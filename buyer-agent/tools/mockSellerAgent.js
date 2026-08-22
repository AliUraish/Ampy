// tools/mockSellerAgent.js
//
// A stand-in seller agent, and a REFERENCE IMPLEMENTATION of the contract
// in lib/sellerChannel.js.
//
// This is NOT the real seller agent — that's being built separately. Two
// reasons this exists anyway:
//
//   1. The buyer agent can't be verified against a service that doesn't
//      exist yet. Running it against this proves the whole path works:
//      question -> seller agent -> answer -> buyer agent uses the answer.
//   2. It pins down the wire contract in code rather than in prose, so the
//      real seller agent has something concrete to match. If it speaks
//      these two endpoints, it drops in with no changes to Hagglr.
//
// Point Hagglr at it and run:
//
//   node tools/mockSellerAgent.js                    # listens on :4000
//   SELLER_AGENT_URL=http://localhost:4000 npm start
//
// It holds a hidden floor price per listing (like a real seller would) and
// won't go below it, so negotiations have a real shape instead of always
// caving or never moving.

require("dotenv").config({ quiet: true });

const express = require("express");
const path = require("path");
const llm = require(path.join(__dirname, "..", "lib", "llm.js"));

const PORT = process.env.MOCK_SELLER_PORT || 4000;

const app = express();
app.use(express.json({ limit: "1mb" }));

// Hidden floors, remembered per listing so the seller doesn't contradict
// itself between rounds. A real seller agent would read this from its own
// store; here it's derived once and cached.
const floors = new Map();
function floorFor(listing) {
  if (!floors.has(listing.listingId)) {
    // 78% of asking, which is roughly where secondhand sellers actually
    // stop. Deterministic so a test run is reproducible.
    floors.set(listing.listingId, Math.round((listing.price || 0) * 0.78));
  }
  return floors.get(listing.listingId);
}

// One helper, one model family: this reference seller agent runs on
// Mistral, same as the real one being built for the hackathon.
async function ask({ system, user, maxTokens = 400 }) {
  return llm.chatText({ system, user, maxTokens });
}

// POST /ask — answer a buyer's question about a listing.
app.post("/ask", async (req, res) => {
  const { listing = {}, question, threadId, listingId } = req.body || {};
  if (!question) return res.status(400).json({ error: "question is required" });

  console.log(`[mock-seller] ask about "${listing.title}": ${question}`);

  try {
    const answer = await ask({
      system:
        "You are the seller of a secondhand item, answering a buyer's question by text. Answer in one or two " +
        "short, plain sentences, like a real person would. Be honest about flaws — invent specific, plausible " +
        "details consistent with the listing (you're the seller, you know the item). Never mention being an AI. " +
        "If asked the lowest you'd take, give a number a bit above your real floor — you're still negotiating.",
      user:
        `Your listing:\nTitle: ${listing.title}\nAsking: $${listing.price}\n` +
        `Condition: ${listing.condition}\nDescription: ${listing.description}\n` +
        `Your hidden floor (never state this exactly): $${floorFor({ listingId, price: listing.price })}\n\n` +
        `Buyer asks: ${question}`,
    });

    res.json({ answer, threadId });
  } catch (err) {
    console.error("[mock-seller] /ask failed:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// POST /negotiate — respond to one offer.
app.post("/negotiate", async (req, res) => {
  const { listing = {}, offer = {}, round = 1, listingId } = req.body || {};
  const asking = Number(listing.price) || 0;
  const floor = floorFor({ listingId, price: asking });
  const offered = Number(offer.price) || 0;

  console.log(`[mock-seller] round ${round}: offered $${offered} on "${listing.title}" (asking $${asking}, floor $${floor})`);

  // The numbers are decided in code, not by the model — a seller agent that
  // can be talked below its own floor isn't much of a seller agent. The
  // model only writes how it's said.
  let accepted = false;
  let counterPrice = null;
  let walkAway = false;

  if (offered >= floor) {
    accepted = true;
  } else if (offered < floor * 0.55) {
    // Insultingly low — real sellers stop replying.
    walkAway = true;
  } else {
    // Concede toward the floor, slower early, never below it.
    const concession = round === 1 ? 0.4 : 0.6;
    counterPrice = Math.max(floor, Math.round(asking - (asking - Math.max(offered, floor)) * concession));
    if (counterPrice <= offered) counterPrice = floor;
  }

  try {
    const message = await ask({
      maxTokens: 200,
      system:
        "You are a secondhand seller haggling by text. One or two short sentences, plain and natural, like a real " +
        "person. No greetings, no emoji, no signature. Never mention being an AI or reveal your floor price.",
      user:
        `Item: ${listing.title} (asking $${asking}, condition ${listing.condition}).\n` +
        `Buyer offered $${offered}: "${offer.message}"\n\n` +
        (accepted
          ? `You are ACCEPTING $${offered}. Say yes and suggest sorting out pickup.`
          : walkAway
            ? `You are DECLINING and ending it — the offer is far too low. Be brief and civil.`
            : `You are COUNTERING at $${counterPrice}. State that number and give one concrete reason it's worth it.`),
    });

    res.json({ message, counterPrice, accepted, walkAway });
  } catch (err) {
    console.error("[mock-seller] /negotiate failed:", err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, service: "mock-seller-agent" }));

app.listen(PORT, () => {
  console.log(`[mock-seller] reference seller agent on http://localhost:${PORT}`);
  console.log(`[mock-seller] point Hagglr at it: SELLER_AGENT_URL=http://localhost:${PORT} npm start`);
});
