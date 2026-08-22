// lib/sources/craigslist.js
//
// Craigslist adapter for the multi-source buyer agent (see
// lib/sources/index.js for the contract).
//
// Deliberately thin: all the HTML-parsing lives in lib/craigslistFetcher.js
// and stays there. This file's only job is to present that fetcher through
// the same interface every other marketplace will implement, so the agent
// never learns that Craigslist is scraped while some future source is an
// API.

const { searchCraigslist, fetchListingDetail } = require("../craigslistFetcher.js");

const DEFAULT_LOCATION = process.env.CRAIGSLIST_LOCATION || "sfbay";

module.exports = {
  id: "craigslist",
  label: "Craigslist",

  // Craigslist needs no credentials, so it's always available. USE_MOCK_DATA
  // is read at call time, not module load, so flipping it doesn't require a
  // restart in dev.
  enabled() {
    return String(process.env.USE_MOCK_DATA || "").toLowerCase() !== "true";
  },

  async search({ query, category, maxPrice, location }) {
    const result = await searchCraigslist({
      query,
      location: location || DEFAULT_LOCATION,
      category,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
    return { listings: result.listings || [], error: result.error };
  },

  // A Craigslist search row carries title/price/neighborhood and nothing
  // else — no photo, description, post date, or condition. Those need the
  // listing's own page. Returns the listing untouched if it's already
  // enriched or the fetch fails.
  async enrich(listing, { timeoutMs } = {}) {
    if (!listing.url || listing.imageUrl) return listing;
    const detail = await fetchListingDetail(listing.url, { timeoutMs });
    if (!detail) return listing;
    return {
      ...listing,
      imageUrl: detail.imageUrl,
      images: detail.images,
      postedAt: detail.postedAt || listing.postedAt,
      description: detail.description || listing.description,
      condition: detail.condition,
    };
  },
};
