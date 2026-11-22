# cPanel Slim Deploy (`deploy` Branch Architecture)

Built on the same **single-commit orphan `deploy` branch** architecture as `ImNickFery/Love`, tailored for **Scienta (Next.js 16 standalone)**:

- **Zero heavy builds on cPanel**: The full workspace (`~671 MB node_modules` + `~432 MB .next` = **~1.1 GB**) never runs or lives on your shared host.
- **Aggressive safe pruning**: `npm run deploy:package` assembles `./deploy` from `.next/standalone`, strips duplicate/host-incompatible native `sharp` binaries (`-18 MB`), prunes unused Shiki themes (`one-dark-pro` only) and unused grammars with transitive closure (`-8 MB`), removes `.map`/`.d.ts`/docs/debug files, and keeps runtime state (`.env`, `data/`, `uploads/`, `node_modules/`) safely gitignored.
- **Single-commit force-push**: Every push to `main` (via GitHub Actions, or locally via `npm run deploy:push`) force-pushes a fresh single commit to `origin/deploy`, so git history never grows.
- **CloudLinux `nodevenv` compatible**: Root `node_modules/` stays gitignored and uses `package.runtime.json` (installing only optional host-native `sharp`), while Next.js's pre-traced runtime lives cleanly inside `standalone/`.

---

## 1. Connect cPanel to Private GitHub via SSH (One-Time Setup)

In **cPanel → Terminal**:

```bash
ssh-keygen -t ed25519 -C "cpanel-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy the printed `ssh-ed25519 ...` key and add it in GitHub:
**Repository → Settings → Deploy keys → Add deploy key** (Read-only is enough).

---

## 2. First-Time Install on cPanel

In **cPanel → Terminal** (replace `<USER>/<REPO>` with your repository):

```bash
git clone --depth 1 --branch deploy git@github.com:<USER>/<REPO>.git ~/scienta-app \
  && cd ~/scienta-app \
  && bash scripts/cpanel-install.sh
```

In **cPanel → Setup Node.js App** (auto-created when `cloudlinux-selector` is available):
- **Node.js version**: `22` (recommended)
- **Application mode**: `Production`
- **Application root**: `scienta-app`
- **Application startup file**: `app.cjs`

*(Preserves `.env`, `data/scienta.sqlite`, `uploads/`, and `node_modules/`, generates a strong `JWT_SECRET` if blank, installs optional host-native `sharp`, and touches `tmp/restart.txt`.)*

---

## 3. Future Updates (1 Line — or Fully Automatic)

Every push to `main` automatically rebuilds the `deploy` branch via `.github/workflows/deploy-cpanel.yml`. On cPanel Terminal run:

```bash
cd ~/scienta-app && git -c pack.threads=1 -c pack.windowMemory=64m fetch --depth 1 origin deploy && git reset --hard origin/deploy && bash scripts/cpanel-slim-finalize.sh
```

### Optional: Fully Automatic Deploy on `git push`
Add these GitHub Repository Secrets (**Settings → Secrets and variables → Actions**):
- **SSH mode (recommended):** `CPANEL_SSH_HOST`, `CPANEL_SSH_USER`, `CPANEL_SSH_KEY`, `CPANEL_REPO_ROOT` (e.g. `/home/username/scienta-app`), optional `CPANEL_SSH_PORT`
- **Or cPanel UAPI mode (no SSH):** `CPANEL_HOST`, `CPANEL_USERNAME`, `CPANEL_API_TOKEN`, `CPANEL_REPO_ROOT`

---

## 4. Database Options

- **Zero-config SQLite (default):** Leave `DB_HOST=` empty in `.env`. `app.cjs` automatically stores the persistent SQLite database at `data/scienta.sqlite` (preserved across updates).
- **cPanel MySQL 8.0 / MariaDB 10.6:** Import `sql/schema.sql` in phpMyAdmin and fill `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env`.
