// lib/craigslistFetcher.js
//
// Fetches and parses real Craigslist listings into the app's canonical
// Listing shape (see data/listings.js for the full field list).
//
// Craigslist has no official API, so this scrapes public HTML with cheerio.
// ALL markup-parsing logic is intentionally kept in this one file — if
// Craigslist changes its markup again (it already has once during this
// project — see below), or if this data source gets swapped for something
// else entirely, only this module should need to change. Callers
// (server.js) only ever see the normalized Listing shape.
//
// TWO-STAGE FETCH, ON PURPOSE:
//   Craigslist's search-results page (verified live against the current
//   site) only renders title / price / neighborhood / listing URL — no
//   photo, no post date, no description, no condition. Those all live on
//   each listing's own page. Fetching every result's detail page on every
//   search would mean N+1 requests per search, which is both slow and a
//   good way to get rate-limited/blocked. So:
//     - searchCraigslist()   → cheap, one request, gets the result list.
//     - fetchListingDetail() → one request per listing, called LAZILY by
//                               server.js only when a buyer actually opens
//                               a specific listing (GET /api/listings/:id).
//                               This is what fills in imageUrl, postedAt,
//                               description, and condition.
//   A listing straight out of searchCraigslist() will have
//   imageUrl: null, postedAt: null, condition: 'unknown' until/unless
//   fetchListingDetail() has been called for it.
//
// Craigslist doesn't expose everything our Listing shape wants even after
// the detail fetch:
//   - sellerName / sellerRating: Craigslist listings are anonymous. Both
//     are always null for craigslist-sourced listings — never fabricated.
//   - distanceMiles: not returned by a plain text search. Defaults to
//     null; the ranking code treats null distance as neutral rather than
//     penalizing it.
//   - minAcceptablePrice: doesn't exist for real listings at all (see
//     lib/negotiate.js, which derives an *estimate* instead).

const cheerio = require("cheerio");
const crypto = require("crypto");

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — successful results
// Failed results get a much shorter TTL than successful ones. A network
// blip or a momentary block is usually transient. A valid search with zero
// matches is not a failure and keeps the normal cache TTL.
const ERROR_CACHE_TTL_MS = 30 * 1000;
const FETCH_TIMEOUT_MS = 15000; // was 8000; sfbay search occasionally takes >8s and we would rather wait than fall back to mock

// Best-effort mapping from this app's category names to Craigslist's "for
// sale" category codes — verified empirically against the live site as of
// this writing (Craigslist doesn't document these). Categories not in this
// map (or "general"/"") fall back to "sss" (for sale - all) and the app's
// own post-fetch category filter in server.js still applies, so an
// unmapped category degrades to "search everything, then filter" rather
// than failing.
const CATEGORY_CODES = {
  electronics: "ela",
  furniture: "fua",
  vehicles: "cta",
  appliances: "ppa",
  instruments: "msa",
  jewelry: "jwa",
  bikes: "bia",
  "sporting goods": "sga",
};
const DEFAULT_CATEGORY_CODE = "sss";

// Separate caches for search results vs. per-listing detail fetches — they
// have different keys (query+location+category vs. listing URL) and
// different volumes (one search can fan out to many detail lookups).
const searchCache = new Map();
const detailCache = new Map();

function cacheKey(parts) {
  return parts.join("::").toLowerCase();
}

function getCached(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAtMs > entry.ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(cache, key, value, ttlMs = CACHE_TTL_MS) {
  cache.set(key, { value, fetchedAtMs: Date.now(), ttlMs });
}

const REQUEST_HEADERS = {
  // Craigslist blocks obvious bot UAs. Mirror a current desktop Chrome.
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: REQUEST_HEADERS });
    return { res };
  } catch (err) {
    const message =
      err.name === "AbortError"
        ? `request timed out after ${timeoutMs}ms`
        : `fetch failed: ${err.message}`;
    return { error: message };
  } finally {
    clearTimeout(timeout);
  }
}

