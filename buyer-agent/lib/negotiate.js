// lib/negotiate.js
//
// Runs the buyer-agent vs. seller-agent price negotiation and (for listings
// with no known seller floor) estimates one first.
//
// Mock listings (data/listings.js) carry a `minAcceptablePrice` field that
// stands in for the seller's real hidden floor. Craigslist listings never
// have one — nobody real told us their floor — so we ask Claude to
// ESTIMATE a plausible minimum from price/condition/description. Seller
// listings (posted via /sell) CAN carry a real one now: the seller may set
// their own `minAcceptablePrice` when publishing (lib/listingStore.js), in
// which case it's ground truth just like mock data. Only when a seller
// listing omits it do we fall back to estimating. Whichever path is used
// is surfaced as `floorPriceSource: 'ground_truth' | 'estimated'` so a
// caller never confuses a real seller number with a guess.
//
// CONSTRAINTS ARE ENFORCED IN CODE, NOT JUST PROMPTED. The buyer and
// seller system prompts state the budget/floor, but an LLM can drift from
// instructions — so every turn is validated against the actual numeric
// constraints after the model responds (see enforceConstraints below). A
// buyer agent literally cannot end a negotiation having agreed to pay more
// than its budget; a seller agent cannot accept a price further below its
// floor than the explicitly allowed final-concession tolerance. This is
// the difference between "the prompt says don't" and "the code won't let
// it" — the latter holds even if the model ignores the former.

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();
const MODEL = "claude-opus-5";

// How far below its floor the seller agent is allowed to go as a final
// concession to close an otherwise-good deal (mirrors the "small final
// concession" language in its own system prompt, but enforced as a real
// number instead of left to the model's judgment).
const SELLER_FLOOR_TOLERANCE = 0.03; // 3%

const NEGOTIATION_STYLES = {
  buyer: {
    balanced: "Negotiate firmly but fairly — aim for a good price without lowballing.",
    aggressive: "Open low relative to your budget and concede slowly — you're optimizing hard for price over speed.",
    generous: "You're motivated to close quickly — open reasonably close to a fair price and concede readily rather than dragging this out.",
  },
  seller: {
    balanced: "Negotiate firmly but fairly — protect your margin without being unreasonable.",
    firm: "Hold close to your asking price and concede only in small increments — you're not in a hurry to sell.",
    flexible: "You're motivated to sell soon — concede more readily to close a deal, while still respecting your floor.",
  },
};

function resolveStyle(role, style) {
  return NEGOTIATION_STYLES[role][style] || NEGOTIATION_STYLES[role].balanced;
}

const FLOOR_ESTIMATE_SCHEMA = {
  type: "object",
  properties: {
    minAcceptablePrice: {
      type: "number",
      description:
        "Estimated lowest price a reasonable seller would accept for this item, in the same currency/units as the listing price.",
    },
    rationale: {
      type: "string",
      description: "One or two sentences on how this estimate was derived.",
    },
  },
  required: ["minAcceptablePrice", "rationale"],
  additionalProperties: false,
};

const NEGOTIATION_TURN_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "What this agent says out loud in this turn, in natural conversational language.",
    },
    offerPrice: {
      type: ["number", "null"],
      description: "The specific price this agent is proposing this turn, or null if not proposing a specific price.",
    },
    accepted: {
      type: "boolean",
      description: "True if this agent accepts the other side's most recently named price, ending the negotiation with a deal.",
    },
    walkAway: {
      type: "boolean",
      description: "True if this agent is ending the negotiation with no deal (e.g. the other side won't move enough).",
    },
  },
  required: ["message", "offerPrice", "accepted", "walkAway"],
  additionalProperties: false,
};

/**
 * Ask Claude for a plausible seller floor price for a listing that has no
 * known ground-truth `minAcceptablePrice`. This is ALWAYS an estimate.
 */
