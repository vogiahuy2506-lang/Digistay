#!/usr/bin/env bash
# ============================================================
# Installed on the VPS as /usr/local/bin/digistay-deploy.sh (root:root 0755).
# GitHub Actions runs:  sudo /usr/local/bin/digistay-deploy.sh <git-sha>
#
# Deliberately tiny: it syncs /opt/digistay to the exact commit CI tested,
# then hands over to docker/deploy.sh from THAT commit. Deploy logic thus
# changes through code review, not by editing files on the VPS.
# Reinstall after changing this file (docs/RUNBOOK.md, "Deploy an toàn").
# ============================================================
set -euo pipefail

SHA="${1:-}"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: $0 <40-char git sha>" >&2
  exit 2
fi

APP_DIR=/opt/digistay
DEPLOY_USER=deploy

cd "$APP_DIR"
echo "[digistay-deploy] syncing $APP_DIR to $SHA"
sudo -u "$DEPLOY_USER" git fetch --quiet origin main
sudo -u "$DEPLOY_USER" git checkout --quiet --detach "$SHA"
exec bash "$APP_DIR/docker/deploy.sh" "$SHA"
