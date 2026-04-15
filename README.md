# E-Pharmacy Drug Locator (Hawassa)

E-Pharmacy Drug Locator is a full-stack web project that helps customers search medicines and connect with pharmacies in Hawassa.  
It also includes a pharmacy dashboard for managing inventory and handling customer orders.

## What This Website Does

### Customer side
- Browse featured medicines and pharmacy medicine listings without login.
- Search medicines by name, generic name, and pharmacy.
- Add medicines to cart (customer login required).
- Checkout orders and track status (waiting, approved, declined).
- View order history summary with approved/declined/pending item counts.
- Manage personal profile (name and profile image).

### Pharmacy side
- Login as pharmacy and access a dedicated dashboard.
- Add, update, and delete medicines from inventory.
- View incoming customer orders.
- Approve or decline pending orders.
- Monitor dashboard statistics (pending, approved, declined orders).
- Manage pharmacy profile.

## Project Structure

- `vite-project/` — React + Vite frontend
- `backend/` — Node.js + Express + MongoDB backend

## Tech Stack

- Frontend: React, Vite, React Router
- Backend: Node.js, Express
- Database: MongoDB Atlas (Mongoose)
- Authentication: JWT

## Quick Start

### 1) Backend
```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` with:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

### 2) Frontend
```bash
cd vite-project
npm install
npm run dev
```

Create `vite-project/.env` with:
```env
VITE_API_BASE_URL=http://127.0.0.1:5000/api
```

## Current Status

- Core customer and pharmacy flows are implemented.
- UI and UX are actively being improved.

## Deployment

### Coming soon on Vercel
The project is being prepared for Vercel deployment soon.
