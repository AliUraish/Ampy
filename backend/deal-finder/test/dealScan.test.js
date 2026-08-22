const test = require("node:test");
const assert = require("node:assert/strict");

const { extractCraigslistListings, roundRobinListings } = require("../lib/dealScan");

test("keeps a valid empty Craigslist search empty", () => {
  assert.deepEqual(extractCraigslistListings({ listings: [], source: "craigslist" }), []);
});

test("does not disguise a Craigslist failure as fixture data", () => {
  assert.throws(
    () => extractCraigslistListings({ listings: [], error: "craigslist responded 429" }),
    /Craigslist search failed: craigslist responded 429/
  );
});

test("rejects malformed Craigslist responses", () => {
  assert.throws(() => extractCraigslistListings({}), /unreadable response/);
});

test("balances nationwide results across markets instead of favoring the first city", () => {
  const groups = [
    [{ id: "ny-1" }, { id: "ny-2" }, { id: "ny-3" }],
    [{ id: "la-1" }, { id: "la-2" }],
    [{ id: "chi-1" }],
  ];
  assert.deepEqual(
    roundRobinListings(groups, 5).map((listing) => listing.id),
    ["ny-1", "la-1", "chi-1", "ny-2", "la-2"]
  );
});

test("score-based pass events retain the actual appraisal and decision evidence", async () => {
  const modulePaths = {
    dealScan: require.resolve("../lib/dealScan"),
    valuation: require.resolve("../lib/valuation"),
    demand: require.resolve("../lib/demand"),
    dealScore: require.resolve("../lib/dealScore"),
    explain: require.resolve("../lib/explain"),
  };
  const previousModules = Object.fromEntries(
    Object.entries(modulePaths).map(([name, modulePath]) => [name, require.cache[modulePath]])
  );
  const previousEnv = {
    USE_MOCK_DATA: process.env.USE_MOCK_DATA,
    VALUATION_LIMIT: process.env.VALUATION_LIMIT,
    PASS_THRESHOLD: process.env.PASS_THRESHOLD,
  };
  const stub = (modulePath, exports) => {
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports,
    };
  };

  try {
    process.env.USE_MOCK_DATA = "true";
    process.env.VALUATION_LIMIT = "1";
    process.env.PASS_THRESHOLD = "60";
    stub(modulePaths.valuation, { valueListing: async () => ({
      item: "bicycle",
      brandModel: "Test Bike",
      condition: "good",
      estimatedResaleUsd: 200,
      redFlags: ["test flag"],
      reasoning: "Model appraisal evidence.",
      provenance: { source: "mistral", model: "test-model", inputMode: "text" },
    }) });
    stub(modulePaths.demand, { getDemand: async () => ({
      value: 0.5,
      source: "baseline",
      keyword: "Test Bike",
    }) });
    stub(modulePaths.dealScore, { scoreDeal: () => ({
      fairValue: 200,
      margin: 0.1,
      confidence: 0.7,
      score: 42,
      flags: [],
    }) });
    stub(modulePaths.explain, { explainDeal: async () => ({
      headline: "Model verdict",
      why: "Model explanation.",
      riskNote: "Model risk.",
      provenance: {
        source: "mistral",
        model: "test-explainer",
        fields: { headline: "mistral", why: "mistral", riskNote: "mistral" },
      },
    }) });
    delete require.cache[modulePaths.dealScan];
    const { streamDeals } = require(modulePaths.dealScan);
    const events = [];
    await streamDeals({ maxPrice: 10000 }, (event, data) => events.push({ event, data }));

    const candidate = events.find((entry) => entry.event === "candidate");
    assert.ok(candidate, "expected an immediate candidate event before appraisal");
    assert.equal(candidate.data.valuation, undefined);
    assert.equal(candidate.data.deal, undefined);
    assert.ok(Number.isFinite(candidate.data.compsMedian));

    const candidateIndex = events.indexOf(candidate);
    const analysisStages = events
      .slice(candidateIndex + 1)
      .filter((entry) => entry.event === "analysis" && entry.data.id === candidate.data.id)
      .map((entry) => entry.data.stage);
    assert.deepEqual(analysisStages, ["details", "appraisal", "comps", "demand", "score"]);

    const pass = events.find((entry) => entry.event === "pass" && entry.data.deal);
    assert.ok(pass, "expected a scored pass event");
    assert.ok(candidateIndex < events.indexOf(pass), "candidate must arrive before its terminal pass event");
    assert.equal(pass.data.reason, "Score 42/100");
    assert.equal(pass.data.valuation.reasoning, "Model appraisal evidence.");
    assert.equal(pass.data.deal.why, "Model explanation.");
    assert.equal(pass.data.deal.explanationProvenance.source, "mistral");
    assert.equal(pass.data.demand.source, "baseline");
    assert.equal(pass.data.fairValue, 200);
  } finally {
    for (const [name, modulePath] of Object.entries(modulePaths)) {
      const previous = previousModules[name];
      if (previous) require.cache[modulePath] = previous;
      else delete require.cache[modulePath];
    }
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
