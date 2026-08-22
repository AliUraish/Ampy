# Deal Finder (backend/deal-finder)

Mistral-powered Craigslist deal finder **API**. Fans out across U.S. Craigslist
markets, appraises listings with Mistral vision, and streams scored deals over SSE.

The product UI is the Next.js app in [`frontend/`](../../frontend/) (separate
process). This service is API-only.

## Run

```sh
# from repo root
npm run install:deal-finder
npm run start:deal-finder          # http://localhost:4747
```

```sh
curl -N 'http://127.0.0.1:4747/api/deals?category=bikes&query=road%20bike&maxPrice=600'
```

Optional Google Trends demand:

```sh
python3 -m venv .venv && .venv/bin/pip install -r demand-requirements.txt
```

`USE_MOCK_DATA=true` forces `data/mockListings.js`. `US_MARKET_LIMIT` and
`DEAL_FINDER_PORT` are optional (default port 4747).

## Scoring

See `lib/dealScore.js` and `docs/contracts.md`.
