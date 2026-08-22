# Ampy frontend

Static UI for Ampy. Today this folder holds the **Deal Finder** UI
(`index.html`, `app.js`, `style.css`).

It is served by the Deal Finder API at `backend/deal-finder` on port 4747:

```sh
npm run start:deal-finder
# open http://localhost:4747
```

API calls use same-origin paths (`/api/deals`, `/api/craigslist-locations`).
