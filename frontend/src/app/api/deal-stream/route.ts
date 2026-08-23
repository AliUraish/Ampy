import type { NextRequest } from "next/server";

/**
 * Streams backend/deal-finder's `/api/deals` SSE to the browser unchanged.
 *
 * Why not the `/api/deals` rewrite? Browsers advertise gzip, and Next's
 * compression layer then buffers the proxied event stream until the scan
 * ends. `Cache-Control: no-transform` opts this response out of compression
 * so every event is flushed as the backend emits it. The backend is untouched.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<Response> {
  const dealFinder = (process.env.DEAL_FINDER_URL || "http://127.0.0.1:4747").replace(/\/+$/, "");
  const upstream = await fetch(`${dealFinder}/api/deals?${request.nextUrl.searchParams.toString()}`, {
    headers: { Accept: "text/event-stream" },
    cache: "no-store",
    signal: request.signal,
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
