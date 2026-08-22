// server.js
//
// Hagglr — Express server for the buyer portal (search + agent-vs-agent
// negotiation) and the seller portal (photo-to-listing, publish, traction
// dashboard).

require("dotenv").config({ quiet: true });

const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");

const mockListings = require("./data/listings.js");
const craigslistLocations = require("./data/craigslistLocations.js");
const { searchCraigslist, fetchListingDetail } = require("./lib/craigslistFetcher.js");
const { mapWithConcurrency } = require("./lib/concurrency.js");
const { sortListings } = require("./lib/rank.js");
const { runNegotiation } = require("./lib/negotiate.js");
const { detectListingFromPhotos } = require("./lib/vision.js");
const listingStore = require("./lib/listingStore.js");
const { runBuyerAgent, askSellerAboutListing } = require("./lib/buyerAgent.js");
const { listSources } = require("./lib/sources/index.js");
const sellerChannel = require("./lib/sellerChannel.js");
const extensionBridge = require("./lib/extensionBridge.js");
const imessage = require("./lib/imessage.js");
const repostScheduler = require("./lib/repostScheduler.js");
const { findRepostCandidates } = repostScheduler;
const { isConfigured: telegramConfigured } = require("./lib/telegramNotifier.js");

const app = express();
const PORT = process.env.PORT || 3000;
const USE_MOCK_DATA = String(process.env.USE_MOCK_DATA || "").toLowerCase() === "true";
const CRAIGSLIST_LOCATION = process.env.CRAIGSLIST_LOCATION || "sfbay";

// GET /api/search eagerly fetches photos (via a detail-page request per
// listing) for the first page of results, so the results grid shows real
// thumbnails like craigslist.org itself does — not just once a buyer opens
// a specific listing. That means one extra HTTP request to Craigslist per
// result shown, so this is deliberately bounded: only the top-ranked page
// is enriched (not every match, which can be hundreds), fetched with
// limited concurrency, and each request gets a shorter timeout than the
// interactive single-listing case so one slow listing can't stall a whole
// search response.
const SEARCH_PAGE_SIZE = 20;
const SEARCH_MAX_PAGE_SIZE = 30;
// Kept deliberately modest, with jitter (see PHOTO_ENRICH_JITTER_MS below):
// this app got a real 403 from Craigslist mid-development after a burst of
// automated testing, and a handful of requests firing in the exact same
// instant is a bursty, easy-to-fingerprint traffic pattern — one of the
// things anti-bot systems key on. Fewer, staggered requests looks more
// like normal browsing and reduces the odds of tripping the same block
// during ordinary use.
const PHOTO_ENRICH_CONCURRENCY = 3;
const PHOTO_ENRICH_JITTER_MS = 400;
const PHOTO_ENRICH_TIMEOUT_MS = 5000;

// Sorting by date needs each listing's real post date — but that only
// exists after the same per-listing detail fetch that fetches photos (see
// lib/craigslistFetcher.js: the search-results page itself has no date).
// So when a date sort is requested, enrich a larger relevance-ranked
// candidate pool BEFORE sorting/slicing to the page, not just the page
// itself — otherwise every craigslist listing would look equally
// "dateless" at sort time and the sort would silently do nothing. Price,
// relevance, and distance sort don't need this (their fields are already
// on the search-results page), so paging through those works cleanly all
// the way through every match — see the pagination note below.
const DATE_SORT_CANDIDATE_POOL = 40;
// Hard ceiling on how deep date-sorted pagination can go — each page still
// only enriches DATE_SORT_CANDIDATE_POOL-or-current-window listings, but
// letting that window grow unbounded as someone pages deeper would mean
// arbitrarily many Craigslist requests for a single search. Relevance,
// price, and distance sort have no such ceiling — every match is
// paginatable since sorting by those never requires enrichment.
const MAX_DATE_SORT_WINDOW = 120;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// In-memory index of the most recently seen listings, keyed by id, across
// every source (mock, craigslist, seller). Live-fetched (craigslist) and
// mock listings aren't otherwise persisted anywhere, so /api/negotiate needs
// this to look a listing back up by id after a search. Seller listings are
// also persisted in lib/listingStore.js — this index is just a fast-path
// cache for them, not their source of truth.
const recentListingsById = new Map();
function indexListings(listings) {
  for (const l of listings) recentListingsById.set(l.id, l);
}
// Seed the index with mock data + any previously published seller listings
// so negotiate works even before a search has been run.
indexListings(mockListings);
indexListings(listingStore.listAll());

