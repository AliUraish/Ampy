import { NextResponse } from "next/server";

import { readMistralKey } from "@/lib/mistralKey";
import type { Product, ProductSearchError, ProductSearchResponse } from "@/lib/products";

export const maxDuration = 90;

const MISTRAL_URL = "https://api.mistral.ai/v1/conversations";
const SEARCH_TIMEOUT_MS = 70_000;
const SCRAPE_TIMEOUT_MS = 7_000;
const MAX_QUERY_LENGTH = 240;

interface ProductCandidate {
  name: string;
  price: string;
  productUrl: string;
  retailer: string;
  reason: string;
  imageUrl?: string;
}

interface MessageChunk {
  type?: unknown;
  text?: unknown;
}

interface MistralOutput {
  type?: unknown;
  content?: unknown;
}

interface MistralResponse {
  outputs?: unknown;
}

class ProductPipelineError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ProductPipelineError";
  }
}

export async function POST(request: Request): Promise<NextResponse<ProductSearchResponse | ProductSearchError>> {
  const apiKey = readMistralKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Product search is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as unknown;
  const query = readQuery(body);
  if (!query) {
    return NextResponse.json({ error: "Enter a product you want to find." }, { status: 400 });
  }

  try {
    const candidates = await searchProductCandidates(query, apiKey);
    const scrapedProducts = await Promise.all(candidates.map((candidate, index) => scrapeProduct(candidate, index)));
    const products = scrapedProducts.filter((product): product is Product => product !== null).slice(0, 5);

    if (products.length === 0) {
      return NextResponse.json(
        { error: "I could not scrape live product pages for that search. Try a more specific query.", code: "scrape_count" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      query,
      agentMessage: products.length === 5
        ? "I found five products for you."
        : `I found ${products.length} live product${products.length === 1 ? "" : "s"} for you.`,
      products,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "The product search took too long. Please try again.", code: "timeout" }, { status: 504 });
    }
    if (error instanceof ProductPipelineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 502 });
    }
    return NextResponse.json({ error: "The product search failed. Please try again.", code: "unknown" }, { status: 502 });
  }
}

function readQuery(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const query = (body as Record<string, unknown>).query;
  if (typeof query !== "string") return null;
  const normalized = query.trim();
  return normalized.length > 0 && normalized.length <= MAX_QUERY_LENGTH ? normalized : null;
}

async function searchProductCandidates(query: string, apiKey: string): Promise<ProductCandidate[]> {
  const response = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-2603",
      inputs: [
        `Search the live web for 10 distinct, currently purchasable products matching: ${query}.`,
        "Prioritize official manufacturers and reputable retailers. Return a compact JSON object with a products array.",
        "Each product needs name, price as displayed, productUrl, retailer, reason, and imageUrl when a real direct image URL is available.",
        "Never invent products, prices, URLs, or image URLs. Return JSON only.",
      ].join(" "),
      instructions: "You are a product discovery agent. Always use web_search before answering.",
      tools: [{ type: "web_search" }],
      completion_args: { temperature: 0.1 },
      store: false,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (response.status === 429) {
    throw new ProductPipelineError("rate_limited", "The search limit was reached. Please wait a moment and try again.");
  }
  if (!response.ok) throw new ProductPipelineError("mistral_http", "Mistral search is temporarily unavailable.");
  const payload = await response.json() as MistralResponse;
  const text = collectMistralText(payload);
  const candidates = parseCandidates(text);
  if (candidates.length < 5) {
    throw new ProductPipelineError("candidate_parse", "Mistral did not return enough usable product pages. Please try again.");
  }
  return candidates.slice(0, 10);
}

function collectMistralText(payload: MistralResponse): string {
  if (!Array.isArray(payload.outputs)) return "";
  return payload.outputs
    .filter((output): output is MistralOutput => Boolean(output && typeof output === "object"))
    .filter((output) => output.type === "message.output")
    .flatMap((output) => Array.isArray(output.content) ? output.content : [])
    .filter((chunk): chunk is MessageChunk => Boolean(chunk && typeof chunk === "object"))
    .filter((chunk) => chunk.type === "text" && typeof chunk.text === "string")
    .map((chunk) => chunk.text as string)
    .join("");
}

function parseCandidates(text: string): ProductCandidate[] {
  const json = extractJson(text);
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown;
      const candidates = readCandidateArray(parsed);
      if (candidates.length >= 5) return candidates;
    } catch {
      // Fall through to the markdown parser used by some web-search responses.
    }
  }
  return parseMarkdownCandidates(text);
}

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

