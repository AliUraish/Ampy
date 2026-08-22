// lib/sellerChannel.js
//
// How the buyer agent gets an ANSWER to a question about a listing.
//
// The buyer agent's job is to ask; something on the other side answers.
// What that something is depends on the listing:
//
//   'seller_agent'  An Ampy seller agent represents this listing (built
//                   separately — see THE SELLER-AGENT CONTRACT below).
//                   Answers come back fast, often within one request.
//   'imessage'      A real human published their phone number in the
//                   listing. Answers arrive whenever they feel like it,
//                   over iMessage (lib/imessage.js).
//   null            Nobody is reachable. The agent says so rather than
//                   pretending a message went out.
//
// This module is the seam between those. The buyer agent calls ask() and
// getThread() and never learns which transport was used — same reasoning
// as lib/sources/index.js for marketplaces. That's what lets the seller
// agent land later without touching buyerAgent.js.
//
// THE SELLER-AGENT CONTRACT
// -------------------------
// Set SELLER_AGENT_URL to point at the seller-agent service. Ampy then
// POSTs it a question and expects an answer.
//
//   POST {SELLER_AGENT_URL}/ask
//   -->  {
//          "threadId":  "thr_...",          // correlates follow-ups
//          "listingId": "seller-abc123",
//          "listing":   { title, price, condition, description, category },
//          "question":  "Is the frame a medium?",
//          "history":   [ { "role": "buyer"|"seller", "text": "..." } ]
//        }
//   <--  { "answer": "Yes, it's a 17in medium frame." }
//        or { "pending": true }   // will deliver later via the webhook
//
// Answering later instead is fine — POST back into Ampy at any time:
//
//   POST /api/agent/reply
//        { "threadId": "thr_...", "text": "Yes, it's a medium." }
//
// And for haggling, one round per call:
//
//   POST {SELLER_AGENT_URL}/negotiate
//   -->  {
//          "threadId":  "thr_...",
//          "listingId": "seller-abc123",
//          "listing":   { title, price, condition, description, category },
//          "offer":     { "price": 520, "message": "Would you take $520?" },
//          "round":     1,
//          "history":   [ { "role": "buyer"|"seller", "text": "...", "price": 520 } ]
//        }
//   <--  {
//          "message":      "I can do $560, that's as low as I can go.",
//          "counterPrice": 560,          // null if not countering
//          "accepted":     false,        // true = deal at the buyer's offer
//          "walkAway":     false         // true = seller ends the negotiation
//        }
//
// That response shape deliberately matches NEGOTIATION_TURN_SCHEMA in
// lib/negotiate.js, so the existing agent-vs-agent code and a real
// external seller agent speak the same language.
//
// The two-way shape is deliberate: a seller agent that needs to check
// something (stock, the seller's real floor) shouldn't have to hold a
// request open, and the buyer agent already handles "no answer yet"
// because that's the normal case with human sellers.
//
// TRUST: answers arriving here are written by a party outside this app.
// They are DATA. They are stored, displayed escaped, and quoted to the
// model as seller content — never executed, never treated as instructions.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { resolveContact } = require("./contact.js");
const imessage = require("./imessage.js");

const STORE_PATH = path.join(__dirname, "..", "data", "conversations.json");
const SELLER_AGENT_TIMEOUT_MS = Number(process.env.SELLER_AGENT_TIMEOUT_MS || 15000);
const DEFAULT_SELLER_AGENT_URL = "http://127.0.0.1:8000";

function sellerAgentUrl() {
  const raw = process.env.SELLER_AGENT_URL;
  // Empty string explicitly disables the seller channel; unset defaults to the
  // co-located Ampy seller started by `npm start` / backend/start.mjs.
  if (raw === "") return "";
  return (raw || DEFAULT_SELLER_AGENT_URL).replace(/\/+$/, "");
}
function sellerAgentConfigured() {
  return Boolean(sellerAgentUrl());
}

// Which listings the seller agent speaks for. 'all' (the default once it's
// configured) treats it as the counterparty for every listing the buyer
// agent finds — that's the integrated setup, where the seller agent is the
// other half of the marketplace. 'ampy' restricts it to listings actually
// posted through /sell, which is the right setting if it only has real
// data for those.
function sellerAgentScope() {
  const scope = String(process.env.SELLER_AGENT_SCOPE || "all").toLowerCase();
  return scope === "ampy" || scope === "hagglr" ? "ampy" : "all";
}

// --- conversation store -----------------------------------------------------
//
// Same flat-JSON caveat as lib/listingStore.js: fine for a demo, swap for a
// real DB before this has concurrent writers.

