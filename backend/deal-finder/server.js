// server.js — Deal Finder. Serves the single-page UI and the SSE deal scan.
require("dotenv").config();
const express = require("express");
const path = require("path");
const craigslistLocations = require("./data/craigslistLocations");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/craigslist-locations", (req, res) => res.json(craigslistLocations));

// GET /api/deals — implemented in lib/dealScan.js (Track 3). See docs/contracts.md.
app.get("/api/deals", async (req, res) => {
  const { streamDeals } = require("./lib/dealScan");
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    await streamDeals(req.query, send);
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 4747; // 3000 collides with other local apps (Sytrex)
app.listen(PORT, () => console.log(`Deal Finder on http://localhost:${PORT}`));
