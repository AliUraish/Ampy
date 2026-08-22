// public/app.js — buyer portal: search + negotiate

const resultsEl = document.getElementById("results");
const searchMetaEl = document.getElementById("search-meta");
const form = document.getElementById("search-form");
const overlay = document.getElementById("negotiate-overlay");
const panel = document.getElementById("negotiate-panel");

let currentListings = [];

// --- Location dropdown ------------------------------------------------------

async function loadLocations() {
  const select = document.getElementById("location");
  try {
    const res = await fetch("/api/craigslist-locations");
    const { locations, default: defaultSlug } = await res.json();

    // Group in source order (US states first, then other countries) rather
    // than alphabetizing groups — keeps "California" etc. easy to find near
    // the top instead of buried under every other US state alphabetically
    // ahead of it being no better than source order.
    const groups = new Map();
    for (const loc of locations) {
      if (!groups.has(loc.state)) groups.set(loc.state, []);
      groups.get(loc.state).push(loc);
    }

    const optgroupsHtml = [...groups.entries()]
      .map(([state, locs]) => {
        const options = locs
          .map((l) => `<option value="${escapeHtml(l.slug)}">${escapeHtml(l.name)}</option>`)
          .join("");
        return `<optgroup label="${escapeHtml(state)}">${options}</optgroup>`;
      })
      .join("");

    select.innerHTML = optgroupsHtml;
    select.value = defaultSlug;
    // Fall back to the first real option if the configured default slug
    // isn't in the list for some reason (still leaves a valid selection).
    if (!select.value && select.options.length > 0) select.selectedIndex = 0;
  } catch (err) {
    select.innerHTML = `<option value="sfbay">san francisco bay area (fallback — location list failed to load)</option>`;
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function formatPrice(price) {
  return typeof price === "number" ? `$${price.toLocaleString()}` : "price n/a";
}

function timeAgo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function listingCardHtml(listing) {
  const thumb = listing.imageUrl
    ? `<img class="thumb" src="${escapeHtml(listing.imageUrl)}" alt="" />`
    : `<div class="thumb placeholder">no photo</div>`;

  const sourceBadge =
    listing.source === "craigslist"
      ? `<span class="badge">craigslist</span>`
      : listing.source === "seller"
      ? `<span class="badge">hagglr seller</span>`
      : `<span class="badge">demo data</span>`;

  return `
    <div class="listing-card" data-id="${escapeHtml(listing.id)}">
      ${thumb}
      <div class="row">
        <h3>${escapeHtml(listing.title)}</h3>
      </div>
      <div class="row">
        <span class="price large">${formatPrice(listing.price)}</span>
        ${sourceBadge}
      </div>
      <div class="meta">
        <span>${escapeHtml(listing.condition || "unknown")}</span>
        <span class="mono">·</span>
        <span>${escapeHtml(listing.location || "")}</span>
        ${
          listing.distanceMiles != null
            ? `<span class="mono">· ${listing.distanceMiles} mi</span>`
            : ""
        }
        <span class="mono">· ${timeAgo(listing.postedAt)}</span>
      </div>
      <p class="desc">${escapeHtml(listing.description || "")}</p>
      <div class="row">
        ${
          listing.url
            ? `<a href="${escapeHtml(listing.url)}" target="_blank" rel="noopener">view original</a>`
            : `<span></span>`
        }
        <button class="negotiate-btn" data-id="${escapeHtml(listing.id)}">Negotiate</button>
      </div>
    </div>
  `;
}

const loadMoreBtn = document.getElementById("load-more-btn");

// Search state for "Load more" — the params of the search currently on
// screen, and how many results are showing, so a "Load more" click can
// request the next page of the *same* search without re-reading the form
// (the form could change before the user clicks it).
let activeSearchParams = null;
let loadedCount = 0;

function render(listings, { append = false } = {}) {
  currentListings = append ? [...currentListings, ...listings] : listings;

  if (!append && listings.length === 0) {
    resultsEl.innerHTML = `<div class="empty-state">No listings found. Try a different search.</div>`;
    return;
  }

  const html = listings.map(listingCardHtml).join("");
  if (append) {
    resultsEl.insertAdjacentHTML("beforeend", html);
  } else {
    resultsEl.innerHTML = html;
  }
  resultsEl.querySelectorAll(".negotiate-btn").forEach((btn) => {
    // Guard against double-binding on cards already wired from a previous
    // render (only matters when append reuses existing DOM, which it
    // doesn't here since new cards are freshly inserted — kept simple and
    // cheap either way since resultsEl only ever grows or fully resets).
    btn.addEventListener("click", () => openNegotiate(btn.dataset.id));
  });
}

function updateSearchMeta(data) {
  const bits = [`showing ${loadedCount} of ${data.total} results`];
  bits.push(data.usedMockData ? "showing demo data" : "live from craigslist");
  if (data.craigslistWarning) bits.push(`(live fetch note: ${data.craigslistWarning})`);
  searchMetaEl.textContent = bits.join(" — ");
  loadMoreBtn.style.display = data.hasMore ? "inline-block" : "none";
}

async function runSearch(e) {
  if (e) e.preventDefault();
  const q = document.getElementById("q").value.trim();
  const category = document.getElementById("category").value;
  const maxPrice = document.getElementById("maxPrice").value;
  const location = document.getElementById("location").value.trim();
  const sort = document.getElementById("sort").value;

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (maxPrice) params.set("maxPrice", maxPrice);
  if (location) params.set("location", location);
  if (sort && sort !== "relevance") params.set("sort", sort);
  activeSearchParams = params;
  loadedCount = 0;

  searchMetaEl.textContent = "Searching…";
  resultsEl.innerHTML = "";
  loadMoreBtn.style.display = "none";

  try {
    const res = await fetch(`/api/search?${params.toString()}`);
    const data = await res.json();
    loadedCount = data.listings.length;
    render(data.listings || []);
    updateSearchMeta(data);
  } catch (err) {
    searchMetaEl.textContent = "";
    resultsEl.innerHTML = `<div class="error-banner">Search failed: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadMore() {
  if (!activeSearchParams) return;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "Loading…";

  const params = new URLSearchParams(activeSearchParams);
  params.set("offset", String(loadedCount));

  try {
    const res = await fetch(`/api/search?${params.toString()}`);
    const data = await res.json();
    loadedCount += data.listings.length;
    render(data.listings || [], { append: true });
    updateSearchMeta(data);
  } catch (err) {
    searchMetaEl.textContent = `Failed to load more: ${err.message}`;
  } finally {
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "Load more";
  }
}

loadMoreBtn.addEventListener("click", loadMore);

form.addEventListener("submit", runSearch);
document.getElementById("sort").addEventListener("change", runSearch);

// --- Negotiation ------------------------------------------------------------

function turnHtml(turn) {
  const label = turn.role === "buyer" ? "Your agent" : "Seller's agent";
  const offer =
    typeof turn.offerPrice === "number"
      ? `<div class="offer">${formatPrice(turn.offerPrice)}</div>`
      : "";
  // Set server-side in lib/negotiate.js when the agent's raw response
  // violated its hard budget/floor constraint and got corrected in code —
  // shown here so the guardrail is visible, not just invisibly applied.
  const enforcedNote = turn.constraintEnforced
    ? `<div class="hint">⚠ constraint enforced — the model's response was adjusted to respect the ${turn.role === "buyer" ? "budget" : "floor price"}</div>`
    : "";
  return `
    <div class="turn ${turn.role}">
      <div class="who">${label}${turn.accepted ? " · accepted" : ""}${turn.walkAway ? " · walked away" : ""}</div>
      <div>${escapeHtml(turn.message)}</div>
      ${offer}
      ${enforcedNote}
    </div>
  `;
}

async function openNegotiate(listingId) {
  let listing = currentListings.find((l) => l.id === listingId);
  if (!listing) return;

  overlay.style.display = "block";
  panel.innerHTML = `<p class="spinner-label">Loading listing details…</p>`;

  // Craigslist search results don't carry a photo, condition, or full
  // description (Craigslist only puts those on the listing's own page) —
  // fetching this single listing fills those in lazily, only for the one
  // listing the buyer actually opened. See lib/craigslistFetcher.js.
  try {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}`);
    if (res.ok) {
      listing = await res.json();
      const idx = currentListings.findIndex((l) => l.id === listingId);
      if (idx !== -1) currentListings[idx] = listing;
      const card = resultsEl.querySelector(`.listing-card[data-id="${CSS.escape(listingId)}"]`);
      if (card && listing.imageUrl) {
        const thumb = card.querySelector(".thumb");
        if (thumb) thumb.outerHTML = `<img class="thumb" src="${escapeHtml(listing.imageUrl)}" alt="" />`;
      }
    }
  } catch {
    // Non-fatal — fall back to the search-result listing we already have.
  }

  // All of a listing's photos, not just one — see lib/craigslistFetcher.js
  // for where `images` comes from (Craigslist) vs. lib/listingStore.js
  // (seller listings, currently always zero-or-one photo).
  const images = listing.images && listing.images.length > 0 ? listing.images : listing.imageUrl ? [listing.imageUrl] : [];

  const galleryHtml =
    images.length === 0
      ? ""
      : `
    <img class="thumb gallery-hero" id="gallery-hero-img" src="${escapeHtml(images[0])}" alt="" />
    ${
      images.length > 1
        ? `<div class="gallery-thumbs">
             ${images
               .map(
                 (src, i) =>
                   `<img src="${escapeHtml(src)}" class="${i === 0 ? "selected" : ""}" data-src="${escapeHtml(src)}" alt="photo ${i + 1} of ${images.length}" />`
               )
               .join("")}
           </div>`
        : ""
    }
  `;

  panel.innerHTML = `
    <div class="row">
      <h2 style="margin-top:0;">Negotiating: ${escapeHtml(listing.title)}</h2>
      <button class="secondary" id="close-negotiate">Close</button>
    </div>
    ${galleryHtml}
    <p class="hint">
      Asking price: <span class="mono">${formatPrice(listing.price)}</span>
      · condition: ${escapeHtml(listing.condition || "unknown")}
    </p>
    <p class="desc" style="-webkit-line-clamp: initial; white-space: pre-line;">${escapeHtml(listing.description || "")}</p>
    <div class="field-row">
      <div>
        <label for="buyerBudget">Your max budget</label>
        <input type="number" id="buyerBudget" value="${listing.price || ""}" min="1" />
        <p class="hint">Your agent will never offer or accept above this — enforced, not just requested.</p>
      </div>
      <div>
        <label for="buyerStyle">Negotiation style</label>
        <select id="buyerStyle">
          <option value="balanced" selected>Balanced</option>
          <option value="aggressive">Aggressive — push hard for price</option>
          <option value="generous">Generous — close quickly</option>
        </select>
      </div>
    </div>
    <div style="margin-top:14px;">
      <button id="start-negotiate">Start negotiation</button>
    </div>
    <div id="negotiate-body"></div>
  `;

  const heroImg = document.getElementById("gallery-hero-img");
  panel.querySelectorAll(".gallery-thumbs img").forEach((thumbEl) => {
    thumbEl.addEventListener("click", () => {
      if (heroImg) heroImg.src = thumbEl.dataset.src;
      panel.querySelectorAll(".gallery-thumbs img").forEach((t) => t.classList.remove("selected"));
      thumbEl.classList.add("selected");
    });
  });

  document.getElementById("close-negotiate").addEventListener("click", () => {
    overlay.style.display = "none";
  });

  document.getElementById("start-negotiate").addEventListener("click", async () => {
    // Guardrail is required, not just defaulted silently — an empty or
    // non-positive budget refuses to start rather than quietly falling
    // back to the asking price, so the buyer always explicitly sets the
    // hard ceiling their agent will be constrained to.
    const buyerBudgetInput = document.getElementById("buyerBudget");
    const buyerBudget = Number(buyerBudgetInput.value);
    const body = document.getElementById("negotiate-body");
    if (!buyerBudget || buyerBudget <= 0) {
      body.innerHTML = `<div class="error-banner">Set your max budget before starting — your agent needs a hard ceiling to negotiate within.</div>`;
      buyerBudgetInput.focus();
      return;
    }

    const buyerStyle = document.getElementById("buyerStyle").value;
    body.innerHTML = `<p class="spinner-label">Agents are negotiating…</p>`;

    try {
      const res = await fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, buyerBudget, buyerStyle }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      const banner = data.dealReached
        ? `<div class="result-banner deal">Deal reached at ${formatPrice(data.finalPrice)}</div>`
        : `<div class="result-banner no-deal">No deal reached</div>`;

      // Deal-quality scores (0-100) — how good the outcome was for each
      // side relative to the seller's floor and the buyer's budget. This
      // is a scoring metric shown for transparency, not reinforcement
      // learning — it doesn't change how the agents behave next time.
      const scoresHtml =
        typeof data.buyerScore === "number"
          ? `<p class="hint mono">Deal quality — buyer: ${data.buyerScore}/100 · seller: ${data.sellerScore}/100</p>`
          : "";

      const floorNote =
        data.floorPriceSource === "estimated"
          ? `<p class="hint">Seller floor was estimated by Claude (no real seller data available): ${escapeHtml(
              data.floorPriceRationale || ""
            )}</p>`
          : "";

      body.innerHTML = `
        ${banner}
        ${scoresHtml}
        ${floorNote}
        <div class="transcript">${data.transcript.map(turnHtml).join("")}</div>
        <div id="similar-listings"></div>
      `;

      loadSimilarListings(listingId);
    } catch (err) {
      body.innerHTML = `<div class="error-banner">Negotiation failed: ${escapeHtml(err.message)}</div>`;
    }
  });
}

async function loadSimilarListings(listingId) {
  const container = document.getElementById("similar-listings");
  if (!container) return;

  try {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/similar`);
    if (!res.ok) return;
    const { listings } = await res.json();
    if (!listings || listings.length === 0) return;

    container.innerHTML = `
      <h3>Similar listings</h3>
      <div class="listing-grid">${listings.map(listingCardHtml).join("")}</div>
    `;
    container.querySelectorAll(".negotiate-btn").forEach((btn) => {
      btn.addEventListener("click", () => openNegotiate(btn.dataset.id));
    });
    // Similar-listing cards aren't part of the main search results, so
    // openNegotiate's currentListings.find() needs them available too.
    currentListings = [...currentListings, ...listings];
  } catch {
    // Non-fatal — the negotiation result itself already rendered fine.
  }
}

// Initial load
loadLocations().then(runSearch);
