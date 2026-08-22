# Ampy buyer agent

API-only buyer agent for Ampy. It searches listings, questions sellers, and
negotiates price. There is no product UI here — the frontend ships separately.

Lives under `backend/buyer/`. The Python seller is `backend/seller/`. Start both
from the repo root with `npm start`.

## Setup

Uses the same Mistral env names as the repo-root `.env`:

```
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-medium-latest
MISTRAL_SEARCH_TOOL=web_search
```

The server loads `../../.env` (repo root) first, then a local `.env` if present.
`SELLER_AGENT_URL` defaults to `http://127.0.0.1:8000` (the co-located seller).

```sh
# from repo root
npm run install:buyer
npm start
```

Or buyer alone (seller must already be running):

```sh
cd backend/buyer
npm install
SELLER_AGENT_URL=http://127.0.0.1:8000 npm start
```

`GET http://localhost:3000` should return `{ "name": "Ampy buyer agent" }`.

## What it does

One natural-language request runs a Mistral tool loop in `lib/buyerAgent.js`:

| Tool | What it does |
|---|---|
| `search_marketplaces` | Search every connected source |
| `get_listing_details` | Open a listing |
| `contact_seller` | Ask the seller a question |
| `negotiate_price` | Negotiate, up to 6 offer/counter rounds |

Progress streams over SSE at `POST /api/agent/run`.

### Talking to the seller agent

With `npm start`, the buyer is pointed at the Python seller automatically.
Contract details: `INTEGRATION.md`.

```sh
node tools/checkSellerAgent.js http://127.0.0.1:8000
```

## Main API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/search` | Search listings |
| `GET` | `/api/listings/:id` | Listing detail |
| `POST` | `/api/agent/run` | Run the buyer agent (SSE) |
| `GET` | `/api/agent/status` | Seller-channel / source status |
| `POST` | `/api/agent/ask` | Ask a seller a question |
| `POST` | `/api/negotiate` | One buyer-vs-seller negotiation |
| `POST` | `/api/listings` | Publish a listing |
| `POST` | `/api/vision-detect` | Draft a listing from photos |
