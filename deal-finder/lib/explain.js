const { chatJSON } = require("./mistral");

const MODEL = "mistral-small-latest";

function cleanString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function limitSentences(value, fallback) {
  const text = cleanString(value, fallback);
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return (sentences || [text]).slice(0, 2).join(" ").trim();
}

async function explainDeal({ listing, valuation, deal }) {
  const safeListing = listing || {};
  const safeValuation = valuation || {};
  const safeDeal = deal || {};
  const prompt = `Write concise copy for a used-goods deal card. Return only JSON with exactly these string fields: {"headline": string, "why": string, "riskNote": string}. Each field must be no more than two sentences. Be specific, skeptical, and do not invent facts.

Listing: ${JSON.stringify({
    title: safeListing.title,
    price: safeListing.price,
    condition: safeListing.condition,
    description: safeListing.description,
  })}
Valuation: ${JSON.stringify(safeValuation)}
Deal score: ${JSON.stringify(safeDeal)}`;

  const raw = await chatJSON({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 300,
  });

  const title = cleanString(safeListing.title, "Listing");
  const price = Number.isFinite(Number(safeListing.price))
    ? `$${Number(safeListing.price)}`
    : "unknown price";
  const flags = [
    ...(Array.isArray(safeValuation.redFlags) ? safeValuation.redFlags : []),
    ...(Array.isArray(safeDeal.flags) ? safeDeal.flags : []),
  ].filter((flag) => typeof flag === "string" && flag.trim());

  const fallbacks = {
    headline: `${title} at ${price}`,
    why: cleanString(safeValuation.reasoning, "Compare it carefully with local listings."),
    riskNote: flags.join("; ") || "No specific risks noted.",
  };
  const fieldSources = {
    headline: cleanString(raw.headline, "") ? "mistral" : "fallback",
    why: cleanString(raw.why, "") ? "mistral" : "fallback",
    riskNote: cleanString(raw.riskNote, "") ? "mistral" : "fallback",
  };
  const fullyGenerated = Object.values(fieldSources).every((source) => source === "mistral");

  return {
    headline: limitSentences(raw.headline, fallbacks.headline),
    why: limitSentences(raw.why, fallbacks.why),
    riskNote: limitSentences(raw.riskNote, fallbacks.riskNote),
    provenance: {
      source: fullyGenerated ? "mistral" : "mixed",
      model: MODEL,
      fields: fieldSources,
    },
  };
}

module.exports = { explainDeal };
