/**
 * Server-only negotiation agents shared by /api/purchase/turn (reseller buys
 * from a retailer) and /api/sell/turn (a seller agent sells to buyers).
 *
 *   BUYER agent   Mistral chat completion, JSON mode. The shopper's budget is
 *                 enforced HERE in code after the model answers — the prompt is
 *                 a request, this file is the guarantee.
 *   SELLER agent  The Python seller service (backend/seller):
 *                   - buyer-contract `/negotiate` for a retailer we have no
 *                     floor for (it hides one at ~70% of asking), and
 *                   - internal `/seller/negotiate` when the seller is OUR user
 *                     and gave explicit upper/lower bounds.
 *                 Both degrade to a deterministic local seller if the service
 *                 is down or the Mistral key is missing, so the UI never stalls.
 */
import { readMistralKey } from "@/lib/mistralKey";
import { extractOffer } from "@/lib/negotiateLocal";

export interface AgentItem {
  id: string;
  name: string;
  description: string;
  retailer?: string;
}

export interface Line {
  role: "buyer" | "seller";
  text: string;
  price?: number;
}

export interface BuyerContext {
  item: AgentItem;
  listPrice: number;
  budget: number;
  round: number;
  maxRounds: number;
  history: Line[];
  lastSellerPrice: number;
  lastBuyerPrice: number | null;
  ceiling: number;
}

export interface BuyerDecision {
  text: string;
  price: number;
  accept: boolean;
  source: "mistral" | "local";
}

export interface SellerDecision {
  text: string;
  price: number | null;
  accepted: boolean;
  walkAway: boolean;
  action: "accept" | "counter" | "hold" | "walk_away" | "ask_question";
  guardrailApplied: boolean;
  source: "seller-agent" | "local";
}

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const BUYER_TIMEOUT_MS = 20_000;
const SELLER_TIMEOUT_MS = 25_000;
const LOCAL_RETAIL_FLOOR = 0.7;

