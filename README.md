# Star Electronics — Shop Management, Inventory, POS & M-Pesa Platform

Owner login: **Admin** / **2114**

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. The development command starts both the Vite frontend and
the Neon-backed API server. Data is stored in the Neon database configured by
`DATABASE_URL`.

To point at a different backend later, set `VITE_BACKEND_URL`:
```bash
VITE_BACKEND_URL=https://your-backend.example.com npm run dev
```

## Connect Neon PostgreSQL

The backend stores its records in Neon through `backend/lib/neon.ts`. Create a Neon
project, copy its pooled connection string into `DATABASE_URL`, and run
`backend/schema.sql` in the Neon SQL Editor. Set `DATABASE_URL` as a server-side
secret on the backend deployment; never expose it in the Vite frontend or commit a
real `.env` file. Set `VITE_BACKEND_URL` to the URL of the deployed backend API.

For local execution, copy `.env.example` to `.env` and provide the Neon connection
string. `backend/server.ts` is the Node HTTP runtime for the API.

`npm run build` produces a static `dist/` you can host anywhere (Vercel, Netlify, S3,
etc.) — just make sure whatever serves it also proxies/rewrites `/api/*` to a real
backend, since the built app still calls relative `/api/...` paths.

## Backend and database

The backend is a standalone Node TypeScript API. It uses Neon PostgreSQL through
`backend/lib/neon.ts`, and the complete one-run database setup is in
`backend/schema.sql`. Keep `DATABASE_URL` server-side and never expose it in Vite.

## Structure
- `src/` — React + TypeScript + Tailwind frontend (Vite)
  - `src/App.tsx` — routing & auth gating
  - `src/pages/` — one file per module (POS, Products, Sales, Repairs, Reports, etc.)
  - `src/components/` — shared UI (Layout/sidebar, Modal, Button, StatCard, etc.)
  - `src/lib/` — API client (axios), auth/toast context, formatting helpers
- `backend/` — Node/TypeScript API
  - `backend/index.ts` — all REST routes (auth, products, POS/sales, M-Pesa, repairs, reports, etc.)
  - `backend/lib/helpers.ts` — auth/session/permission/settings helpers
  - `backend/lib/mpesa.ts` — M-Pesa Daraja STK Push service (sandbox-simulated until live secrets are added)
  - `backend/lib/seed.ts` — owner-account bootstrap + one-time demo-data purge
  - `backend/lib/types.ts` — shared backend types
- `tests/tests.txt` — QA test scenarios

## Going live with M-Pesa
Add these as server-side environment variables to enable live Daraja requests:
`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`

## Roles
owner, manager, sales, inventory, technician, accountant — permissions enforced
server-side in `backend/index.ts` (`authGuard` + `can()`), not just hidden in the UI.
