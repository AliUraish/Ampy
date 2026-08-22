function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreDeal({
  price,
  compsMedian,
  compsN,
  mistralEstimate,
  demand,
  hasPhoto,
  descLen,
}) {
  // Mistral appraises blind (see lib/valuation.js), so its estimate carries
  // the item-specific signal; comps median is a category-wide sanity anchor.
  const fairValue = 0.4 * compsMedian + 0.6 * mistralEstimate;
  const margin = clamp((fairValue - price - 15) / price, -1, 2);
  const marginN = (margin + 1) / 3;
  const normalizedDemand = clamp(demand, 0, 1);
  const agreement = compsMedian > 0
    ? 1 - Math.min(Math.abs(compsMedian - mistralEstimate) / compsMedian, 1)
    : Number(mistralEstimate) === 0 ? 1 : 0;
  const confidence =
    0.4 * Math.min(compsN / 8, 1) +
    0.3 * agreement +
    0.2 * (hasPhoto ? 1 : 0) +
    0.1 * Math.min(descLen / 300, 1);
  const flags = [];
  let score = Math.round(
    100 * (0.5 * marginN + 0.3 * normalizedDemand + 0.2 * confidence),
  );
  score = clamp(score, 0, 100);

  if (price < 0.2 * fairValue) {
    flags.push("too_good");
    score = Math.min(score, 40);
  }

  return {
    fairValue,
    margin,
    marginN,
    demand: normalizedDemand,
    confidence,
    score,
    flags,
  };
}

module.exports = { scoreDeal };
