import { NextResponse } from "next/server";

import { ampyApi } from "@/lib/ampy";

export const dynamic = "force-dynamic";

async function ping(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return { ok: res.ok, status: res.status };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : "unreachable" };
  }
}

/**
 * Stack health for the merged Ampy app. Uses absolute backend URLs from env
 * (rewrites only apply to browser → Next, not Next → Next).
 */
export async function GET(): Promise<NextResponse> {
  const buyer = process.env.BUYER_URL || "http://127.0.0.1:3001";
  const seller = process.env.SELLER_URL || "http://127.0.0.1:8000";
  const dealFinder = process.env.DEAL_FINDER_URL || "http://127.0.0.1:4747";

  const [buyerHealth, sellerHealth, dealFinderHealth] = await Promise.all([
    ping(`${buyer}/`),
    ping(`${seller}/health`),
    ping(`${dealFinder}/health`),
  ]);

  const body = {
    frontend: { ok: true, routes: ampyApi },
    buyer: buyerHealth,
    seller: sellerHealth,
    dealFinder: dealFinderHealth,
  };

  const ok = buyerHealth.ok && sellerHealth.ok && dealFinderHealth.ok;
  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
