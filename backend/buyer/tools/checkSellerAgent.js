// tools/checkSellerAgent.js
//
// Contract conformance check for a seller agent.
//
// Run this the moment you point Ampy at a new seller agent. It exercises
// both endpoints with realistic payloads and validates the response shapes
// against what lib/sellerChannel.js actually expects — so a mismatched
// field name surfaces in five seconds as a named failure, instead of as a
// buyer agent that mysteriously never negotiates four minutes into a run.
//
//   node tools/checkSellerAgent.js http://localhost:4000
//   node tools/checkSellerAgent.js                 # uses SELLER_AGENT_URL
//
// Exits non-zero if anything fails, so it works in CI too.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../..", ".env"), quiet: true });
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const BASE = (
  process.argv[2] || process.env.SELLER_AGENT_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.SELLER_AGENT_TIMEOUT_MS || 15000);

// A realistic listing — a seller agent that only works on toy input isn't
// verified. Description length and a real price matter for /negotiate.
const LISTING = {
  title: 'MacBook Pro 14" M1 Pro, 16GB/512GB',
  price: 900,
  condition: "good",
  category: "electronics",
  description:
    "2021 14-inch MacBook Pro, M1 Pro, 16GB RAM, 512GB SSD. Battery health 89%. " +
    "Light scuff on the bottom case, screen is clean. Comes with the original charger.",
};

const results = [];
function check(name, passed, detail) {
  results.push({ name, passed, detail });
  const mark = passed ? "\x1b[32m  ok  \x1b[0m" : "\x1b[31mFAIL  \x1b[0m";
  console.log(`${mark}${name}${detail && !passed ? `\n        ${detail}` : ""}`);
}

async function post(pathname, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* reported by the caller */ }
    return { status: res.status, ok: res.ok, json, text, ms: Date.now() - started };
  } catch (err) {
    return {
      error: err.name === "AbortError" ? `no response within ${TIMEOUT_MS}ms` : err.message,
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkAsk() {
  console.log("\nPOST /ask");
  const res = await post("/ask", {
    threadId: "thr_contractcheck",
    listingId: "check-1",
    listing: LISTING,
    question: "What's the battery cycle count, and does it come with the original charger?",
    history: [],
  });

  if (res.error) return check("/ask responds", false, res.error);
  check("/ask responds", true);
  check("/ask returns 2xx", res.ok, `got HTTP ${res.status}: ${(res.text || "").slice(0, 200)}`);
  if (!res.ok) return;

  check("/ask returns JSON", res.json !== null, `body was not JSON: ${(res.text || "").slice(0, 200)}`);
  if (!res.json) return;

  const hasAnswer = typeof res.json.answer === "string" && res.json.answer.trim().length > 0;
  const isPending = res.json.pending === true;
  check(
    "/ask returns { answer } or { pending: true }",
    hasAnswer || isPending,
    `got keys [${Object.keys(res.json).join(", ")}] — need a non-empty string "answer", or "pending": true ` +
      `if answering later via POST /api/agent/reply`
  );

  // Not a hard failure: a slow-but-correct agent still works, it just makes
  // every buyer-agent run drag.
  check(
    `/ask answers within ${TIMEOUT_MS}ms`,
    res.ms < TIMEOUT_MS,
    `took ${res.ms}ms — the buyer agent will treat this as a timeout`
  );

  if (hasAnswer) console.log(`        seller said: "${res.json.answer.slice(0, 150)}"`);
  if (isPending) console.log("        (deferred — must arrive later at POST /api/agent/reply)");
}

async function checkNegotiate() {
  console.log("\nPOST /negotiate");
  const res = await post("/negotiate", {
    threadId: "thr_contractcheck",
    listingId: "check-1",
    listing: LISTING,
    offer: { price: 720, message: "Would you take $720? The battery's at 89% and there's a scuff on the case." },
    round: 1,
    history: [{ role: "buyer", text: "Would you take $720?", price: 720 }],
  });

  if (res.error) return check("/negotiate responds", false, res.error);
  check("/negotiate responds", true);
  check("/negotiate returns 2xx", res.ok, `got HTTP ${res.status}: ${(res.text || "").slice(0, 200)}`);
  if (!res.ok) return;

  check("/negotiate returns JSON", res.json !== null, `body was not JSON: ${(res.text || "").slice(0, 200)}`);
  if (!res.json) return;

  const r = res.json;
  check(
    "  message: non-empty string",
    typeof r.message === "string" && r.message.trim().length > 0,
    `got ${JSON.stringify(r.message)}`
  );
  check(
    "  counterPrice: number or null",
    r.counterPrice === null || r.counterPrice === undefined || Number.isFinite(Number(r.counterPrice)),
    `got ${JSON.stringify(r.counterPrice)} — use null when not countering, not a string or 0`
  );
  check("  accepted: boolean", typeof r.accepted === "boolean", `got ${JSON.stringify(r.accepted)}`);
  check("  walkAway: boolean", typeof r.walkAway === "boolean", `got ${JSON.stringify(r.walkAway)}`);

  // The one semantic trap worth catching: a counter ABOVE asking is almost
  // always a sign the field is being used backwards.
  if (Number.isFinite(Number(r.counterPrice)) && Number(r.counterPrice) > LISTING.price) {
    check(
      "  counterPrice is at or below asking",
      false,
      `countered $${r.counterPrice} against a $${LISTING.price} asking price — counterPrice should be ` +
        `what the SELLER will take, not a markup`
    );
  }

  const outcome = r.accepted ? `accepted $720` : r.walkAway ? "walked away" : `countered $${r.counterPrice}`;
  console.log(`        outcome: ${outcome}`);
  console.log(`        seller said: "${String(r.message || "").slice(0, 150)}"`);
}

async function checkMultiRound() {
  console.log("\nPOST /negotiate — round 2 (does it hold state / read history?)");
  const res = await post("/negotiate", {
    threadId: "thr_contractcheck",
    listingId: "check-1",
    listing: LISTING,
    offer: { price: 780, message: "I can stretch to $780." },
    round: 2,
    history: [
      { role: "buyer", text: "Would you take $720?", price: 720 },
      { role: "seller", text: "I can do $820.", price: 820 },
      { role: "buyer", text: "I can stretch to $780.", price: 780 },
    ],
  });

  if (res.error) return check("round 2 responds", false, res.error);
  check("round 2 responds with a valid shape",
    res.ok && res.json && typeof res.json.message === "string" && typeof res.json.accepted === "boolean",
    `HTTP ${res.status}, keys [${res.json ? Object.keys(res.json).join(", ") : "none"}]`);

  if (res.json?.message) console.log(`        seller said: "${String(res.json.message).slice(0, 150)}"`);
}

(async () => {
  console.log(`Checking seller agent at ${BASE}`);
  console.log(`Contract: lib/sellerChannel.js — "THE SELLER-AGENT CONTRACT"`);

  await checkAsk();
  await checkNegotiate();
  await checkMultiRound();

  const failed = results.filter((r) => !r.passed);
  console.log("");
  if (failed.length === 0) {
    console.log(`\x1b[32mAll ${results.length} checks passed.\x1b[0m This agent will work with the buyer agent.`);
    console.log(`\nStart Ampy against it:\n  SELLER_AGENT_URL=${BASE} npm start`);
    process.exit(0);
  }

  console.log(`\x1b[31m${failed.length} of ${results.length} checks failed:\x1b[0m`);
  failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? `\n      ${f.detail}` : ""}`));
  console.log(`\nThe contract is documented at the top of lib/sellerChannel.js.`);
  process.exit(1);
})();
