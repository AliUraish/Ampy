// server.js — Deal Finder API (SSE scan). UI lives in repo-root frontend/ (Next.js).

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });
require("dotenv").config({ quiet: true });

const express = require("express");
const craigslistLocations = require("./data/craigslistLocations");

const PORT = process.env.DEAL_FINDER_PORT || process.env.PORT || 4747;

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ name: "Ampy deal-finder", status: "ok" });
});

app.get("/api/craigslist-locations", (req, res) => res.json(craigslistLocations));

// GET /api/deals — implemented in lib/dealScan.js. See docs/contracts.md.
app.get("/api/deals", async (req, res) => {
  const { streamDeals } = require("./lib/dealScan");
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    await streamDeals(req.query, send);
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Deal Finder API on http://localhost:${PORT}`);
});
