# Slim Prebuilt Deployment Package (Scienta)

Built outside cPanel so heavy build tools (`typescript`, `tailwindcss`, `eslint`, `.next/cache`, dev `node_modules`) never touch host disk quota.

## Setup / Update on cPanel Terminal
```bash
bash scripts/cpanel-slim-finalize.sh
```

In **cPanel -> Setup Node.js App**:
- Application startup file: `app.cjs`
- Application mode: `Production`
- Node.js version: `22` (recommended for built-in SQLite fallback)
- Required `.env` keys: `NODE_ENV=production`, `JWT_SECRET` (32+ chars), optional MySQL (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) or automatic SQLite (`SQLITE_FALLBACK_PATH=data/scienta.sqlite`).
