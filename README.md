# Ampy

Full stack: Next.js frontend + buyer, seller, and deal-finder backends.

```
frontend/            # Next.js UI (port 3000) — proxies to backends
backend/
  start.mjs          # npm start — full stack
  seller/            # Python FastAPI (:8000)
  buyer/             # Node buyer agent (:3001)
  deal-finder/       # Node Deal Finder API (:4747)
```

## Setup

```bash
cp .env.example .env
# set MISTRAL_API_KEY

npm run install:all
```

## Run everything

```bash
npm start
```

Opens the UI at **http://127.0.0.1:3000** and starts:

| Service | Port | Via frontend |
|---|---|---|
| Next.js UI + `/api/products` | 3000 | — |
| Buyer API | 3001 | `/api/buyer/*` |
| Seller API | 8000 | `/api/seller/*` |
| Deal Finder API | 4747 | `/api/deals`, `/api/deal-finder/*` |

Stack health: `GET http://127.0.0.1:3000/api/status`

## Run pieces alone

```bash
npm run start:seller
npm run start:buyer
npm run start:deal-finder
npm run dev:frontend
```
