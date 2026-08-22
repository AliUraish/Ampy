import { NextResponse } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const SELLER_TIMEOUT_MS = 20_000;
const COMPS_TIMEOUT_MS = 25_000;

interface Listing {
  title?: string;
  price?: number;
  url?: string;
  location?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const raw = await request.text();
  const parsed = parseBody(raw);

  const sellerResult = await trySeller(raw);
  if (sellerResult) return sellerResult;

  try {
    const fallback = await compsValuation(parsed);
    return NextResponse.json(fallback);
  } catch (error: unknown) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Seller valuation failed." },
      { status: 502 },
    );
  }
}

function parseBody(raw: string): { item: string; purchaseCost: number; marginPct: number } {
  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    return {
      item: typeof body.item_description === "string" ? body.item_description.trim() : "",
      purchaseCost: Number(body.purchase_cost) || 0,
      marginPct: Number(body.minimum_margin_pct) || 20,
    };
  } catch {
    return { item: "", purchaseCost: 0, marginPct: 20 };
  }
}

async function trySeller(body: string): Promise<NextResponse | null> {
  const seller = process.env.SELLER_URL || "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${seller}/seller/value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(SELLER_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const text = await response.text();
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return null;
  }
}

async function compsValuation({
  item,
  purchaseCost,
  marginPct,
}: {
  item: string;
  purchaseCost: number;
  marginPct: number;
}) {
  if (item.length < 3) throw new Error("Describe the item to value.");

  const buyer = process.env.BUYER_URL || "http://127.0.0.1:3001";
  let listings: Listing[] = [];
  for (const query of searchFallbacks(item)) {
    const response = await fetch(
      `${buyer}/api/search?${new URLSearchParams({ q: query, limit: "20" }).toString()}`,
      { cache: "no-store", signal: AbortSignal.timeout(COMPS_TIMEOUT_MS) },
    );
    if (!response.ok) continue;
    const payload = await response.json() as { listings?: Listing[] };
    listings = (payload.listings || []).filter((listing) => {
      const price = Number(listing.price);
      return Number.isFinite(price) && price > 0;
    });
    if (listings.length) break;
  }
  const prices = listings.map((listing) => Number(listing.price)).sort((a, b) => a - b);
  if (!prices.length) throw new Error("No priced Craigslist comps found. Try a more specific item.");

  const median = prices[Math.floor(prices.length / 2)];
  const low = prices[Math.max(0, Math.floor((prices.length - 1) * 0.25))];
  const high = prices[Math.min(prices.length - 1, Math.ceil((prices.length - 1) * 0.75))];
  const marginFloor = Math.round(purchaseCost * (1 + marginPct / 100));
  const floor = Math.round(Math.max(low * 0.85, marginFloor, 1));
  const list = Math.round(Math.max(median, floor));

  return {
    currency: "USD",
    low_value: low,
    high_value: high,
    quick_sale_value: low,
    recommended_list_price: list,
    protected_floor_price: floor,
    estimated_profit_at_floor: Math.round(floor - purchaseCost),
    viable_at_requested_margin: high >= marginFloor,
    confidence: Math.min(80, 28 + prices.length * 4),
    rationale: `Priced from ${prices.length} live Craigslist comps. Median ask $${median}. List near the median; do not go below the floor.`,
    source: "craigslist_comps",
    comparables: listings.slice(0, 6).map((listing) => ({
      title: listing.title || "Listing",
      price: Number(listing.price),
      url: listing.url || "https://craigslist.org",
      notes: listing.location || "",
    })),
  };
}

function searchFallbacks(item: string): string[] {
  const cleaned = item.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter((word) => word.length > 2 && !/^\d+$/.test(word));
  const withoutModels = words.filter((word) => !/\d/.test(word));
  const queries = [cleaned];
  if (withoutModels.length >= 2) queries.push(withoutModels.join(" "));
  if (words.length > 2) queries.push(words.slice(-2).join(" "));
  if (words.length) queries.push(words[words.length - 1]);
  return [...new Set(queries.filter(Boolean))];
}
