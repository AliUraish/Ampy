import { NextResponse } from "next/server";

import { readMistralKey } from "@/lib/mistralKey";
import {
  MAX_PURCHASE_ROUNDS,
  type PurchaseLine,
  type PurchaseTurnRequest,
  type PurchaseTurnResponse,
} from "@/lib/purchase";

/**
 * One round of the purchase simulation: the BUYER agent (Mistral, budget
 * enforced here in code) makes an offer, then the SELLER agent (the Python
 * seller's buyer-contract `/negotiate`, with a local fallback) answers.
 *
 * The client drives rounds one at a time so the chat can render each
 * bubble as it lands. Nothing here places a real order.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const BUYER_TIMEOUT_MS = 20_000;
const SELLER_TIMEOUT_MS = 25_000;
// Hidden floor for the local seller fallback — the Python seller uses the same
// 70%-of-asking default for listings without a minAcceptablePrice.
const LOCAL_SELLER_FLOOR = 0.7;

interface BuyerDecision {
  text: string;
  price: number;
  accept: boolean;
  source: "mistral" | "local";
}

interface SellerDecision {
  text: string;
  price: number | null;
  accepted: boolean;
  walkAway: boolean;
  source: "seller-agent" | "local";
}

interface Context extends PurchaseTurnRequest {
  lastSellerPrice: number;
  lastBuyerPrice: number | null;
  ceiling: number;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as unknown;
  const input = readInput(body);
  if (!input) {
    return NextResponse.json({ error: "Invalid purchase turn." }, { status: 400 });
  }

  const lastSeller = [...input.history].reverse().find((line) => line.role === "seller" && typeof line.price === "number");
  const lastBuyer = [...input.history].reverse().find((line) => line.role === "buyer" && typeof line.price === "number");
  const ctx: Context = {
    ...input,
    lastSellerPrice: lastSeller?.price ?? input.listPrice,
    lastBuyerPrice: lastBuyer?.price ?? null,
    ceiling: 0,
  };
  ctx.ceiling = roundMoney(Math.min(ctx.budget, ctx.lastSellerPrice), ctx.listPrice);

  const buyer = enforceBuyer(await buyerDecision(ctx), ctx);

  if (buyer.accept) {
    const response: PurchaseTurnResponse = {
      buyer: { text: buyer.text, price: ctx.lastSellerPrice, accepted: true },
      seller: null,
      outcome: "deal",
      dealPrice: ctx.lastSellerPrice,
      sources: { buyer: buyer.source, seller: "none" },
    };
    return NextResponse.json(response);
  }

  const seller = await sellerDecision(ctx, buyer);
  const outcome = seller.accepted
    ? "deal"
    : seller.walkAway || ctx.round >= MAX_PURCHASE_ROUNDS
      ? "no_deal"
      : "continue";
  const response: PurchaseTurnResponse = {
    buyer: { text: buyer.text, price: buyer.price, accepted: false },
    seller: {
      text: seller.text,
      price: seller.accepted ? buyer.price : seller.price,
      accepted: seller.accepted,
      walkAway: seller.walkAway,
    },
    outcome,
    dealPrice: seller.accepted ? buyer.price : null,
    sources: { buyer: buyer.source, seller: seller.source },
  };
  return NextResponse.json(response);
}

// --- input ---------------------------------------------------------------

function readInput(body: unknown): PurchaseTurnRequest | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const product = raw.product as Record<string, unknown> | undefined;
  const listPrice = Number(raw.listPrice);
  const budget = Number(raw.budget);
  const round = Number(raw.round);
  if (!product || typeof product.name !== "string" || !product.name.trim()) return null;
  if (!Number.isFinite(listPrice) || listPrice <= 0) return null;
  if (!Number.isFinite(budget) || budget <= 0) return null;
  if (!Number.isInteger(round) || round < 1 || round > MAX_PURCHASE_ROUNDS) return null;
  const history = Array.isArray(raw.history) ? raw.history.flatMap(readLine).slice(-30) : [];
  return {
    product: {
      id: typeof product.id === "string" ? product.id : "product",
      name: product.name.trim().slice(0, 500),
      price: typeof product.price === "string" ? product.price : "",
      retailer: typeof product.retailer === "string" ? product.retailer.slice(0, 200) : "the retailer",
      reason: typeof product.reason === "string" ? product.reason.slice(0, 1000) : "",
      productUrl: typeof product.productUrl === "string" ? product.productUrl : "",
    },
    listPrice,
    budget,
    round,
    history,
  };
}

function readLine(value: unknown): PurchaseLine[] {
  if (!value || typeof value !== "object") return [];
  const line = value as Record<string, unknown>;
  if ((line.role !== "buyer" && line.role !== "seller") || typeof line.text !== "string" || !line.text.trim()) return [];
  const price = typeof line.price === "number" && Number.isFinite(line.price) ? line.price : undefined;
  return [{ role: line.role, text: line.text.slice(0, 4000), price }];
}

// --- buyer agent -----------------------------------------------------------

const BUYER_SYSTEM_PROMPT = [
  "You are a shopper's purchasing agent negotiating the price of a retail product with the seller's agent.",
  "Hard rules: never offer more than the shopper's budget; never offer more than the seller's latest price;",
  "one to three sentences; friendly, specific to the item, no emoji, no invented facts about the product.",
  "Round 1: open clearly below list price (about 70-80% of list, capped at the budget).",
  "Later rounds: raise your offer in small steps toward the seller's latest price; do not jump straight to it.",
  "Set accept to true only when the seller's latest price is within budget AND the seller has held firm or the",
  "remaining gap is small; when accepting, the message confirms the seller's latest price and asks to complete the order.",
  'Return only JSON: {"message": string, "offer": number, "accept": boolean}.',
].join(" ");

async function buyerDecision(ctx: Context): Promise<BuyerDecision> {
  const apiKey = readMistralKey();
  if (!apiKey) return localBuyer(ctx);
  try {
    const transcript = ctx.history.map((line) =>
      `${line.role === "buyer" ? "Buyer agent" : "Seller agent"}${typeof line.price === "number" ? ` ($${line.price})` : ""}: ${line.text}`,
    ).join("\n") || "(no messages yet)";
    const response = await fetch(MISTRAL_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.MISTRAL_MODEL || "mistral-medium-latest",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: BUYER_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `ITEM: ${ctx.product.name}`,
              `RETAILER: ${ctx.product.retailer}`,
              ctx.product.reason ? `WHY THE SHOPPER WANTS IT: ${ctx.product.reason}` : "",
              `LIST PRICE: $${ctx.listPrice}`,
              `SHOPPER BUDGET (hard ceiling): $${ctx.budget}`,
              `SELLER'S LATEST PRICE: $${ctx.lastSellerPrice}`,
              ctx.lastBuyerPrice != null ? `YOUR LAST OFFER: $${ctx.lastBuyerPrice}` : "",
              `ROUND: ${ctx.round} of ${MAX_PURCHASE_ROUNDS}`,
              "",
              "CONVERSATION SO FAR:",
              transcript,
            ].filter((line) => line !== "").join("\n"),
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(BUYER_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`mistral ${response.status}`);
    const payload = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("empty completion");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    const offer = Number(parsed.offer);
    if (!message || !Number.isFinite(offer)) throw new Error("unusable completion");
    return { text: message, price: offer, accept: parsed.accept === true, source: "mistral" };
  } catch {
    return localBuyer(ctx);
  }
}

function localBuyer(ctx: Context): BuyerDecision {
  const { product, listPrice, round, lastSellerPrice, lastBuyerPrice, ceiling, budget } = ctx;
  if (round === 1) {
    const price = Math.min(ceiling, roundMoney(listPrice * 0.75, listPrice));
    return {
      text: `Hi! I'm interested in the ${product.name}. Would you take $${price}? I can complete the order right away.`,
      price,
      accept: false,
      source: "local",
    };
  }
  const previous = lastBuyerPrice ?? roundMoney(listPrice * 0.75, listPrice);
  const withinBudget = lastSellerPrice <= budget;
  if (withinBudget && (round >= 3 || lastSellerPrice <= previous * 1.08)) {
    return { text: `Alright, $${lastSellerPrice} works for me — let's get the order done.`, price: lastSellerPrice, accept: true, source: "local" };
  }
  const price = Math.min(ceiling, roundMoney(previous + (lastSellerPrice - previous) * 0.5, listPrice));
  return {
    text: `I can stretch to $${price} for the ${product.name} if we can wrap this up today.`,
    price,
    accept: false,
    source: "local",
  };
}

/** The prompt is a request; this is the guarantee. */
function enforceBuyer(decision: BuyerDecision, ctx: Context): BuyerDecision {
  const { round, budget, listPrice, lastSellerPrice, lastBuyerPrice, ceiling } = ctx;
  let price = roundMoney(clamp(decision.price, 1, ceiling), listPrice);
  if (round === 1) {
    // Open below list unless the budget itself is lower; never an insulting lowball.
    price = Math.min(price, roundMoney(listPrice * 0.9, listPrice), ceiling);
    price = Math.max(price, Math.min(ceiling, roundMoney(listPrice * 0.5, listPrice)));
  } else if (lastBuyerPrice != null && price < lastBuyerPrice) {
    // Offers only climb.
    price = Math.min(ceiling, lastBuyerPrice);
  }

  const canAccept = round > 1 && lastSellerPrice <= budget;
  const mustAccept = canAccept && (round >= MAX_PURCHASE_ROUNDS || price >= lastSellerPrice);
  const accept = canAccept && (decision.accept || mustAccept);
  if (accept) {
    const text = decision.accept
      ? decision.text
      : `Alright, $${lastSellerPrice} works for me — let's complete the order.`;
    return { ...decision, text, price: lastSellerPrice, accept: true };
  }
  return { ...decision, price, accept: false };
}