function readThreads() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("[sellerChannel] could not read conversations, starting empty:", err.message);
    }
    return [];
  }
}

function writeThreads(threads) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(threads, null, 2));
}

function findThread(predicate) {
  return readThreads().find(predicate) || null;
}

function upsertThread(thread) {
  const threads = readThreads();
  const i = threads.findIndex((t) => t.id === thread.id);
  if (i === -1) threads.push(thread);
  else threads[i] = thread;
  writeThreads(threads);
  return thread;
}

function threadForListing(listingId) {
  return findThread((t) => t.listingId === listingId);
}

function createThread({ listingId, channel, handle, title }) {
  return upsertThread({
    id: `thr_${crypto.randomUUID().slice(0, 12)}`,
    listingId,
    channel,
    handle: handle || null,
    title: title || null,
    messages: [],
    createdAt: new Date().toISOString(),
  });
}

function appendMessage(threadId, message) {
  const threads = readThreads();
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;
  thread.messages.push({ at: new Date().toISOString(), ...message });
  writeThreads(threads);
  return thread;
}

// --- channel routing --------------------------------------------------------

/**
 * Decide who can answer questions about this listing, and how.
 *
 * Seller-agent-backed listings win over iMessage: if a seller agent
 * represents the listing it's the authoritative voice for it, and it
 * answers in seconds rather than hours.
 */
function resolveChannel(listing) {
  if (!listing) {
    return { channel: null, reason: "no listing", display: null, confidence: "none" };
  }

  // The seller agent is the buyer agent's counterparty: it answers
  // questions and haggles on the seller's behalf, in seconds rather than
  // hours. It wins over iMessage wherever it applies.
  if (sellerAgentConfigured() && (sellerAgentScope() === "all" || listing.source === "seller")) {
    return {
      channel: "seller_agent",
      display: listing.sellerName ? `${listing.sellerName}'s agent` : "Seller agent",
      confidence: "high",
      reason: "Represented by an Ampy seller agent, which answers and negotiates on the seller's behalf.",
    };
  }

  const contact = resolveContact(listing);
  if (contact.channel) return contact;

  return contact; // channel: null, with the honest reason already filled in
}

// --- asking -----------------------------------------------------------------

