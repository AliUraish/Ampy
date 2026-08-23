# Deal Finder on Hagglr — Design (office hours, 2026-08-22)

**Mode:** hackathon / builder. **Decision:** Option A, deal-finder agent, as a fresh app that lifts craigslistFetcher.js, concurrency.js and craigslistLocations.js from Hagglr (not a fork). Agent model: **Mistral** (required).

## One-liner
Point it at a city + category. The agent scans live Craigslist listings, estimates resale value (photo + comps), measures demand, and surfaces the 5-10 listings that are underpriced, with its reasoning shown live. No buying, no payments.

## Lifted from Hagglr (copied files, fresh repo)
- `lib/craigslistFetcher.js` → `searchCraigslist({query, location, category, maxPrice})`, `fetchListingDetail(url)`
- `lib/concurrency.js` → `mapWithConcurrency(items, limit, fn, {jitterMs})`
- Pattern only: gatherListings() live→mock fallback, re-implemented in lib/dealScan.js
- Canonical listing shape from `data/listings.js`

## New (the whole hackathon)
1. `lib/mistral.js` — thin client (chat + JSON mode + Pixtral vision)
2. `lib/valuation.js` — fair value: Mistral estimate ⨉ Craigslist comps median
3. `lib/demand.js` — pytrends sidecar (`demand.py`) with static fallback table
4. `lib/dealScore.js` — pure function: margin, demand, confidence → score 0-100, scam filter
5. `GET /api/deals?location&category&query` — SSE stream of scan progress + scored deals
6. `public/deals.html` + `deals.js` — the Deal Feed UI (the demo)

## Scoring
- `fairValue` = weighted(0.6 comps median, 0.4 Mistral estimate); if |disagreement| > 35% → confidence penalty
- `margin` = (fairValue − price − hassle $15) / price, clamp to [−1, 2], normalize
- `demand` = Trends 0-100 /100 (fallback: Mistral 1-5 rating)
- `confidence` = 0.4·comps_n(≥8 → 1) + 0.3·agreement + 0.2·has_photo + 0.1·desc_len
- `dealScore` = 100·(0.5·margin_n + 0.3·demand + 0.2·confidence)
- Scam gate: price < 0.2·fairValue → tag "too good", score cap 40

## Premises agreed
- Signal, not business: no transactions.
- Craigslist only; no automated posting/messaging (teammate's TOS line, Hagglr README).
- Accuracy is a demo property, not a product property: rehearse with cached scan.

## Rejected alternatives
- B) Full arbitrage pipeline (too much for 48h, seller incentive unproven)
- C) Voice negotiation (demo-failure risk)

## Assignment
Run one live scan on `sfbay` bikes tonight with the raw fetcher and hand-label the 10 results. That labeled set is both your demo cache and your scoring sanity check.

See `deal-finder-plan.html` for the full plan (UI map, subagent prompts, timeline).
