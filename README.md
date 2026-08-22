# Seller + Sourcing Agents

An API containing two Mistral-powered agents for a resale workflow:

1. **Seller agent** — researches an item's low/high resale value and negotiates firmly inside
   deterministic price guardrails.
2. **Event scout** — searches Lu.ma, Eventbrite, estate-sale sites, auction listings, local
   calendars, flea markets, swap meets, and similar sources, then ranks source-backed events by
   likely sourcing value.

The agents recommend actions. They do not automatically message buyers, purchase inventory, or
claim that an event is profitable without evidence.

## Setup

Python 3.11 or newer is required.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
```

Put your Mistral key in `.env`, then start the API:

```bash
uvicorn app.main:app --reload
```

Interactive API documentation is available at <http://127.0.0.1:8000/docs>.

## 1. Value an item

```bash
curl -X POST http://127.0.0.1:8000/seller/value \
  -H 'Content-Type: application/json' \
  -d '{
    "item_description": "Sony WH-1000XM5 headphones, complete with case",
    "condition": "good",
    "area": "San Jose, CA",
    "purchase_cost": 110,
    "minimum_margin_pct": 30,
    "currency": "USD"
  }'
```

The response contains a researched low/high range, a quick-sale value, a list price, and a
protected floor. The protected floor is never lower than `purchase_cost * (1 + margin)`.

## 2. Negotiate with a buyer

```bash
curl -X POST http://127.0.0.1:8000/seller/negotiate \
  -H 'Content-Type: application/json' \
  -d '{
    "item_description": "Sony WH-1000XM5 headphones in good condition",
    "buyer_message": "Can you do $140 today?",
    "listing_price": 220,
    "target_price": 195,
    "floor_price": 165,
    "currency": "USD",
    "turn_number": 1,
    "conversation": []
  }'
```

The application, not the LLM, calculates the minimum permitted price for each turn. It clamps or
replaces unsafe model output, so a generated reply cannot approve a price below the current limit.

## 3. Find high-upside sourcing events

```bash
curl -X POST http://127.0.0.1:8000/events/discover \
  -H 'Content-Type: application/json' \
  -d '{
    "area": "San Jose, CA",
    "days_ahead": 21,
    "radius_miles": 35,
    "item_interests": ["vintage audio", "cameras", "small furniture"],
    "max_purchase_budget": 500,
    "minimum_score": 60,
    "max_results": 8
  }'
```

The score weights discount potential and resale potential most heavily, followed by the likelihood
that the event actually has buyable inventory and the strength of the evidence. Events without a
URL returned by Mistral's web search are removed instead of being guessed.

## Test

```bash
pytest
ruff check .
```

## Useful next production steps

- Store valuations, buyer conversations, and event results in a database.
- Add marketplace-specific sold-data APIs for stronger comps.
- Run the event scout daily and alert only for new, high-scoring events.
- Add inventory categories with category-specific fees, sell-through time, and shipping cost.