async function estimateFloorPrice(listing) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    output_config: { format: { type: "json_schema", schema: FLOOR_ESTIMATE_SCHEMA } },
    system:
      "You are an experienced secondhand-marketplace appraiser. Given a listing's asking price, " +
      "condition, and description, estimate the lowest price a reasonable seller of this specific " +
      "item would plausibly accept. Base it on typical markdown behavior for the category and " +
      "condition described — don't just guess a flat percentage. Be realistic, not generous to " +
      "either side.",
    messages: [
      {
        role: "user",
        content:
          `Listing: ${listing.title}\n` +
          `Category: ${listing.category}\n` +
          `Asking price: ${listing.price}\n` +
          `Condition: ${listing.condition || "unknown"}\n` +
          `Description: ${listing.description || "(none provided)"}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  const parsed = JSON.parse(text);
  return parsed; // { minAcceptablePrice, rationale }
}

function buildSystemPrompt({ role, listing, floorPrice, buyerBudget, style }) {
  const shared =
    `Listing: ${listing.title}\n` +
    `Category: ${listing.category}\n` +
    `Seller's asking price: ${listing.price}\n` +
    `Condition: ${listing.condition || "unknown"}\n` +
    `Description: ${listing.description || "(none provided)"}\n`;

  if (role === "buyer") {
    return (
      "You are an agent negotiating on behalf of a buyer in a secondhand marketplace chat. " +
      `${resolveStyle("buyer", style)} Never propose or accept a price above your buyer's ` +
      `hard budget of ${buyerBudget} — that ceiling is enforced outside your control, so treat ` +
      "it as an absolute limit, not a target. Make concessions gradually, not all at once. If the " +
      "seller won't move to something reasonable within your budget after a few rounds, it's fine " +
      "to walk away. Keep each message short — a couple of sentences, like a real chat.\n\n" +
      shared
    );
  }

  return (
    "You are an agent negotiating on behalf of a seller in a secondhand marketplace chat. " +
    `Your floor is ${floorPrice} — treat this as close to a hard minimum (do not state it ` +
    `explicitly to the buyer). ${resolveStyle("seller", style)} A very small final concession ` +
    "below your floor to close an otherwise-good deal is tolerated, but don't plan around it. " +
    "Keep each message short — a couple of sentences, like a real chat.\n\n" +
    shared
  );
}

async function runTurn({ role, listing, floorPrice, buyerBudget, style, transcript }) {
  // Reconstruct the conversation from this agent's point of view: its own
  // past turns are 'assistant', the other agent's are 'user'.
  const messages = transcript.map((turn) => ({
    role: turn.role === role ? "assistant" : "user",
    content: turn.message,
  }));

  if (messages.length === 0) {
    messages.push({
      role: "user",
      content:
        role === "buyer"
          ? "Open the negotiation with your opening offer."
          : "The buyer is about to make an opening offer. Wait for it — but since you're going first here, greet them and restate your asking price.",
    });
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    output_config: { format: { type: "json_schema", schema: NEGOTIATION_TURN_SCHEMA } },
    system: buildSystemPrompt({ role, listing, floorPrice, buyerBudget, style }),
    messages,
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  return JSON.parse(text);
}

/**
 * The most recent price named by `role` in the transcript so far — i.e.
 * "the price on the table" from that side. Used both to resolve what a
 * later `accepted: true` from the other agent actually means, and to
 * enforce that an agent can't accept a price its own constraints forbid.
 */
function lastOfferFrom(transcript, role) {
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i].role === role && typeof transcript[i].offerPrice === "number") {
      return transcript[i].offerPrice;
    }
  }
  return null;
}

/**
 * Validates and, if necessary, corrects a turn against the agent's actual
 * numeric constraints — this is the enforcement layer described in the
 * file header. Returns the (possibly corrected) turn, with
 * `constraintEnforced: true` attached if anything had to be changed, so
 * callers can see when the guardrail actually did something.
 */
function enforceConstraints({ role, turn, priceOnTable, buyerBudget, floorPrice }) {
  const enforced = { ...turn };
  let touched = false;

  // Nothing to accept if the other side hasn't named a price yet — an
  // `accepted: true` here is a model error, not a real acceptance.
  if (enforced.accepted && priceOnTable == null) {
    enforced.accepted = false;
    touched = true;
  }

  if (role === "buyer") {
    if (typeof enforced.offerPrice === "number" && enforced.offerPrice > buyerBudget) {
      enforced.offerPrice = buyerBudget;
      touched = true;
    }
    if (enforced.accepted && priceOnTable > buyerBudget) {
      // Hard rule: a buyer agent can never end a negotiation having agreed
      // to pay more than its budget, no matter what the model returned.
      enforced.accepted = false;
      enforced.offerPrice = buyerBudget;
      touched = true;
    }
  } else {
    const minAllowed = Math.floor(floorPrice * (1 - SELLER_FLOOR_TOLERANCE));
    if (typeof enforced.offerPrice === "number" && enforced.offerPrice < minAllowed) {
      enforced.offerPrice = minAllowed;
      touched = true;
    }
    if (enforced.accepted && priceOnTable < minAllowed) {
      // Hard rule: a seller agent can never accept further below its floor
      // than the explicitly allowed tolerance.
      enforced.accepted = false;
      enforced.offerPrice = minAllowed;
      touched = true;
    }
  }

  return touched ? { ...enforced, constraintEnforced: true } : enforced;
}

