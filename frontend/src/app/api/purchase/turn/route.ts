import { NextResponse } from "next/server";

import { buyerContext, buyerDecision, readLines, sellerContractDecision } from "@/lib/server/agents";
import { MAX_PURCHASE_ROUNDS, type PurchaseTurnRequest, type PurchaseTurnResponse } from "@/lib/purchase";

/**
 * One round of the reseller's PURCHASE: our buyer agent offers, the retailer's
 * seller agent answers. The client drives rounds so every bubble renders as it
 * lands. Nothing here places a real order.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as unknown;
  const input = readInput(body);
  if (!input) return NextResponse.json({ error: "Invalid purchase turn." }, { status: 400 });

  const ctx = buyerContext({
    item: {
      id: input.product.id,
      name: input.product.name,
      description: input.product.reason,
      retailer: input.product.retailer,
    },
    listPrice: input.listPrice,
    budget: input.budget,
    round: input.round,
    maxRounds: MAX_PURCHASE_ROUNDS,
    history: input.history,
  });

  const buyer = await buyerDecision(ctx);
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

  const seller = await sellerContractDecision(ctx, buyer);
  const outcome = seller.accepted
    ? "deal"
    : seller.walkAway || ctx.round >= MAX_PURCHASE_ROUNDS
      ? "no_deal"
      : "continue";
  const response: PurchaseTurnResponse = {
    buyer: { text: buyer.text, price: buyer.price, accepted: false },
    seller: { text: seller.text, price: seller.price, accepted: seller.accepted, walkAway: seller.walkAway },
    outcome,
    dealPrice: seller.accepted ? buyer.price : null,
    sources: { buyer: buyer.source, seller: seller.source },
  };
  return NextResponse.json(response);
}

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
    history: readLines(raw.history),
  };
}
