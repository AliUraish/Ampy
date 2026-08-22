import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const seller = process.env.SELLER_URL || "http://127.0.0.1:8000";
  const body = await request.text();

  try {
    const response = await fetch(`${seller}/events/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(18_000),
    });
    if (!response.ok) {
      return NextResponse.json({ opportunities: [], notes: ["Event scout is rate-limited; flip deals still available."] });
    }
    const payload = await response.json();
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ opportunities: [], notes: ["Event scout unavailable; flip deals still available."] });
  }
}
