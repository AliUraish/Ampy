# Ampy

Buyer, seller, and deal-finder backends plus a Next.js frontend.

```
backend/
  start.mjs          # npm start — seller + buyer
  seller/            # Python FastAPI
  buyer/             # Node buyer agent API
  deal-finder/       # Node Deal Finder API (SSE)
frontend/            # Next.js product-discovery UI
```

## Setup

```bash
cp .env.example .env
# set MISTRAL_API_KEY

npm run install:seller
npm run install:buyer
npm run install:deal-finder
npm run install:frontend
```

## Run

```bash
npm start                 # seller :8000 + buyer :3000
npm run start:deal-finder # Deal Finder API :4747
npm run dev:frontend      # Next.js UI :3000 (use another port if buyer is up)
```

| Service | URL | Role |
|---|---|---|
| Frontend | `http://127.0.0.1:3000` | Product discovery UI |
| Buyer API | `http://127.0.0.1:3000` | Search / agent (when started via `npm start`) |
| Seller API | `http://127.0.0.1:8000` | `/ask`, `/negotiate`, valuation, events |
| Deal Finder | `http://127.0.0.1:4747` | Nationwide Craigslist scan API |

Note: buyer and the Next frontend both default to port 3000 — run one at a time,
or set `PORT` / `-p` for the frontend.
