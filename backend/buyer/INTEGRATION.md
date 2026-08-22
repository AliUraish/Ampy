# Integrating the Ampy seller agent with the Ampy buyer agent

This folder is the **Ampy buyer agent** (`backend/buyer`) — a Node API that
searches marketplaces, questions sellers, and negotiates. It talks to the
**seller agent** (`backend/seller`) over plain HTTP + JSON. Two endpoints is
the entire integration surface.

With `npm start` from the repo root, both processes run locally and the buyer
defaults to `SELLER_AGENT_URL=http://127.0.0.1:8000`.

The authoritative version of this contract lives in the header comment of
[`lib/sellerChannel.js`](lib/sellerChannel.js). This file is the
language-neutral summary.

## What the seller agent must expose

### `POST /ask` — answer a buyer's question

Request:

```json
{
  "threadId":  "thr_a1b2c3",
  "listingId": "seller-abc123",
  "listing": {
    "title":       "MacBook Pro 14\" M1 Pro, 16GB/512GB",
    "price":       900,
    "condition":   "good",
    "description": "Battery health 89%. Light scuff on the bottom case.",
    "category":    "electronics"
  },
  "question": "What's the battery cycle count, and does it include the charger?",
  "history": [
    { "role": "buyer",  "text": "Is it still available?" },
    { "role": "seller", "text": "Yes it is." }
  ]
}
```

Response — either answer now:

```json
{ "answer": "Cycle count is 312 and battery health is 89%. Charger included." }
```

…or defer, and push the answer in later:

```json
{ "pending": true }
```

### `POST /negotiate` — respond to one offer

Called once per round. Request:

```json
{
  "threadId":  "thr_a1b2c3",
  "listingId": "seller-abc123",
  "listing":   { "title": "...", "price": 900, "condition": "good", "description": "...", "category": "electronics" },
  "offer":     { "price": 720, "message": "Would you take $720? Battery's at 89%." },
  "round":     1,
  "history": [
    { "role": "buyer",  "text": "Would you take $720?", "price": 720 }
  ]
}
```

Response:

```json
{
  "message":      "I can do $820 — it's barely been used and comes with the charger.",
  "counterPrice": 820,
  "accepted":     false,
  "walkAway":     false
}
```

| Field | Type | Meaning |
|---|---|---|
| `message` | string, required | What the seller says out loud. |
| `counterPrice` | number or `null` | What the seller will take. `null` when not countering. |
| `accepted` | boolean | `true` = deal at the buyer's offer. |
| `walkAway` | boolean | `true` = seller ends the negotiation. |

The Ampy Python seller implements this by wrapping its internal
`/seller/negotiate` logic (floor ≈ 70% of asking unless `minAcceptablePrice`
is set; target ≈ 90% of asking).

## Answering later

```
POST http://localhost:3000/api/agent/reply
{ "threadId": "thr_a1b2c3", "text": "Cycle count is 312." }
```

## Verifying

```sh
# from repo root, with both services up via npm start
node backend/buyer/tools/checkSellerAgent.js http://127.0.0.1:8000
```

## Running

```sh
# from repo root
npm start
```

Call `GET /api/agent/status` on the buyer to confirm the seller agent is connected.

Set `SELLER_AGENT_SCOPE=ampy` if the seller agent should only speak for
listings posted through this app's `/api/listings` store — the default (`all`) makes
it the counterparty for every listing the buyer agent finds, including
Craigslist ones it has no real data about.
