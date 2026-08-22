# Ampy seller + sourcing agents

Python FastAPI service under `backend/seller/`. Part of the Ampy backend —
start with the buyer via `npm start` from the repo root.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness |
| `POST` | `/ask` | Buyer-agent contract — answer a listing question |
| `POST` | `/negotiate` | Buyer-agent contract — one offer/counter round |
| `POST` | `/seller/value` | Resale valuation with protected floor |
| `POST` | `/seller/negotiate` | Internal negotiation API (richer schema) |
| `POST` | `/events/discover` | Local sourcing / demand events |

Loads `MISTRAL_API_KEY`, `MISTRAL_MODEL`, and `MISTRAL_SEARCH_TOOL` from the
repo-root `.env`.

## Solo run

```bash
cd backend/seller
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Docs: <http://127.0.0.1:8000/docs>
