# Ampy

Buyer, seller, and deal-finder agents under one repo. Shared root `.env`.
Product UI for Deal Finder lives in `frontend/`; buyer/seller APIs are headless
(for a separate frontend later).

```
backend/
  start.mjs          # npm start — seller + buyer
  seller/            # Python FastAPI
  buyer/             # Node buyer agent API
  deal-finder/       # Node Deal Finder API (serves frontend/)
frontend/            # Deal Finder UI
```

## Setup

Python 3.11+, [uv](https://docs.astral.sh/uv/), and Node 18+ are required.

```bash
cp .env.example .env
# set MISTRAL_API_KEY

npm run install:seller
npm run install:buyer
npm run install:deal-finder
```

## Run

```bash
npm start                 # seller :8000 + buyer :3000
npm run start:deal-finder # Deal Finder UI + API :4747
```

| Service | URL | Role |
|---|---|---|
| Buyer API | `http://127.0.0.1:3000` | Search, agent run, ask, negotiate |
| Seller API | `http://127.0.0.1:8000` | `/ask`, `/negotiate`, `/seller/value`, `/events/discover` |
| Deal Finder | `http://127.0.0.1:4747` | Nationwide Craigslist scan UI + SSE API |

See `backend/buyer/README.md`, `backend/seller/README.md`, and
`backend/deal-finder/README.md` for details.