export function sellerUrl(): string {
  return (process.env.SELLER_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export function buyerContext(args: {
  item: AgentItem;
  listPrice: number;
  budget: number;
  round: number;
  maxRounds: number;
  history: Line[];
}): BuyerContext {
  const lastSeller = [...args.history].reverse().find((line) => line.role === "seller" && typeof line.price === "number");
  const lastBuyer = [...args.history].reverse().find((line) => line.role === "buyer" && typeof line.price === "number");
  const lastSellerPrice = lastSeller?.price ?? args.listPrice;
  return {
    ...args,
    lastSellerPrice,
    lastBuyerPrice: lastBuyer?.price ?? null,
    ceiling: roundMoney(Math.min(args.budget, lastSellerPrice), args.listPrice),
  };
}

// --- buyer agent -------------------------------------------------------------

const BUYER_SYSTEM_PROMPT = [
  "You are a shopper's purchasing agent negotiating the price of an item with the seller.",
  "Hard rules: never offer more than the shopper's budget; never offer more than the seller's latest price;",
  "one to three sentences; friendly, specific to the item, no emoji, no invented facts about the item.",
  "Round 1: open clearly below the asking price (about 70-80% of it, capped at the budget).",
  "Later rounds: raise your offer in small steps toward the seller's latest price; do not jump straight to it.",
  "Set accept to true only when the seller's latest price is within budget AND the seller has held firm or the",
  "remaining gap is small; when accepting, confirm the seller's latest price and ask to complete the deal.",
  "The offer number in your JSON must be the same number you write in the message.",
  'Return only JSON: {"message": string, "offer": number, "accept": boolean}.',
].join(" ");

export async function buyerDecision(ctx: BuyerContext): Promise<BuyerDecision> {
  const raw = await buyerDraft(ctx);
  return enforceBuyer(raw, ctx);
}

async function buyerDraft(ctx: BuyerContext): Promise<BuyerDecision> {
  const apiKey = readMistralKey();
  if (!apiKey) return localBuyer(ctx);
  try {
    const transcript = ctx.history.map((line) =>
      `${line.role === "buyer" ? "Buyer" : "Seller"}${typeof line.price === "number" ? ` ($${line.price})` : ""}: ${line.text}`,
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
              `ITEM: ${ctx.item.name}`,
              ctx.item.retailer ? `SELLER: ${ctx.item.retailer}` : "",
              ctx.item.description ? `ABOUT THE ITEM: ${ctx.item.description}` : "",
              `ASKING PRICE: $${ctx.listPrice}`,
              `SHOPPER BUDGET (hard ceiling): $${ctx.budget}`,
              `SELLER'S LATEST PRICE: $${ctx.lastSellerPrice}`,
              ctx.lastBuyerPrice != null ? `YOUR LAST OFFER: $${ctx.lastBuyerPrice}` : "",
              `ROUND: ${ctx.round} of ${ctx.maxRounds}`,
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

function localBuyer(ctx: BuyerContext): BuyerDecision {
  const { item, listPrice, round, lastSellerPrice, lastBuyerPrice, ceiling, budget } = ctx;
  if (round === 1) {
    const price = Math.min(ceiling, roundMoney(listPrice * 0.75, listPrice));
    return {
      text: `Hi! I'm interested in the ${item.name}. Would you take $${price}? I can pay right away.`,
      price,
      accept: false,
      source: "local",
    };
  }
  const previous = lastBuyerPrice ?? roundMoney(listPrice * 0.75, listPrice);
  if (lastSellerPrice <= budget && (round >= 3 || lastSellerPrice <= previous * 1.08)) {
    return { text: `Alright, $${lastSellerPrice} works for me — let's do it.`, price: lastSellerPrice, accept: true, source: "local" };
  }
  const price = Math.min(ceiling, roundMoney(previous + (lastSellerPrice - previous) * 0.5, listPrice));
  return {
    text: `I can stretch to $${price} for the ${item.name} if we can wrap this up today.`,
    price,
    accept: false,
    source: "local",
  };
}

function enforceBuyer(decision: BuyerDecision, ctx: BuyerContext): BuyerDecision {
  const { round, budget, listPrice, lastSellerPrice, lastBuyerPrice, ceiling, maxRounds } = ctx;
  let price = roundMoney(clamp(decision.price, 1, ceiling), listPrice);
  if (round === 1) {
    price = Math.min(price, roundMoney(listPrice * 0.9, listPrice), ceiling);
    price = Math.max(price, Math.min(ceiling, roundMoney(listPrice * 0.5, listPrice)));
  } else if (lastBuyerPrice != null && price < lastBuyerPrice) {
    price = Math.min(ceiling, lastBuyerPrice);
  }

  const canAccept = round > 1 && lastSellerPrice <= budget;
  const mustAccept = canAccept && (round >= maxRounds || price >= lastSellerPrice);
  const accept = canAccept && (decision.accept || mustAccept);
  if (accept) {
    const text = decision.accept
      ? syncPriceInText(decision.text, lastSellerPrice)
      : `Alright, $${lastSellerPrice} works for me — let's complete the deal.`;
    return { ...decision, text, price: lastSellerPrice, accept: true };
  }
  return { ...decision, text: syncPriceInText(decision.text, price), price, accept: false };
}

/**
 * The model sometimes writes one number and returns another, and enforcement
 * can move the offer. Whatever the text says must be the offer we actually
 * make, so rewrite any dollar amount in the message that disagrees with it.
 */
export function syncPriceInText(text: string, price: number): string {
  const amounts = Array.from(text.matchAll(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/g));
  if (!amounts.length) return text;
  const differs = amounts.some((match) => Math.abs(Number(match[1].replace(/,/g, "")) - price) > 0.5);
  return differs ? text.replace(/\$\s?\d[\d,]*(?:\.\d{1,2})?/g, `$${price}`) : text;
}

// --- seller agent: retailer we have no floor for (buyer contract) -------------

export async function sellerContractDecision(
  ctx: BuyerContext,
  buyer: BuyerDecision,
): Promise<SellerDecision> {
  try {
    const response = await fetch(`${sellerUrl()}/negotiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: `buy_${ctx.item.id}`,
        listingId: ctx.item.id,
        listing: {
          title: ctx.item.name,
          price: ctx.listPrice,
          condition: "new",
          description: `${ctx.item.description} Sold by ${ctx.item.retailer || "the retailer"}.`.trim(),
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
    const accepted = payload.accepted === true;
    const walkAway = payload.walkAway === true;
    const counter = typeof payload.counterPrice === "number" && Number.isFinite(payload.counterPrice)
      ? roundMoney(payload.counterPrice, ctx.listPrice)
      : null;
    return {
      text: payload.message.trim(),
      price: accepted ? buyer.price : counter,
      accepted,
      walkAway,
      action: accepted ? "accept" : walkAway ? "walk_away" : "counter",
      guardrailApplied: false,
      source: "seller-agent",
    };
  } catch {
    return localSeller({
      item: ctx.item,
      listPrice: ctx.listPrice,
      floorPrice: roundMoney(ctx.listPrice * LOCAL_RETAIL_FLOOR, ctx.listPrice),
      round: ctx.round,
      offer: buyer.price,
      lastSellerPrice: ctx.lastSellerPrice,
    });
  }
}

// --- seller agent: our own user with explicit bounds (internal API) -----------

export interface SellerBoundsContext {
  item: AgentItem;
  listPrice: number;
  floorPrice: number;
  round: number;
  history: Line[];
  buyerMessage: string;
}

export function targetPrice(listPrice: number, floorPrice: number): number {
  return clamp(roundMoney(listPrice * 0.9, listPrice), floorPrice, listPrice);
}

export async function sellerBoundsDecision(ctx: SellerBoundsContext): Promise<SellerDecision> {
  const offer = extractOffer(ctx.buyerMessage);
  const lastSeller = [...ctx.history].reverse().find((line) => line.role === "seller" && typeof line.price === "number");
  const lastSellerPrice = lastSeller?.price ?? ctx.listPrice;
  try {
    const response = await fetch(`${sellerUrl()}/seller/negotiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_description: `${ctx.item.name}. ${ctx.item.description}`.trim().slice(0, 4000),
        buyer_message: ctx.buyerMessage.slice(0, 4000),
        listing_price: ctx.listPrice,
        target_price: targetPrice(ctx.listPrice, ctx.floorPrice),
        floor_price: ctx.floorPrice,
        currency: "USD",
        turn_number: clamp(ctx.round, 1, 50),
        conversation: ctx.history.slice(-30).map((line) => ({ role: line.role, content: line.text.slice(0, 4000) })),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(SELLER_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`seller ${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";
    const action = String(payload.action || "counter") as SellerDecision["action"];
    const recommended = Number(payload.recommended_price);
    if (!reply || !Number.isFinite(recommended)) throw new Error("unusable seller reply");
    const accepted = action === "accept";
    return {
      text: reply,
      price: accepted ? (offer ?? roundMoney(recommended, ctx.listPrice)) : roundMoney(recommended, ctx.listPrice),
      accepted,
      walkAway: action === "walk_away",
      action,
      guardrailApplied: payload.guardrail_applied === true,
      source: "seller-agent",
    };
  } catch {
    if (offer == null) {
      return {
        text: "Hey! Yes, it's still available. Happy to answer any questions — what would you like to know?",
        price: lastSellerPrice,
        accepted: false,
        walkAway: false,
        action: "ask_question",
        guardrailApplied: false,
        source: "local",
      };
    }
    return localSeller({
      item: ctx.item,
      listPrice: ctx.listPrice,
      floorPrice: ctx.floorPrice,
      round: ctx.round,
      offer,
      lastSellerPrice,
    });
  }
}

// --- local seller fallback ------------------------------------------------------

function localSeller(args: {
  item: AgentItem;
  listPrice: number;
  floorPrice: number;
  round: number;
  offer: number;
  lastSellerPrice: number;
}): SellerDecision {
  const { item, listPrice, floorPrice, round, offer, lastSellerPrice } = args;
  // Same shape as the Python seller: six turns to approach the target, then
  // slowly toward the floor.
  const target = targetPrice(listPrice, floorPrice);
  const minimumThisTurn = round <= 6
    ? listPrice - (listPrice - target) * (round / 6)
    : target - (target - floorPrice) * Math.min((round - 6) / 5, 1);
  const step = listPrice >= 100 ? 5 : 1;
  const human = Math.max(floorPrice, Math.round(minimumThisTurn / step) * step);
  const counter = Math.min(lastSellerPrice, roundMoney(human, listPrice));

  if (offer >= counter) {
    return {
      text: `Deal — $${offer} works for the ${item.name}. Let's get it sorted.`,
      price: offer,
      accepted: true,
      walkAway: false,
      action: "accept",
      guardrailApplied: false,
      source: "local",
    };
  }
  if (offer < floorPrice * 0.5) {
    return {
      text: `Sorry, we're too far apart for me to negotiate from that number. If you have a serious cash offer closer to $${listPrice}, feel free to send it.`,
      price: lastSellerPrice,
      accepted: false,
      walkAway: true,
      action: "walk_away",
      guardrailApplied: false,
      source: "local",
    };
  }
  const counters = [
    `Thanks for the interest in the ${item.name}. I understand where you're coming from, but that's lower than I can go — I could do $${counter}. Want me to hold it for you?`,
    `I hear you. The best I can do right now is $${counter}; it's in good shape and ready to go whenever you are.`,
    `I can come down a little more to $${counter}, but that's about where I need to be on this one.`,
    `$${counter} is really the lowest I can go and still make this worth it. Shall we finish it up?`,
    `Final answer from my side: $${counter}. Happy to close at that.`,
  ];
  return {
    text: counters[Math.min(round, counters.length) - 1],
    price: counter,
    accepted: false,
    walkAway: false,
    action: "counter",
    guardrailApplied: false,
    source: "local",
  };
}

// --- helpers --------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Whole dollars for anything that isn't cheap; cents for small-ticket items. */
export function roundMoney(value: number, listPrice: number): number {
  return listPrice >= 50 ? Math.round(value) : Math.round(value * 100) / 100;
}

export function readLines(value: unknown): Line[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Line[] => {
    if (!entry || typeof entry !== "object") return [];
    const line = entry as Record<string, unknown>;
    if ((line.role !== "buyer" && line.role !== "seller") || typeof line.text !== "string" || !line.text.trim()) return [];
    const price = typeof line.price === "number" && Number.isFinite(line.price) ? line.price : undefined;
    return [{ role: line.role, text: line.text.slice(0, 4000), price }];
  }).slice(-30);
}
