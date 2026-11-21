#!/usr/bin/env bash
set -euo pipefail

# Finalizes an ultra-slim runtime deployment for Scienta on cPanel:
# - Activates cPanel Node.js environment (CloudLinux nodevenv / EasyApache / nvm)
# - Ensures persistent data/, tmp/, and uploads/ directories survive `git reset --hard`
# - Auto-generates JWT_SECRET in .env if missing
# - Installs ONLY host-native optional `sharp` (from package.runtime.json)
# - Verifies `sharp` loads on host GLIBC/Node ABI and prunes docs/unused binaries
# - Restarts Phusion Passenger cleanly

TARGET_DIR="${1:-$PWD}"
TARGET_DIR="${TARGET_DIR%/}"

log() {
  printf '[cpanel-slim] %s\n' "$1"
}

activate_node_env() {
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
      if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        log "Activated cPanel Node.js environment: $venv_activate ($(node -v))"
        return 0
      fi
    fi
  done

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

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

ensure_jwt_secret() {
  [ -f "$TARGET_DIR/.env" ] || return 0
  if ! grep -q '^JWT_SECRET=' "$TARGET_DIR/.env" || grep -q '^JWT_SECRET=$' "$TARGET_DIR/.env"; then
    local generated
    generated="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
    local tmp_env
    tmp_env="$(mktemp)"
    grep -v '^JWT_SECRET=' "$TARGET_DIR/.env" > "$tmp_env" || true
    printf 'JWT_SECRET=%s\n' "$generated" >> "$tmp_env"
    mv "$tmp_env" "$TARGET_DIR/.env"
    chmod 600 "$TARGET_DIR/.env" || true
    log "Generated a fresh 64-character JWT_SECRET in .env."
  fi
}

link_persistent_uploads() {
  mkdir -p "$TARGET_DIR/uploads/media" "$TARGET_DIR/uploads/thumbnails"
  if [ -d "$TARGET_DIR/standalone/public" ]; then
    if [ ! -L "$TARGET_DIR/standalone/public/uploads" ]; then
      if [ -d "$TARGET_DIR/standalone/public/uploads" ]; then
        cp -rn "$TARGET_DIR/standalone/public/uploads"/* "$TARGET_DIR/uploads/" 2>/dev/null || true
        rm -rf "$TARGET_DIR/standalone/public/uploads"
      fi
      ln -s ../../uploads "$TARGET_DIR/standalone/public/uploads"
    fi
  fi
}

prune_sharp() {
  local sharp_dir="$TARGET_DIR/node_modules/sharp"
  [ -d "$sharp_dir" ] || return 0

  # Verify sharp loads cleanly on this host's GLIBC & Node ABI
  if ! node -e "require('sharp')" >/dev/null 2>&1; then
    log "Native sharp unsupported on this host ($(node -v)); removing broken binary to save disk space."
    rm -rf "$sharp_dir" "$TARGET_DIR/node_modules/@img"
    return 0
  fi

  # Strip TypeScript declarations and markdown docs inside sharp & @img
  find "$sharp_dir" -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.md' \) -delete 2>/dev/null || true
  if [ -d "$TARGET_DIR/node_modules/@img" ]; then
    find "$TARGET_DIR/node_modules/@img" -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.md' \) -delete 2>/dev/null || true
  fi

  # Re-verify sharp still loads after cleanup
  if ! node -e "require('sharp')" >/dev/null 2>&1; then
    log "WARNING: sharp verification failed after prune; removing binary."
    rm -rf "$sharp_dir" "$TARGET_DIR/node_modules/@img"
  fi
}

main() {
  activate_node_env
  cd "$TARGET_DIR"

  mkdir -p data tmp
  link_persistent_uploads

  if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    chmod 600 .env || true
  fi
  ensure_jwt_secret

  # Remove any stray sourcemaps on host
  if [ -d "$TARGET_DIR/standalone/.next" ]; then
    find "$TARGET_DIR/standalone/.next" -name '*.map' -delete 2>/dev/null || true
  fi

  if [ -f "package.runtime.json" ]; then
    cp package.runtime.json package.json
  fi

  log "Installing optional host-native runtime dependency (Node $(node -v))..."
  npm install --omit=dev --no-audit --no-fund || true
  prune_sharp

  touch tmp/restart.txt
  local app_rel="${TARGET_DIR#$HOME/}"
  if command -v cloudlinux-selector >/dev/null 2>&1 && [ "$app_rel" != "$TARGET_DIR" ]; then
    cloudlinux-selector restart --json --interpreter nodejs --app-root "$app_rel" >/dev/null 2>&1 || true
  fi

  log "Slim deployment complete! Total directory usage: $(du -sh "$TARGET_DIR" 2>/dev/null | cut -f1)"
}

main "$@"
