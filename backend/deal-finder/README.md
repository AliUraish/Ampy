# Deal Finder (backend/deal-finder)

Mistral-powered Craigslist deal finder. Backend API + SSE scan live here; the UI
is in [`frontend/`](../../frontend/).

Pick a category and product; the agent fans the search across 12 priority U.S.
Craigslist markets, appraises each listing with Mistral vision, and streams
underpriced opportunities with a decision trace.

## Run

From the repo root (uses shared `.env` for `MISTRAL_API_KEY`):

```sh
npm run install:deal-finder
npm run start:deal-finder          # http://localhost:4747
```

Or from this folder:

```sh
npm install
npm start
```

Optional Google Trends demand signal:

```sh
python3 -m venv .venv && .venv/bin/pip install -r demand-requirements.txt
```

`/?demo=1` plays a built-in fixture with no network. **Replay cached** replays
the last real scan (`data/lastScan.json`). `USE_MOCK_DATA=true` forces
`data/mockListings.js`. `US_MARKET_LIMIT` / `DEAL_FINDER_PORT` are optional.

## How it scores

`fairValue = 0.4 × comps median + 0.6 × Mistral blind appraisal`
`score = 100 × (0.5 × margin + 0.3 × demand + 0.2 × confidence)`, scam gate when
asking < 20% of fair value. See `lib/dealScore.js` and `docs/contracts.md`.

## Layout

```
backend/deal-finder/   # this package — API, scan, valuation, tests
frontend/              # Deal Finder UI (served by this server)
```
