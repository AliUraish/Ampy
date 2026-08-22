const test = require("node:test");
const assert = require("node:assert/strict");

const { scoreDeal } = require("../lib/dealScore");

function closeTo(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test("scores a strong deal from margin, demand, and confidence", () => {
  const result = scoreDeal({
    price: 200,
    compsMedian: 500,
    compsN: 8,
    mistralEstimate: 500,
    demand: 0.8,
    hasPhoto: true,
    descLen: 300,
  });

  assert.equal(result.fairValue, 500);
  closeTo(result.margin, 1.425);
  closeTo(result.marginN, 0.8083333333333333);
  closeTo(result.confidence, 1);
  assert.equal(result.score, 84);
  assert.deepEqual(result.flags, []);
});

test("keeps a negative margin and scores it accordingly", () => {
  const result = scoreDeal({
    price: 500,
    compsMedian: 400,
    compsN: 8,
    mistralEstimate: 400,
    demand: 0.2,
    hasPhoto: true,
    descLen: 300,
  });

  closeTo(result.margin, -0.23);
  closeTo(result.marginN, 0.25666666666666665);
  assert.equal(result.score, 39);
  assert.deepEqual(result.flags, []);
});

test("caps implausibly cheap listings with the too_good gate", () => {
  const result = scoreDeal({
    price: 50,
    compsMedian: 500,
    compsN: 8,
    mistralEstimate: 500,
    demand: 1,
    hasPhoto: true,
    descLen: 300,
  });

  assert.equal(result.margin, 2);
  assert.equal(result.score, 40);
  assert.deepEqual(result.flags, ["too_good"]);
});

test("missing photo and description contribute no confidence", () => {
  const result = scoreDeal({
    price: 300,
    compsMedian: 500,
    compsN: 8,
    mistralEstimate: 500,
    demand: 0.5,
    hasPhoto: false,
    descLen: 0,
  });

  closeTo(result.confidence, 0.7);
  assert.equal(result.score, 56);
});

test("fair value leans on the blind Mistral estimate (0.4 comps / 0.6 mistral)", () => {
  const result = scoreDeal({
    price: 100,
    compsMedian: 300,
    mistralEstimate: 150,
    compsN: 60,
    demand: 0.5,
    hasPhoto: true,
    descLen: 300,
  });
  assert.equal(result.fairValue, 210); // 0.4*300 + 0.6*150
  closeTo(result.margin, 0.95); // (210 - 100 - 15) / 100
});