// --- seller agent ----------------------------------------------------------

async function sellerDecision(ctx: Context, buyer: BuyerDecision): Promise<SellerDecision> {
  const sellerUrl = (process.env.SELLER_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  try {
    const response = await fetch(`${sellerUrl}/negotiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: `buy_${ctx.product.id}`,
        listingId: ctx.product.id,
        listing: {
          title: ctx.product.name,
          price: ctx.listPrice,
          condition: "new",
          description: `${ctx.product.reason} Sold by ${ctx.product.retailer}.`.trim(),
          category: "retail",
        },
        offer: { price: buyer.price, message: buyer.text },
        round: ctx.round,
        history: [...ctx.history, { role: "buyer", text: buyer.text, price: buyer.price }].slice(-30),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(SELLER_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`seller ${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    if (typeof payload.message !== "string" || !payload.message.trim()) throw new Error("empty seller reply");
    const counter = typeof payload.counterPrice === "number" && Number.isFinite(payload.counterPrice)
      ? roundMoney(payload.counterPrice, ctx.listPrice)
      : null;
    return {
      text: payload.message.trim(),
      price: counter,
      accepted: payload.accepted === true,
      walkAway: payload.walkAway === true,
      source: "seller-agent",
    };
  } catch {
    return localSeller(ctx, buyer);
  }
}

function localSeller(ctx: Context, buyer: BuyerDecision): SellerDecision {
  const { product, listPrice, round } = ctx;
  const floor = roundMoney(listPrice * LOCAL_SELLER_FLOOR, listPrice);
  // Concede slowly: 96% of list on round 1 down toward the floor.
  const minimumThisTurn = Math.max(floor, roundMoney(listPrice * (0.96 - 0.04 * (round - 1)), listPrice));
  if (buyer.price >= minimumThisTurn) {
    return {
      text: `Deal — $${buyer.price} works for the ${product.name}. I'll get the order ready for you.`,
      price: buyer.price,
      accepted: true,
      walkAway: false,
      source: "local",
    };
  }
  if (buyer.price < floor * 0.6) {
    return {
      text: `I appreciate the interest, but that's too far below what I can do on the ${product.name}. If you can get closer to $${listPrice}, I'm happy to keep talking.`,
      price: null,
      accepted: false,
      walkAway: true,
      source: "local",
    };
  }
  const counters = [
    `Thanks for the interest in the ${product.name}. I understand where you're coming from, but that's lower than I can go — I could do $${minimumThisTurn}. Want me to hold one for you?`,
    `I hear you. The best I can do right now is $${minimumThisTurn} — it's in high demand and ships from ${product.retailer} today.`,
    `I can come down a little more to $${minimumThisTurn}, but that's about where I need to be on this one.`,
    `$${minimumThisTurn} is really the lowest I can go and still make this work. Shall we finish it up?`,
    `Final answer from my side: $${minimumThisTurn}. Happy to complete the order at that.`,
  ];
  return {
    text: counters[Math.min(round, counters.length) - 1],
    price: minimumThisTurn,
    accepted: false,
    walkAway: false,
    source: "local",
  };
}

// --- helpers ---------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Whole dollars for anything that isn't cheap; cents for small-ticket items. */
function roundMoney(value: number, listPrice: number): number {
  return listPrice >= 50 ? Math.round(value) : Math.round(value * 100) / 100;
}