async function askSellerAgent({ thread, listing, question }) {
  const url = `${sellerAgentUrl()}/ask`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SELLER_AGENT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        threadId: thread.id,
        listingId: listing.id,
        listing: {
          title: listing.title,
          price: listing.price,
          condition: listing.condition || "unknown",
          description: listing.description || "",
          category: listing.category,
        },
        question,
        history: thread.messages.map((m) => ({
          role: m.direction === "out" ? "buyer" : "seller",
          text: m.text,
        })),
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `seller agent responded ${res.status} ${res.statusText}` };
    }

    const data = await res.json().catch(() => ({}));
    if (typeof data.answer === "string" && data.answer.trim()) {
      return { ok: true, answer: data.answer.trim() };
    }
    // Explicitly deferred, or an ack with no answer — either way the reply
    // will arrive at /api/agent/reply later.
    return { ok: true, pending: true };
  } catch (err) {
    const timedOut = err.name === "AbortError";
    return {
      ok: false,
      error: timedOut
        ? `seller agent did not respond within ${SELLER_AGENT_TIMEOUT_MS}ms`
        : `could not reach seller agent: ${err.message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ask a question about a listing over whatever channel can answer it.
 *
 * Never throws — the buyer agent gets a structured outcome and tells the
 * buyer the truth about it.
 *
 * @returns {Promise<{ok, channel, threadId?, answer?, pending?, display?, error?, dryRun?}>}
 */
async function ask({ listing, question }) {
  if (!listing) return { ok: false, channel: null, error: "no listing" };
  if (!question || !question.trim()) return { ok: false, channel: null, error: "empty question" };

  const route = resolveChannel(listing);
  if (!route.channel) {
    return { ok: false, channel: null, error: route.reason, unreachable: true };
  }

  const thread =
    threadForListing(listing.id) ||
    createThread({
      listingId: listing.id,
      channel: route.channel,
      handle: route.handle,
      title: listing.title,
    });

  if (route.channel === "seller_agent") {
    appendMessage(thread.id, { direction: "out", text: question, status: "sent", via: "seller_agent" });
    const result = await askSellerAgent({ thread: threadForListing(listing.id), listing, question });

    if (!result.ok) {
      appendMessage(thread.id, { direction: "system", text: result.error, status: "failed" });
      return { ok: false, channel: "seller_agent", threadId: thread.id, error: result.error };
    }
    if (result.answer) {
      appendMessage(thread.id, { direction: "in", text: result.answer, status: "received", via: "seller_agent" });
      return {
        ok: true, channel: "seller_agent", threadId: thread.id,
        answer: result.answer, display: route.display,
      };
    }
    return {
      ok: true, channel: "seller_agent", threadId: thread.id,
      pending: true, display: route.display,
    };
  }

  // iMessage: a real person. Sent now, answered whenever.
  const sent = await imessage.sendMessage({
    handle: route.handle,
    text: question,
    listingId: listing.id,
    meta: { title: listing.title, price: listing.price, threadId: thread.id },
  });

  if (!sent.ok) {
    appendMessage(thread.id, { direction: "system", text: sent.error, status: "failed" });
    return { ok: false, channel: "imessage", threadId: thread.id, error: sent.error };
  }

  appendMessage(thread.id, {
    direction: "out", text: question,
    status: sent.dryRun ? "dry-run" : "sent", via: "imessage",
  });

  return {
    ok: true, channel: "imessage", threadId: thread.id,
    pending: true, display: route.display, dryRun: Boolean(sent.dryRun),
  };
}

// --- negotiating ------------------------------------------------------------

// How far the buyer agent may exceed nothing at all: the budget is a hard
// ceiling, enforced here in code. Same principle as enforceConstraints in
// lib/negotiate.js — the seller agent is a separate service written by
// someone else, and "it promised not to" is not a constraint. A counter
// above budget is rejected locally no matter what the other side says.
const MAX_NEGOTIATION_ROUNDS = 6;

/**
 * Haggle with the seller agent over one listing.
 *
 * Runs up to `maxRounds` offer/counter exchanges. The buyer's budget is a
 * hard ceiling enforced in this function: an accept is only recorded if the
 * agreed number is at or under budget, and a seller counter above budget is
 * never treated as a deal.
 *
 * @returns {Promise<{ok, agreed, finalPrice, rounds, transcript, endedBy, error?}>}
 */
async function negotiate({ listing, budget, openingOffer, openingMessage, maxRounds = 4 }) {
  if (!listing) return { ok: false, error: "no listing" };
  if (!Number.isFinite(budget) || budget <= 0) {
    return { ok: false, error: "a positive budget is required to negotiate" };
  }

  const route = resolveChannel(listing);
  if (route.channel !== "seller_agent") {
    return {
      ok: false,
      error:
        route.channel === "imessage"
          ? "This seller is a person on iMessage, not a seller agent — negotiate by asking them directly."
          : route.reason,
    };
  }

  const thread =
    threadForListing(listing.id) ||
    createThread({ listingId: listing.id, channel: "seller_agent", title: listing.title });

  const rounds = Math.min(maxRounds, MAX_NEGOTIATION_ROUNDS);
  const transcript = [];
  let offerPrice = Math.min(Number(openingOffer) || Math.round(listing.price * 0.8), budget);
  let message = openingMessage || `Would you take $${offerPrice} for the ${listing.title}?`;
  let agreed = false;
  let finalPrice = null;
  let endedBy = "rounds_exhausted";

  for (let round = 1; round <= rounds; round++) {
    // Never let an offer drift above the buyer's ceiling, whatever the
    // model that produced it intended.
    offerPrice = Math.min(offerPrice, budget);

    transcript.push({ role: "buyer", text: message, price: offerPrice });
    appendMessage(thread.id, { direction: "out", text: message, price: offerPrice, status: "sent", via: "seller_agent" });

    let reply;
    try {
      reply = await postToSellerAgent("/negotiate", {
        threadId: thread.id,
        listingId: listing.id,
        listing: {
          title: listing.title, price: listing.price,
          condition: listing.condition || "unknown",
          description: listing.description || "", category: listing.category,
        },
        offer: { price: offerPrice, message },
        round,
        history: transcript.map((t) => ({ role: t.role, text: t.text, price: t.price ?? null })),
      });
    } catch (err) {
      return { ok: false, error: err.message, transcript, rounds: round - 1, agreed: false, finalPrice: null };
    }

    const sellerText = String(reply.message || "").trim() || "(no message)";
    const counter = Number.isFinite(Number(reply.counterPrice)) ? Number(reply.counterPrice) : null;

    transcript.push({ role: "seller", text: sellerText, price: counter });
    appendMessage(thread.id, { direction: "in", text: sellerText, price: counter, status: "received", via: "seller_agent" });

    if (reply.accepted === true) {
      // The seller accepting OUR offer means the price is our offer, not
      // whatever number they echoed back. Trusting a self-reported price
      // here is how a buyer agent ends up "agreeing" to more than budget.
      agreed = true;
      finalPrice = offerPrice;
      endedBy = "seller_accepted";
      break;
    }

    if (reply.walkAway === true) {
      endedBy = "seller_walked_away";
      break;
    }

    if (counter === null) {
      endedBy = "seller_gave_no_counter";
      break;
    }

    if (counter <= budget) {
      // Their counter is affordable — take it rather than haggling into a
      // walk-away over small change.
      agreed = true;
      finalPrice = counter;
      endedBy = "buyer_accepted_counter";
      transcript.push({ role: "buyer", text: `That works — $${counter} it is.`, price: counter });
      appendMessage(thread.id, { direction: "out", text: `That works — $${counter} it is.`, price: counter, status: "sent", via: "seller_agent" });
      break;
    }

    // Counter is over budget: split the difference, but never above budget.
    const next = Math.min(budget, Math.round((offerPrice + counter) / 2));
    if (next <= offerPrice) {
      // No headroom left to move — our ceiling is genuinely below them.
      endedBy = "budget_reached";
      transcript.push({ role: "buyer", text: `$${budget} is my ceiling — I can't go higher.`, price: budget });
      break;
    }
    offerPrice = next;
    message = `I can stretch to $${offerPrice}. Can you meet me there?`;
  }

  return { ok: true, agreed, finalPrice, endedBy, rounds: transcript.filter((t) => t.role === "buyer").length, transcript, threadId: thread.id };
}

