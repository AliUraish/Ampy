// lib/sources/index.js
//
// The multi-source seam for the buyer agent.
//
// The buyer agent's whole premise is "search everywhere at once", but the
// rest of the app should never learn how many marketplaces there are or
// how any one of them is fetched. So every marketplace is an ADAPTER
// implementing one small contract, registered here, and callers only ever
// call searchAllSources() and get back canonical Listings.
//
// THE ADAPTER CONTRACT
// --------------------
//   {
//     id:          string   // stable slug, also the Listing.source value
//     label:       string   // human name for the UI ("Craigslist")
//     enabled():   boolean  // may consult env — a source that isn't
//                           //   configured should switch itself off rather
//                           //   than fail every search
//     search({ query, category, maxPrice, location, limit }):
//                  Promise<{ listings: Listing[], error?: string }>
//                           // MUST NOT throw and MUST NOT return partial
//                           //   junk — on failure return [] plus an error
//                           //   string; the fan-out reports it as a
//                           //   per-source warning instead of failing the
//                           //   whole search.
//     enrich?(listing):
//                  Promise<Listing>
//                           // optional; fills in the fields that source
//                           //   only exposes on a listing's own page.
//                           //   Omit it if search() already returns
//                           //   everything.
//   }
//
// Every adapter normalizes into the canonical Listing shape documented in
// data/listings.js. That's the contract that makes the fan-out work: the
// agent, ranking, and negotiation code branch on nothing.
//
// TWO KINDS OF ADAPTER
// --------------------
// craigslist.js is a PULL adapter — it fetches on its own.
// facebook.js is a PUSH adapter — Marketplace is login-walled with no
// buyer-side API, so the reading happens in the user's own browser via the
// Ampy Chrome extension and the adapter just brokers it (see
// lib/extensionBridge.js). Both satisfy the same contract, which is the
// point: the buyer agent can't tell them apart.
//
// OfferUp and Mercari are the obvious next ones, and either style works.
// Adding one means writing an adapter file and registering it below —
// nothing else in the app changes. See README.md.

const { mapWithConcurrency } = require("../concurrency.js");
const craigslist = require("./craigslist.js");
const facebook = require("./facebook.js");
const mock = require("./mock.js");
const sellerStore = require("./sellerStore.js");

// Order matters only for tie-breaking in the merged result; ranking
// (lib/rank.js) does the real ordering.
const ADAPTERS = [craigslist, facebook, sellerStore, mock];

function listSources() {
  return ADAPTERS.map((a) => ({ id: a.id, label: a.label, enabled: a.enabled() }));
}

function getAdapter(id) {
  return ADAPTERS.find((a) => a.id === id) || null;
}

/**
 * Fan out one query across every enabled marketplace in parallel and merge
 * the results.
 *
 * A source that fails does NOT fail the search — its error is collected
 * into `warnings` and the other sources' results are still returned. With
 * one source that looks like a nicety; with several it's the difference
 * between "Facebook is rate-limiting us" degrading to Craigslist-only
 * results and the buyer seeing an error page.
 *
 * @returns {Promise<{ listings: Listing[], sources: string[], warnings: Array<{source, error}> }>}
 */
async function searchAllSources({ query = "", category = "", maxPrice, location, limit } = {}) {
  const active = ADAPTERS.filter((a) => a.enabled());

  const settled = await Promise.all(
    active.map(async (adapter) => {
      try {
        const result = await adapter.search({ query, category, maxPrice, location, limit });
        return { adapter, listings: result.listings || [], error: result.error };
      } catch (err) {
        // Belt-and-braces: the contract says adapters don't throw, but a
        // buggy one shouldn't be able to take down every other source.
        return { adapter, listings: [], error: `adapter threw: ${err.message}` };
      }
    })
  );

  const listings = [];
  const sources = [];
  const warnings = [];

  for (const { adapter, listings: found, error } of settled) {
    if (error) warnings.push({ source: adapter.id, error });
    if (found.length > 0) {
      sources.push(adapter.id);
      listings.push(...found);
    }
  }

  // Last-resort fallback. Every live source failing or returning nothing
  // is a routine occurrence (Craigslist 403s, an unloaded extension, a
  // query with no matches), and an empty result set doesn't just look
  // empty to the buyer agent — it derails the run. Same fallback GET
  // /api/search has always had, flagged so nobody mistakes demo data for
  // live listings.
  let usedFallback = false;
  if (listings.length === 0 && !mock.enabled()) {
    const fallback = await mock.search({ query, category, maxPrice });
    if (fallback.listings.length > 0) {
      usedFallback = true;
      sources.push(mock.id);
      listings.push(...fallback.listings);
    }
  }

  return { listings: dedupe(listings), sources, warnings, usedFallback };
}

// Two marketplaces routinely carry the same item — people cross-post the
// same couch to Craigslist and Marketplace within a minute of each other.
// Collapsing those keeps the agent from reporting one bike as two finds
// and, worse, messaging the same seller twice about it.
//
// Same id is an exact dupe. Beyond that, "same normalized title + same
// price" is deliberately conservative: it catches genuine cross-posts
// without merging two similar-but-distinct listings (two different Trek
// bikes at different prices stay separate). First one wins, since sources
// are registered in preference order.
function dedupe(listings) {
  const seen = new Set();
  const out = [];
  for (const l of listings) {
    const titleKey = (l.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const keys = [`id:${l.id}`, `tp:${titleKey}|${l.price}`];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(l);
  }
  return out;
}

/**
 * Fill in the per-listing fields a source only exposes on the listing's own
 * page (photo, full description, post date, condition), by delegating to
 * whichever adapter owns the listing.
 *
 * This is the detail the buyer agent needs to actually answer "what is it
 * and what shape is it in" — a search-results row alone can't.
 *
 * Never throws and never partially mangles a listing: an adapter with no
 * enrich(), an unknown source, or a failed fetch all just return the
 * listing as-is.
 */
async function enrichListing(listing, opts = {}) {
  if (!listing) return listing;
  const adapter = getAdapter(listing.source);
  if (!adapter || typeof adapter.enrich !== "function") return listing;
  try {
    return await adapter.enrich(listing, opts);
  } catch {
    return listing;
  }
}

/** Bounded-concurrency enrich for a page of results. Same rationale as server.js. */
async function enrichListings(listings, { concurrency = 3, jitterMs = 400, timeoutMs } = {}) {
  const enriched = await mapWithConcurrency(
    listings,
    concurrency,
    (l) => enrichListing(l, { timeoutMs }),
    { jitterMs }
  );
  // mapWithConcurrency yields undefined for a failed call — fall back to
  // the unenriched listing rather than punching a hole in the results.
  return enriched.map((l, i) => l || listings[i]);
}

module.exports = { searchAllSources, enrichListing, enrichListings, listSources, getAdapter };
