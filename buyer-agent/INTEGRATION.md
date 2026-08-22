# Integrating the seller agent with the buyer agent

This folder is the **buyer agent** — a Node app that searches marketplaces,
questions sellers, and negotiates. It talks to the **seller agent** over
plain HTTP + JSON, so it does not care that the seller agent is Python or
that it runs on Mistral. Two endpoints is the entire integration surface.

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

…or defer, and push the answer in later (see **Answering later** below):

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
| `message` | string, required | What the seller says out loud. Keep it natural and short. |
| `counterPrice` | number or `null` | What the seller *will* take. `null` when not countering. |
| `accepted` | boolean, required | `true` = deal at the **buyer's** offered price. |
| `walkAway` | boolean, required | `true` = seller ends the negotiation. |

## Three things that will bite you

**1. `accepted: true` means "at the buyer's number."** The buyer agent
records the deal at the price *it* offered, not at any price echoed back in
the response. If you mean "yes, but at $780", that is **not** `accepted`
— send `accepted: false` with `counterPrice: 780`. The buyer agent accepts
any counter at or under its budget, so this still closes the deal, at the
right number.

This is deliberate. The buyer's budget is enforced in the buyer agent's own
code precisely because the seller agent is a separate service — trusting a
self-reported price is how a buyer agent ends up agreeing to more than its
ceiling.

**2. `counterPrice` is a number, not a string.** `"820"` and `"$820"` both
read as no-counter and end the negotiation early. Same for `0` — use `null`.

**3. Respond within 15 seconds** (`SELLER_AGENT_TIMEOUT_MS`). Slower than
that reads as a timeout and kills the round. If a Mistral call runs long,
either raise that env var on the buyer side or use the deferred path below.

## Answering later

If the seller agent can't answer synchronously, return `{ "pending": true }`
from `/ask`, then POST the answer to the buyer agent whenever it's ready:

```
POST http://localhost:3000/api/agent/reply
{ "threadId": "thr_a1b2c3", "text": "Cycle count is 312." }
```

`listingId` works in place of `threadId` if that's easier to carry.

## Minimal Python skeleton

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class AskRequest(BaseModel):
    threadId: str | None = None
    listingId: str | None = None
    listing: dict
    question: str
    history: list = []

@app.post("/ask")
async def ask(req: AskRequest):
    answer = await your_mistral_call(req.listing, req.question, req.history)
    return {"answer": answer}

class NegotiateRequest(BaseModel):
    threadId: str | None = None
    listingId: str | None = None
    listing: dict
    offer: dict
    round: int = 1
    history: list = []

@app.post("/negotiate")
async def negotiate(req: NegotiateRequest):
    asking  = req.listing["price"]
    offered = req.offer["price"]
    floor   = your_floor_for(req.listingId, asking)

    if offered >= floor:
        return {"message": "Deal.", "counterPrice": None,
                "accepted": True, "walkAway": False}

    counter = max(floor, round(asking - (asking - max(offered, floor)) * 0.5))
    message = await your_mistral_call_for_counter(req.listing, offered, counter)
    return {"message": message, "counterPrice": counter,
            "accepted": False, "walkAway": False}
```

Decide the **numbers in code** and let the model write only the **wording**.
A seller agent that can be talked below its own floor by a persuasive buyer
isn't much of a seller agent — and the buyer agent on the other side is
genuinely trying to talk it down.

## Verifying

`tools/checkSellerAgent.js` exercises both endpoints with realistic payloads
and validates every field against what the buyer agent actually reads:

```sh
cd buyer-agent
npm install
node tools/checkSellerAgent.js http://localhost:8000
```

13 checks, ~5 seconds. It catches field-name drift, wrong types, and the
`counterPrice`-above-asking mistake. Needs Node (it ships with this folder);
the seller agent itself needs nothing but HTTP.

`tools/mockSellerAgent.js` is a working reference implementation of this
same contract if you'd rather read one than a spec.

## Running the buyer agent

```sh
cd buyer-agent
npm install
cp .env.example .env          # set ANTHROPIC_API_KEY
SELLER_AGENT_URL=http://localhost:8000 npm start
```

Open <http://localhost:3000/agent>. The capability strip at the top shows
whether the seller agent is connected.

Set `SELLER_AGENT_SCOPE=hagglr` if the seller agent should only speak for
listings posted through this app's `/sell` page — the default (`all`) makes
it the counterparty for every listing the buyer agent finds, including
Craigslist ones it has no real data about.
