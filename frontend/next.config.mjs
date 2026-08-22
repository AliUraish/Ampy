import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefer the Ampy repo-root .env (shared MISTRAL_API_KEY) over frontend-local files.
loadEnvConfig(path.join(__dirname, ".."));
loadEnvConfig(__dirname);

const BUYER_URL = process.env.BUYER_URL || "http://127.0.0.1:3001";
const SELLER_URL = process.env.SELLER_URL || "http://127.0.0.1:8000";
const DEAL_FINDER_URL = process.env.DEAL_FINDER_URL || "http://127.0.0.1:4747";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deal Finder / buyer SSE and seller valuation outlive the default proxy cut-off.
  experimental: {
    proxyTimeout: 120_000,
  },
  async rewrites() {
    // Next owns /api/products. Everything else under these prefixes is proxied
    // to the Ampy backends so the browser stays same-origin.
    //
    // The buyer app's own pages (/agent, /sell, /dashboard) are mounted
    // same-origin too: their HTML references root-relative assets
    // (/style.css, /agent.js, ...) and same-origin APIs (/api/agent/*),
    // so each of those paths is proxied straight to the buyer backend.
    // These run after Next's own files/pages, so / and /api/products stay
    // Next's own.
    const buyerPages = ["agent", "sell", "dashboard"].map((p) => ({
      source: `/${p}`,
      destination: `${BUYER_URL}/${p}`,
    }));
    const buyerAssets = ["style.css", "app.js", "agent.js", "agent.css", "sell.js", "dashboard.js"].map((f) => ({
      source: `/${f}`,
      destination: `${BUYER_URL}/${f}`,
    }));
    const buyerApi = [
      "agent/:path*", "search", "craigslist-locations", "listings/:path*",
      "negotiate", "vision-detect", "extension/:path*", "repost-check",
    ].map((r) => ({
      source: `/api/${r}`,
      destination: `${BUYER_URL}/api/${r}`,
    }));

    return [
      ...buyerPages,
      ...buyerAssets,
      ...buyerApi,
      { source: "/uploads/:path*", destination: `${BUYER_URL}/uploads/:path*` },
      {
        source: "/api/buyer/:path*",
        destination: `${BUYER_URL}/api/:path*`,
      },
      {
        source: "/api/seller/:path*",
        destination: `${SELLER_URL}/:path*`,
      },
      {
        source: "/api/deal-finder/:path*",
        destination: `${DEAL_FINDER_URL}/api/:path*`,
      },
      {
        source: "/api/deals",
        destination: `${DEAL_FINDER_URL}/api/deals`,
      },
    ];
  },
};

export default nextConfig;
