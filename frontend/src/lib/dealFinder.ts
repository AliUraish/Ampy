/**
 * Types + helpers for the Deal Finder stream (backend/deal-finder, SSE
 * `/api/deals`). Shapes mirror docs/contracts.md exactly.
 */
export interface DealValuation {
  item?: string;
  brandModel?: string | null;
  condition?: string;
  estimatedResaleUsd?: number;
  redFlags?: string[];
  reasoning?: string;
}

export interface DealMeta {
  score?: number;
  margin?: number;
  marginN?: number;
  demand?: number;
  confidence?: number;
  flags?: string[];
  headline?: string;
  why?: string;
  riskNote?: string;
}

export interface DealListing {
  id: string;
  title?: string;
  price?: number | null;
  condition?: string;
  location?: string;
  market?: string;
  postedAt?: string | null;
  description?: string;
  url?: string;
  imageUrl?: string | null;
  source?: string;
  valuation?: DealValuation;
  compsMedian?: number | null;
  compsN?: number;
  fairValue?: number | null;
  demand?: { value?: number; source?: string; keyword?: string };
  deal?: DealMeta;
  /** Present on `pass` events. */
  reason?: string;
}

export interface TraceLine {
  label: string;
  message: string;
  tone: "info" | "success" | "error";
}

export interface LogLine {
  id: number;
  type: "progress" | "deal" | "pass" | "error";
  mark: string;
  message: string;
}

export const DEAL_CATEGORIES = [
  { value: "general", label: "All categories" },
  { value: "jewelry", label: "Jewelry & watches" },
  { value: "bikes", label: "Bikes" },
  { value: "electronics", label: "Electronics" },
  { value: "furniture", label: "Furniture" },
  { value: "instruments", label: "Instruments" },
  { value: "appliances", label: "Appliances" },
  { value: "vehicles", label: "Vehicles" },
];

/** Matches PASS_THRESHOLD in backend/deal-finder/lib/dealScan.js. */
export const PASS_THRESHOLD = 60;

export function money(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number);
}

export function clamp(value: unknown, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function safeText(value: unknown, fallback: string | number = ""): string {
  return value === null || value === undefined || value === "" ? String(fallback) : String(value);
}

export function listingPlace(listing: DealListing | undefined): string {
  const places = [listing?.location, listing?.market].map((value) => safeText(value)).filter(Boolean);
  return Array.from(new Set(places)).join(" · ") || "Location not listed";
}

export function postedAgo(date: string | null | undefined): string {
  if (!date) return "posted recently";
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return "posted recently";
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3600000));
  if (hours < 1) return "posted <1h ago";
  if (hours < 24) return `posted ${hours}h ago`;
  return `posted ${Math.floor(hours / 24)}d ago`;
}

export function safeUrl(value: unknown): string {
  if (!value || typeof value !== "string") return "#";
  try {
    const url = new URL(value, typeof window === "undefined" ? "http://localhost" : window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

/** ≥75 strong · ≥60 maybe (PASS_THRESHOLD) · below = pass. */
export function scoreTone(score: number): { color: string; bucket: "strong" | "maybe" | "pass" } {
  if (score >= 75) return { color: "#34d399", bucket: "strong" };
  if (score >= PASS_THRESHOLD) return { color: "#fb923c", bucket: "maybe" };
  return { color: "rgba(255,255,255,0.4)", bucket: "pass" };
}

export function demandSourceLabel(source: unknown): string {
  if (source === "trends") return "google trends";
  if (source === "baseline") return "category baseline";
  return safeText(source, "not emitted");
}
