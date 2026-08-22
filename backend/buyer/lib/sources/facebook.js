// lib/sources/facebook.js
//
// Facebook Marketplace adapter (see lib/sources/index.js for the contract).
//
// This is a PUSH adapter — unlike Craigslist, it doesn't fetch anything
// itself. Marketplace is login-walled and has no buyer-side API, so the
// reading happens in the user's own browser via the Ampy Chrome
// extension, and this adapter just brokers the request and normalizes what
// comes back. See lib/extensionBridge.js for why that's the design.
//
// The normalization here is the same deal as craigslistFetcher.js: ALL
// knowledge of Facebook's data shape stops at this file. Everything
// downstream sees canonical Listings.
//
// Facebook sellers are contactable only through Messenger, which isn't an
// iMessage handle — so a Facebook listing is usually "browse and compare"
// only. The exception is a seller who typed a phone number into their own
// description, which lib/contact.js picks up regardless of source. That
// degrades honestly: the agent reports the listing either way and only
// promises to message when there's really a way to.

const bridge = require("../extensionBridge.js");

const MARKETPLACE_ITEM_URL = "https://www.facebook.com/marketplace/item/";

function toCanonicalListing(raw, { category } = {}) {
  const price =
    typeof raw.price === "number" && Number.isFinite(raw.price) && raw.price > 0 ? raw.price : null;

  return {
    id: raw.itemId ? `fb-${raw.itemId}` : `fb-${Buffer.from(String(raw.title || "")).toString("base64url").slice(0, 16)}`,
    category: category || "general",
    title: String(raw.title || "").trim(),
    price,
    // Marketplace shows a condition chip only on some listings, and never
    // on the search grid — 'unknown' rather than a guess.
    condition: raw.condition || "unknown",
    // No geocoding: Marketplace gives a place name, not a distance. Null
    // is treated as neutral by lib/rank.js rather than penalized.
    distanceMiles: null,
    location: raw.location || "",
    // The grid has no post date either — only "listed N days ago" on some
    // cards, which isn't reliable enough to synthesize a timestamp from.
    postedAt: raw.postedAt || null,
    sellerName: raw.sellerName || null,
    sellerRating: null,
    description: raw.description || "",
    imageUrl: raw.imageUrl || null,
    images: raw.imageUrl ? [raw.imageUrl] : [],
    url: raw.url || (raw.itemId ? `${MARKETPLACE_ITEM_URL}${raw.itemId}/` : null),
    source: "facebook",
  };
}

module.exports = {
  id: "facebook",
  label: "Facebook Marketplace",

  // Off unless explicitly switched on. Without the extension loaded and
  // signed in, every search would just burn the job timeout before falling
  // back — better to be visibly off than silently slow.
  enabled() {
    return String(process.env.ENABLE_FACEBOOK || "").toLowerCase() === "true";
  },

  async search({ query, category, maxPrice, location, limit }) {
    const result = await bridge.requestSearch({ query, maxPrice, location, limit });

    if (!result.ok) return { listings: [], error: result.error };

    const listings = (result.listings || [])
      .map((raw) => toCanonicalListing(raw, { category }))
      .filter((l) => l.title)
      // The extension scrapes the grid as rendered, which can include
      // sponsored rows and cards whose price didn't parse. A listing with
      // no price is useless to a buyer agent comparing offers.
      .filter((l) => l.price !== null)
      .filter((l) => !maxPrice || l.price <= Number(maxPrice));

    return { listings };
  },

  // No enrich(): opening each item page would mean driving the user's
  // browser to N more pages per search, which is slow and far more
  // conspicuous than reading the grid they already loaded. The extension
  // returns everything the grid shows in one pass instead.
};
