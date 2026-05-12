# E-Pharmacy Drug locater(Hawassa)

E-Pharmacy is a full-stack web app that helps customers find medicines and order from pharmacies in Hawassa. It includes a customer-facing storefront and a pharmacy dashboard for inventory and order management.

## Features

### Customer features
- Browse medicines without logging in.
- Search by medicine name, generic name, and pharmacy.
- Add medicines to cart (requires customer login).
- Place orders and track order status (`waiting`, `approved`, `declined`).
- View personal order history and status summary.
- Update customer profile (name and profile image).

### Pharmacy features
- Login with pharmacy account and access dashboard.
- Add, update, and delete medicines.
- Review incoming customer orders.
- Approve or decline pending orders.
- Monitor basic order stats from dashboard.
- Update pharmacy profile details.

## Project Structure

- `vite-project/` - React + Vite frontend
- `backend/` - Node.js + Express API (MongoDB via Mongoose)
- `vercel.json` - Vercel build and route configuration for monorepo deployment

## Tech Stack

- Frontend: React 19, Vite, React Router
- Backend: Node.js, Express
- Database: MongoDB Atlas + Mongoose
- Auth: JWT
- Deployment: Vercel (frontend + backend in one project)

## Local Development

### 1) Backend setup

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### 2) Frontend setup

```bash
cd vite-project
npm install
npm run dev
```

Create `vite-project/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:5000/api
```

## API Endpoints (base)

- Auth: `/api/auth`
- Medicines: `/api/medicines`
- Orders: `/api/orders`
- Health check: `/api/health`

## Vercel Deployment

The repo root is the Vercel project (do **not** set the Vercel “Root Directory” to `vite-project` only).

- **`vercel.json`**: builds the Vite app into root `dist/`, serves that as the static site, and **rewrites** `/api/*` and `/uploads/*` to **`api/server.js`** (Express).
- **`api/server.js`**: exports the same Express app as `backend/src/server.js`.

### 1) Import project to Vercel

- Push the repository to GitHub.
- In Vercel, import the **repository root** (folder that contains `vercel.json` and `package.json`).
- Leave **Root Directory** empty (or `.`), not `vite-project`.

### 2) Set environment variables in Vercel

Backend environment variables:

- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL` (your Vercel frontend URL, e.g. `https://your-app.vercel.app`)
- `NODE_ENV=production`

Frontend environment variable:

- `VITE_API_BASE_URL=/api`

### 3) Redeploy

After setting env vars, trigger a redeploy. Verify:

- `https://your-app.vercel.app/api/health` returns `{"status":"ok"}`
- Frontend loads and API requests work correctly

### 4) Custom domain shows `404: NOT_FOUND`

That Vercel error usually means the hostname is **not** attached to this project (or DNS is not pointing at Vercel yet). In the Vercel dashboard: **Project → Settings → Domains** — add your domain and follow the DNS records Vercel shows. Until DNS propagates, use the default `*.vercel.app` URL to test.

### 5) Project root

If the Vercel **Root Directory** is set to `vite-project` or `backend`, the new `vercel.json` at the **repo root** is ignored and you will get 404s. Clear Root Directory so the deployed project is the folder that contains `vercel.json`, `api/server.js`, and `package.json`.

## Notes

- CORS in production only allows configured frontend origins.
- In local development, CORS is open for easier testing.
- currently under mentainance