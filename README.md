# E-Pharmacy Drug Locater (Hawassa)

Full-stack web app for finding medicines and ordering from pharmacies in Hawassa.

## Project structure

```
├── admin/           # Optional standalone admin UI (static HTML, open index.html locally)
├── backend/         # Node.js + Express API (MongoDB)
├── vite-project/    # React + Vite customer & pharmacy app
├── api/             # Vercel serverless entry (re-exports backend)
├── scripts/         # Build helper (copies Vite dist to root)
├── package.json     # Root build script for Vercel
└── vercel.json      # Deployment routes
```

## Features

- **Customers:** browse, search, cart, checkout, profile
- **Pharmacies:** inventory, orders (approve/decline), dashboard
- **Admins:** approve pharmacy registrations (in-app at `/admin` or via `admin/` static console)

## Default admin login

The backend creates one admin account automatically the first time it connects to MongoDB (if no admin exists yet).

| Field | Value |
|-------|--------|
| **Email** (login username) | ***** |
| **Password** | ***** |

1. Start the backend and frontend (see below).
2. Open the app → **Login**.
3. Enter the email and password above.
4. You are redirected to **`/admin`** to approve pending pharmacies.

> Change this password in production (update the user in MongoDB or adjust the seed in `backend/src/server.js` before deploy).

## Local development

### Backend

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` from `backend/.env.example`. Chapa payments in this project are local demo-only, so no real Chapa secret key is required:

```env
CHAPA_RETURN_URL=http://localhost:5173/payment/callback
```

### Frontend

```bash
cd vite-project
npm install
npm run dev
```

Create `vite-project/.env` from `vite-project/.env.example`.

The Vite dev server proxies `/api` and `/uploads` to `http://localhost:5000`.

## Vercel deployment

Import the **repository root** (not `vite-project` alone). Set env vars: `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`, and `VITE_API_BASE_URL=/api`.

Build: `npm run build` at the repo root (builds Vite, then copies output to `dist/`).

Verify: `https://your-app.vercel.app/api/health` → `{"status":"ok"}`.