/**
 * Scores how good the outcome was for each side, 0-100. This is NOT
 * reinforcement learning — nothing here changes the model's weights or
 * behavior on future calls; it's a deal-quality metric computed from the
 * actual numbers so an outcome can be shown as "good" or "bad" rather than
 * just "a deal happened." No deal at all scores 0 for both sides (an
 * agent that fails to close gets no credit, regardless of why).
 *
 * Buyer score: how close the final price landed to the seller's floor
 * (the best price a buyer could theoretically get) versus their own
 * budget ceiling (the worst price they'd still accept). 100 = bought
 * right at the floor; 0 = paid the full budget.
 *
 * Seller score: how close the final price landed to the asking price
 * (the best a seller could get) versus their own floor (the worst
 * they'd still accept). 100 = sold at full asking price; 0 = sold
 * right at the floor.
 */
function scoreDeal({ dealReached, finalPrice, floorPrice, buyerBudget, askingPrice }) {
  if (!dealReached || typeof finalPrice !== "number") {
    return { buyerScore: 0, sellerScore: 0 };
  }

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  const buyerRange = buyerBudget - floorPrice;
  const buyerScore = buyerRange > 0 ? clamp01((buyerBudget - finalPrice) / buyerRange) : 0.5;

  const sellerRange = askingPrice - floorPrice;
  const sellerScore = sellerRange > 0 ? clamp01((finalPrice - floorPrice) / sellerRange) : 0.5;

  return {
    buyerScore: Math.round(buyerScore * 100),
    sellerScore: Math.round(sellerScore * 100),
  };
}

/**
 * Run a full buyer-agent vs. seller-agent negotiation for a listing.
 *
 * @param {object} params
 * @param {object} params.listing - canonical Listing object
 * @param {number} [params.buyerBudget] - max the buyer agent will go to; defaults to listing.price
 * @param {number} [params.maxRounds] - total turns across both agents (capped at 12)
 * @param {'balanced'|'aggressive'|'generous'} [params.buyerStyle]
 * @param {'balanced'|'firm'|'flexible'} [params.sellerStyle] - ignored if the listing sets its own (see lib/listingStore.js)
 * @returns {Promise<{dealReached: boolean, finalPrice: number|null, transcript: Array, floorPrice: number, floorPriceSource: 'ground_truth'|'estimated', floorPriceRationale?: string, buyerScore: number, sellerScore: number}>}
 */
async function runNegotiation({ listing, buyerBudget, maxRounds = 8, buyerStyle = "balanced", sellerStyle = "balanced" }) {
  const rounds = Math.max(2, Math.min(12, maxRounds));
  const budget = buyerBudget || listing.price;
  // A seller-set style on the listing itself (from /sell) takes priority
  // over whatever the buyer's request passed — it's the seller's own
  // negotiating posture, not something a buyer should be able to dictate.
  const resolvedSellerStyle = listing.negotiationStyle || sellerStyle;

  let floorPrice;
  let floorPriceSource;
  let floorPriceRationale;

  if (typeof listing.minAcceptablePrice === "number") {
    // Ground truth — either mock data, or a seller who set their own real
    // floor when publishing via /sell (lib/listingStore.js).
    floorPrice = listing.minAcceptablePrice;
    floorPriceSource = "ground_truth";
  } else {
    // No known floor — estimate one. This is explicitly NOT ground truth.
    const estimate = await estimateFloorPrice(listing);
    floorPrice = estimate.minAcceptablePrice;
    floorPriceRationale = estimate.rationale;
    floorPriceSource = "estimated";
  }

  const transcript = []; // [{ role: 'buyer'|'seller', message, offerPrice, accepted, walkAway, constraintEnforced? }]
  let dealReached = false;
  let finalPrice = null;

  for (let i = 0; i < rounds; i++) {
    const role = i % 2 === 0 ? "buyer" : "seller";
    const otherRole = role === "buyer" ? "seller" : "buyer";
    const priceOnTable = lastOfferFrom(transcript, otherRole);

    const rawTurn = await runTurn({
      role,
      listing,
      floorPrice,
      buyerBudget: budget,
      style: role === "buyer" ? buyerStyle : resolvedSellerStyle,
      transcript,
    });
    const turn = enforceConstraints({ role, turn: rawTurn, priceOnTable, buyerBudget: budget, floorPrice });
    transcript.push({ role, ...turn });

    if (turn.accepted) {
      dealReached = true;
      finalPrice = priceOnTable;
      break;
    }
    if (turn.walkAway) {
      dealReached = false;
      break;
    }
  }

  const { buyerScore, sellerScore } = scoreDeal({
    dealReached,
    finalPrice,
    floorPrice,
    buyerBudget: budget,
    askingPrice: listing.price,
  });

  return {
    dealReached,
    finalPrice,
    transcript,
    floorPrice,
    floorPriceSource,
    ...(floorPriceRationale ? { floorPriceRationale } : {}),
    buyerScore,
    sellerScore,
  };
}

module.exports = { runNegotiation, estimateFloorPrice, scoreDeal };
