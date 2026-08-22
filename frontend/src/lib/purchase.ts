import type { Product } from "@/lib/products";

/** One bubble in the buyer-agent vs seller-agent purchase chat. */
export interface PurchaseLine {
  role: "buyer" | "seller";
  text: string;
  price?: number;
}

export type PurchaseOutcome = "continue" | "deal" | "no_deal";

export type PurchaseProduct = Pick<Product, "id" | "name" | "price" | "retailer" | "reason" | "productUrl">;

export interface PurchaseTurnRequest {
  product: PurchaseProduct;
  /** Listed price the seller agent defends. */
  listPrice: number;
  /** Shopper's hard ceiling — enforced server-side, the buyer agent cannot exceed it. */
  budget: number;
  round: number;
  history: PurchaseLine[];
}

export interface PurchaseTurnResponse {
  buyer: { text: string; price: number; accepted: boolean };
  seller: { text: string; price: number | null; accepted: boolean; walkAway: boolean } | null;
  outcome: PurchaseOutcome;
  dealPrice: number | null;
  sources: { buyer: "mistral" | "local"; seller: "seller-agent" | "local" | "none" };
}

export interface PurchaseReceipt {
  orderId: string;
  productId: string;
  name: string;
  retailer: string;
  productUrl: string;
  imageUrl: string;
  listPrice: number;
  finalPrice: number;
  saved: number;
  rounds: number;
  purchasedAt: string;
  simulated: true;
}

export const MAX_PURCHASE_ROUNDS = 5;

/** "$1,299.00", "299.99 USD", "from $49" → number. "Check price" → null. */
export function parsePrice(value: string): number | null {
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export async function runPurchaseTurn(body: PurchaseTurnRequest, signal: AbortSignal): Promise<PurchaseTurnResponse> {
  const response = await fetch("/api/purchase/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => null) as PurchaseTurnResponse | { error?: string } | null;
  if (!response.ok || !payload || !("buyer" in payload)) {
    const message = payload && "error" in payload && typeof payload.error === "string" ? payload.error : "Purchase negotiation failed.";
    throw new Error(message);
  }
  return payload;
}
