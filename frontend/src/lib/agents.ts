import { ampyApi } from "@/lib/ampy";
import { mockScrapedCalendar, type EventCard } from "@/lib/calendar";
import { extractOffer, runOpeningNegotiation, sellerTurn, type NegotiationLine } from "@/lib/negotiateLocal";
import { isProductSearchResponse, type Product } from "@/lib/products";
import type { PromptMode } from "@/components/ui/ai-prompt-box";

export type { EventCard, NegotiationLine };

export type AgentKind = "discover" | "deals" | "reseller" | "seller" | "buyer";

export function agentForMode(mode: PromptMode | null): AgentKind {
  if (mode === "search") return "reseller";
  if (mode === "think") return "seller";
  if (mode === "canvas") return "buyer";
  return "discover";
}

export function agentLabel(kind: AgentKind): string {
  switch (kind) {
    case "discover":
      return "Product discovery";
    case "deals":
    case "reseller":
      return "Reseller agent";
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
  events?: EventCard[];
  negotiation?: NegotiationLine[];
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

export interface SellerSession {
  item: string;
  listPrice: number;
  floor: number;
  turn: number;
}

export async function runSellerAgent(query: string, signal: AbortSignal): Promise<{
  message: string;
  valuation: ChatTurn["valuation"];
  deals: DealCard[];
  negotiation: NegotiationLine[];
  session: SellerSession;
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
  const comparables = Array.isArray(payload.comparables) ? payload.comparables as Record<string, unknown>[] : [];

  const session: SellerSession = { item: query, listPrice, floor, turn: 1 };
  const offerInQuery = extractOffer(query);
  const negotiation = offerInQuery
    ? [
        { role: "buyer" as const, text: query, price: offerInQuery },
        (() => {
          const reply = sellerTurn({ item: query, asking: listPrice, floor, offered: offerInQuery, round: 1 });
          return { role: "seller" as const, text: reply.text, price: reply.price };
        })(),
      ]
    : runOpeningNegotiation({ item: query, asking: listPrice, floor });

  return {
    message: `List around $${listPrice.toFixed(0)} (floor $${floor.toFixed(0)}). Range $${low.toFixed(0)}–$${high.toFixed(0)}. I started negotiating with a serious buyer.`,
    valuation: { listPrice, floor, low, high, rationale },
    deals: comparables.map((comp, index) => ({
      id: String(comp.url || index),
      title: String(comp.title || "Comparable"),
      price: typeof comp.price === "number" ? comp.price : Number(comp.price) || null,
      url: typeof comp.url === "string" ? comp.url : undefined,
      location: typeof comp.notes === "string" ? comp.notes : undefined,
      why: "Live comparable used for this valuation.",
    })),
    negotiation,
    session,
  };
}

export function continueSellerNegotiation(session: SellerSession, buyerMessage: string): {
  message: string;
  negotiation: NegotiationLine[];
  session: SellerSession;
} {
  const offered = extractOffer(buyerMessage) ?? Math.round(session.floor * 0.9);
  const reply = sellerTurn({
    item: session.item,
    asking: session.listPrice,
    floor: session.floor,
    offered,
    round: session.turn + 1,
  });
  return {
    message: reply.text,
    negotiation: [
      { role: "buyer", text: buyerMessage, price: offered },
      { role: "seller", text: reply.text, price: reply.price },
    ],
    session: { ...session, turn: session.turn + 1, listPrice: reply.price },
  };
}

export async function runResellerAgent(
  query: string,
  signal: AbortSignal,
  onLog: (line: string) => void,
): Promise<{ message: string; deals: DealCard[]; events: EventCard[] }> {
  onLog("scanning underpriced inventory…");
  const result = await runDealFinderAgent(query, signal, onLog);

  onLog("loading local calendar…");
  const mockEvents = mockScrapedCalendar(query);
  let events: EventCard[] = mockEvents;
  try {
    const response = await fetch(ampyApi.seller.events, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, area: "San Francisco Bay Area" }),
      signal: AbortSignal.any ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : signal,
    });
    if (response.ok) {
      const payload = await response.json() as { opportunities?: Record<string, unknown>[] };
      const live = (payload.opportunities || []).map((event) => ({
        title: String(event.title || "Event"),
        url: typeof event.url === "string" ? event.url : undefined,
        date: typeof event.date_and_time === "string" ? event.date_and_time : undefined,
        location: typeof event.location === "string" ? event.location : undefined,
        why: typeof event.why_it_may_be_valuable === "string" ? event.why_it_may_be_valuable : undefined,
        items: Array.isArray(event.likely_items) ? event.likely_items.map(String) : undefined,
        score: typeof event.opportunity_score === "number" ? event.opportunity_score : undefined,
      }));
      if (live.length) events = [...live, ...mockEvents].slice(0, 6);
    }
  } catch {
    onLog("using mock-scraped calendar");
  }
  onLog(`${events.length} calendar events in context`);

  const eventNames = events.slice(0, 3).map((event) => event.title).join(", ");
  return {
    message: result.deals.length
      ? `Found ${result.deals.length} flip candidates. Calendar context: ${eventNames}. Buy under median and stage inventory for those dates.`
      : `No strong flips this pass. Calendar still loaded: ${eventNames}.`,
    deals: result.deals,
    events,
  };
}

