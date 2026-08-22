const test = require("node:test");
const assert = require("node:assert/strict");

function loadValuationWith(chatJSON) {
  const mistralPath = require.resolve("../lib/mistral");
  const valuationPath = require.resolve("../lib/valuation");
  const previousMistral = require.cache[mistralPath];
  const previousValuation = require.cache[valuationPath];

  require.cache[mistralPath] = {
    id: mistralPath,
    filename: mistralPath,
    loaded: true,
    exports: { chatJSON },
  };
  delete require.cache[valuationPath];
  const valuation = require(valuationPath);

  if (previousMistral) require.cache[mistralPath] = previousMistral;
  else delete require.cache[mistralPath];
  if (previousValuation) require.cache[valuationPath] = previousValuation;
  else delete require.cache[valuationPath];
  return valuation;
}

test("returns an attributable Mistral appraisal without exposing price or comps", async () => {
  let request;
  const { valueListing } = loadValuationWith(async (input) => {
    request = input;
    return {
      item: "watch",
      brandModel: "Rolex Submariner",
      condition: "good",
      estimatedResaleUsd: "$7,250",
      redFlags: ["serial number not visible"],
      reasoning: "The dial and case resemble a Submariner, but authenticity cannot be established from one photo.",
    };
  });

  const result = await valueListing({
    title: "Rolex submariner",
    description: "Black dial; meet locally.",
    price: 100,
    imageUrl: "https://example.com/watch.jpg",
  }, { compsMedian: 9000, compsN: 12, city: "sfbay" });

  const prompt = request.messages[0].content[0].text;
  assert.doesNotMatch(prompt, /\$100|9000|9,000/);
  assert.equal(result.estimatedResaleUsd, 7250);
  assert.deepEqual(result.provenance, {
    source: "mistral",
    model: "mistral-medium-latest",
    inputMode: "vision",
  });
});

test("rejects an invalid model estimate instead of disguising a fallback as Mistral", async () => {
  const { valueListing } = loadValuationWith(async () => ({
    item: "watch",
    condition: "good",
    estimatedResaleUsd: "not sure",
    reasoning: "There is not enough evidence to establish authenticity.",
  }));

  await assert.rejects(
    valueListing({ title: "Watch", price: 100 }, { compsMedian: 9000 }),
    /missing a valid estimatedResaleUsd/
  );
});

test("rejects missing appraisal reasoning instead of labeling canned text as model output", async () => {
  const { valueListing } = loadValuationWith(async () => ({
    item: "watch",
    condition: "good",
    estimatedResaleUsd: 500,
  }));

  await assert.rejects(
    valueListing({ title: "Watch", price: 100 }, { compsMedian: 9000 }),
    /missing appraisal reasoning/
  );
});
