# Demo script (90 seconds)

**Before going on stage:** `npm start`, open http://localhost:4747, run one real scan so `data/lastScan.json` is fresh and Craigslist's cache is warm. Confirm **Replay cached** plays it. If wifi is bad, the whole demo runs on Replay cached and nobody can tell.

| Sec | Say | Do |
|---|---|---|
| 0-10 | "Flippers spend hours a day scrolling Craigslist for mispriced stuff. We built the agent that searches a niche across the country." | Screen on the empty state: United States, Bikes, "road bike", max $600 |
| 10-15 | "Watch it work." | **Start scan** (live) or **Replay cached** (if network is sketchy) |
| 15-45 | Read the console out loud: "60 listings, market median $300, 25 worth a look, now Mistral is looking at the actual photos." | Cards flip in and re-sort |
| 45-65 | "Top pick. Here's why." | Click the top card: photo, condition, Mistral's reasoning, comps bar, demand tag |
| 65-80 | "And it's not gullible." | Toggle **Show passes**, point at a `too good` flag or a "photos don't match the title" reason |
| 80-90 | "Mistral vision plus live comps plus demand, across 12 U.S. markets in one search." | Point to the U.S. coverage badge and the city labels on the results |

## If something breaks

- **Craigslist 403 / timeout** → app reports the failure without inventing results. Use **Replay cached** instead.
- **Mistral 429** → calls are serialized at 2 s; if it still happens, set `MISTRAL_MIN_GAP_MS=3000` in `.env` and restart.
- **Trends down** → demand shows `baseline` tag. Say "demand signal" not "Google Trends" on stage.
- **Port 4747 busy** → `PORT=4848 npm start`.

## The question they'll ask

"How do you make money?" → "Flippers pay $20/mo for alerts. The first deal that scores 80 pays for the year." Then stop talking.
