# Ampy frontend

Next.js UI for Ampy. Product discovery lives here (`/api/products`). Browser
calls to buyer / seller / deal-finder go through same-origin rewrites:

| Browser path | Backend |
|---|---|
| `/api/products` | Next route (this app) |
| `/api/buyer/*` | `backend/buyer` `:3001` |
| `/api/seller/*` | `backend/seller` `:8000` |
| `/api/deals`, `/api/deal-finder/*` | `backend/deal-finder` `:4747` |

Shared helpers: `src/lib/ampy.ts`.

## Run

Prefer the full stack from the repo root:

```bash
npm start
```

Frontend only (backends must already be up):

```bash
npm run dev:frontend
# http://localhost:3000
```

Uses the repo-root `.env` for `MISTRAL_API_KEY`.
