import { NextResponse } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const SELLER_TIMEOUT_MS = 110_000;

export async function POST(request: Request): Promise<NextResponse> {
  const seller = process.env.SELLER_URL || "http://127.0.0.1:8000";
  const body = await request.text();

  try {
    const response = await fetch(`${seller}/seller/value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(SELLER_TIMEOUT_MS),
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { detail: timedOut ? "Seller valuation timed out. Try again." : "Seller agent is unreachable." },
      { status: timedOut ? 504 : 503 },
    );
  }
}
