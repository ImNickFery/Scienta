#!/usr/bin/env bash
set -euo pipefail

# One-command cPanel Terminal Installer for Scienta (SSH + single-commit `deploy` branch).
# - Sets up GitHub SSH Deploy Key automatically when using git@github.com:...
# - Prefers the prebuilt `deploy` branch so zero Next.js/TypeScript builds run on cPanel
# - Falls back to building `main` inside /tmp if `deploy` branch doesn't exist yet
# - Auto-creates cPanel Node.js App (cloudlinux-selector) pointing to `app.cjs`
# - Configures .env (auto-generates JWT_SECRET, optional MySQL or built-in SQLite)
# - Preserves .env, data/, uploads/, and node_modules/ across updates

NON_INTERACTIVE=0
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-deploy}"
APP_DIR="${APP_DIR:-$HOME/scienta-app}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-scienta}"
SQLITE_FALLBACK_PATH="${SQLITE_FALLBACK_PATH:-data/scienta.sqlite}"
CPANEL_DOMAIN="${CPANEL_DOMAIN:-}"
CPANEL_APP_URI="${CPANEL_APP_URI:-/}"
NODE_VERSION="${NODE_VERSION:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --non-interactive) NON_INTERACTIVE=1 ;;
    --repo) REPO_URL="${2:-}"; shift ;;
    --branch) BRANCH="${2:-deploy}"; shift ;;
    --dir) APP_DIR="${2:-$APP_DIR}"; shift ;;
    --token) GITHUB_TOKEN="${2:-}"; shift ;;
    --db-host) DB_HOST="${2:-}"; shift ;;
    --db-port) DB_PORT="${2:-3306}"; shift ;;
    --db-user) DB_USER="${2:-}"; shift ;;
    --db-password) DB_PASSWORD="${2:-}"; shift ;;
    --db-name) DB_NAME="${2:-scienta}"; shift ;;
    --domain) CPANEL_DOMAIN="${2:-}"; shift ;;
    --uri) CPANEL_APP_URI="${2:-/}"; shift ;;
    --node-version) NODE_VERSION="${2:-}"; shift ;;
    --help|-h)
      echo "Usage: bash cpanel-install.sh [--repo git@github.com:User/Repo.git] [--branch deploy|main] [--dir ~/scienta-app] [--domain example.com] [--uri /] [--db-host localhost --db-user u --db-password p --db-name db] [--non-interactive]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

ASKPASS_SCRIPT=""
cleanup() {
  if [ -n "$ASKPASS_SCRIPT" ] && [ -f "$ASKPASS_SCRIPT" ]; then
    rm -f "$ASKPASS_SCRIPT"
  fi
}
trap cleanup EXIT

log() {
  printf '\n==> %s\n' "$1"
}

warn() {
  printf '[warn] %s\n' "$1" >&2
}

prompt_value() {
  local prompt_text="$1"
  local default_val="$2"
  local is_secret="${3:-0}"
  local input_val=""
  if [ "$NON_INTERACTIVE" -eq 1 ]; then
    printf '%s' "$default_val"
    return 0
  fi
  if [ "$is_secret" -eq 1 ]; then
    if [ -n "$default_val" ]; then
      read -r -s -p "$prompt_text [hidden, Enter to keep]: " input_val </dev/tty
    else
      read -r -s -p "$prompt_text: " input_val </dev/tty
    fi
    printf '\n' >&2
  else
    if [ -n "$default_val" ]; then
      read -r -p "$prompt_text [$default_val]: " input_val </dev/tty
    else
      read -r -p "$prompt_text: " input_val </dev/tty
    fi
  fi
  if [ -z "$input_val" ]; then
    printf '%s' "$default_val"
  else
    printf '%s' "$input_val"
  fi
}

ensure_github_ssh_key() {
  local repo="$1"
  case "$repo" in
    git@github.com:*|ssh://git@github.com/*) ;;
    *) return 0 ;;
  esac

  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  touch "$HOME/.ssh/known_hosts"
  chmod 600 "$HOME/.ssh/known_hosts"
  if ! grep -q "github.com" "$HOME/.ssh/known_hosts" 2>/dev/null; then
    ssh-keyscan -H github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
  fi

  local pub_key=""
  if [ -f "$HOME/.ssh/id_ed25519.pub" ]; then
    pub_key="$HOME/.ssh/id_ed25519.pub"
  elif [ -f "$HOME/.ssh/id_rsa.pub" ]; then
    pub_key="$HOME/.ssh/id_rsa.pub"
  else
    log "Generating cPanel SSH key (~/.ssh/id_ed25519)..."
    ssh-keygen -t ed25519 -C "cpanel-deploy@$(hostname)" -f "$HOME/.ssh/id_ed25519" -N "" >/dev/null
    pub_key="$HOME/.ssh/id_ed25519.pub"
  fi

  local ssh_out=""
  ssh_out="$(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1 || true)"
  if printf '%s' "$ssh_out" | grep -qi "successfully authenticated"; then
    log "GitHub SSH authentication verified."
    return 0
  fi

  if [ "$NON_INTERACTIVE" -eq 1 ]; then
    warn "GitHub SSH key may not be added to Deploy Keys yet."
    return 0
  fi

  log "Add this cPanel SSH public key to GitHub (Repo -> Settings -> Deploy keys -> Add deploy key):"
  printf '\n%s\n\n' "$(cat "$pub_key")"
  read -r -p "Press Enter after adding the key to GitHub..." _ </dev/tty
}