// Craigslist price strings look like "$1,450". Returns null when we can't
// confidently parse a number, OR when the listing literally shows "$0" —
// Craigslist renders that for posts with no price set (not a real free
// item; those live in a distinct "free" category), and treating it as a
// real price would make it look like the cheapest thing in every search.
function parsePrice(text) {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value === 0) return null;
  return value;
}

function absoluteUrl(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

// IMPORTANT: hash the full URL, don't just truncate a base64 encoding of
// it — every Craigslist listing URL shares the same long prefix
// ("https://www.craigslist.org/view/d/..."), so truncating base64(url)
// truncates to that shared prefix and collides for almost every listing.
// A hash's output bytes depend on the whole input, so truncating a hash is
// safe where truncating a raw encoding is not.
function idFromUrl(url) {
  const hash = crypto.createHash("sha1").update(url).digest("base64url");
  return `cl-${hash.slice(0, 16)}`;
}

function toCanonicalListing({ id, title, url, price, location, category }) {
  return {
    id,
    category: category || "general",
    title,
    price,
    condition: "unknown", // filled in by fetchListingDetail(), if called
    distanceMiles: null, // not available without a geocoded search — see file header
    location: location || "",
    postedAt: null, // filled in by fetchListingDetail(), if called
    sellerName: null, // Craigslist listings are anonymous
    sellerRating: null, // not available — never fabricated
    description: title, // filled in with the real body by fetchListingDetail(), if called
    url,
    imageUrl: null, // primary photo — filled in by fetchListingDetail(), if called
    images: [], // every photo — filled in by fetchListingDetail(), if called
    source: "craigslist",
  };
}

/**
 * Search Craigslist for listings matching a query in a given metro
 * ("location" = the Craigslist area slug, e.g. "sfbay", "newyork").
 *
 * Never throws — timeouts, blocks/rate-limiting, or unexpected markup
 * resolve to an empty `listings` array plus an error. A valid search with no
 * matches resolves to an empty array without an error.
 *
 * NOTE: results from this function have imageUrl/postedAt = null and
 * condition = 'unknown' — see the file header on why that's fetched
 * separately, lazily, via fetchListingDetail().
 *
 * @returns {Promise<{listings: object[], source: 'craigslist', fetchedAt: string, error?: string}>}
 */
async function searchCraigslist({ query, location = "sfbay", category, maxPrice } = {}) {
  const q = (query || "").trim();
  const key = cacheKey(["search", location, q, category || ""]);

  const cached = getCached(searchCache, key);
  if (cached) return cached;

  const catCode = CATEGORY_CODES[category] || DEFAULT_CATEGORY_CODE;
  const params = new URLSearchParams({ cat: catCode });
  if (q) params.set("query", q);
  if (maxPrice) params.set("max_price", String(maxPrice));
  const searchUrl = `https://www.craigslist.org/search/area/${encodeURIComponent(location)}?${params.toString()}`;

  let listings = [];
  let error;

  const { res, error: fetchError } = await fetchWithTimeout(searchUrl);
  if (fetchError) {
    error = `craigslist ${fetchError}`;
  } else if (!res.ok) {
    // Includes the common "blocked/rate-limited" case (403/429) as well as
    // a bad location slug (404).
    error = `craigslist responded ${res.status} ${res.statusText}`;
  } else {
    const html = await res.text();
    const $ = cheerio.load(html);
    const rows = $("li.cl-static-search-result");

    if (rows.length > 0) {
      listings = rows
        .toArray()
        .map((row) => {
          const $row = $(row);
          const title = $row.attr("title") || $row.find(".title").first().text().trim();
          if (!title) return null;

          const href = $row.find("a").first().attr("href");
          const url = absoluteUrl(href, searchUrl);
          const price = parsePrice($row.find(".price").first().text());
          const location = $row.find(".location").first().text().trim();

          return toCanonicalListing({
            id: idFromUrl(url || title),
            title,
            url,
            price,
            location,
            category,
          });
        })
        .filter(Boolean);
    }
  }

  if (error) {
    console.warn(`[craigslistFetcher] ${error} for "${q}" in ${location}`);
  }

  const result = {
    listings,
    source: "craigslist",
    fetchedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };

  // Cache errors briefly so an outage does not trigger a request burst.
  // Valid empty searches are cached normally.
  setCached(searchCache, key, result, error ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS);

  return result;
}

/**
 * Fetch the photo, full description, condition, and post date for a single
 * Craigslist listing by its URL. Called both lazily (a buyer opens one
 * specific listing) and eagerly in a bounded batch (server.js enriches the
 * first page of search results so the grid shows real thumbnails) — see
 * lib/concurrency.js for how the batch case bounds concurrency/latency.
 *
 * Never throws: on any failure, returns `null` and logs a warning, so a
 * failed enrichment just means the listing keeps its search-page-only
 * fields (title/price/location) rather than breaking the page.
 *
 * @param {string} url - a listing URL as returned by searchCraigslist()
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] - overrides the default per-request timeout; the
 *   bulk/eager path uses a shorter one so one slow listing can't stall a whole search
 * @returns {Promise<{imageUrl: string|null, postedAt: string|null, description: string, condition: string}|null>}
 */
async function fetchListingDetail(url, { timeoutMs } = {}) {
  if (!url) return null;
  const key = cacheKey(["detail", url]);
  const cached = getCached(detailCache, key);
  if (cached) return cached;

  const { res, error: fetchError } = await fetchWithTimeout(url, timeoutMs);
  if (fetchError || !res.ok) {
    console.warn(
      `[craigslistFetcher] detail fetch failed for ${url}: ${fetchError || `HTTP ${res.status}`}`
    );
    return null;
  }

  try {
    const html = await res.text();
    const $ = cheerio.load(html);

    // The full, untruncated description lives in #postingbody. (Craigslist
    // also embeds a `description` in the JSON-LD block below, but it's
    // truncated to a few hundred characters for SEO purposes — this is the
    // real one.)
    const postingBody = $("#postingbody").clone();
    postingBody.find(".print-information").remove();
    const description = postingBody.text().trim().replace(/\s+\n/g, "\n").trim();

    // ALL of a listing's photos, at full resolution, come from a
    // `application/ld+json` block Craigslist embeds on every listing page
    // (id="ld_posting_data", schema.org Product). This is far more
    // reliable than scraping <img> tags out of the gallery/thumbnail
    // widgets — those elements' src attributes are frequently lazy-loaded
    // placeholders, thumbnail-cropped, or just the wrong element depending
    // on which build of the gallery markup is served, which was producing
    // wrong or partial-looking images. The JSON-LD block gives clean,
    // full-size URLs directly, for every photo, with no guessing.
    let images = [];
    try {
      const ldJson = $("#ld_posting_data").first().text();
      if (ldJson) {
        const parsed = JSON.parse(ldJson);
        if (Array.isArray(parsed.image)) images = parsed.image;
      }
    } catch {
      // Malformed/missing JSON-LD — fall through with images = [].
    }
    const imageUrl = images[0] || null; // primary photo, used for card thumbnails

    const datetime = $("time.date.timeago").first().attr("datetime");
    const postedAt = datetime ? new Date(datetime).toISOString() : null;

    const condition = $(".attr.condition .valu").first().text().trim() || "unknown";

    const detail = {
      imageUrl,
      images,
      postedAt,
      description: description || null,
      condition: condition.toLowerCase(),
    };

    setCached(detailCache, key, detail);
    return detail;
  } catch (err) {
    console.warn(`[craigslistFetcher] failed to parse detail page ${url}: ${err.message}`);
    return null;
  }
}

module.exports = { searchCraigslist, fetchListingDetail };
