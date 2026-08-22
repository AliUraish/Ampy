import { ampyApi } from "@/lib/ampy";
import { isProductSearchResponse, type Product } from "@/lib/products";
import type { PromptMode } from "@/components/ui/ai-prompt-box";

export type AgentKind = "discover" | "deals" | "seller" | "buyer";

export function agentForMode(mode: PromptMode | null): AgentKind {
  if (mode === "search") return "deals";
  if (mode === "think") return "seller";
  if (mode === "canvas") return "buyer";
  return "discover";
}

export function agentLabel(kind: AgentKind): string {
  switch (kind) {
    case "discover":
      return "Product discovery";
    case "deals":
      return "Deal Finder";
    case "seller":
      return "Seller agent";
    case "buyer":
      return "Buyer agent";
  }
}

export interface DealCard {
  id: string;
  title: string;
  price: number | null;
  score?: number;
  url?: string;
  imageUrl?: string | null;
  location?: string;
  why?: string;
}

export interface ChatTurn {
  id: string;
  role: "user" | "agent";
  agent?: AgentKind;
  text: string;
  products?: Product[];
  deals?: DealCard[];
  logs?: string[];
  valuation?: {
    listPrice?: number;
    floor?: number;
    low?: number;
    high?: number;
    rationale?: string;
  };
}

