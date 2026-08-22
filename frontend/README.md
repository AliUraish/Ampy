# Ampy frontend

Next.js product-discovery UI (from the `ai-prompt-box` branch). Prompt box +
Mistral-backed product search at `/api/products`.

## Setup

Uses the repo-root `.env` (`MISTRAL_API_KEY`). From the repo root:

```bash
npm run install:frontend
npm run dev:frontend
```

Or:

```bash
cd frontend
pnpm install   # or npm install
pnpm dev       # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production |
| `npm run lint` / `npm run typecheck` | Checks |
