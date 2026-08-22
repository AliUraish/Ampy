// background.js — the Ampy Facebook Marketplace bridge.
//
// Long-polls the local Ampy server for scrape jobs. When one arrives it
// opens the Marketplace search in a background tab, reads the result grid,
// and posts the listings back. Nothing leaves this machine: the only
// network calls are to Facebook (which your browser was going to talk to
// anyway) and to your own localhost server.
//
// Why this exists at all: Facebook has no buyer-side Marketplace API, and
// the alternative — a server scraping with a stored Facebook login — means
// handling credentials and getting blocked from a datacenter IP. Here the
// page is read in your own already-authenticated session, in your own
// browser, on pages your account can normally see. See
// lib/extensionBridge.js in the server for the other half.

const DEFAULT_SERVER = "http://localhost:3000";
// Facebook lazy-loads the grid, so one screenful isn't the whole result
// set. A few scrolls gets a useful page without grinding through
// everything Marketplace will eventually render.
const SCROLL_PASSES = 3;
const TAB_LOAD_TIMEOUT_MS = 20000;

let running = false;

async function getConfig() {
  const { serverUrl, enabled } = await chrome.storage.local.get(["serverUrl", "enabled"]);
  return {
    serverUrl: (serverUrl || DEFAULT_SERVER).replace(/\/+$/, ""),
    enabled: enabled !== false,
  };
}

async function setStatus(patch) {
  const prev = (await chrome.storage.local.get("status")).status || {};
  await chrome.storage.local.set({ status: { ...prev, ...patch, at: new Date().toISOString() } });
}

// --- the poll loop ----------------------------------------------------------

async function loop() {
  if (running) return;
  running = true;

  while (running) {
    const { serverUrl, enabled } = await getConfig();
    if (!enabled) {
      await sleep(3000);
      continue;
    }

    try {
      const res = await fetch(`${serverUrl}/api/extension/jobs`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`server responded ${res.status}`);

      const { jobs = [] } = await res.json();
      await setStatus({ connected: true, error: null });

      for (const job of jobs) {
        try {
          const listings = await runJob(job);
          await postResults(serverUrl, job.id, { listings });
          await setStatus({ lastJob: job.query, lastCount: listings.length, error: null });
        } catch (err) {
          await postResults(serverUrl, job.id, { error: err.message });
          await setStatus({ lastJob: job.query, error: err.message });
        }
      }
    } catch (err) {
      // Server down or restarting — back off rather than spinning.
      await setStatus({ connected: false, error: err.message });
      await sleep(5000);
    }
  }
}

async function postResults(serverUrl, jobId, payload) {
  await fetch(`${serverUrl}/api/extension/jobs/${jobId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// --- running one job --------------------------------------------------------

function searchUrl({ query, maxPrice, location }) {
  const base = location
    ? `https://www.facebook.com/marketplace/${encodeURIComponent(location)}/search`
    : "https://www.facebook.com/marketplace/search";
  const params = new URLSearchParams({ query: query || "" });
  if (maxPrice) params.set("maxPrice", String(Math.round(maxPrice)));
  params.set("sortBy", "best_match");
  return `${base}?${params.toString()}`;
}

async function runJob(job) {
  // A background tab: the scrape happens without stealing focus, but it's a
  // real tab in a real profile, not a headless session pretending to be one.
  const tab = await chrome.tabs.create({ url: searchUrl(job), active: false });
  try {
    await waitForTabLoad(tab.id);

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeMarketplace,
      args: [{ limit: job.limit || 20, scrollPasses: SCROLL_PASSES }],
    });

    if (result?.error) throw new Error(result.error);
    return result?.listings || [];
  } finally {
    // Always clean up, even if the scrape threw — otherwise a failing
    // query leaves a pile of orphan tabs behind.
    try { await chrome.tabs.remove(tab.id); } catch { /* already closed */ }
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Facebook tab didn't finish loading in time"));
    }, TAB_LOAD_TIMEOUT_MS);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        // The grid renders after load; give React a beat to paint.
        setTimeout(resolve, 1500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- the scrape -------------------------------------------------------------
//
// Injected into the Marketplace tab, so it must be entirely self-contained
// (no closure over anything above — Chrome serializes this function).
//
// Marketplace's class names are obfuscated and rotate, so keying on them
// would break weekly. The one stable anchor is the link every result card
// wraps: /marketplace/item/<id>. Find those, then read the card's own text
// lines. Same containment principle as the server's craigslistFetcher.js —
// when the markup shifts, only this function changes.
async function scrapeMarketplace({ limit, scrollPasses }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  if (/\/login|\/checkpoint/.test(location.pathname)) {
    return { error: "Not signed in to Facebook in this browser profile." };
  }

  // Lazy-loaded grid: scroll a few times so there's more than one screenful.
  for (let i = 0; i < scrollPasses; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await wait(1200);
  }

  const anchors = [...document.querySelectorAll('a[href*="/marketplace/item/"]')];
  const byId = new Map();

  for (const a of anchors) {
    const idMatch = a.getAttribute("href")?.match(/\/marketplace\/item\/(\d+)/);
    if (!idMatch) continue;
    const itemId = idMatch[1];
    if (byId.has(itemId)) continue;

    // The anchor usually wraps the whole card. When it doesn't, walk up
    // until the text looks like a card rather than a bare title.
    let card = a;
    for (let up = 0; up < 3 && (card.innerText || "").split("\n").filter(Boolean).length < 2; up++) {
      if (!card.parentElement) break;
      card = card.parentElement;
    }

    const lines = (card.innerText || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    // Price: first line that's a currency amount. "Free" is a real
    // Marketplace price and parses to 0, which the server drops (a $0
    // listing isn't comparable), same as Craigslist's $0 handling.
    let price = null;
    let priceLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^free$/i.test(lines[i])) { price = 0; priceLine = i; break; }
      const m = lines[i].match(/^\$\s?([\d,]+)/);
      if (m) { price = Number(m[1].replace(/,/g, "")); priceLine = i; break; }
    }

    // Title: the most substantial line that isn't the price or an obvious
    // badge. Marketplace puts the title right after the price.
    const isNoise = (l) =>
      /^(free|sponsored|just listed|new listing|sold|pending)$/i.test(l) ||
      /^\$/.test(l) ||
      /^\d+\s*(mi|km|miles)/i.test(l);

    const candidates = lines.filter((l, i) => i !== priceLine && !isNoise(l));
    const title = candidates.sort((x, y) => y.length - x.length)[0] || lines[0];

    // Location: Marketplace renders it last, as "City, ST".
    const location =
      [...lines].reverse().find((l) => /,\s*[A-Z]{2}$/.test(l) || /^[A-Za-z .'-]+,\s*[A-Za-z ]+$/.test(l)) || "";

    const img = card.querySelector("img");

    byId.set(itemId, {
      itemId,
      title,
      price,
      location: location === title ? "" : location,
      imageUrl: img?.src || null,
      url: `https://www.facebook.com/marketplace/item/${itemId}/`,
    });

    if (byId.size >= limit) break;
  }

  if (byId.size === 0) {
    return {
      error:
        "No Marketplace result cards found. Either the search genuinely had no results, " +
        "or Facebook changed the grid markup (see scrapeMarketplace in the extension).",
    };
  }

  return { listings: [...byId.values()] };
}

// Kick the loop on install and on browser start, and once at load so
// reloading the extension from chrome://extensions restarts it too.
chrome.runtime.onInstalled.addListener(() => loop());
chrome.runtime.onStartup.addListener(() => loop());
loop();