setup_git_askpass() {
  if [ -z "$GITHUB_TOKEN" ]; then
    return 0
  fi
  ASKPASS_SCRIPT="$(mktemp)"
  chmod 700 "$ASKPASS_SCRIPT"
  cat > "$ASKPASS_SCRIPT" <<'EOF'
#!/usr/bin/env sh
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *) printf '%s\n' "$CPANEL_GH_TOKEN" ;;
esac
EOF
  export GIT_ASKPASS="$ASKPASS_SCRIPT"
  export CPANEL_GH_TOKEN="$GITHUB_TOKEN"
  export GIT_TERMINAL_PROMPT=0
}

detect_primary_domain() {
  if command -v uapi >/dev/null 2>&1; then
    uapi --output=json DomainInfo domains_data 2>/dev/null \
      | sed -n 's/.*"main_domain"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -n 1 || true
  fi
}

detect_best_node_version() {
  if [ -n "$NODE_VERSION" ]; then
    printf '%s' "$NODE_VERSION"
    return 0
  fi
  if command -v cloudlinux-selector >/dev/null 2>&1; then
    local best
    best="$(cloudlinux-selector get --json --interpreter nodejs 2>/dev/null \
      | grep -oE '"[0-9]+\.[0-9]+(\.[0-9]+)?"' \
      | tr -d '"' \
      | sort -t. -k1,1nr -k2,2nr \
      | head -n 1 || true)"
    if [ -n "$best" ]; then
      printf '%s' "$best"
      return 0
    fi
  fi
  printf '%s' "22"
}

