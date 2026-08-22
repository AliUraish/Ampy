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
    return [
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