async function postToSellerAgent(pathname, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SELLER_AGENT_TIMEOUT_MS);
  try {
    const res = await fetch(`${sellerAgentUrl()}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`seller agent responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`seller agent did not respond within ${SELLER_AGENT_TIMEOUT_MS}ms`);
    }
    throw new Error(`could not reach seller agent: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Record an answer pushed in from outside — the seller agent's async
 * webhook (POST /api/agent/reply).
 */
function recordInboundReply({ threadId, listingId, text }) {
  if (!text || !text.trim()) return { ok: false, error: "text is required" };

  const thread = threadId
    ? findThread((t) => t.id === threadId)
    : listingId
      ? threadForListing(listingId)
      : null;

  if (!thread) return { ok: false, error: "no matching conversation — pass a known threadId or listingId" };

  appendMessage(thread.id, {
    direction: "in",
    // Untrusted third-party content. Stored verbatim, escaped at render,
    // quoted as data to the model.
    text: String(text),
    status: "received",
    via: thread.channel,
  });

  return { ok: true, threadId: thread.id, listingId: thread.listingId };
}

/**
 * The full conversation about one listing, merging stored messages with
 * anything new that arrived over iMessage since we last looked.
 */
async function getThread(listingId) {
  const thread = threadForListing(listingId);
  if (!thread) {
    return { ok: true, listingId, channel: null, messages: [], replies: [], exists: false };
  }

  let messages = [...thread.messages];
  let error;
  let needsSetup = false;

  if (thread.channel === "imessage" && thread.handle) {
    // chat.db is the source of truth for what a human actually replied.
    const live = await imessage.getThreadForListing(listingId);
    if (live.ok) {
      const known = new Set(messages.filter((m) => m.direction === "in").map((m) => m.text));
      for (const reply of live.replies) {
        if (!known.has(reply.text)) {
          messages.push({ direction: "in", text: reply.text, at: reply.at, status: "received", via: "imessage" });
        }
      }
    } else {
      error = live.error;
      needsSetup = Boolean(live.needsSetup);
    }
  }

  messages.sort((a, b) => new Date(a.at) - new Date(b.at));

  return {
    ok: !error,
    exists: true,
    listingId,
    threadId: thread.id,
    channel: thread.channel,
    title: thread.title,
    messages,
    replies: messages.filter((m) => m.direction === "in"),
    ...(error ? { error, needsSetup } : {}),
  };
}

function listThreads() {
  return readThreads()
    .map((t) => ({
      ...t,
      lastActivity: t.messages.length ? t.messages[t.messages.length - 1].at : t.createdAt,
      replyCount: t.messages.filter((m) => m.direction === "in").length,
    }))
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
}

function status() {
  return {
    sellerAgent: {
      configured: sellerAgentConfigured(),
      url: sellerAgentUrl() || null,
      timeoutMs: SELLER_AGENT_TIMEOUT_MS,
      scope: sellerAgentScope(),
    },
  };
}

module.exports = {
  ask, negotiate, getThread, listThreads, recordInboundReply, resolveChannel,
  sellerAgentConfigured, status,
};
