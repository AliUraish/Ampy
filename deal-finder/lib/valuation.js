const { chatJSON } = require("./mistral");

const VISION_MODEL = process.env.MISTRAL_VISION_MODEL || "mistral-medium-latest"; // Large is 4 req/min on demo keys; Medium is 50/min and has vision
const TEXT_MODEL = process.env.MISTRAL_TEXT_MODEL || "mistral-medium-latest";
const CONDITIONS = new Set(["new", "like new", "excellent", "good", "fair", "poor"]);

function cleanString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeCondition(value, listingCondition) {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replace(/[_-]+/g, " ")
    : "";
  if (CONDITIONS.has(normalized)) return normalized;

  const fallback = typeof listingCondition === "string"
    ? listingCondition.trim().toLowerCase().replace(/[_-]+/g, " ")
    : "";
  return CONDITIONS.has(fallback) ? fallback : "good";
}

function toUsd(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "");
    if (!/\d/.test(normalized)) return null;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return null;
}

function toStringArray(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values
    .filter((entry) => typeof entry === "string" && entry.trim())
    .map((entry) => entry.trim());
}

function limitWords(value, maxWords, fallback) {
  const words = cleanString(value, fallback).split(/\s+/);
  return words.slice(0, maxWords).join(" ");
}

async function valueListing(listing, { compsMedian, compsN, city } = {}) {
  const safeListing = listing || {};
  const title = cleanString(safeListing.title, "Unknown item");
  const description = cleanString(safeListing.description, "No description provided");
  const market = cleanString(city, "the local market");
  const photoInstruction = safeListing.imageUrl
    ? "Mention concrete visual evidence from the photo when it affects your appraisal."
    : "There is no photo; treat that as a red flag and rely on the listing text.";

  // BLIND appraisal on purpose: we do NOT show the asking price or the comps
  // median. Given either, the model anchors on it and just echoes it back
  // ("$250 vs median $300") instead of valuing the actual item. The comps
  // comparison happens afterwards in lib/dealScore.js, where it belongs.
  const prompt = `You are a used-goods appraiser for ${market}. Identify the item in the photo and text and estimate what it would realistically SELL for on a local classifieds site within two weeks.
Listing title: ${title}
Description: ${description}
Consider brand, model, age/era, component tier, size, and visible condition. Old department-store or entry-level bikes resell for far less than name-brand or enthusiast models even in good condition.
Return JSON: { "item": string, "brandModel": string|null, "condition": "new|like new|excellent|good|fair|poor", "estimatedResaleUsd": number, "redFlags": string[], "reasoning": string }
Reasoning must be concrete and no more than 60 words. ${photoInstruction}
Be skeptical: stock photos, missing photos, vague or contradictory text, and claims that cannot be seen in the photo are red flags. Do not mention price in redFlags.`;

  const hasImage = typeof safeListing.imageUrl === "string" && safeListing.imageUrl.trim();
  const content = hasImage
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: safeListing.imageUrl.trim() },
      ]
    : prompt;

  const model = hasImage ? VISION_MODEL : TEXT_MODEL;
  const raw = await chatJSON({
    model,
    messages: [{ role: "user", content }],
    maxTokens: 500,
  });

  const estimatedResaleUsd = toUsd(raw.estimatedResaleUsd);
  if (estimatedResaleUsd === null) {
    // Never substitute the asking price or the broad result-set median and then
    // present it as a model appraisal. Without a real Mistral estimate the
    // listing cannot be scored honestly.
    throw new Error("Mistral valuation is missing a valid estimatedResaleUsd");
  }
  const reasoning = cleanString(raw.reasoning);
  if (!reasoning) {
    throw new Error("Mistral valuation is missing appraisal reasoning");
  }

  const brandModel = cleanString(raw.brandModel, "") || null;
  return {
    item: cleanString(raw.item, title),
    brandModel,
    condition: normalizeCondition(raw.condition, safeListing.condition),
    estimatedResaleUsd,
    redFlags: toStringArray(raw.redFlags),
    reasoning: limitWords(reasoning, 60, "Insufficient details for a confident appraisal."),
    provenance: {
      source: "mistral",
      model,
      inputMode: hasImage ? "vision" : "text",
    },
  };
}

module.exports = { valueListing };