function readCandidateArray(value: unknown): ProductCandidate[] {
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  const products = Array.isArray(value) ? value : object.products ?? object.items ?? object.results;
  if (!Array.isArray(products)) return [];
  return products.flatMap((product) => {
    if (!product || typeof product !== "object") return [];
    const item = product as Record<string, unknown>;
    const productUrl = safeExternalUrl(item.productUrl ?? item.product_url ?? item.url ?? item.link);
    const name = item.name ?? item.productName ?? item.product_name ?? item.title;
    if (typeof name !== "string" || !productUrl) return [];
    const rawPrice = item.price ?? item.currentPrice ?? item.current_price;
    return [{
      name: name.trim(),
      price: typeof rawPrice === "string" || typeof rawPrice === "number" ? String(rawPrice).trim() : "Check price",
      productUrl,
      retailer: typeof (item.retailer ?? item.store ?? item.seller) === "string"
        ? String(item.retailer ?? item.store ?? item.seller).trim()
        : new URL(productUrl).hostname,
      reason: typeof (item.reason ?? item.description ?? item.match) === "string"
        ? String(item.reason ?? item.description ?? item.match).trim()
        : "Matches your search.",
      imageUrl: safeExternalUrl(item.imageUrl ?? item.image_url ?? item.image) ?? undefined,
    }];
  });
}

function parseMarkdownCandidates(text: string): ProductCandidate[] {
  const sections = text.split(/\n(?=\s*\d+[.)]\s+)/);
  return sections.flatMap((section) => {
    const name = section.match(/(?:\d+[.)]\s*)?\*\*([^*]+)\*\*/)?.[1]
      ?? section.match(/^\s*\d+[.)]\s*([^\n]+)/)?.[1];
    const links = Array.from(section.matchAll(/\[([^\]]+)]\((https:\/\/[^)]+)\)/gi));
    const productLink = links.find((link) => !/image|photo|source|reference/i.test(link[1]) && !/\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(link[2]));
    const productUrl = safeExternalUrl(productLink?.[2]);
    if (!name || !productUrl) return [];
    const price = section.match(/(?:USD\s*)?[$€£]\s?\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s?(?:USD|EUR|GBP)/i)?.[0];
    return [{
      name: name.trim().replace(/^#+\s*/, ""),
      price: price?.trim() || "Check price",
      productUrl,
      retailer: new URL(productUrl).hostname.replace(/^www\./, ""),
      reason: "Matches your product search.",
    }];
  });
}

async function scrapeProduct(candidate: ProductCandidate, index: number): Promise<Product | null> {
  try {
    const response = await fetch(candidate.productUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
    if (!response.ok) {
      const fallbackImage = safeExternalUrl(candidate.imageUrl);
      if (!fallbackImage) return null;
      return {
        id: `${index}-${new URL(candidate.productUrl).hostname}`,
        name: candidate.name,
        price: candidate.price || "Check price",
        imageUrl: fallbackImage,
        productUrl: candidate.productUrl,
        retailer: candidate.retailer,
        reason: candidate.reason,
      };
    }
    const html = await response.text();
    const finalUrl = safeExternalUrl(response.url) ?? candidate.productUrl;
    const imageUrl = resolveExternalUrl(
      readMeta(html, "og:image")
        ?? readMeta(html, "twitter:image")
        ?? readMeta(html, "twitter:image:src")
        ?? candidate.imageUrl,
      finalUrl,
    );
    if (!imageUrl) return null;

    const pageTitle = cleanText(readMeta(html, "og:title") ?? readTitle(html));
    const amount = readMeta(html, "product:price:amount");
    const currency = readMeta(html, "product:price:currency");
    const scrapedPrice = amount ? `${amount}${currency ? ` ${currency}` : ""}` : null;

    return {
      id: `${index}-${new URL(finalUrl).hostname}`,
      name: pageTitle || candidate.name,
      price: scrapedPrice || candidate.price || "Check price",
      imageUrl,
      productUrl: finalUrl,
      retailer: candidate.retailer,
      reason: candidate.reason,
    };
  } catch {
    return null;
  }
}

function readMeta(html: string, property: string): string | null {
  const metaTags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const attributes = Object.fromEntries(
      Array.from(tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)).map((match) => [match[1].toLowerCase(), match[2]]),
    );
    if ((attributes.property ?? attributes.name)?.toLowerCase() === property.toLowerCase()) {
      return attributes.content || null;
    }
  }
  return null;
}

function readTitle(html: string): string | null {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
}

function cleanText(value: string | null): string {
  return (value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveExternalUrl(value: unknown, baseUrl: string): string | null {
  if (typeof value !== "string") return null;
  try {
    return safeExternalUrl(new URL(value, baseUrl).toString());
  } catch {
    return null;
  }
}

function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || hostname === "localhost" || hostname.endsWith(".local") || isIpAddress(hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}
