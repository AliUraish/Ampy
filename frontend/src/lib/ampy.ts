/** Ampy backend URLs as seen from the Next.js app (same-origin rewrites). */
export const ampyApi = {
  /** Next-local product discovery (Mistral + scrape). */
  products: "/api/products",
  /** Buyer agent API — proxied to backend/buyer. */
  buyer: {
    root: "/api/buyer/",
    search: "/api/buyer/search",
    agentRun: "/api/buyer/agent/run",
    agentStatus: "/api/buyer/agent/status",
    negotiate: "/api/buyer/negotiate",
  },
  /** Seller agent API — proxied to backend/seller. */
  seller: {
    ask: "/api/seller/ask",
    negotiate: "/api/seller/negotiate",
    value: "/api/seller-value",
    events: "/api/seller/events/discover",
    health: "/api/seller/health",
  },
  /** Deal Finder — proxied to backend/deal-finder. */
  dealFinder: {
    deals: "/api/deals",
    locations: "/api/deal-finder/craigslist-locations",
    health: "/api/deal-finder/health",
  },
} as const;
