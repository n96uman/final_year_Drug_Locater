# Admin (static, no backend)

This folder contains a **standalone** admin UI that is **not connected** to the existing `backend/` or `vite-project/` apps.

## Run

- Open `admin/index.html` in your browser.
- Or (recommended) serve the folder with any static server.

Example:

```bash
cd admin
npx serve .
```

## Notes

- There is **no MongoDB / API** usage here.
- The login is **UI-only** and uses a temporary session flag in `sessionStorage`.

