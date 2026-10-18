#!/usr/bin/env bash
# ============================================================
# Runs on the VPS via GitHub Actions → SSH.
# Pulls the latest app image and restarts it in place.
# Keeps the previous image so we can roll back with:
#   docker compose pull app:previous-sha && docker compose up -d --no-deps app
# ============================================================
set -euo pipefail

cd /opt/digistay

echo "[deploy] $(date -u +%Y-%m-%dT%H:%M:%SZ) starting"

# Make sure .env.production exists (the deploy script never touches it,
# but a fresh VM might be missing it).
if [[ ! -f .env.production ]]; then
  echo "[deploy] FATAL: .env.production missing on VPS — aborting." >&2
  exit 1
fi

# 1) Pull the latest app image (nginx + postgres are pinned in compose).
docker compose pull app

# 2) Recreate ONLY the app container so nginx/certbot aren't disturbed.
docker compose up -d --no-deps --remove-orphans app

# 3) Drop dangling images, but keep the previous :<sha> tagged image so
#    rollback works. `prune -f` only removes <none>:<none> dangling layers,
#    not tagged images, so the prior `:main-abcdef0` survives.
docker image prune -f

# 4) Print what just changed for the deploy log.
echo "[deploy] Current app image:"
docker compose images app

echo "[deploy] Done."