// lib/sources/mock.js
//
// The demo/offline listing source (data/listings.js) as an adapter.
//
// GET /api/search has always fallen back to this data when Craigslist
// fails or returns nothing (see gatherListings in server.js) — the buyer
// agent needs the same safety net, and for a stronger reason: a search
// that returns zero listings doesn't just show an empty grid, it derails
// the whole agent run. Craigslist 403s and markup changes are routine (the
// README documents a real one), and a demo that dies when they happen is
// not a demo.
//
// Off unless it's needed: enabled only when USE_MOCK_DATA is set, and
// otherwise pulled in by lib/sources/index.js as a last-resort fallback
// when every live source came back empty. Results are tagged
// `usedFallback` so callers can say so out loud rather than passing demo
// data off as live listings.

const mockListings = require("../../data/listings.js");

module.exports = {
  id: "mock",
  label: "Demo listings",

  enabled() {
    return String(process.env.USE_MOCK_DATA || "").toLowerCase() === "true";
  },

  // Called directly by the fan-out's fallback path even when disabled.
  async search({ query, category, maxPrice }) {
    let listings = mockListings;

    if (query) {
      const needle = query.toLowerCase();
      listings = listings.filter(
        (l) =>
          l.title.toLowerCase().includes(needle) ||
          (l.description || "").toLowerCase().includes(needle)
      );
    }
    if (category) listings = listings.filter((l) => l.category === category);
    if (maxPrice) {
      listings = listings.filter((l) => typeof l.price !== "number" || l.price <= Number(maxPrice));
    }

    return { listings };
  },
};