export interface BuyerSession {
  item: string;
  asking: number;
  floor: number;
  budget: number;
  title: string;
  turn: number;
}

export async function runBuyerAgent(
  query: string,
  signal: AbortSignal,
  onLog: (line: string) => void,
): Promise<{ message: string; logs: string[]; deals: DealCard[]; negotiation: NegotiationLine[]; session: BuyerSession | null }> {
  const logs: string[] = [];
  let recommendation = "";
  let deals: DealCard[] = [];

  onLog("searching Craigslist…");
  try {
    const budgetMatch = query.match(/(?:under|max|below)\s*\$?\s*(\d+)/i);
    const cleanedQuery = query.replace(/(?:under|max|below)\s*\$?\s*\d+/i, "").trim() || query;
    const params = new URLSearchParams({ q: cleanedQuery, limit: "12" });
    if (budgetMatch) params.set("maxPrice", budgetMatch[1]);
    const response = await fetch(`${ampyApi.buyer.search}?${params.toString()}`, { signal });
    const payload = await response.json() as { listings?: Record<string, unknown>[]; total?: number };
    if (response.ok && Array.isArray(payload.listings) && payload.listings.length) {
      deals = payload.listings.map((listing, index) => toDealCard(listing, String(listing.id || index)));
      const priced = deals.filter((deal) => deal.price != null).sort((a, b) => (a.price || 0) - (b.price || 0));
      const best = priced[0];
      recommendation = best
        ? `Found ${deals.length} live listings. Lowest ask is $${best.price} — ${best.title}.`
        : `Found ${deals.length} live listings.`;
      onLog(`found ${deals.length} listings`);
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    onLog("listing search failed, trying buyer agent…");
  }

  const priced = deals.filter((deal) => deal.price != null && deal.price > 0).sort((a, b) => (a.price || 0) - (b.price || 0));
  const target = priced[Math.floor(priced.length / 3)] || priced[0];
  const budgetMatch = query.match(/(?:under|max|below)\s*\$?\s*(\d+)/i);
  let negotiation: NegotiationLine[] = [];
  let session: BuyerSession | null = null;
  if (target?.price) {
    const asking = target.price;
    const budget = budgetMatch ? Number(budgetMatch[1]) : Math.round(asking * 0.9);
    const floor = Math.round(asking * 0.78);
    session = { item: query, asking, floor, budget, title: target.title, turn: 2 };
    negotiation = runOpeningNegotiation({ item: target.title, asking, floor, budget });
    onLog(`negotiating ${target.title}`);
    recommendation = `${recommendation} I opened a negotiation on "${target.title}" (ask $${asking}, budget $${budget}).`;
  }

  if (deals.length) {
    return {
      message: recommendation || `Found ${deals.length} live listings.`,
      logs: logs.slice(-12),
      deals,
      negotiation,
      session,
    };
  }

  try {
    const timed = AbortSignal.timeout(22_000);
    const combined = typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timed]) : timed;
    await readSsePost(
      ampyApi.buyer.agentRun,
      { request: query, allowContact: false },
      combined,
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
          const streamed = (event.listings as Record<string, unknown>[]).map((listing, index) =>
            toDealCard(listing, String(listing.id || index)),
          );
          if (streamed.length) deals = streamed;
          onLog(`shortlist ready · ${streamed.length} listings`);
        } else if (type === "done" || type === "result") {
          recommendation = String(event.summary || event.recommendation || event.message || recommendation);
        } else if (type === "warning") {
          onLog(`warning: ${String(event.error || event.source || "warning")}`);
        }
      },
    );
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError" && signal.aborted) throw error;
    if (!deals.length) {
      throw error instanceof Error ? error : new Error("Buyer agent failed.");
    }
    logs.push("Buyer LLM skipped — showing scraped listings.");
    onLog("showing scraped listings");
  }

  if (!deals.length && !recommendation) {
    throw new Error("Buyer agent found no live listings. Try a more specific request.");
  }

  return {
    message: recommendation || `Found ${deals.length} live listings.`,
    logs: logs.slice(-12),
    deals,
    negotiation,
    session,
  };
}

export function continueBuyerNegotiation(session: BuyerSession, sellerMessage: string): {
  message: string;
  negotiation: NegotiationLine[];
  session: BuyerSession;
} {
  const lastAsk = extractOffer(sellerMessage) ?? session.asking;
  const offer = buyerTurnForContinue(session, lastAsk);
  const reply = sellerTurn({
    item: session.title,
    asking: session.asking,
    floor: session.floor,
    offered: offer.price,
    round: session.turn + 1,
  });
  return {
    message: `${offer.text}\nSeller: ${reply.text}`,
    negotiation: [
      { role: "buyer", text: offer.text, price: offer.price },
      { role: "seller", text: reply.text, price: reply.price },
    ],
    session: { ...session, turn: session.turn + 1, asking: reply.price },
  };
}

function buyerTurnForContinue(session: BuyerSession, lastAsk: number): { price: number; text: string } {
  const ceiling = Math.min(session.budget, lastAsk);
  const price = Math.min(ceiling, Math.max(1, Math.round(lastAsk * 0.92)));
  return {
    price,
    text: `I can do $${price} cash on the ${session.title} if we wrap this up today.`,
  };
}
