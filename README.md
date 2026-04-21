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

This project is now configured for Vercel deployment with both frontend and backend:

- `backend/src/server.js` is deployed as a Node serverless function.
- `vite-project` is built as a static site.
- Requests to `/api/*` are routed to the backend.
- Other requests are served by the frontend app (`index.html`) for SPA routing.

### 1) Import project to Vercel

- Push the repository to GitHub.
- In Vercel, import the repository as a single project.
- Vercel will read `vercel.json` and use the configured builds/routes.

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

## Notes

- CORS in production only allows configured frontend origins.
- In local development, CORS is open for easier testing.
- currently under mentainance