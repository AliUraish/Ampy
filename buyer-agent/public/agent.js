// agent.js — the buyer-agent console.
//
// Two jobs: stream the agent's run as it happens, and let the buyer follow
// up on any listing it found.
//
// The activity feed matters more than it looks. A run does several searches,
// opens listings, messages sellers, and haggles — 30+ seconds of work. A
// spinner for that long reads as "broken"; a live feed of what it's doing
// reads as an agent working, and it's also the only way to see WHICH seller
// got messaged and what was said.
//
// SECURITY: everything rendered here — listing titles, descriptions, seller
// replies, negotiation transcripts — is written by strangers or by an LLM
// reading strangers' text. All of it goes through escapeHtml(). No innerHTML
// is ever handed raw remote content.

const form = document.getElementById("agent-form");
const runBtn = document.getElementById("run-btn");
const stopBtn = document.getElementById("stop-btn");
const runHint = document.getElementById("run-hint");
const activityEl = document.getElementById("activity");
const resultsEl = document.getElementById("results");
const summaryEl = document.getElementById("summary");
const findingsTitle = document.getElementById("findings-title");
const threadsEl = document.getElementById("threads");
const threadsTitle = document.getElementById("threads-title");
const capsEl = document.getElementById("capabilities");

let controller = null;
// Listings seen so far in the current run, so cards can appear while the
// agent is still working instead of only at the end.
const liveListings = new Map();

// --- helpers ---------------------------------------------------------------

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

const formatPrice = (p) => (typeof p === "number" ? `$${p.toLocaleString()}` : "price n/a");

function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// --- capability strip ------------------------------------------------------
//
// Surfaces what's actually connected before a run rather than after a
// silent failure — a missing macOS permission or an unloaded extension
// should be a visible, labelled fact with the fix attached.

async function loadCapabilities() {
  let status;
  try {
    status = await (await fetch("/api/agent/status")).json();
  } catch {
    capsEl.innerHTML = `<span class="cap off"><span class="dot"></span>server unreachable</span>`;
    return;
  }

  const caps = status.sources.map(
    (s) => `<span class="cap ${s.enabled ? "on" : "off"}"><span class="dot"></span>${escapeHtml(s.label)}</span>`
  );

  const sa = status.sellerAgent || {};
  caps.push(
    `<span class="cap ${sa.configured ? "on" : "off"}"><span class="dot"></span>Seller agent</span>`
  );

  const msg = status.messaging || {};
  const canText = msg.available && !msg.dryRun;
  caps.push(
    `<span class="cap ${msg.available ? (msg.dryRun ? "" : "on") : "off"}"><span class="dot"></span>` +
      `iMessage${msg.dryRun ? " (dry run)" : ""}</span>`
  );

  capsEl.innerHTML = caps.join("");

  // Only the things that need doing, phrased as instructions.
  const notes = [];
  if (!sa.configured) {
    notes.push("Seller agent not connected — set SELLER_AGENT_URL to let the agent ask questions and negotiate.");
  }
  const fbOff = status.sources.find((s) => s.id === "facebook" && !s.enabled);
  if (fbOff) notes.push("Facebook Marketplace off — set ENABLE_FACEBOOK=true and load the Chrome extension.");
  if (status.extension && !status.extension.connected && !fbOff) {
    notes.push("Facebook extension not connected — open chrome://extensions and confirm it's loaded and enabled.");
  }
  (msg.issues || []).forEach((i) => notes.push(i));

  if (notes.length) {
    capsEl.insertAdjacentHTML(
      "beforeend",
      `<div class="cap-note">${notes.map((n) => escapeHtml(n)).join("<br />")}</div>`
    );
  }
}

