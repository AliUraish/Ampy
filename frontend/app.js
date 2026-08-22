(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    form: $("#scan-form"),
    location: $("#location"),
    category: $("#category"),
    query: $("#query"),
    maxPrice: $("#max-price"),
    scanButton: $("#scan-button"),
    scanButtonText: $(".scan-button-text"),
    replayButton: $("#replay-button"),
    banner: $("#banner"),
    bannerMessage: $("#banner-message"),
    bannerClose: $("#banner-close"),
    liveTickerTrack: $("#live-ticker-track"),
    console: $("#console"),
    consoleStatus: $("#console-status"),
    elapsed: $("#elapsed-time"),
    emptyState: $("#empty-state"),
    emptyKicker: $("#empty-kicker"),
    emptyTitle: $("#empty-title"),
    emptyCopy: $("#empty-copy"),
    skeletons: $("#skeleton-list"),
    dealList: $("#deal-list"),
    passList: $("#pass-list"),
    resultCount: $("#result-count"),
    showPasses: $("#show-passes"),
    cardTemplate: $("#deal-card-template"),
    drawer: $("#deal-drawer"),
    drawerContent: $("#drawer-content"),
    drawerClose: $("#drawer-close"),
    drawerBackdrop: $("#drawer-backdrop")
  };

  const state = {
    deals: [],
    passes: [],
    candidates: new Map(),
    cards: new Map(),
    source: null,
    eventSource: null,
    demoRun: 0,
    startedAt: null,
    timer: null,
    revealTimers: [],
    lastFocus: null,
    scanning: false,
    loadingCache: false,
    currentQuery: "",
    listingCount: null
  };

  const demoEvents = [
    ["progress", { stage: "coverage", markets: 12, available: 12 }],
    ["progress", { stage: "scan", count: 84, markets: 12 }],
    ["progress", { stage: "comps", median: 335, n: 84 }],
    ["progress", { stage: "prefilter", candidates: 31 }],
    ["deal", makeDemoDeal({
      id: "demo-allez", title: "Specialized Allez Elite 56cm", price: 240,
      location: "Oakland / Rockridge", market: "San Francisco Bay Area", postedHours: 7, condition: "excellent",
      estimate: 575, median: 510, score: 82, demand: .78, confidence: .88,
      headline: "Fast-moving road bike at less than half local value",
      reasoning: "The photo and component list match a clean Allez Elite with Shimano 105. Comparable Bay Area road bikes cluster around $475–$600, and this model has consistent resale demand.",
      risk: "Confirm the frame serial and inspect the carbon fork for crash damage before buying."
    })],
    ["deal", makeDemoDeal({
      id: "demo-trek", title: "Trek FX 3 Disc — hydraulic brakes", price: 120,
      location: "Brooklyn", market: "New York", postedHours: 2, condition: "good",
      estimate: 430, median: 390, score: 91, demand: .86, confidence: .91,
      headline: "Best margin in the scan, with strong commuter demand",
      reasoning: "This appears to be a genuine FX 3 with hydraulic discs and original Bontrager wheels. Similar hybrids sell locally for $350–$450, while the seller's moving deadline likely explains the discount.",
      risk: "The rear derailleur hanger may be slightly bent; budget for a tune-up and verify shifting under load."
    })],
    ["deal", makeDemoDeal({
      id: "demo-cannondale", title: "Cannondale Quick 4 commuter", price: 265,
      location: "Silver Lake", market: "Los Angeles", postedHours: 19, condition: "good",
      estimate: 395, median: 370, score: 68, demand: .69, confidence: .77,
      headline: "A credible flip if the drivetrain checks out",
      reasoning: "The asking price sits below the local median and the frame looks clean. Margin is useful but narrower after a likely tune-up, so condition matters more than on the top-ranked listings.",
      risk: "Listing photos do not show the cassette closely; check chain wear and rear wheel alignment."
    })],
    ["deal", makeDemoDeal({
      id: "demo-bianchi", title: "Bianchi Volpe steel touring bike", price: 310,
      location: "Logan Square", market: "Chicago", postedHours: 31, condition: "fair",
      estimate: 415, median: 400, score: 57, demand: .61, confidence: .66,
      headline: "Modest upside for a patient vintage-bike buyer",
      reasoning: "Steel Bianchi touring frames have a loyal but smaller buyer pool. The price is under comps, though visible cosmetic wear and slower demand keep this in maybe territory.",
      risk: "Surface rust is visible near the cable guides; inspect inside the frame and confirm the seatpost is not seized."
    })],
    ["deal", makeDemoDeal({
      id: "demo-pinarello", title: "Pinarello Dogma carbon race bike", price: 90,
      location: "Capitol Hill", market: "Seattle", postedHours: 3, condition: "excellent",
      estimate: 2450, median: 2200, score: 38, demand: .89, confidence: .34,
      headline: "The price is implausible for the claimed model",
      reasoning: "A genuine Dogma at this condition would trade above $2,000. The listing uses a polished catalog-style image, has almost no description, and is priced below 5% of fair value.",
      risk: "High scam or stolen-goods risk. Do not send a deposit; require serial verification and an in-person inspection.",
      flags: ["too_good", "stock_photo"]
    })],
    ["pass", makeDemoPass({
      id: "demo-pass-1", title: "Vintage Schwinn road bicycle", price: 325,
      location: "Montrose", market: "Houston", postedHours: 46, condition: "fair", estimate: 355, median: 348,
      score: 49, demand: .43, confidence: .71,
      headline: "The service bill eats nearly all of the upside",
      reasoning: "The frame looks complete, but ordinary vintage Schwinn road bikes trade in a narrow range. Tires, cables, and a likely tune-up leave too little room at this asking price.",
      risk: "Check the wheels, bottom bracket, and seized components; restoration costs can exceed the remaining margin.",
      reason: "Estimated upside is only $18 after expected service."
    })],
    ["pass", makeDemoPass({
      id: "demo-pass-2", title: "Carbon road bike frame — unknown brand", price: 280,
      location: "Cambridge", market: "Boston", postedHours: 11, condition: "fair", estimate: 330, median: 410,
      score: 42, demand: .55, confidence: .28,
      headline: "Too little evidence to price an anonymous carbon frame",
      reasoning: "The photo does not expose a serial, maker mark, size label, or useful component detail. Without an identifiable model, the appraisal range is too wide for a confident flip.",
      risk: "Hidden crash damage is the central risk. Inspect every tube junction and do not buy without verifiable provenance.",
      redFlags: ["unknown brand", "no serial shown"],
      reason: "Low confidence: no serial, size, components, or usable photo."
    })],
    ["done", { deals: 5, scored: 7, ms: 4028, source: "mock" }]
  ];

  function makeDemoDeal(config) {
    const fairValue = Math.round(config.median * .4 + config.estimate * .6);
    const margin = Math.max(-1, Math.min(2, (fairValue - config.price - 15) / config.price));
    return {
      id: config.id,
      category: "bikes",
      title: config.title,
      price: config.price,
      condition: config.condition,
      distanceMiles: null,
      location: config.location,
      market: config.market,
      postedAt: new Date(Date.now() - config.postedHours * 3600000).toISOString(),
      sellerName: null,
      sellerRating: null,
      description: config.reasoning,
      url: "https://sfbay.craigslist.org/search/bia",
      imageUrl: null,
      source: "mock",
      valuation: {
        item: "road bike",
        brandModel: config.title.split("—")[0].trim(),
        condition: config.condition,
        estimatedResaleUsd: config.estimate,
        redFlags: config.redFlags || config.flags || [],
        reasoning: config.reasoning
      },
      compsMedian: config.median,
      compsN: 12,
      fairValue,
      demand: { value: config.demand, source: "trends", keyword: config.title.split(" ").slice(0, 3).join(" ") },
      deal: {
        score: config.score,
        margin,
        marginN: (margin + 1) / 3,
        demand: config.demand,
        confidence: config.confidence,
        flags: config.flags || [],
        headline: config.headline,
        why: config.reasoning,
        riskNote: config.risk
      }
    };
  }

  function makeDemoPass(config) {
    return { ...makeDemoDeal(config), reason: config.reason };
  }

  function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(number);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function scoreColor(score) {
    if (score >= 75) return "var(--navy)";
    if (score >= 60) return "var(--accent)"; // matches PASS_THRESHOLD in lib/dealScan.js
    return "var(--muted)";
  }

  function postedAgo(date) {
    if (!date) return "posted recently";
    const timestamp = new Date(date).getTime();
    if (!Number.isFinite(timestamp)) return "posted recently";
    const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3600000));
    if (hours < 1) return "posted <1h ago";
    if (hours < 24) return `posted ${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `posted ${days}d ago`;
  }

  function safeText(value, fallback = "") {
    return value === null || value === undefined || value === "" ? fallback : String(value);
  }

  function listingPlace(listing) {
    const places = [listing?.location, listing?.market]
      .map((value) => safeText(value))
      .filter(Boolean);
    return [...new Set(places)].join(" · ") || "Location not listed";
  }

  function escapeHtml(value) {
    return safeText(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function safeUrl(value) {
    if (!value) return "#";
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch (_error) {
      return "#";
    }
  }

  function timestamp() {
    return new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function appendTicker(message, type = "progress", mark = "›") {
    const item = document.createElement("span");
    item.className = `ticker-event is-${type}`;
    item.textContent = `${mark} ${message}`;

    const badge = document.createElement("i");
    badge.textContent = "DF";
    badge.setAttribute("aria-hidden", "true");
    elements.liveTickerTrack.append(item, badge);
  }

  function appendLog(message, type = "progress", mark = "›", tickerMessage = message, { ticker = true } = {}) {
    const line = document.createElement("div");
    line.className = `log-line is-${type}`;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = timestamp();

    const icon = document.createElement("span");
    icon.className = "log-mark";
    icon.textContent = mark;

    const text = document.createElement("span");
    text.textContent = message;

    line.append(time, icon, text);
    elements.console.append(line);
    elements.console.scrollTop = elements.console.scrollHeight;
    if (ticker) appendTicker(tickerMessage, type, mark);
  }

  function showBanner(message) {
    elements.bannerMessage.textContent = message;
    elements.banner.hidden = false;
  }

  function hideBanner() {
    elements.banner.hidden = true;
  }

  function setScanning(scanning) {
    state.scanning = scanning;
    elements.scanButton.disabled = scanning;
    elements.scanButton.classList.toggle("is-scanning", scanning);
    elements.scanButtonText.textContent = scanning ? "Searching…" : "Find deals";
    elements.consoleStatus.classList.toggle("is-live", scanning);
    elements.consoleStatus.lastChild.textContent = scanning ? " LIVE" : " IDLE";

    if (scanning) {
      state.startedAt = Date.now();
      clearInterval(state.timer);
      state.timer = setInterval(updateElapsed, 1000);
      updateElapsed();
    } else {
      clearInterval(state.timer);
      state.timer = null;
      updateElapsed();
    }
  }

  function updateElapsed() {
    if (!state.startedAt) {
      elements.elapsed.textContent = "00:00";
      return;
    }
    const total = Math.floor((Date.now() - state.startedAt) / 1000);
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    elements.elapsed.textContent = `${minutes}:${seconds}`;
  }

  function resetScan() {
    closeDrawer();
    if (state.eventSource) state.eventSource.close();
    state.eventSource = null;
    state.demoRun += 1;
    state.deals = [];
    state.passes = [];
    state.candidates.clear();
    state.cards.clear();
    state.source = null;
    state.loadingCache = false;
    state.listingCount = null;
    elements.dealList.replaceChildren();
    elements.passList.replaceChildren();
    elements.liveTickerTrack.replaceChildren();
    elements.passList.hidden = !elements.showPasses.checked;
    elements.console.replaceChildren();
    elements.emptyState.hidden = true;
    setEmptyState();
    elements.skeletons.hidden = false;
    updateResultCount();
    hideBanner();
  }

  function setEmptyState(query = "") {
    if (query) {
      elements.emptyKicker.textContent = "No matching listings";
      elements.emptyTitle.textContent = "Nothing found this time.";
      elements.emptyCopy.textContent = `Craigslist returned no listings for “${query}” across the current U.S. coverage and category. Try All categories, a broader phrase, or a higher budget.`;
      return;
    }
    elements.emptyKicker.textContent = "Ready when you are";
    elements.emptyTitle.innerHTML = "Promising finds<br>will land here.";
    elements.emptyCopy.textContent = "We compare the ask, condition, market comps, and resale demand as listings arrive across the U.S.";
  }

  function scanParams(cached = false) {
    const params = new URLSearchParams({
      location: elements.location.value || "us",
      category: elements.category.value,
      query: elements.query.value.trim(),
      maxPrice: elements.maxPrice.value || "400"
    });
    if (cached) params.set("cached", "1");
    return params;
  }

  function startScan({ cached = false } = {}) {
    const query = elements.query.value.trim();
    if (!query) {
      elements.query.focus();
      return;
    }

    resetScan();
    state.currentQuery = query;
    setScanning(true);

    appendLog(`scan initialized · United States / ${elements.category.value} / “${query}”`, "progress", "▸");

    const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
    if (demoMode) {
      showBanner("Demo fixture active — playing a representative U.S. scan locally.");
      playDemo();
      return;
    }

    if (cached) showBanner("Showing last real scan · press Start scan for live");
    connectEvents(scanParams(cached));
  }

  function connectEvents(params, { silentCache = false } = {}) {
    const endpoint = typeof params === "string" ? params : `/api/deals?${params.toString()}`;
    const source = new EventSource(endpoint);
    state.eventSource = source;

    ["progress", "candidate", "analysis", "deal", "pass", "done", "error"].forEach((eventName) => {
      source.addEventListener(eventName, (event) => {
        if (state.eventSource !== source) return;
        if (!event.data) return;
        try {
          handleEvent(eventName, JSON.parse(event.data), { silentCache });
        } catch (_error) {
          if (eventName === "error") handleFatal({ message: "The scan ended with an unreadable error." }, { silentCache });
        }
      });
    });

    source.onerror = (event) => {
      if (state.eventSource !== source) return;
      if (event.data || (!state.scanning && !state.loadingCache)) return;
      handleFatal({ message: "The live stream disconnected before the scan completed." }, { silentCache });
    };
  }

  function playDemo() {
    const runId = state.demoRun;
    demoEvents.forEach(([event, data], index) => {
      window.setTimeout(() => {
        if (runId !== state.demoRun) return;
        handleEvent(event, data);
      }, (index + 1) * 400);
    });
  }

  function handleEvent(event, data, options = {}) {
    if (event === "progress" && !options.silentCache) handleProgress(data);
    if (event === "candidate") handleCandidate(data, options);
    if (event === "analysis") handleAnalysis(data, options);
    if (event === "deal") handleDeal(data, options);
    if (event === "pass") handlePass(data, options);
    if (event === "done") handleDone(data, options);
    if (event === "error") handleFatal(data, options);
  }

  function handleProgress(data) {
    if (data.stage === "scan") state.listingCount = Number(data.count) || 0;
    const messages = {
      market: () => `${safeText(data.market, "U.S. market")} · ${data.unavailable ? "unavailable" : `${safeText(data.count, 0)} listings found`}`,
      coverage: () => `U.S. coverage · ${safeText(data.available, 0)} of ${safeText(data.markets, 0)} priority markets available`,
      scan: () => `scanned ${safeText(data.count, 0)} listings across ${safeText(data.markets, 1)} U.S. markets`,
      comps: () => `market comps · median ${money(data.median)} across n=${safeText(data.n, 0)}`,
      prefilter: () => `pre-filter retained ${safeText(data.candidates, 0)} candidates below median`,
      valuing: () => `Mistral evaluating “${safeText(data.title, data.id || "listing") }”`
    };
    appendLog(messages[data.stage] ? messages[data.stage]() : `${safeText(data.stage, "working")} · agent processing`, "progress", "▸");
  }

  function setCardPhoto(card, listing) {
    const photo = card.querySelector(".deal-photo");
    const imageUrl = safeUrl(listing.imageUrl);
    if (!photo || imageUrl === "#") return;
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = `${safeText(listing.title, "Listing")} photo`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.replaceWith(cardPhotoPlaceholder()), { once: true });
    photo.replaceChildren(image);
  }

  function setCardFlipped(card, flipped, { focus = false } = {}) {
    const front = card.querySelector(".card-front");
    const back = card.querySelector(".card-back");
    card.classList.toggle("is-flipped", flipped);
    front.setAttribute("aria-hidden", String(flipped));
    back.setAttribute("aria-hidden", String(!flipped));
    front.inert = flipped;
    back.inert = !flipped;
    if (focus) {
      const target = flipped ? back.querySelector(".card-unflip") : front.querySelector(".reasoning-affordance");
      window.setTimeout(() => target?.focus(), 220);
    }
  }

  function appendCardTrace(card, label, message, tone = "info") {
    const terminal = card?.querySelector(".card-terminal");
    if (!terminal) return;
    const line = document.createElement("div");
    line.className = `card-terminal-line is-${tone}`;
    const prompt = document.createElement("span");
    prompt.textContent = ">";
    const body = document.createElement("p");
    const tag = document.createElement("b");
    tag.textContent = label;
    body.append(tag, document.createTextNode(` ${message}`));
    line.append(prompt, body);
    terminal.append(line);
    terminal.scrollTop = terminal.scrollHeight;
  }

  function initCard(card) {
    card.querySelectorAll(".card-flip-trigger").forEach((button) => {
      button.addEventListener("click", () => {
        if (!card.classList.contains("is-complete")) return;
        setCardFlipped(card, true, { focus: true });
      });
    });
    card.querySelector(".card-unflip").addEventListener("click", () => {
      if (card.classList.contains("is-complete")) setCardFlipped(card, false, { focus: true });
    });
    card.querySelectorAll(".product-detail-trigger").forEach((button) => {
      button.addEventListener("click", () => {
        if (card.classList.contains("is-complete") && card._listing) openProductDetails(card._listing, card);
      });
    });
    card.querySelector(".card-full-trace").addEventListener("click", () => {
      if (card.classList.contains("is-complete") && card._listing) openDrawer(card._listing, card);
    });
  }

  function createCandidateCard(listing) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.id = listing.id;
    card._listing = listing;
    card.classList.add("is-analyzing", "is-flipped");
    card.querySelector(".deal-main h3").textContent = safeText(listing.title, "Untitled listing");
    card.querySelector(".deal-meta").innerHTML = `${escapeHtml(listingPlace(listing))} · <strong>${escapeHtml(money(listing.price))} asking</strong>`;
    card.querySelector(".score-value").textContent = "…";
    card.querySelector(".card-rank").textContent = "Candidate · analyzing";
    card.querySelector(".trace-card-title").textContent = safeText(listing.title, "Inspecting listing");
    card.querySelector(".trace-card-ask").textContent = `${money(listing.price)} ASK`;
    setCardPhoto(card, listing);
    initCard(card);
    setCardFlipped(card, true);
    appendCardTrace(card, "DISCOVERED", `${money(listing.price)} ask · below ${money(listing.compsMedian)} search median`);
    return card;
  }

  function handleCandidate(listing, { silentCache = false } = {}) {
    if (silentCache || !listing?.id || state.cards.has(listing.id)) return;
    state.candidates.set(listing.id, listing);
    const card = createCandidateCard(listing);
    state.cards.set(listing.id, card);
    elements.dealList.append(card);
    elements.skeletons.hidden = true;
    elements.emptyState.hidden = true;
    updateResultCount();
  }

  function handleAnalysis(data, { silentCache = false } = {}) {
    if (silentCache || !data?.id) return;
    const card = state.cards.get(data.id);
    if (!card?.classList.contains("is-analyzing")) return;
    const messages = {
      details: () => {
        const current = state.candidates.get(data.id) || card._listing || {};
        const merged = { ...current, ...(data.listing || {}) };
        state.candidates.set(data.id, merged);
        card._listing = merged;
        setCardPhoto(card, merged);
        return `${merged.imageUrl ? "photo + " : ""}listing details fetched · condition ${safeText(merged.condition, "unknown")}`;
      },
      appraisal: () => {
        const value = data.valuation || {};
        return `Mistral identified ${safeText(value.brandModel, value.item || "item")} · ${safeText(value.condition, "unknown")} · blind appraisal ${money(value.estimatedResaleUsd)}`;
      },
      comps: () => `${money(data.compsMedian)} Craigslist asking median · n=${safeText(data.compsN, 0)}`,
      demand: () => `${safeText(data.demand?.keyword, "category")} · ${Math.round(clamp(data.demand?.value, 0, 1) * 100)}% proxy via ${safeText(data.demand?.source, "baseline")}`,
      score: () => `${Math.round(clamp(data.deal?.score, 0, 100))}/100 · fair value ${money(data.fairValue)} · ${Math.round(clamp(data.deal?.confidence, 0, 1) * 100)}% confidence`,
      verdict: () => `${safeText(data.headline, "Deal threshold met")} · score ${Math.round(clamp(data.score, 0, 100))}`,
      error: () => safeText(data.message, "Candidate could not be scored")
    };
    const labels = { details: "DETAILS", appraisal: "MISTRAL", comps: "COMPS", demand: "DEMAND", score: "SCORE", verdict: "VERDICT", error: "ERROR" };
    appendCardTrace(card, labels[data.stage] || "EVIDENCE", messages[data.stage] ? messages[data.stage]() : safeText(data.stage, "updated"), data.stage === "error" ? "error" : data.stage === "verdict" ? "success" : "info");
  }

  function hydrateDealCard(card, listing, { silent = false, fromLive = false } = {}) {
    const score = Math.round(clamp(listing.deal.score, 0, 100));
    const flags = Array.isArray(listing.deal.flags) ? listing.deal.flags : [];
    const delta = Number(listing.fairValue) - Number(listing.price);
    const demand = clamp(listing.demand?.value, 0, 1);
    const confidence = clamp(listing.deal?.confidence, 0, 1);
    card._listing = listing;
    card.classList.remove("is-analyzing");
    card.classList.add("is-complete");
    card.style.setProperty("--score-color", scoreColor(score));
    card.querySelector(".deal-main h3").textContent = safeText(listing.title, "Untitled listing");
    card.querySelector(".score-value").textContent = score;
    card.querySelector(".deal-meta").innerHTML = `${escapeHtml(listingPlace(listing))} · ${escapeHtml(postedAgo(listing.postedAt))} · <strong>${escapeHtml(money(listing.price))} asking</strong>`;
    card.querySelector(".demand-tag").textContent = `${Math.round(demand * 100)} demand · ${safeText(listing.demand?.source, "baseline")}`;
    card.querySelector(".confidence-tag").textContent = `${Math.round(confidence * 100)}% confidence`;
    card.querySelector(".deal-delta").textContent = `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}`;
    card.querySelector(".fair-value").textContent = `${money(listing.fairValue)} fair value`;
    const discount = Number(listing.fairValue) > 0 ? Math.round((1 - Number(listing.price) / Number(listing.fairValue)) * 100) : 0;
    card.querySelector(".market-sticker").textContent = `${discount >= 0 ? "−" : "+"}${Math.abs(discount)}% VS MARKET`;
    setCardPhoto(card, listing);
    const chip = card.querySelector(".flag-chip");
    if (flags.includes("too_good")) {
      card.classList.add("is-sus");
      chip.hidden = false;
      chip.textContent = "SUS";
    }
    card.querySelector(".trace-card-title").textContent = safeText(listing.title, "Completed analysis");
    card.querySelector(".trace-card-ask").textContent = `${money(listing.price)} ASK`;
    card.querySelector(".trace-card-status").innerHTML = "<i></i> ANALYSIS COMPLETE";
    card.querySelector(".card-unflip").disabled = false;
    card.querySelector(".card-full-trace").disabled = false;
    card.querySelectorAll(".product-detail-trigger, .card-flip-trigger").forEach((button) => { button.disabled = false; });
    if (!fromLive) {
      const terminal = card.querySelector(".card-terminal");
      terminal.replaceChildren();
      appendCardTrace(card, "DISCOVERED", `${money(listing.price)} ask · listing captured from ${safeText(listing.source, "source")}`);
      appendCardTrace(card, "MISTRAL", `${safeText(listing.valuation?.brandModel, listing.valuation?.item || "item")} · blind appraisal ${money(listing.valuation?.estimatedResaleUsd)}`);
      appendCardTrace(card, "COMPS", `${money(listing.compsMedian)} Craigslist asking median · n=${safeText(listing.compsN, 0)}`);
      appendCardTrace(card, "DEMAND", `${Math.round(demand * 100)}% proxy via ${safeText(listing.demand?.source, "baseline")}`);
      appendCardTrace(card, "RESULT", `surfaced at ${score}/100 · ${money(delta)} estimated upside`, "success");
    } else {
      appendCardTrace(card, "RESULT", `DEAL SURFACED · ${score}/100 · ${money(delta)} estimated upside`, "success");
    }
    if (silent) card.querySelector(".score-ring").style.setProperty("--ring-progress", `${score * 3.6}deg`);
    else animateRing(card.querySelector(".score-ring"), score);
  }

  function createDealCard(listing, { silent = false } = {}) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.id = listing.id;
    initCard(card);
    hydrateDealCard(card, listing, { silent, fromLive: false });
    setCardFlipped(card, false);
    return card;
  }

  function rankDealCards() {
    const fragment = document.createDocumentFragment();
    state.deals.forEach((deal, index) => {
      const card = state.cards.get(deal.id);
      if (!card) return;
      card.classList.remove("rank-1", "rank-2", "rank-3", "rank-4", "rank-5");
      card.classList.add(`rank-${(index % 5) + 1}`);
      card.querySelector(".card-rank").textContent = `#${String(index + 1).padStart(2, "0")} · ${index === 0 ? "TOP PICK" : "FINDER PICK"}`;
      fragment.append(card);
    });
    state.candidates.forEach((_candidate, id) => {
      const card = state.cards.get(id);
      if (card) fragment.append(card);
    });
    elements.dealList.append(fragment);
  }

  function handleDeal(listing, { silentCache = false } = {}) {
    const score = clamp(listing?.deal?.score, 0, 100);
    if (!listing || !listing.id || !listing.deal) return;
    const priorIndex = state.deals.findIndex((deal) => deal.id === listing.id);
    if (priorIndex >= 0) state.deals.splice(priorIndex, 1);
    state.deals.push(listing);
    state.deals.sort((a, b) => Number(b.deal.score) - Number(a.deal.score));
    const existing = state.cards.get(listing.id);
    const wasLive = Boolean(existing?.classList.contains("is-analyzing"));
    const card = existing || createDealCard(listing, { silent: silentCache });
    if (wasLive) hydrateDealCard(card, listing, { silent: silentCache, fromLive: true });
    state.cards.set(listing.id, card);
    state.candidates.delete(listing.id);
    rankDealCards();
    elements.skeletons.hidden = true;
    elements.emptyState.hidden = true;
    updateResultCount();
    if (wasLive) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => setCardFlipped(card, false), reduced ? 0 : 520);
    }
    const delta = Number(listing.fairValue) - Number(listing.price);
    const flagged = Array.isArray(listing.deal.flags) && listing.deal.flags.includes("too_good");
    if (!silentCache) appendLog(
      flagged ? `flagged “${listing.title}” · implausible price / too good` : `score ${Math.round(score)} · “${listing.title}” · ${money(delta)} upside`,
      flagged ? "pass" : "deal", flagged ? "!" : "✓",
      flagged ? `SUS · ${listing.title} · IMPLAUSIBLE PRICE` : `${listing.title} · SCORE ${Math.round(score)} · ${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}`
    );
  }

  function animateRing(ring, score) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : 720;
    const start = performance.now();
    const target = score * 3.6;

    function frame(now) {
      const progress = duration ? Math.min(1, (now - start) / duration) : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      ring.style.setProperty("--ring-progress", `${target * eased}deg`);
      if (progress < 1 && ring.isConnected) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function handlePass(pass, { silentCache = false } = {}) {
    if (!pass || !pass.id) return;
    const pendingCard = state.cards.get(pass.id);
    if (pendingCard?.classList.contains("is-analyzing")) {
      appendCardTrace(
        pendingCard,
        "RESULT",
        `PASS · ${safeText(pass.reason, "did not meet the deal threshold")}`,
        "error"
      );
      pendingCard.remove();
      state.cards.delete(pass.id);
      state.candidates.delete(pass.id);
    }
    state.passes.push(pass);
    const item = document.createElement("div");
    item.className = "pass-item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `${safeText(pass.title, "Untitled listing")}, passed. View decision trace.`);

    const mark = document.createElement("span");
    mark.className = "pass-mark";
    mark.textContent = "PASS";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = safeText(pass.title, "Untitled listing");
    const reason = document.createElement("small");
    reason.textContent = safeText(pass.reason, "Did not meet the deal threshold.");
    body.append(title, reason);
    const price = document.createElement("span");
    price.className = "pass-price";
    price.textContent = money(pass.price);
    const affordance = document.createElement("span");
    affordance.className = "pass-reasoning";
    affordance.textContent = "VIEW DECISION TRACE ↗";
    item.append(mark, body, price, affordance);
    const open = () => openDrawer(pass, item, true);
    item.addEventListener("click", open);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    elements.passList.append(item);
    updateResultCount();
    if (!silentCache) appendLog(`passed “${safeText(pass.title)}” · ${safeText(pass.reason, "below threshold")}`, "pass", "×");
  }

  function handleDone(data, { silentCache = false } = {}) {
    if (state.eventSource) state.eventSource.close();
    state.eventSource = null;
    state.loadingCache = false;
    state.source = data.source;
    if (!silentCache) setScanning(false);
    elements.skeletons.hidden = true;

    if (!state.deals.length) {
      if (data.source === "craigslist" && state.listingCount === 0) setEmptyState(state.currentQuery);
      elements.emptyState.hidden = false;
    }
    if (silentCache) {
      appendLog("loaded last real scan", "progress", "■", "", { ticker: false });
      showBanner("Showing last real scan · press Start scan for live");
      return;
    }
    const duration = Number.isFinite(Number(data.ms)) ? `${(Number(data.ms) / 1000).toFixed(1)}s` : elements.elapsed.textContent;
    appendLog(`scan complete · ${safeText(data.deals, state.deals.length)} surfaced / ${safeText(data.scored, state.deals.length + state.passes.length)} scored · ${duration}`, "progress", "■");

    if (data.source === "cache") {
      showBanner("Showing last real scan · press Start scan for live");
    } else if (data.source === "mock" && !demoMode) {
      showBanner("Craigslist unavailable — showing representative fallback listings.");
    }
  }

  function handleFatal(data, { silentCache = false } = {}) {
    if (state.eventSource) state.eventSource.close();
    state.eventSource = null;
    state.loadingCache = false;
    if (silentCache) {
      state.deals = [];
      state.passes = [];
      state.candidates.clear();
      state.cards.clear();
      elements.dealList.replaceChildren();
      elements.passList.replaceChildren();
      elements.emptyState.hidden = false;
      elements.skeletons.hidden = true;
      updateResultCount();
      return;
    }
    setScanning(false);
    elements.skeletons.hidden = true;
    if (!state.deals.length) elements.emptyState.hidden = false;
    const message = safeText(data?.message, "The scan could not be completed.");
    appendLog(message, "error", "!");
    showBanner(`${message} Try Replay cached to keep the demo moving.`);
  }

  function updateResultCount() {
    const dealWord = state.deals.length === 1 ? "deal" : "deals";
    const analyzing = state.candidates.size ? ` · ${state.candidates.size} analyzing` : "";
    elements.resultCount.textContent = state.passes.length
      ? `${state.deals.length} ${dealWord}${analyzing} · ${state.passes.length} passed`
      : `${state.deals.length} ${dealWord}${analyzing}`;
  }

  function optionalNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function displayMetric(value, formatter = String) {
    return value === null ? "not emitted" : formatter(value);
  }

  function openProductDetails(listing, card) {
    state.lastFocus = card;
    document.querySelectorAll(".deal-card.is-selected").forEach((node) => node.classList.remove("is-selected"));
    card.classList.add("is-selected");
    const ask = optionalNumber(listing.price);
    const fair = optionalNumber(listing.fairValue);
    const upside = ask === null || fair === null ? null : fair - ask;
    const estimate = optionalNumber(listing.valuation?.estimatedResaleUsd);
    const median = optionalNumber(listing.compsMedian);
    const demand = optionalNumber(listing.demand?.value);
    const listingUrl = safeUrl(listing.url);
    const hasListingUrl = listingUrl !== "#";
    const risk = safeText(listing.deal?.riskNote, "No specific risk was emitted. Inspect the item and verify the seller before buying.");
    const reason = safeText(listing.deal?.why, listing.valuation?.reasoning || "The result cleared the current score threshold based on margin, demand, and confidence.");

    elements.drawer.style.setProperty("--score-color", scoreColor(clamp(listing.deal?.score, 0, 100)));
    elements.drawer.classList.remove("is-sus");
    elements.drawerContent.innerHTML = `
      <header class="opportunity-header">
        <p class="reasoning-kicker">PRODUCT OPPORTUNITY</p>
        <h2 id="drawer-title">${escapeHtml(listing.title || "Untitled listing")}</h2>
        <p>${escapeHtml(listingPlace(listing))} · ${escapeHtml(postedAgo(listing.postedAt))}</p>
      </header>
      <div class="opportunity-body">
        <section class="opportunity-hero">
          <div><span>Seller asks</span><strong>${escapeHtml(displayMetric(ask, money))}</strong></div>
          <div><span>Current fair value</span><strong>${escapeHtml(displayMetric(fair, money))}</strong></div>
          <div class="is-upside"><span>Estimated gross upside</span><strong>${escapeHtml(displayMetric(upside, (value) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`))}</strong></div>
        </section>
        <section class="opportunity-narrative">
          <span>WHY THIS MAY MAKE MONEY</span>
          <h3>${escapeHtml(listing.deal?.headline || "The listing is priced below the evidence-backed estimate")}</h3>
          <p>${escapeHtml(reason)}</p>
        </section>
        <div class="opportunity-evidence">
          <section><span>MISTRAL BLIND APPRAISAL</span><strong>${escapeHtml(displayMetric(estimate, money))}</strong><p>${escapeHtml(listing.valuation?.reasoning || "No appraisal explanation was emitted.")}</p></section>
          <section><span>CRAIGSLIST MARKET EVIDENCE</span><strong>${escapeHtml(displayMetric(median, money))}</strong><p>Median asking price across ${escapeHtml(safeText(listing.compsN, 0))} search results. Asking prices are not confirmed sales.</p></section>
          <section><span>DEMAND SIGNAL</span><strong>${demand === null ? "—" : `${Math.round(clamp(demand, 0, 1) * 100)}%`}</strong><p>${escapeHtml(safeText(listing.demand?.keyword, "Category"))} via ${escapeHtml(safeText(listing.demand?.source, "baseline"))}; a demand proxy, not sales volume.</p></section>
          <section class="is-risk"><span>WHAT COULD BREAK THE DEAL</span><strong>Verify before buying</strong><p>${escapeHtml(risk)}</p></section>
        </div>
        <div class="opportunity-actions">
          <button class="open-decision-trace" type="button">Open full 7-step decision trace <span aria-hidden="true">↗</span></button>
          ${hasListingUrl
            ? `<a href="${escapeHtml(listingUrl)}" target="_blank" rel="noopener noreferrer">Open on Craigslist <span aria-hidden="true">↗</span></a>`
            : `<span class="is-disabled">Listing URL not emitted</span>`}
        </div>
        <p class="opportunity-caveat">Upside is fair value minus asking price before fees, shipping, repairs, tax, or negotiation. It is an estimate, not guaranteed profit.</p>
      </div>`;
    elements.drawerBackdrop.hidden = false;
    elements.drawer.classList.add("is-open");
    elements.drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    elements.drawerContent.querySelector(".open-decision-trace")?.addEventListener("click", () => openDrawer(listing, card));
    requestAnimationFrame(() => elements.drawerClose.focus());
  }

  function openDrawer(listing, card, isPass = false) {
    state.lastFocus = card;
    document.querySelectorAll(".deal-card.is-selected").forEach((node) => node.classList.remove("is-selected"));
    if (card.classList.contains("deal-card")) card.classList.add("is-selected");

    const scoreRaw = optionalNumber(listing.deal?.score);
    const score = scoreRaw === null ? null : Math.round(clamp(scoreRaw, 0, 100));
    const color = scoreColor(score || 0);
    const price = optionalNumber(listing.price);
    const median = optionalNumber(listing.compsMedian);
    const estimate = optionalNumber(listing.valuation?.estimatedResaleUsd);
    const computedFair = median !== null && estimate !== null ? .4 * median + .6 * estimate : null;
    const fairValue = computedFair ?? optionalNumber(listing.fairValue);
    const demand = optionalNumber(listing.deal?.demand) ?? optionalNumber(listing.demand?.value);
    const margin = optionalNumber(listing.deal?.margin);
    const marginN = optionalNumber(listing.deal?.marginN) ?? (margin === null ? null : (clamp(margin, -1, 2) + 1) / 3);
    const confidence = optionalNumber(listing.deal?.confidence);
    const scoreFlags = Array.isArray(listing.deal?.flags) ? listing.deal.flags : [];
    const redFlags = Array.isArray(listing.valuation?.redFlags) ? listing.valuation.redFlags : [];
    const flags = [...new Set([...scoreFlags, ...redFlags])];
    const tooGood = scoreFlags.includes("too_good");
    const imageUrl = safeUrl(listing.imageUrl);
    const validImage = imageUrl !== "#";
    const listingUrl = safeUrl(listing.url);
    const hasListingUrl = listingUrl !== "#";
    const sourceLabel = listing.demand?.source === "trends" ? "google trends" : listing.demand?.source === "baseline" ? "category baseline" : safeText(listing.demand?.source, "not emitted");
    const condition = safeText(listing.valuation?.condition || listing.condition, "not emitted");
    const item = safeText(listing.valuation?.item, "not emitted");
    const brandModel = safeText(listing.valuation?.brandModel, "model not identified");
    const rankIndex = isPass
      ? state.passes.findIndex((entry) => entry.id === listing.id)
      : state.deals.findIndex((entry) => entry.id === listing.id);
    const traceNumber = String(Math.max(0, rankIndex) + 1).padStart(2, "0");
    const scaleValues = [price, median, estimate, fairValue].filter((value) => value !== null);
    const maxScale = Math.max(...scaleValues, 1) * 1.14;
    const position = (value) => value === null ? 50 : clamp((value / maxScale) * 100, 4, 96);
    const agreement = median !== null && estimate !== null
      ? Math.abs(median - estimate) / Math.max(median, 1) < .2
      : false;
    const bucket = score === null ? "not scored" : score >= 75 ? "strong" : score >= 60 ? "maybe" : "pass";
    const formatPercent = (value) => `${Math.round(clamp(value, 0, 1) * 100)}%`;
    const weightedRows = [
      { label: "MARGIN", weight: "50%", value: marginN, color: "var(--accent)" },
      { label: "DEMAND", weight: "30%", value: demand, color: "var(--navy)" },
      { label: "CONFIDENCE", weight: "20%", value: confidence, color: "var(--slate)" }
    ];

    const thought = {
      look: listing.valuation
        ? `I identified ${brandModel !== "model not identified" ? brandModel : item} and rated its visible condition ${condition}.`
        : "This pass event did not include the vision appraisal payload.",
      flags: redFlags.length
        ? `I found ${redFlags.length} visual or listing warning${redFlags.length === 1 ? "" : "s"} before pricing it.`
        : "Nothing in the emitted appraisal triggered a red flag.",
      blind: estimate === null
        ? "No blind appraisal was emitted for this pass."
        : `I priced the item at ${money(estimate)} without seeing the seller's ${displayMetric(price, money)} ask.`,
      comps: median === null || estimate === null
        ? "The pass event did not carry enough market evidence to compare appraisals."
        : `Comps say ${money(median)}, I say ${money(estimate)} — ${agreement ? "we roughly agree, confidence up" : "the gap is meaningful, so confidence comes down"}.`,
      demand: demand === null
        ? "No demand signal was included in this pass event."
        : `${safeText(listing.demand?.keyword, "This category")} is at ${formatPercent(demand)} demand using ${sourceLabel}.`,
      score: score === null
        ? `The agent passed this listing: ${safeText(listing.reason, "no numeric score was emitted")}.`
        : `Weighted evidence lands at ${score}/100 — this belongs in the ${bucket.toUpperCase()} bucket.`,
      verdict: safeText(listing.deal?.headline, listing.reason || "The agent did not surface this listing as a deal.")
    };

    elements.drawer.style.setProperty("--score-color", color);
    elements.drawer.classList.toggle("is-sus", tooGood);
    elements.drawerContent.innerHTML = `
      <header class="reasoning-header">
        <p class="reasoning-kicker">DECISION TRACE / EVIDENCE</p>
        <h2 id="drawer-title">Why this result <span>· #${traceNumber} ${escapeHtml(listing.title || "Untitled listing")}</span></h2>
        <div class="reasoning-header-meta">
          <span class="mistral-sticker">MISTRAL</span>
          <span>${escapeHtml(listingPlace(listing))} · ${escapeHtml(postedAgo(listing.postedAt))}</span>
          ${isPass ? `<span class="pass-status">PASS</span>` : ""}
        </div>
      </header>
      <div class="reasoning-controls">
        <button class="replay-reasoning" type="button">Replay decision trace <b aria-hidden="true">↻</b></button>
        <span>7-STEP DECISION TRACE</span>
      </div>
      <div class="reasoning-trace">
        <section class="trace-step step-look">
          <div class="trace-rail"><span>01</span></div>
          <div class="trace-block">
            <div class="trace-label"><span>01 / INPUT</span><b>LOOK</b><em>mistral-medium · vision</em></div>
            <p class="trace-thought">${escapeHtml(thought.look)}</p>
            <div class="look-grid">
              <div class="trace-photo">${validImage
                ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(listing.title)} listing photo">`
                : `<div class="photo-placeholder"><span><b>◫</b>Photo unavailable<br>description-only analysis</span></div>`}</div>
              <div class="saw-copy"><span>MISTRAL SAW:</span><strong>${escapeHtml(item)}</strong><p>${escapeHtml(brandModel)}</p><b class="condition-chip">${escapeHtml(condition)}</b></div>
            </div>
          </div>
        </section>

        <section class="trace-step step-flags">
          <div class="trace-rail"><span>02</span></div>
          <div class="trace-block">
            <div class="trace-label"><span>02 / SAFETY</span><b>RED FLAGS</b></div>
            <p class="trace-thought">${escapeHtml(thought.flags)}</p>
            <div class="red-flag-list">${redFlags.length
              ? redFlags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")
              : `<span class="none-flag">NONE ✓</span>`}</div>
          </div>
        </section>

        <section class="trace-step step-appraisal">
          <div class="trace-rail"><span>03</span></div>
          <div class="trace-block">
            <div class="trace-label"><span>03 / PRICE-BLIND</span><b>BLIND APPRAISAL</b><em>ASKING PRICE HIDDEN</em></div>
            <p class="trace-thought">${escapeHtml(thought.blind)}</p>
            <div class="blind-number">${escapeHtml(displayMetric(estimate, money))}</div>
            <blockquote>“${escapeHtml(listing.valuation?.reasoning || "No appraisal reasoning was emitted with this pass event.")}”</blockquote>
            <p class="blind-note">MISTRAL DID NOT SEE THE ASKING PRICE.</p>
          </div>
        </section>

        <section class="trace-step step-comps">
          <div class="trace-rail"><span>04</span></div>
          <div class="trace-block">
            <div class="trace-label"><span>04 / CALIBRATION</span><b>MARKET COMPS</b><em>N=${escapeHtml(safeText(listing.compsN, "—"))}</em></div>
            <p class="trace-thought">${escapeHtml(thought.comps)}</p>
            <div class="comps-stats"><span>ASK <b>${escapeHtml(displayMetric(price, money))}</b></span><span>COMPS MEDIAN <b>${escapeHtml(displayMetric(median, money))}</b></span></div>
            <div class="reasoning-number-line" aria-label="Price comparison number line">
              <div class="number-axis"></div>
              ${[
                ["ASKING", price, "asking"], ["FAIR VALUE", fairValue, "fair"],
                ["COMPS", median, "comps"], ["MISTRAL", estimate, "estimate"]
              ].filter((entry) => entry[1] !== null).map(([label, value, kind]) => `<span class="number-tick ${kind}" style="left:${position(value)}%"><i></i><b>${label}</b><em>${escapeHtml(money(value))}</em></span>`).join("")}
            </div>
            <p class="fair-formula">FAIR VALUE = 0.4 × COMPS + 0.6 × MISTRAL = <b>${escapeHtml(displayMetric(fairValue, money))}</b></p>
          </div>
        </section>

        <section class="trace-step step-demand">
          <div class="trace-rail"><span>05</span></div>
          <div class="trace-block">
            <div class="trace-label"><span>05 / VELOCITY</span><b>DEMAND</b><em>${escapeHtml(sourceLabel)}</em></div>
            <p class="trace-thought">${escapeHtml(thought.demand)}</p>
            <div class="chunky-demand"><div style="width:${demand === null ? 0 : clamp(demand, 0, 1) * 100}%"></div><b>${demand === null ? "—" : Math.round(clamp(demand, 0, 1) * 100)}</b></div>
            <div class="demand-evidence"><span>${escapeHtml(safeText(listing.demand?.keyword, "keyword not emitted"))}</span><b>${escapeHtml(sourceLabel)}</b></div>
          </div>
        </section>

        <section class="trace-step step-score ${tooGood ? "is-sus" : ""}">
          <div class="trace-rail"><span>06</span></div>
          <div class="trace-block">
            <div class="trace-label"><span>06 / SYNTHESIS</span><b>SCORE</b>${tooGood ? `<em class="sus-sticker">SUS</em>` : ""}</div>
            <p class="trace-thought">${escapeHtml(thought.score)}</p>
            <p class="score-formula">100 × (0.50 MARGIN + 0.30 DEMAND + 0.20 CONFIDENCE)</p>
            <div class="weighted-bars">${weightedRows.map((row) => `
              <div class="weighted-row"><span>${row.label} <b>${row.weight}</b></span><div><i style="width:${row.value === null ? 0 : clamp(row.value, 0, 1) * 100}%;background:${row.color}"></i></div><em>${row.value === null ? "—" : formatPercent(row.value)}</em></div>`).join("")}</div>
            <div class="final-score"><span>${score === null ? "—" : score}</span><div><b>${escapeHtml(bucket)}</b><small>/ 100 FINAL</small></div></div>
            ${flags.length ? `<div class="drawer-flags">${flags.map((flag) => `<span class="flag-chip">${escapeHtml(String(flag).replaceAll("_", " "))}</span>`).join("")}</div>` : ""}
            ${tooGood ? `<p class="scam-gate">SCAM GATE TRIPPED: asking ${escapeHtml(displayMetric(price, money))} is below 20% of fair value ${escapeHtml(displayMetric(fairValue, money))}. The score is capped at 40.</p>` : ""}
          </div>
        </section>

        <section class="trace-step step-verdict">
          <div class="trace-rail"><span>07</span></div>
          <div class="trace-block">
            <div class="trace-label"><span>07 / OUTPUT</span><b>VERDICT</b></div>
            <p class="trace-thought">${escapeHtml(thought.verdict)}</p>
            <h3>${escapeHtml(listing.deal?.headline || (isPass ? "PASS — BELOW THE DEAL THRESHOLD" : "AGENT VERDICT NOT EMITTED"))}</h3>
            <p class="verdict-why">${escapeHtml(listing.deal?.why || listing.reason || "No explanation was emitted.")}</p>
            <p class="risk-note"><b>RISK NOTE</b>${escapeHtml(listing.deal?.riskNote || "No risk note was emitted with this pass event.")}</p>
            ${hasListingUrl
              ? `<a class="drawer-link" href="${escapeHtml(listingUrl)}" target="_blank" rel="noopener noreferrer"><span>Open on Craigslist</span><span aria-hidden="true">↗</span></a>`
              : `<span class="drawer-link is-disabled"><span>Listing URL not emitted</span><span aria-hidden="true">×</span></span>`}
          </div>
        </section>
      </div>`;

    const drawerImage = elements.drawerContent.querySelector("img");
    if (drawerImage) {
      drawerImage.addEventListener("error", () => {
        drawerImage.replaceWith(photoPlaceholder());
      }, { once: true });
    }

    elements.drawerBackdrop.hidden = false;
    elements.drawer.classList.add("is-open");
    elements.drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    elements.drawerContent.querySelector(".replay-reasoning")?.addEventListener("click", replayReasoning);
    requestAnimationFrame(() => {
      replayReasoning();
      elements.drawerClose.focus();
    });
  }

  function replayReasoning() {
    state.revealTimers.forEach(clearTimeout);
    state.revealTimers = [];
    const steps = [...elements.drawerContent.querySelectorAll(".trace-step")];
    steps.forEach((step) => step.classList.remove("is-revealed"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    steps.forEach((step, index) => {
      if (reduced) step.classList.add("is-revealed");
      else state.revealTimers.push(window.setTimeout(() => step.classList.add("is-revealed"), 80 + index * 350));
    });
    elements.drawer.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }

  function photoPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.className = "photo-placeholder";
    placeholder.innerHTML = "<span><b>◫</b>Photo unavailable<br>analysis uses listing description</span>";
    return placeholder;
  }

  function cardPhotoPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.className = "card-photo-placeholder";
    placeholder.innerHTML = "<span>Photo unavailable</span>";
    return placeholder;
  }

  function closeDrawer() {
    if (!elements.drawer.classList.contains("is-open")) return;
    state.revealTimers.forEach(clearTimeout);
    state.revealTimers = [];
    elements.drawer.classList.remove("is-open");
    elements.drawer.classList.remove("is-sus");
    elements.drawer.setAttribute("aria-hidden", "true");
    elements.drawerBackdrop.hidden = true;
    document.body.classList.remove("drawer-open");
    document.querySelectorAll(".deal-card.is-selected").forEach((node) => node.classList.remove("is-selected"));
    if (state.lastFocus?.isConnected) state.lastFocus.focus();
  }

  function loadLastRealScan() {
    state.loadingCache = true;
    connectEvents("/api/deals?cached=1&fast=1", { silentCache: true });
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    startScan();
  });
  elements.replayButton.addEventListener("click", () => startScan({ cached: true }));
  elements.bannerClose.addEventListener("click", hideBanner);
  elements.showPasses.addEventListener("change", () => {
    elements.passList.hidden = !elements.showPasses.checked;
  });
  elements.drawerClose.addEventListener("click", closeDrawer);
  elements.drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });

  const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
  if (!demoMode) loadLastRealScan();
  if (demoMode) startScan();
})();