activate_node_env() {
  local app_rel="$1"
  local venv_activate
  for venv_activate in \
    "$HOME/nodevenv/$app_rel"/*/bin/activate \
    "$HOME"/nodevenv/*/*/bin/activate \
    "$HOME"/nodevenv/*/bin/activate; do
    if [ -f "$venv_activate" ]; then
      # shellcheck disable=SC1090
      source "$venv_activate"
      if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        return 0
      fi
    fi
  done
  export PATH="/usr/local/bin:/opt/cpanel/ea-nodejs24/bin:/opt/cpanel/ea-nodejs22/bin:/opt/cpanel/ea-nodejs20/bin:$PATH"
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
  fi
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1
}

ensure_cpanel_node_app() {
  local app_dir="$1"
  local app_rel="${app_dir#$HOME/}"
  if ! command -v cloudlinux-selector >/dev/null 2>&1 || [ "$app_rel" = "$app_dir" ]; then
    return 0
  fi
  if [ -d "$HOME/nodevenv/$app_rel" ]; then
    log "Existing cPanel Node.js App detected for '$app_rel'."
    return 0
  fi
  if [ -z "$CPANEL_DOMAIN" ]; then
    local default_domain
    default_domain="$(detect_primary_domain)"
    if [ "$NON_INTERACTIVE" -eq 0 ]; then
      CPANEL_DOMAIN="$(prompt_value "Domain for cPanel Node.js App (leave empty to skip auto-create)" "$default_domain")"
    fi
  fi
  if [ -z "$CPANEL_DOMAIN" ]; then
    return 0
  fi
  if [ "$NON_INTERACTIVE" -eq 0 ]; then
    CPANEL_APP_URI="$(prompt_value "URL path on domain (e.g. /)" "$CPANEL_APP_URI")"
  fi
  local target_node_ver
  target_node_ver="$(detect_best_node_version)"
  log "Creating cPanel Node.js App ($CPANEL_DOMAIN${CPANEL_APP_URI} -> $app_rel, Node $target_node_ver)..."
  if cloudlinux-selector create --json \
    --interpreter nodejs \
    --version "$target_node_ver" \
    --app-root "$app_rel" \
    --domain "$CPANEL_DOMAIN" \
    --app-uri "$CPANEL_APP_URI" \
    --startup-file app.cjs \
    --app-mode Production >/dev/null 2>&1; then
    log "cPanel Node.js App created successfully!"
  else
    warn "Could not auto-create Node.js App via cloudlinux-selector (attach $app_rel -> app.cjs in cPanel -> Setup Node.js App)."
  fi
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local val="$3"
  local tmp_file
  tmp_file="$(mktemp)"
  grep -v "^${key}=" "$file" > "$tmp_file" || true
  printf '%s=%s\n' "$key" "$val" >> "$tmp_file"
  mv "$tmp_file" "$file"
}

main() {
  if ! command -v git >/dev/null 2>&1; then
    echo "ERROR: git is required in cPanel Terminal." >&2
    exit 1
  fi

  log "Scienta cPanel SSH Slim Installer (deploy-branch model)"
  if [ -z "$REPO_URL" ] && [ -d ".git" ]; then
    REPO_URL="$(git remote get-url origin 2>/dev/null || true)"
  fi
  REPO_URL="$(prompt_value "GitHub Repository URL (SSH recommended for private repos)" "$REPO_URL")"
  if [ -z "$REPO_URL" ]; then
    echo "ERROR: Repository URL is required." >&2
    exit 1
  fi

  ensure_github_ssh_key "$REPO_URL"

  case "$REPO_URL" in
    https://*)
      if [ -z "$GITHUB_TOKEN" ] && [ "$NON_INTERACTIVE" -eq 0 ]; then
        GITHUB_TOKEN="$(prompt_value "GitHub Token (leave empty if public repo)" "" 1)"
      fi
      setup_git_askpass
      ;;
  esac

  # Auto-fallback to main if `deploy` branch doesn't exist on remote yet
  if [ "$BRANCH" = "deploy" ]; then
    if ! git ls-remote --heads "$REPO_URL" deploy 2>/dev/null | grep -q "refs/heads/deploy"; then
      warn "Prebuilt 'deploy' branch not found on remote yet; falling back to 'main' (build in /tmp)."
      BRANCH="main"
    fi
  fi

  BRANCH="$(prompt_value "Git branch" "$BRANCH")"
  APP_DIR="$(prompt_value "cPanel install directory" "$APP_DIR")"
  APP_DIR="${APP_DIR%/}"
  local app_rel="${APP_DIR#$HOME/}"

  if [ -d "$APP_DIR/.git" ]; then
    log "Pulling latest '$BRANCH' in $APP_DIR..."
    git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  elif [ -d "$APP_DIR" ] && [ "$(ls -A "$APP_DIR" 2>/dev/null || true)" != "" ]; then
    echo "ERROR: Directory $APP_DIR already exists and is not a git repository. Choose a clean directory." >&2
    exit 1
  else
    log "Shallow-cloning $REPO_URL (branch: $BRANCH) into $APP_DIR..."
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --depth 1 --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
  fi

  ensure_cpanel_node_app "$APP_DIR"

  if ! activate_node_env "$app_rel"; then
    echo "ERROR: Node.js (20+/22+) and npm not found. Create a Node.js App in cPanel -> Setup Node.js App for '$app_rel' and re-run." >&2
    exit 1
  fi

  cd "$APP_DIR"
  mkdir -p data tmp uploads/media uploads/thumbnails
  if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
      cp .env.example .env
    else
      touch .env
    fi
    chmod 600 .env || true
  fi

  if [ -z "$DB_HOST" ] && [ "$NON_INTERACTIVE" -eq 0 ]; then
    DB_HOST="$(prompt_value "MySQL Host (leave empty to use built-in zero-config SQLite)" "")"
  fi
  if [ -n "$DB_HOST" ] && [ "$NON_INTERACTIVE" -eq 0 ]; then
    DB_PORT="$(prompt_value "MySQL Port" "$DB_PORT")"
    DB_USER="$(prompt_value "MySQL Username" "$DB_USER")"
    DB_PASSWORD="$(prompt_value "MySQL Password" "$DB_PASSWORD" 1)"
    DB_NAME="$(prompt_value "MySQL Database Name" "$DB_NAME")"
  fi

  upsert_env_var ".env" "NODE_ENV" "production"
  upsert_env_var ".env" "SQLITE_FALLBACK_PATH" "$SQLITE_FALLBACK_PATH"
  if [ -n "$DB_HOST" ]; then
    upsert_env_var ".env" "DB_HOST" "$DB_HOST"
    upsert_env_var ".env" "DB_PORT" "$DB_PORT"
    upsert_env_var ".env" "DB_USER" "$DB_USER"
    upsert_env_var ".env" "DB_PASSWORD" "$DB_PASSWORD"
    upsert_env_var ".env" "DB_NAME" "$DB_NAME"
  fi
  chmod 600 .env || true

  if [ -f "$APP_DIR/standalone/server.js" ] && [ -f "$APP_DIR/app.cjs" ] && [ "$BRANCH" = "deploy" ]; then
    log "Prebuilt 'deploy' branch detected — skipping Next.js/TS build on cPanel!"
    bash "$APP_DIR/scripts/cpanel-slim-finalize.sh" "$APP_DIR"
  else
    log "Building in /tmp and finalizing slim runtime..."
    CPANEL_SLIM_MODE=1 bash "$APP_DIR/scripts/cpanel-deploy.sh" "$APP_DIR"
  fi

  log "Done!"
  printf '  Install path   : %s\n' "$APP_DIR"
  printf '  Disk usage     : %s\n' "$(du -sh "$APP_DIR" 2>/dev/null | cut -f1)"
  printf '  Startup file   : app.cjs\n'
  printf '  Admin Console  : https://%s%s/admin\n' "${CPANEL_DOMAIN:-yourdomain.com}" "${CPANEL_APP_URI%/}"
  printf '\nFor future updates on cPanel, run:\n'
  printf '  cd %s && git fetch --depth 1 origin deploy && git reset --hard origin/deploy && bash scripts/cpanel-slim-finalize.sh\n\n' "$APP_DIR"
}

main
