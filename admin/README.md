# Standalone admin UI

Admin console connected to the E-Pharmacy backend API.

## Run

1. Start backend: `cd backend && npm run dev`
2. Serve this folder (proxy `/api` to backend or use same host):

```bash
cd admin
npx serve .
```

Default admin login: email `admin`, password `finalyear` (see root README).

You can also use `/admin` in the React app.
