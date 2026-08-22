# Deal Finder

Mistral-powered Craigslist deal finder for a solo operator hunting a profitable niche. Pick a category and product; the agent fans the search across 12 priority U.S. Craigslist markets, balances the results so one city cannot dominate, appraises each listing blind (photo + text, Mistral Medium vision), and streams the underpriced opportunities with a decision trace. The trace is structured evidence—not hidden chain-of-thought—and separates model output from deterministic score math. No buying, no messaging, no posting.

## Run

```sh
npm install
cp .env.example .env            # set MISTRAL_API_KEY
python3 -m venv .venv && .venv/bin/pip install -r demand-requirements.txt   # optional: Google Trends demand signal
npm start                       # http://localhost:4747
```

`/?demo=1` plays a built-in fixture with no network. **Replay cached** replays the last real scan (`data/lastScan.json`). `USE_MOCK_DATA=true` forces `data/mockListings.js`. `US_MARKET_LIMIT` controls how many of the 12 priority markets are searched; the default is 12.

## How it scores

`fairValue = 0.4 × comps median + 0.6 × Mistral blind appraisal`
`score = 100 × (0.5 × margin + 0.3 × demand + 0.2 × confidence)`, scam gate when asking < 20% of fair value. See `lib/dealScore.js` (pure, tested: `npm test`) and `docs/contracts.md`.

Demand: pytrends momentum vs the 3-month median (`demand.py`), falling back to a per-category baseline when Trends rate-limits (it will). The source is shown on every card.

## Rate limits that matter

Demo-tier Mistral keys allow ~4 req/min on `mistral-large-latest` but 50/min on `mistral-medium-latest` (vision-capable), so valuation uses Medium. `lib/mistral.js` serializes all calls with a 2 s gap (`MISTRAL_MIN_GAP_MS`). A 25-listing scan takes ~2 min.

## Credits

`lib/craigslistFetcher.js`, `lib/concurrency.js`, `data/craigslistLocations.js` lifted from [Hagglr](https://github.com/jasnoormac/Hagglr). Everything else is new.
