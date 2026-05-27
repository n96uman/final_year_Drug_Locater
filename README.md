# E-Pharmacy Drug Locater (Hawassa)

Full-stack web application for searching medicines, placing pharmacy orders, and managing pharmacy/admin workflows in Hawassa.

## Project structure

```
├── admin/           # Optional standalone admin UI (static HTML)
├── backend/         # Node.js + Express API (MongoDB)
├── vite-project/    # React + Vite frontend (customer + pharmacy + admin routes)
├── api/             # Vercel serverless entry point (re-exports backend app)
├── scripts/         # Build helper scripts
├── package.json     # Root scripts for production build
└── vercel.json      # Vercel routing and build config
```

## How the system works

### Customer flow

- Browse/search medicines from approved pharmacies.
- Add items to cart (**one pharmacy at a time**).
- Checkout with:
  - Manual transfer + required receipt image, or
  - Chapa demo mode.
- Optional prescription image can be uploaded during checkout.
- Optional delivery can be enabled in checkout.
- If delivery is enabled, after order approval the customer must provide latitude/longitude.

### Pharmacy flow

- Register pharmacy account and upload licence image.
- Wait for admin approval.
- Manage medicines (add/update/delete).
- Review incoming orders:
  - See payment receipt and prescription image (if uploaded).
  - Approve or reject (reject requires reason).
- See delivery status per order and redirect to customer location when available.

### Admin flow

- Review pending pharmacy registrations.
- Approve/reject pharmacies.
- View transactions and expired medicine alerts.

## Image and upload rules

- Maximum file size: **2MB** per image.
- Oversized image upload is blocked in the UI with popup notification.
- Manual checkout cannot continue without receipt image.
- Pharmacy registration cannot continue without licence image.

## Authentication and security note

- Do **not** keep or publish fixed/default admin credentials in documentation.
- Use your own secure admin credentials in your environment/database.
- Set a strong `JWT_SECRET` in production.

## Local development

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` from `backend/.env.example`.

Example:

```env
MONGO_URI=mongodb://127.0.0.1:27017/drug_locater
JWT_SECRET=your_strong_secret
FRONTEND_URL=http://localhost:5173
CHAPA_RETURN_URL=http://localhost:5173/payment/callback
```

### 2) Frontend

```bash
cd vite-project
npm install
npm run dev
```

Create `vite-project/.env` from `vite-project/.env.example`.

The Vite server proxies `/api` and `/uploads` to `http://localhost:5000`.

## Deployment (Vercel)

Import the repository root and set these environment variables:

- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `NODE_ENV=production`
- `VITE_API_BASE_URL=/api`

Build command at root:

```bash
npm run build
```

Health check:

`https://your-app.vercel.app/api/health` should return:

```json
{"status":"ok"}
```
