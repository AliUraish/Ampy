# Deal Finder — module contracts (FROZEN for the hackathon)

All tracks code against these shapes. Do not change a shape without telling the orchestrator.
Agent brain is **Mistral** only. No Anthropic/OpenAI SDKs. Use plain `fetch`. Node 24, CommonJS (`require`).

## Canonical Listing (emitted by lib/craigslistFetcher.js — lifted from Hagglr, do not modify)
```js
{ id: string, category: string, title: string, price: number|null,
  condition: 'new'|'like new'|'excellent'|'good'|'fair'|'unknown',
  distanceMiles: number|null, location: string, postedAt: string|null /* ISO */,
  sellerName: null, sellerRating: null, description: string, url: string,
  imageUrl?: string|null /* set by fetchListingDetail */, source: 'craigslist'|'mock' }
```
Fetcher API: `searchCraigslist({query, location='sfbay', category, maxPrice})` → `Listing[]`; `fetchListingDetail(url)` → partial listing fields (photo, description, postedAt, condition). Check the file header for exact return field names before using them.
Concurrency: `mapWithConcurrency(items, limit, fn, {jitterMs})` from lib/concurrency.js.

## lib/mistral.js (Track 1)
```js
chatJSON({ model, messages, maxTokens=600, temperature=0.2 }) → Promise<object>   // uses response_format json_object, parses, throws on non-2xx, up to 4 attempts on 5xx/429
```
Vision message content: `[{type:'text', text}, {type:'image_url', image_url: url}]`.
Models (verify against docs.mistral.ai, adjust constants if drifted): `mistral-medium-latest` (blind appraisal, vision + text), `mistral-small-latest` (card verdict copy).

## lib/valuation.js (Track 1)
```js
valueListing(listing, { compsMedian, compsN, city }) → Promise<{
  item: string, brandModel: string|null,
  condition: 'new'|'like new'|'excellent'|'good'|'fair'|'poor',
  estimatedResaleUsd: number, redFlags: string[], reasoning: string /* ≤60 words */,
  provenance: {source:'mistral', model:string, inputMode:'vision'|'text'} }>
```
Uses Mistral Medium vision when `listing.imageUrl` exists, text mode otherwise. The asking price and broad comps median are intentionally absent from the appraisal prompt. Numeric strings are coerced, but a missing/invalid estimate or missing reasoning rejects the appraisal instead of substituting a non-model value and labeling it as Mistral.

## lib/dealScore.js (Track 1) — PURE, no I/O, with node:test
```js
scoreDeal({ price, compsMedian, compsN, mistralEstimate, demand /*0..1*/, hasPhoto, descLen }) → {
  fairValue, margin, marginN, demand, confidence, score /*0..100 int*/, flags: string[] }
```
fairValue = 0.4·compsMedian + 0.6·mistralEstimate (changed from 0.6/0.4 after live run: Mistral now appraises blind, no median/asking price in its prompt). margin = (fairValue − price − 15)/price clamped [−1,2]; marginN=(margin+1)/3.
confidence = 0.4·min(compsN/8,1) + 0.3·(1−min(|compsMedian−mistralEstimate|/compsMedian,1)) + 0.2·hasPhoto + 0.1·min(descLen/300,1).
score = round(100·(0.5·marginN + 0.3·demand + 0.2·confidence)). If price < 0.2·fairValue → flags ['too_good'], score = min(score, 40).

## lib/explain.js (Track 1)
```js
explainDeal({ listing, valuation, deal }) → Promise<{ headline: string, why: string, riskNote: string,
  provenance:{source:'mistral'|'mixed',model:string,fields:{headline:string,why:string,riskNote:string}} }>  // mistral-small, ≤2 sentences each
```

## lib/demand.js (Track 2)
```js
getDemand({ keyword, category, geo='US-CA' }) → Promise<{ value: 0..1, source: 'trends'|'baseline', keyword: string }>   // NEVER throws
```
pytrends sidecar `demand.py` via child_process, 6s timeout, in-memory cache by keyword. Baseline table: bikes .70, electronics .80, instruments .60, jewelry .65, furniture .45, appliances .50, vehicles .65, general .50.

## lib/dealScan.js (Track 3)
```js
streamDeals({ location='us', category, query, maxPrice, cached }, send) → Promise<void>
// send(event, data) writes one SSE event. Events, in order:
// progress {stage:'market', market, count, unavailable?} (per U.S. market)
// → progress {stage:'coverage', markets, available}
// → progress {stage:'scan', count, markets} → progress {stage:'comps', median, n} → progress {stage:'prefilter', candidates}
// → progress {stage:'valuing', id, title}   (per candidate start, optional)
// → candidate {…Listing, compsMedian, compsN} (immediate card; no appraisal or score yet)
// → analysis {id,stage:'details',listing:{description,condition,imageUrl,postedAt}}
// → analysis {id,stage:'appraisal',valuation}
// → analysis {id,stage:'comps',compsMedian,compsN}
// → analysis {id,stage:'demand',demand:{value,source,keyword}}
// → analysis {id,stage:'score',fairValue,deal:{score,margin,confidence,flags}}
// → analysis {id,stage:'verdict',outcome:'deal',headline,score} (surfaced deals only)
// → deal {…Listing, valuation, compsMedian, compsN, fairValue, demand:{value,source,keyword}, deal:{score,margin,confidence,flags,headline,why,riskNote}}  (per candidate, as soon as scored)
// → pass {…the full deal evidence shape above, reason} for scored candidates below 60;
//        {id,title,price,reason} only when valuation/scoring itself failed
// → done {deals, scored, ms, source:'craigslist'|'mock'|'cache'}
// A candidate-level failure emits analysis {id,stage:'error',message}, then pass.
// error {message} on fatal.
```
Pipeline: fan out across 12 priority U.S. Craigslist markets (3 concurrent) → round-robin results across available markets → comps = median of non-null prices → prefilter (drop null price and price ≥ median) → mapWithConcurrency(candidates, 2): fetchListingDetail → valueListing → getDemand(keyword = valuation.brandModel || query, geo = US) → scoreDeal → explainDeal → send('deal'). A valid empty search emits zero results; individual unavailable markets are reported and skipped, while a total Craigslist failure emits an error and never substitutes unrelated fixtures. `USE_MOCK_DATA=true` is the only backend mock path. Non-empty live scans are written to `data/lastScan.json`; `cached=1` replays only a nationwide last scan, so legacy single-market results cannot masquerade as U.S. coverage.

`candidate` and `analysis` are a truthful live-evidence feed, not hidden model chain-of-thought. Cache replay intentionally filters them out and hydrates only completed `deal`/`pass` payloads, so a cached page never pretends that old work is happening live.

## public/ (Track 4) — single page at /
Consumes `new EventSource('/api/deals?...')`. Sections: ScanBar (fixed United States coverage badge, category select, query, max price, Scan, "replay cached"), AgentConsole (append one line per progress/deal/pass), DealFeed (cards sorted live by score desc; ScoreRing conic-gradient: ≥75 green, 50-74 amber, <50 red; dollar delta = fairValue − price), DealDrawer (photo, valuation.condition + model appraisal reason, comps bar with this price marked vs median, demand bar with source tag, flags, "Open on Craigslist" link), Banner for error/cache mode, toggle "show passes". The drawer is a **decision trace**, not hidden chain-of-thought: it may show structured evidence, the short model-provided appraisal reason, deterministic score math, and the concise verdict.