async function loadLocations() {
  const select = document.getElementById("location");
  try {
    const { locations, default: def } = await (await fetch("/api/craigslist-locations")).json();
    select.innerHTML = locations
      .map((l) => {
        const slug = typeof l === "string" ? l : l.slug || l.value;
        const label = typeof l === "string" ? l : l.label || l.name || slug;
        return `<option value="${escapeHtml(slug)}"${slug === def ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
  } catch {
    select.innerHTML = `<option value="">(couldn't load regions)</option>`;
  }
}

// --- activity feed ---------------------------------------------------------

function addStep(html, cls = "") {
  if (activityEl.querySelector(".hint")) activityEl.innerHTML = "";
  const div = document.createElement("div");
  div.className = `step ${cls}`;
  div.innerHTML = html;
  activityEl.appendChild(div);
  activityEl.scrollTop = activityEl.scrollHeight;
}

const icon = (ch) => `<span class="step-icon">${ch}</span>`;

function renderEvent(e) {
  switch (e.type) {
    case "search":
      return addStep(`${icon("🔎")}<span class="what">Searching</span> <span class="em">${escapeHtml(e.query)}</span>` +
        (e.maxPrice ? ` <span class="what">under $${e.maxPrice}</span>` : ""));
    case "search_result":
      return addStep(`${icon("")}<span class="what">${e.count} listings across ${escapeHtml((e.sources || []).join(", ") || "no sources")}</span>`);
    case "open_listing":
      return addStep(`${icon("📄")}<span class="what">Opening</span> ${escapeHtml(e.title || e.listingId)}`);
    case "thinking":
      return addStep(`${icon("")}${escapeHtml(e.text)}`, "think");
    case "contacting":
      return addStep(`${icon("💬")}<span class="what">Asking</span> <span class="em">${escapeHtml(e.to || "seller")}</span>` +
        `<br /><span class="what">“${escapeHtml(e.message)}”</span>`);
    case "contacted":
      return addStep(`${icon("✓")}<span class="what">Sent${e.dryRun ? " (dry run)" : ""} via ${escapeHtml(e.channel || "")}</span>` +
        (e.answer ? `<br /><span class="em">“${escapeHtml(e.answer)}”</span>` : ""), "good");
    case "contact_skipped":
      return addStep(`${icon("—")}<span class="what">Can't reach seller of ${escapeHtml(e.title || "")}: ${escapeHtml(e.reason || "")}</span>`);
    case "contact_failed":
      return addStep(`${icon("✕")}Message failed: ${escapeHtml(e.error || "")}`, "bad");
    case "negotiating":
      return addStep(`${icon("🤝")}<span class="what">Negotiating on</span> ${escapeHtml(e.title || "")} ` +
        `<span class="what">— opening at $${e.openingOffer} against $${e.asking}</span>`);
    case "negotiated":
      return addStep(
        e.agreed
          ? `${icon("✓")}<span class="em">Deal at $${e.finalPrice}</span> <span class="what">(asking $${e.asking})</span>`
          : `${icon("—")}<span class="what">No deal — ${escapeHtml(e.endedBy || "")}</span>`,
        e.agreed ? "good" : ""
      );
    case "negotiation_failed":
      return addStep(`${icon("✕")}Negotiation failed: ${escapeHtml(e.error || "")}`, "bad");
    case "checking_replies":
      return addStep(`${icon("📬")}<span class="what">Checking for a reply…</span>`);
    case "warning":
      return addStep(`${icon("!")}<span class="what">${escapeHtml(e.source)}: ${escapeHtml(e.error)}</span>`, "warn");
    case "error":
      return addStep(`${icon("✕")}${escapeHtml(e.error)}`, "bad");
    default:
      return undefined;
  }
}

// --- results ---------------------------------------------------------------

function cardHtml(listing, negotiation) {
  const thumb = listing.imageUrl
    ? `<img class="thumb" src="${escapeHtml(listing.imageUrl)}" alt="" />`
    : `<div class="thumb placeholder">no photo</div>`;

  const sourceLabel = { craigslist: "craigslist", facebook: "facebook", seller: "hagglr seller", mock: "demo data" }[listing.source] || listing.source;

  const contact = listing.contact || {};
  const chan = contact.channel === "seller_agent"
    ? `<span class="chan">💬 ${escapeHtml(contact.display || "seller agent")}</span>`
    : contact.channel === "imessage"
      ? `<span class="chan">📱 ${escapeHtml(contact.display || "iMessage")}</span>`
      : `<span class="chan" title="${escapeHtml(contact.reason || "")}">— not contactable</span>`;

  const deal = negotiation
    ? negotiation.agreed
      ? `<div class="deal">Negotiated to <strong>$${negotiation.finalPrice.toLocaleString()}</strong>` +
        (listing.price ? ` — saved $${(listing.price - negotiation.finalPrice).toLocaleString()}` : "") + `</div>`
      : `<div class="deal none">No deal — ${escapeHtml(negotiation.endedBy || "").replace(/_/g, " ")}</div>`
    : "";

  return `
    <div class="listing-card" data-id="${escapeHtml(listing.id)}">
      ${thumb}
      <div class="row"><h3>${escapeHtml(listing.title)}</h3></div>
      <div class="row">
        <span class="price large">${formatPrice(listing.price)}</span>
        <span class="badge">${escapeHtml(sourceLabel)}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(listing.condition || "unknown")}</span>
        ${listing.location ? `<span class="mono">·</span><span>${escapeHtml(listing.location)}</span>` : ""}
      </div>
      <p class="desc">${escapeHtml((listing.description || "").slice(0, 260))}</p>
      ${deal}
      <div class="card-foot">
        <div class="row" style="align-items:center;">
          ${chan}
          ${listing.url ? `<a href="${escapeHtml(listing.url)}" target="_blank" rel="noopener">view original</a>` : "<span></span>"}
        </div>
        ${
          contact.channel
            ? `<div class="ask-row">
                 <input type="text" class="ask-input" placeholder="Ask the seller something…" />
                 <button class="secondary ask-btn" data-id="${escapeHtml(listing.id)}">Ask</button>
               </div>
               <div class="ask-out" data-out="${escapeHtml(listing.id)}"></div>`
            : ""
        }
      </div>
    </div>`;
}

function renderResults(listings, negotiations) {
  const negByListing = new Map((negotiations || []).map((n) => [n.listingId, n]));
  // Listings the agent actually engaged with (messaged, negotiated, or that
  // have a price) first — a run touches more than it recommends.
  const ordered = [...listings].sort((a, b) => (negByListing.has(b.id) ? 1 : 0) - (negByListing.has(a.id) ? 1 : 0));

  findingsTitle.style.display = ordered.length ? "" : "none";
  resultsEl.innerHTML = ordered.map((l) => cardHtml(l, negByListing.get(l.id))).join("");

  resultsEl.querySelectorAll(".ask-btn").forEach((btn) => {
    btn.addEventListener("click", () => askSeller(btn));
  });
}

async function askSeller(btn) {
  const card = btn.closest(".listing-card");
  const input = card.querySelector(".ask-input");
  const out = card.querySelector(".ask-out");
  const question = input.value.trim();
  if (!question) return;

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "…";
  out.innerHTML = `<div class="q">Asking…</div>`;

  try {
    const res = await fetch("/api/agent/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: btn.dataset.id, question }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      out.innerHTML = `<div class="q">${escapeHtml(data.error || "couldn't send")}</div>`;
    } else {
      out.innerHTML =
        `<div class="q">Sent${data.dryRun ? " (dry run)" : ""}: “${escapeHtml(data.draft)}”</div>` +
        (data.answer
          ? `<div class="a">${escapeHtml(data.answer)}</div>`
          : `<div class="q" style="margin-top:4px;">Waiting for a reply…</div>`);
      input.value = "";
      loadThreads();
    }
  } catch (err) {
    out.innerHTML = `<div class="q">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// --- threads ---------------------------------------------------------------

async function loadThreads() {
  let threads = [];
  try {
    ({ threads } = await (await fetch("/api/agent/threads")).json());
  } catch {
    return;
  }

  threadsTitle.style.display = threads.length ? "" : "none";
  threadsEl.innerHTML = threads
    .map(
      (t) => `
      <div class="thread">
        <h4>${escapeHtml(t.title)}</h4>
        <div class="meta">
          ${escapeHtml(t.channel === "seller_agent" ? "seller agent" : "iMessage")}
          · ${t.replyCount} ${t.replyCount === 1 ? "reply" : "replies"}
          · ${escapeHtml(timeAgo(t.lastActivity))}
          ${t.error ? `<br /><span style="color:#a8461f;">${escapeHtml(t.error)}</span>` : ""}
        </div>
        ${t.messages
          .map(
            (m) => `<div class="bubble ${m.direction === "out" ? "out" : m.direction === "in" ? "in" : "sys"}">
                      ${escapeHtml(m.text)}
                      <span class="when">${escapeHtml(timeAgo(m.at))}${m.price ? ` · $${m.price}` : ""}</span>
                    </div>`
          )
          .join("")}
      </div>`
    )
    .join("");
}

// --- run -------------------------------------------------------------------

async function run(e) {
  e.preventDefault();
  const request = document.getElementById("request").value.trim();
  if (!request) return;

  const budgetRaw = document.getElementById("budget").value;
  const budget = budgetRaw ? Number(budgetRaw) : undefined;
  const location = document.getElementById("location").value;

  activityEl.innerHTML = "";
  resultsEl.innerHTML = "";
  summaryEl.style.display = "none";
  findingsTitle.style.display = "none";
  runBtn.disabled = true;
  runBtn.textContent = "Working…";
  stopBtn.style.display = "";
  runHint.textContent = "";

  liveListings.clear();
  controller = new AbortController();

  try {
    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request, budget, location }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `server responded ${res.status}`);
    }

    // SSE over POST — read the stream by hand, since EventSource is GET-only.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line; keep any partial tail.
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop();

      for (const chunk of chunks) {
        const line = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;

        let event;
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue; // a truncated frame — the next read completes it
        }

        if (event.type === "listings") {
          // Live cards during the run, replaced by the richer final render
          // when the result arrives. Merge rather than overwrite, since a
          // later search shouldn't wipe out earlier finds.
          event.listings.forEach((l) => liveListings.set(l.id, l));
          renderResults([...liveListings.values()], []);
        } else if (event.type === "result") {
          renderResults(event.listings || [], event.negotiations || []);
          if (event.summary) {
            summaryEl.textContent = event.summary;
            summaryEl.style.display = "";
          }
          loadThreads();
        } else {
          renderEvent(event);
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      addStep(`${icon("■")}Stopped.`, "warn");
    } else {
      addStep(`${icon("✕")}${escapeHtml(err.message)}`, "bad");
      runHint.textContent = err.message;
    }
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Send the agent";
    stopBtn.style.display = "none";
    controller = null;
  }
}

form.addEventListener("submit", run);
stopBtn.addEventListener("click", () => controller?.abort());

loadCapabilities();
loadLocations();
loadThreads();