function findListingById(id) {
  const sellerListing = listingStore.getById(id);
  if (sellerListing) return sellerListing;
  return recentListingsById.get(id) || null;
}

// Craigslist search results don't carry a photo, post date, condition, or
// full description (see lib/craigslistFetcher.js) — fetch those on demand
// for a given listing (viewing it, negotiating on it, or being in the
// eagerly-enriched first page of search results — see SEARCH_PAGE_SIZE
// above), rather than for every row Craigslist ever returns for a query.
// Returns the listing unchanged if it's not a craigslist listing, already
// enriched, or the detail fetch fails for any reason.
async function enrichCraigslistListing(listing, { timeoutMs } = {}) {
  if (listing.source !== "craigslist" || !listing.url || listing.imageUrl) {
    return listing;
  }
  const detail = await fetchListingDetail(listing.url, { timeoutMs });
  if (!detail) return listing;

  const enriched = {
    ...listing,
    imageUrl: detail.imageUrl,
    images: detail.images,
    postedAt: detail.postedAt || listing.postedAt,
    description: detail.description || listing.description,
    condition: detail.condition,
  };
  recentListingsById.set(enriched.id, enriched);
  return enriched;
}

// --- Page routes -----------------------------------------------------------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/agent", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "agent.html"));
});

app.get("/sell", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sell.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// --- Craigslist locations ---------------------------------------------------

// Powers the location <select> in the buyer portal — every value it can
// send is a real Craigslist area slug, so search can't 404 from a mistyped
// or made-up location the way a free-text field could.
app.get("/api/craigslist-locations", (req, res) => {
  res.json({ locations: craigslistLocations, default: CRAIGSLIST_LOCATION });
});

// --- Search ------------------------------------------------------------

// Shared by GET /api/search and GET /api/listings/:id/similar: fetches the
// raw listing pool (live Craigslist with mock fallback, folded together
// with seller listings) and applies the plain text/category/price/distance
// filters. Doesn't rank, page, or enrich with photos — callers do that
// differently (search paginates a sorted list; similar-listings just wants
// a small price-proximity-sorted handful).
async function gatherListings({ q = "", category = "", location, maxPrice, maxDistance } = {}) {
  const craigslistLocation = location || CRAIGSLIST_LOCATION;

  let listings = [];
  let source = "mock";
  let craigslistWarning;

  if (!USE_MOCK_DATA) {
    const result = await searchCraigslist({
      query: q,
      location: craigslistLocation,
      category,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
    if (result.listings.length > 0) {
      listings = result.listings;
      source = "craigslist";
    } else {
      // Live fetch failed or returned nothing — fall back to mock/demo data
      // rather than showing the buyer an empty page.
      craigslistWarning = result.error || "no live results";
      console.warn(
        `[server] craigslist search returned no results (${craigslistWarning}) — falling back to mock data`
      );
    }
  }

  if (listings.length === 0) {
    listings = mockListings;
    source = "mock";
  }

  // Always fold in seller-published listings so they're searchable too.
  const sellerListings = listingStore.listAll();
  listings = [...listings, ...sellerListings];

  if (q) {
    const needle = q.toLowerCase();
    listings = listings.filter(
      (l) =>
        l.title.toLowerCase().includes(needle) ||
        (l.description || "").toLowerCase().includes(needle)
    );
  }
  if (category) {
    listings = listings.filter((l) => l.category === category);
  }
  if (maxPrice) {
    listings = listings.filter((l) => typeof l.price !== "number" || l.price <= Number(maxPrice));
  }
  if (maxDistance) {
    listings = listings.filter(
      (l) => l.distanceMiles == null || l.distanceMiles <= Number(maxDistance)
    );
  }

  indexListings(listings);

  return { listings, source, craigslistWarning };
}

app.get("/api/search", async (req, res) => {
  const { q = "", category = "", location, maxPrice, maxDistance, limit, sort, offset } = req.query;
  const pageSize = Math.min(SEARCH_MAX_PAGE_SIZE, Number(limit) || SEARCH_PAGE_SIZE);
  const pageOffset = Math.max(0, Number(offset) || 0);

  const { listings, source, craigslistWarning } = await gatherListings({
    q,
    category,
    location,
    maxPrice,
    maxDistance,
  });

  const isDateSort = sort === "date_asc" || sort === "date_desc";
  const windowEnd = pageOffset + pageSize;
  const totalMatches = listings.length;

  // Relevance/price/distance sort by fields already present on the
  // search-results page — no enrichment needed to sort correctly — so
  // pagination for those can page through every match, not just a fixed
  // first page. Date sort is the exception: it needs enriched candidates
  // to sort within (see the constants above), so its pagination depth is
  // capped at MAX_DATE_SORT_WINDOW.
  let page, hasMore;

  if (isDateSort) {
    const poolSize = Math.min(MAX_DATE_SORT_WINDOW, Math.max(DATE_SORT_CANDIDATE_POOL, windowEnd));
    const candidates = sortListings(listings, "relevance").slice(0, poolSize);
    const enrichedCandidates = await mapWithConcurrency(
      candidates,
      PHOTO_ENRICH_CONCURRENCY,
      (listing) => enrichCraigslistListing(listing, { timeoutMs: PHOTO_ENRICH_TIMEOUT_MS }),
      { jitterMs: PHOTO_ENRICH_JITTER_MS }
    );
    page = sortListings(enrichedCandidates, sort).slice(pageOffset, windowEnd);
    hasMore = windowEnd < Math.min(totalMatches, MAX_DATE_SORT_WINDOW);
  } else {
    const sorted = sortListings(listings, sort);
    const pageListings = sorted.slice(pageOffset, windowEnd);
    // Eagerly fetch photos (+ condition/description/date) for just this
    // page, bounded and concurrency-limited — see the constants above.
    // Non-craigslist listings pass through untouched (mock/seller listings
    // already carry whatever imageUrl they have, or none).
    page = await mapWithConcurrency(
      pageListings,
      PHOTO_ENRICH_CONCURRENCY,
      (listing) => enrichCraigslistListing(listing, { timeoutMs: PHOTO_ENRICH_TIMEOUT_MS }),
      { jitterMs: PHOTO_ENRICH_JITTER_MS }
    );
    hasMore = windowEnd < totalMatches;
  }

  res.json({
    listings: page,
    total: totalMatches,
    offset: pageOffset,
    pageSize,
    hasMore,
    sort: sort || "relevance",
    source,
    usedMockData: source === "mock",
    ...(craigslistWarning ? { craigslistWarning } : {}),
  });
});

app.get("/api/listings/:id", async (req, res) => {
  let listing = findListingById(req.params.id);
  if (!listing) return res.status(404).json({ error: "listing not found" });

  // Traction: increment view count for seller-published listings only —
  // mock/craigslist listings don't belong to anyone on this platform.
  if (listing.source === "seller") {
    listingStore.recordView(listing.id);
  }

  listing = await enrichCraigslistListing(listing);

  res.json(listing);
});

const SIMILAR_LISTINGS_LIMIT = 4;
// How far a candidate's price can be from the base listing's and still
// count as "similar" — wide enough to surface real alternatives, narrow
// enough that a $20 accessory doesn't show up next to a $2,000 bike.
const SIMILAR_PRICE_BAND = 0.5; // ±50%

// Suggests a handful of alternative listings in the same category and a
// similar price range — same specs/price-range idea as "customers also
// viewed". Read-only: never enriches more than SIMILAR_LISTINGS_LIMIT
// listings with photos, same bounded-request principle as /api/search.
app.get("/api/listings/:id/similar", async (req, res) => {
  const listing = findListingById(req.params.id);
  if (!listing) return res.status(404).json({ error: "listing not found" });

  const { listings } = await gatherListings({ category: listing.category, location: req.query.location });

  const priceLow = typeof listing.price === "number" ? listing.price * (1 - SIMILAR_PRICE_BAND) : null;
  const priceHigh = typeof listing.price === "number" ? listing.price * (1 + SIMILAR_PRICE_BAND) : null;

  const candidates = listings
    .filter((l) => l.id !== listing.id)
    .filter((l) => {
      if (priceLow == null || typeof l.price !== "number") return true; // can't price-filter without a number on either side
      return l.price >= priceLow && l.price <= priceHigh;
    })
    .sort((a, b) => {
      // Closest in price first; unknown prices sort last regardless of direction.
      const aDiff = typeof a.price === "number" ? Math.abs(a.price - listing.price) : Infinity;
      const bDiff = typeof b.price === "number" ? Math.abs(b.price - listing.price) : Infinity;
      return aDiff - bDiff;
    })
    .slice(0, SIMILAR_LISTINGS_LIMIT);

  const enriched = await mapWithConcurrency(
    candidates,
    PHOTO_ENRICH_CONCURRENCY,
    (l) => enrichCraigslistListing(l, { timeoutMs: PHOTO_ENRICH_TIMEOUT_MS }),
    { jitterMs: PHOTO_ENRICH_JITTER_MS }
  );

  res.json({ listings: enriched });
});

// --- Negotiation ---------------------------------------------------------

const BUYER_STYLES = ["balanced", "aggressive", "generous"];

app.post("/api/negotiate", async (req, res) => {
  const { listingId, buyerBudget, maxRounds, buyerStyle } = req.body || {};
  if (!listingId) return res.status(400).json({ error: "listingId is required" });
  // Required, not defaulted — the buyer's hard budget ceiling is the core
  // guardrail the buyer agent is constrained to (see enforceConstraints in
  // lib/negotiate.js); it shouldn't be possible to start a negotiation
  // without explicitly setting one, even calling the API directly.
  if (typeof buyerBudget !== "number" || buyerBudget <= 0) {
    return res.status(400).json({ error: "buyerBudget is required and must be a positive number" });
  }

  let listing = findListingById(listingId);
  if (!listing) return res.status(404).json({ error: "listing not found" });
  listing = await enrichCraigslistListing(listing);

  // Traction: a negotiation attempt counts as a buyer inquiry.
  if (listing.source === "seller") {
    listingStore.recordInquiry(listing.id);
  }

  try {
    const result = await runNegotiation({
      listing,
      buyerBudget,
      maxRounds,
      // Falls back to 'balanced' for anything unrecognized rather than
      // rejecting the request — this only shapes tone/pacing, not a hard
      // constraint, so there's nothing unsafe about a bad value here.
      buyerStyle: BUYER_STYLES.includes(buyerStyle) ? buyerStyle : "balanced",
    });
    res.json({ listing, ...result });
  } catch (err) {
    console.error("[server] negotiation failed:", err);
    res.status(502).json({ error: "negotiation failed", detail: err.message });
  }
});

// --- Seller portal: vision-assisted listing draft -------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
});

app.post("/api/vision-detect", upload.array("photos", 6), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "at least one photo is required" });
  }

  const images = req.files.map((f) => ({
    data: f.buffer.toString("base64"),
    mediaType: f.mimetype,
  }));

  try {
    const draft = await detectListingFromPhotos(images);
    res.json({ draft });
  } catch (err) {
    console.error("[server] vision detection failed:", err);
    res.status(502).json({ error: "vision detection failed", detail: err.message });
  }
});

