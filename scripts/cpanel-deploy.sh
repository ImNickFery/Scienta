#!/usr/bin/env bash
set -euo pipefail

# Fallback cPanel deployment helper when deploying from `main` instead of the prebuilt `deploy` branch:
# Builds Next.js standalone inside /tmp so ~1.1 GB of devDependencies & .next cache
# never consume cPanel home disk quota, copies slim runtime artifacts into TARGET_DIR,
# preserves .env / data / uploads, and runs cpanel-slim-finalize.sh.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1:-${DEPLOY_TARGET:-$REPO_DIR}}"
TARGET_DIR="${TARGET_DIR%/}"
SLIM_MODE="${CPANEL_SLIM_MODE:-1}"

log() {
  printf '[cpanel-deploy] %s\n' "$1"
}

activate_node_env() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  local app_rel="${TARGET_DIR#$HOME/}"
  local venv_activate
  for venv_activate in \
    "$HOME/nodevenv/$app_rel"/*/bin/activate \
    "$HOME"/nodevenv/*/*/bin/activate \
    "$HOME"/nodevenv/*/bin/activate; do
    if [ -f "$venv_activate" ]; then
      # shellcheck disable=SC1090
      set +u
      source "$venv_activate"
      set -u
      if command -v node >/dev/null 2>&1; then
        log "Activated cPanel Node.js environment: $venv_activate"
        return 0
      fi
    fi
  done

  export PATH="/usr/local/bin:/opt/cpanel/ea-nodejs24/bin:/opt/cpanel/ea-nodejs22/bin:/opt/cpanel/ea-nodejs20/bin:$PATH"
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    set +u
    source "$HOME/.nvm/nvm.sh"
    set -u
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    log "ERROR: Node.js / npm not found. Create a Node.js App in cPanel first."
    exit 1
  fi
}

main() {
  activate_node_env

  local build_dir="$REPO_DIR"
  local temp_build_dir=""

  cleanup_tmp() {
    if [ -n "$temp_build_dir" ] && [ -d "$temp_build_dir" ]; then
      rm -rf "$temp_build_dir"
    fi
  }
  trap cleanup_tmp EXIT

  if [ "$SLIM_MODE" = "1" ] && [ "$REPO_DIR" = "$TARGET_DIR" ]; then
    temp_build_dir="$(mktemp -d /tmp/scienta-build-XXXXXX)"
    log "Using temporary build workspace $temp_build_dir to keep $TARGET_DIR ultra-slim..."
    tar -C "$REPO_DIR" \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='.next' \
      --exclude='deploy' \
      --exclude='standalone' \
      --exclude='data' \
      --exclude='tmp' \
      --exclude='uploads' \
      -cf - . | tar -C "$temp_build_dir" -xf -
    build_dir="$temp_build_dir"
  fi

  cd "$build_dir"

  log "Installing build dependencies in $build_dir..."
  if [ -f "package-lock.json" ]; then
    npm ci --include=dev --no-audit --no-fund || npm install --include=dev --no-audit --no-fund
  else
    npm install --include=dev --no-audit --no-fund
  fi

  log "Building Next.js standalone bundle and packaging slim runtime..."
  NODE_ENV=production npm run build
  npm run deploy:package

  if [ ! -f "$build_dir/deploy/standalone/server.js" ] || [ ! -f "$build_dir/deploy/app.cjs" ]; then
    log "ERROR: Slim deploy artifacts missing (deploy/standalone/server.js or deploy/app.cjs)."
    exit 1
  fi

  mkdir -p "$TARGET_DIR"
  log "Copying slim runtime artifacts into $TARGET_DIR..."
  rm -rf "$TARGET_DIR/standalone"
  cp -R "$build_dir/deploy/standalone" "$TARGET_DIR/standalone"
  cp "$build_dir/deploy/app.cjs" "$TARGET_DIR/app.cjs"
  cp "$build_dir/deploy/package.json" "$TARGET_DIR/package.runtime.json"
  [ -f "$build_dir/deploy/.env.example" ] && cp "$build_dir/deploy/.env.example" "$TARGET_DIR/.env.example"
  if [ -d "$build_dir/deploy/sql" ]; then
    mkdir -p "$TARGET_DIR/sql"
    cp -R "$build_dir/deploy/sql"/* "$TARGET_DIR/sql/"
  fi
  mkdir -p "$TARGET_DIR/scripts"
  [ -f "$build_dir/deploy/scripts/cpanel-slim-finalize.sh" ] && \
    cp "$build_dir/deploy/scripts/cpanel-slim-finalize.sh" "$TARGET_DIR/scripts/cpanel-slim-finalize.sh"

  # Free /tmp immediately before installing host runtime dependency
  cleanup_tmp
  temp_build_dir=""

  if [ "$SLIM_MODE" = "1" ] && [ -f "$TARGET_DIR/package.runtime.json" ]; then
    if [ ! -L "$TARGET_DIR/node_modules" ]; then
      rm -rf "$TARGET_DIR/node_modules"
    fi
    rm -rf "$TARGET_DIR/.next" "$TARGET_DIR/deploy"
    bash "$TARGET_DIR/scripts/cpanel-slim-finalize.sh" "$TARGET_DIR"
  else
    cd "$TARGET_DIR"
    mkdir -p data tmp uploads/media uploads/thumbnails
    touch tmp/restart.txt
  fi
}

main "$@"