async function readSsePost(
  url: string,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Request failed (${response.status})`);
  }
  if (!response.body) throw new Error("No stream from buyer agent.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (!raw) continue;
      try {
        onEvent(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        // ignore malformed frames
      }
    }
  }
}

export async function runDiscoverAgent(query: string, signal: AbortSignal): Promise<{ message: string; products: Product[] }> {
  const response = await fetch(ampyApi.products, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  const payload = await response.json() as unknown;
  if (!response.ok || !isProductSearchResponse(payload)) {
    const apiError = payload as { error?: string };
    throw new Error(typeof apiError.error === "string" ? apiError.error : "Product search failed.");
  }
  return { message: payload.agentMessage, products: payload.products };
}

function toDealCard(data: Record<string, unknown>, fallbackId: string): DealCard {
  const dealMeta = (data.deal || {}) as Record<string, unknown>;
  return {
    id: String(data.id || fallbackId),
    title: String(data.title || "Listing"),
    price: typeof data.price === "number" ? data.price : null,
    score: typeof dealMeta.score === "number" ? dealMeta.score : undefined,
    url: typeof data.url === "string" ? data.url : undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : null,
    location: typeof data.location === "string"
      ? data.location
      : typeof data.market === "string"
        ? data.market
        : undefined,
    why: typeof dealMeta.why === "string"
      ? dealMeta.why
      : typeof dealMeta.headline === "string"
        ? dealMeta.headline
        : typeof data.description === "string"
          ? data.description
          : undefined,
  };
}

export async function runDealFinderAgent(
  query: string,
  signal: AbortSignal,
  onLog: (line: string) => void,
): Promise<{ message: string; deals: DealCard[] }> {
  const params = new URLSearchParams({
    query,
    category: "general",
    location: "us",
    fast: "1",
  });
  const source = new EventSource(`${ampyApi.dealFinder.deals}?${params.toString()}`);

  return await new Promise((resolve, reject) => {
    const deals: DealCard[] = [];
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      if (deals.length > 0) {
        settled = true;
        cleanup();
        resolve({
          message: `Found ${deals.length} live listings before the scan timed out.`,
          deals: deals.slice(0, 8),
        });
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Deal Finder timed out while scraping Craigslist."));
    }, 90_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      source.close();
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);

    source.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { stage?: string; market?: string; count?: number; message?: string };
        if (data.stage === "market" && data.market) {
          onLog(`${data.market}${typeof data.count === "number" ? ` · ${data.count} listings` : ""}`);
        } else if (data.message) {
          onLog(data.message);
        } else if (data.stage) {
          onLog(data.stage);
        }
      } catch {
        // ignore
      }
    });

    source.addEventListener("deal", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
        deals.push(toDealCard(data, `${deals.length}-${data.title}`));
        onLog(`Deal: ${String(data.title || "")}`);
      } catch {
        // ignore
      }
    });

    source.addEventListener("done", () => {
      if (settled) return;
      settled = true;
      cleanup();
      const top = [...deals].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 8);
      resolve({
        message: top.length
          ? `Found ${top.length} underpriced opportunities.`
          : "No strong deals in this pass — try a tighter niche or higher budget.",
        deals: top,
      });
    });

    source.addEventListener("error", (event) => {
      if (settled) return;
      // EventSource also fires error on normal close in some browsers; prefer message payload when present.
      try {
        const data = JSON.parse((event as MessageEvent).data) as { message?: string };
        if (data.message) {
          settled = true;
          cleanup();
          reject(new Error(data.message));
          return;
        }
      } catch {
        // fall through
      }
      if (source.readyState === EventSource.CLOSED && deals.length > 0) {
        settled = true;
        cleanup();
        resolve({
          message: `Found ${deals.length} opportunities before the stream closed.`,
          deals: deals.slice(0, 8),
        });
        return;
      }
      if (source.readyState === EventSource.CLOSED) {
        settled = true;
        cleanup();
        reject(new Error("Deal Finder stream failed. Is the deal-finder API running on :4747?"));
      }
    });
  });
}

export async function runSellerAgent(query: string, signal: AbortSignal): Promise<{
  message: string;
  valuation: ChatTurn["valuation"];
}> {
  const response = await fetch(ampyApi.seller.value, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_description: query,
      condition: "good",
      currency: "USD",
      purchase_cost: 0,
      minimum_margin_pct: 20,
    }),
    signal,
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const detail = payload.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => (typeof item === "object" && item && "msg" in item ? String((item as { msg: unknown }).msg) : JSON.stringify(item))).join("; ")
          : "Seller valuation failed.";
    throw new Error(message);
  }

  const listPrice = Number(payload.recommended_list_price);
  const floor = Number(payload.protected_floor_price);
  const low = Number(payload.low_value);
  const high = Number(payload.high_value);
  const rationale = typeof payload.rationale === "string" ? payload.rationale : undefined;

  return {
    message: `List around $${listPrice.toFixed(0)} (floor $${floor.toFixed(0)}). Range $${low.toFixed(0)}–$${high.toFixed(0)}.`,
    valuation: { listPrice, floor, low, high, rationale },
  };
}

export async function runBuyerAgent(
  query: string,
  signal: AbortSignal,
  onLog: (line: string) => void,
): Promise<{ message: string; logs: string[]; deals: DealCard[] }> {
  const logs: string[] = [];
  let recommendation = "";
  let deals: DealCard[] = [];

  await readSsePost(
    ampyApi.buyer.agentRun,
    { request: query, allowContact: false },
    signal,
    (event) => {
      const type = String(event.type || "");
      if (type === "thinking" && event.text) {
        const line = String(event.text);
        logs.push(line);
        onLog(line);
      } else if (type === "search") {
        onLog(`search: ${String(event.query || "")}`);
      } else if (type === "search_result") {
        onLog(`found ${String(event.count ?? "?")} listings`);
      } else if (type === "listings" && Array.isArray(event.listings)) {
        deals = (event.listings as Record<string, unknown>[]).map((listing, index) =>
          toDealCard(listing, String(listing.id || index)),
        );
        onLog(`shortlist ready · ${deals.length} listings`);
      } else if (type === "open_listing") {
        onLog(`open: ${String(event.title || event.listingId || "")}`);
      } else if (type === "contacting" || type === "contacted" || type === "negotiating" || type === "negotiated") {
        onLog(`${type}: ${String(event.title || event.listingId || "")}`);
      } else if (type === "done" || type === "result") {
        recommendation = String(event.summary || event.recommendation || event.message || recommendation || "Buyer agent finished.");
        if (Array.isArray(event.listings) && event.listings.length && deals.length === 0) {
          deals = (event.listings as Record<string, unknown>[]).map((listing, index) =>
            toDealCard(listing, String(listing.id || index)),
          );
        }
      } else if (type === "error") {
        throw new Error(String(event.error || "Buyer agent error"));
      } else if (type === "warning") {
        onLog(`warning: ${String(event.error || event.source || "warning")}`);
      } else if (event.message) {
        const line = String(event.message);
        logs.push(line);
        onLog(line);
      }
    },
  );

  return {
    message: recommendation || (deals.length
      ? `Found ${deals.length} live listings.`
      : logs.length ? "Buyer agent finished." : "Buyer agent returned no recommendation."),
    logs: logs.slice(-12),
    deals,
  };
}