// --- Seller portal: publish a listing --------------------------------------

const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const SELLER_STYLES = ["balanced", "firm", "flexible"];

app.post("/api/listings", upload.single("photo"), (req, res) => {
  const body = req.body || {};
  if (!body.title || !body.price) {
    return res.status(400).json({ error: "title and price are required" });
  }

  // Both optional, but validated strictly (400, not silently ignored) —
  // unlike buyerStyle in /api/negotiate, these get persisted and drive a
  // real constraint (the seller's actual floor), so a bad value here
  // should surface immediately rather than fail silently later.
  let minAcceptablePrice;
  if (body.minAcceptablePrice != null && body.minAcceptablePrice !== "") {
    minAcceptablePrice = Number(body.minAcceptablePrice);
    if (!Number.isFinite(minAcceptablePrice) || minAcceptablePrice <= 0) {
      return res.status(400).json({ error: "minAcceptablePrice must be a positive number" });
    }
    if (minAcceptablePrice > Number(body.price)) {
      return res.status(400).json({ error: "minAcceptablePrice cannot exceed the asking price" });
    }
  }
  if (body.negotiationStyle && !SELLER_STYLES.includes(body.negotiationStyle)) {
    return res.status(400).json({ error: `negotiationStyle must be one of: ${SELLER_STYLES.join(", ")}` });
  }

  let imageUrl = body.imageUrl || null;
  if (req.file) {
    const filename = `${Date.now()}-${req.file.originalname.replace(/[^a-z0-9.\-_]/gi, "_")}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
    imageUrl = `/uploads/${filename}`;
  }

  const listing = listingStore.createListing({
    title: body.title,
    category: body.category,
    price: body.price,
    condition: body.condition,
    description: body.description,
    location: body.location,
    sellerName: body.sellerName,
    imageUrl,
    minAcceptablePrice,
    negotiationStyle: body.negotiationStyle,
    detectedFrom: body.detectedFrom ? JSON.parse(body.detectedFrom) : null,
  });

  recentListingsById.set(listing.id, listing);
  res.status(201).json(listing);
});

// --- Buyer agent -----------------------------------------------------------
//
// The buyer agent (lib/buyerAgent.js) searches every connected marketplace
// for one natural-language request and messages sellers over iMessage when
// the buyer has a question. Three routes: what's available, run the agent,
// and follow up on a single listing.

// What this machine can actually do right now — which sources are on, and
// whether iMessage sending/reply-reading are set up. The UI calls this on
// load so a missing macOS permission shows up as a labelled banner with the
// fix, rather than as a send that mysteriously does nothing.
app.get("/api/agent/status", async (req, res) => {
  const messaging = await imessage.checkSetup();
  res.json({
    sources: listSources(),
    messaging,
    ...sellerChannel.status(),
    extension: extensionBridge.status(),
    limits: {
      perSellerPerDay: imessage.MAX_PER_HANDLE_PER_DAY,
      perDay: imessage.MAX_PER_DAY,
    },
  });
});

// Runs the agent, streaming its steps as they happen.
//
// Server-Sent Events over POST: the request body carries the buyer's
// request, and a full agent run takes long enough (several searches, detail
// fetches, and possibly a send) that a plain JSON response would leave the
// UI staring at a spinner with no idea whether anything is happening. The
// client reads this with fetch + a stream reader rather than EventSource,
// since EventSource is GET-only.
app.post("/api/agent/run", async (req, res) => {
  const { request: buyerRequest, budget, location, allowContact } = req.body || {};
  if (!buyerRequest || !String(buyerRequest).trim()) {
    return res.status(400).json({ error: "request is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // don't let a proxy buffer the stream
  res.flushHeaders();

  // Detect the client going away on the RESPONSE, not the request.
  // req.on("close") fires when the request stream finishes — which for a
  // POST with a small JSON body is immediately, long before the client
  // actually disconnects. Using it here silently suppressed every streamed
  // event: the agent ran fine server-side and the UI showed nothing.
  // res.on("close") is the one that means "the socket went away".
  let clientGone = false;
  res.on("close", () => { clientGone = true; });

  const send = (event) => {
    if (clientGone || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const result = await runBuyerAgent({
      request: String(buyerRequest),
      budget: typeof budget === "number" && budget > 0 ? budget : undefined,
      location: location || CRAIGSLIST_LOCATION,
      listingIndex: recentListingsById,
      allowContact: allowContact !== false,
      onEvent: send,
    });

    send({ type: "result", ...result });
  } catch (err) {
    console.error("[server] buyer agent failed:", err);
    send({ type: "error", error: err.message });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// Ask one seller one question about one listing — the per-card follow-up,
// without spinning up a whole agent run. Drafts in the buyer's voice, then
// sends (see askSellerAboutListing).
app.post("/api/agent/ask", async (req, res) => {
  const { listingId, question, send: shouldSend } = req.body || {};
  if (!listingId) return res.status(400).json({ error: "listingId is required" });
  if (!question || !String(question).trim()) {
    return res.status(400).json({ error: "question is required" });
  }

  let listing = findListingById(listingId);
  if (!listing) return res.status(404).json({ error: "listing not found" });
  listing = await enrichCraigslistListing(listing);

  // Same traction accounting as a negotiation — a question is an inquiry.
  if (listing.source === "seller") listingStore.recordInquiry(listing.id);

  try {
    const result = await askSellerAboutListing({
      listing,
      question: String(question),
      send: shouldSend !== false,
    });
    res.json({ listingId, title: listing.title, ...result });
  } catch (err) {
    console.error("[server] ask-seller failed:", err);
    res.status(502).json({ error: "could not contact seller", detail: err.message });
  }
});

// The conversation with one listing's seller: what we sent (from the audit
// log) plus anything that came back (from chat.db). Polled by the UI.
app.get("/api/agent/threads/:listingId", async (req, res) => {
  const thread = await sellerChannel.getThread(req.params.listingId);
  res.json(thread);
});

// Every seller conversation the agent has opened, newest first — the
// "Messages" view. Reads from the conversation store, so it works whether
// the answers came from a seller agent or over iMessage.
app.get("/api/agent/threads", async (req, res) => {
  const threads = await Promise.all(
    sellerChannel.listThreads().map(async (t) => {
      const full = await sellerChannel.getThread(t.listingId);
      const listing = findListingById(t.listingId);
      return {
        ...t,
        title: listing?.title || t.title || "(listing no longer in cache)",
        price: listing?.price ?? null,
        messages: full.messages,
        replyCount: full.replies.length,
        ...(full.error ? { error: full.error, needsSetup: full.needsSetup } : {}),
      };
    })
  );
  res.json({ threads });
});

// Inbound webhook for the seller agent to deliver an answer it couldn't
// produce synchronously. See THE SELLER-AGENT CONTRACT in
// lib/sellerChannel.js — this is the endpoint that contract points at.
//
// The body is written by another service: treated as data, stored verbatim,
// escaped at render, and quoted to the model as seller content.
app.post("/api/agent/reply", (req, res) => {
  const { threadId, listingId, text } = req.body || {};
  if (!text) return res.status(400).json({ error: "text is required" });
  if (!threadId && !listingId) {
    return res.status(400).json({ error: "one of threadId or listingId is required" });
  }

  const result = sellerChannel.recordInboundReply({ threadId, listingId, text });
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

// --- Facebook Marketplace extension bridge ---------------------------------
//
// The Chrome extension's two endpoints. Marketplace has no buyer-side API,
// so instead of scraping it server-side with a stored login, the extension
// reads it in the user's own signed-in browser and posts results back here.
// See lib/extensionBridge.js.

// The extension is a browser extension, not a page — it fetches from its own
// origin. host_permissions covers it, but be explicit so a misconfigured
// setup fails loudly rather than silently.
function allowExtension(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

app.get("/api/extension/status", allowExtension, (req, res) => {
  res.json(extensionBridge.status());
});

// Long-poll: held open until there's a job or the hold window expires.
app.get("/api/extension/jobs", allowExtension, async (req, res) => {
  const jobs = await extensionBridge.pollForJobs();
  res.json({ jobs });
});

app.post("/api/extension/jobs/:id/results", allowExtension, (req, res) => {
  const { listings, error } = req.body || {};
  const result = extensionBridge.resolveJob(req.params.id, { listings, error });
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

// Whether a given listing's seller can be reached, and why or why not.
// Lets the UI show the truth up front instead of after a failed send.
app.get("/api/listings/:id/contact", async (req, res) => {
  let listing = findListingById(req.params.id);
  if (!listing) return res.status(404).json({ error: "listing not found" });
  listing = await enrichCraigslistListing(listing);
  const contact = sellerChannel.resolveChannel(listing);
  // Never leak the raw handle to the browser — the display form is enough
  // to show who's being messaged, and the send path resolves the real one
  // server-side from the listing anyway.
  res.json({
    listingId: listing.id,
    channel: contact.channel,
    display: contact.display,
    confidence: contact.confidence,
    reason: contact.reason,
  });
});

// --- Seller dashboard: listings + traction ----------------------------------

app.get("/api/dashboard/listings", (req, res) => {
  // NOTE: no auth/seller-accounts yet — this returns every seller-posted
  // listing in the store. Fine for a single-seller demo; needs a real
  // seller identity + auth before this could show only "your" listings.
  const listings = listingStore.listAll();
  const withSuggestions = findRepostCandidates(listings);
  res.json({ listings: withSuggestions });
});

// Manually triggers the same low-traction check the weekly cron job runs —
// mainly for testing a Telegram setup without waiting for Monday. Defaults
// to ignoring the notification cooldown (?force=false to respect it, same
// as the real weekly run). No-ops cleanly with telegramConfigured: false
// if TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID aren't set — see lib/telegramNotifier.js.
app.post("/api/repost-check", async (req, res) => {
  const force = req.query.force !== "false";
  const summary = await repostScheduler.runRepostCheck({ force });
  res.json({ telegramConfigured: telegramConfigured(), ...summary });
});

app.listen(PORT, () => {
  console.log(`Hagglr listening on http://localhost:${PORT}`);
  console.log(`  USE_MOCK_DATA=${USE_MOCK_DATA}  CRAIGSLIST_LOCATION=${CRAIGSLIST_LOCATION}`);

  // Fire-and-forget: neither of these should block the server from
  // accepting requests, and both already no-op safely if Telegram isn't
  // configured — see lib/repostScheduler.js.
  repostScheduler.startCallbackListener();
  repostScheduler.startWeeklySchedule();
});
