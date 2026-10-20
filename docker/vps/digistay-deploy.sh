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

APP_DIR="${DIGISTAY_APP_DIR:-/opt/digistay}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/var/lock/digistay-deploy.lock}"

# One deploy at a time, taken BEFORE the checkout: a second run must not
# swap the source tree while the first is still building from it. The lock
# stays held through `exec` below (fd 9 is inherited).
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[digistay-deploy] another deploy is running (lock $LOCK_FILE); wait for it, then retry" >&2
  exit 1
fi
export DIGISTAY_DEPLOY_LOCK_HELD=1

# git runs as the checkout's owner, so files keep their owner and git does
# not refuse with "dubious ownership". On the current VPS that is the user
# who cloned it (hotro_digibook), not "deploy".
OWNER="$(stat -c '%U' "$APP_DIR/.git" 2>/dev/null || stat -f '%Su' "$APP_DIR/.git")" # GNU, else BSD
as_owner() {
  if [[ "$(id -un)" == "$OWNER" ]]; then "$@"; else sudo -u "$OWNER" "$@"; fi
}

cd "$APP_DIR"
echo "[digistay-deploy] syncing $APP_DIR to $SHA (git as $OWNER)"
as_owner git fetch --quiet origin main
# Only commits that are on main reach production.
if ! as_owner git merge-base --is-ancestor "$SHA" origin/main; then
  echo "[digistay-deploy] $SHA is not on origin/main; refusing" >&2
  exit 2
fi
# --force: the VPS runs what was reviewed; edits to tracked files made on
# the VPS are dropped (.env files and certificates are untracked, so kept).
as_owner git -c advice.detachedHead=false checkout --quiet --force --detach "$SHA"
exec bash "$APP_DIR/docker/deploy.sh" "$SHA"
