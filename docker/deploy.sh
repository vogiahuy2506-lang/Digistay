#!/usr/bin/env bash
# ============================================================
# Deploys one commit to this VPS, safely.
#
#   bash docker/deploy.sh <40-char git sha>
#
# Called by /usr/local/bin/digistay-deploy.sh (source: docker/vps/) after it
# has checked out that same commit (CI already tested it). Steps:
#   1. build the image from the checked-out source: digistay-app:<sha>,
#      with that SHA as the version /api/health reports
#   2. back up the database (docker/backup.sh, local copy)
#   3. run migrations with the NEW image while the old app keeps serving;
#      a failing migration stops the deploy here, nothing is swapped
#   4. recreate the app container on the new image
#   5. wait until /api/health reports this SHA; otherwise roll back to the
#      previous image and exit 1, so the GitHub Action goes red
#
# Migrations are not rolled back: each one must stay compatible with the
# previous release (see CLAUDE.md, "Migration").
# ============================================================
set -euo pipefail

SHA="${1:-}"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: $0 <40-char git sha>" >&2
  exit 2
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
APP_CONTAINER=digistay-app
IMAGE_REPO=digistay-app # docker-compose.yml: image digistay-app:${APP_TAG}
LOCK_FILE="${DEPLOY_LOCK_FILE:-/var/lock/digistay-deploy.lock}"

log() { echo "[deploy] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

# One deploy at a time. Two at once (a manual run during a CI run) failed
# on 2026-10-20 with "removal of container ... is already in progress".
# The VPS wrapper takes the lock before its checkout and passes it down.
if [[ "${DIGISTAY_DEPLOY_LOCK_HELD:-}" != 1 ]]; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "FATAL: another deploy is running (lock $LOCK_FILE); wait for it, then retry"
    exit 1
  fi
fi

# Build exactly what was reviewed: the wrapper checked out $SHA.
HEAD_SHA="$(git -c safe.directory="$APP_DIR" rev-parse HEAD)"
if [[ "$HEAD_SHA" != "$SHA" ]]; then
  log "FATAL: $APP_DIR is at $HEAD_SHA, not $SHA"
  exit 1
fi

for f in .env .env.production; do
  if [[ ! -f "$f" ]]; then
    log "FATAL: $APP_DIR/$f is missing"
    exit 1
  fi
done

# The version deployed right now: rollback target. Before per-commit tags,
# the running image was digistay-app:latest.
PREV_TAG="$(sed -n 's/^APP_TAG=//p' .env | tail -n 1)"
if [[ -z "$PREV_TAG" ]] && docker image inspect "$IMAGE_REPO:latest" >/dev/null 2>&1; then
  PREV_TAG=latest
fi

# Records the deployed tag in .env, which compose reads for every command,
# so a manual `docker compose up -d` keeps this version. `cat >` keeps the
# file's owner and mode.
record_tag() {
  local tmp
  tmp="$(mktemp)"
  grep -v '^APP_TAG=' .env > "$tmp" || true
  echo "APP_TAG=$1" >> "$tmp"
  cat "$tmp" > .env
  rm -f "$tmp"
}

# Polls /api/health inside the app container until it reports version $1.
wait_for_version() {
  local want="$1" body=""
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while (( SECONDS < deadline )); do
    body="$(docker exec "$APP_CONTAINER" wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null || true)"
    if [[ "$body" == *'"status":"ok"'* && "$body" == *"\"version\":\"$want\""* ]]; then
      return 0
    fi
    sleep 3
  done
  log "last /api/health response: ${body:-<none>}"
  return 1
}

# Re-renders the HTTPS nginx config from its template and reloads nginx, so
# changes to docker/nginx/ (headers, proxy settings) reach the VPS. The
# rendered app-secure.conf only exists once TLS was set up (init-cert.sh).
# An invalid config is rolled back and fails the deploy; nginx keeps
# serving with the config it already had in memory.
reload_nginx() {
  local conf=docker/nginx/conf.d/app-secure.conf
  local tpl=docker/nginx/conf.d/app-secure.conf.template
  if ! docker compose ps --status running --services 2>/dev/null | grep -qx nginx; then
    log "nginx is not running; config reload skipped"
    return 0
  fi
  if [[ -f "$conf" ]]; then
    local domain
    domain="$(sed -n 's/^DOMAIN=//p' .env | tail -n 1)"
    if [[ -z "$domain" ]]; then
      log "WARNING: DOMAIN is not set in .env; $conf not re-rendered"
    else
      cp "$conf" "$conf.bak"
      # shellcheck disable=SC2016 # envsubst gets the literal variable name
      DOMAIN="$domain" envsubst '$DOMAIN' < "$tpl" > "$conf"
    fi
  fi
  if docker compose exec -T nginx nginx -t >/dev/null 2>&1; then
    docker compose exec -T nginx nginx -s reload
    rm -f "$conf.bak"
    log "nginx config checked and reloaded"
    return 0
  fi
  log "ERROR: the new nginx config is invalid; restoring the previous one"
  docker compose exec -T nginx nginx -t 2>&1 | sed 's/^/[nginx] /' || true
  if [[ -f "$conf.bak" ]]; then mv "$conf.bak" "$conf"; fi
  return 1
}

log "deploying $SHA (previous: ${PREV_TAG:-none})"
export APP_TAG="$SHA"

log "1/5 building $IMAGE_REPO:$SHA (the old app keeps serving)"
docker compose build app

# Backing services (postgres, redis, ...): everything except the app itself
# and nginx, whose depends_on would start the app before migrations ran.
BACKING=()
while IFS= read -r svc; do BACKING+=("$svc"); done < <(docker compose config --services | grep -vxE 'app|nginx')

log "2/5 starting ${BACKING[*]} if needed, backing up"
docker compose up -d --wait "${BACKING[@]}"
BACKUP_SKIP_UPLOAD=1 bash docker/backup.sh "pre-deploy-${SHA:0:12}"

log "3/5 applying migrations with the new image (old app still serving)"
docker compose run --rm --no-deps -e CHECKPOINT_DISABLE=1 app \
  node node_modules/prisma/build/index.js migrate deploy

log "4/5 starting the new app container"
# --no-build: never build here; a missing image must fail, not be rebuilt.
docker compose up -d --no-deps --no-build app

log "5/5 waiting for /api/health to report $SHA (up to ${HEALTH_TIMEOUT}s)"
if wait_for_version "$SHA"; then
  record_tag "$SHA"
  # Keep the current and previous images for rollback; drop older ones.
  docker image ls "$IMAGE_REPO" --format '{{.Tag}}' \
    | { grep -vxE "$SHA|${PREV_TAG:-<none>}|latest" || true; } \
    | while read -r tag; do docker image rm "$IMAGE_REPO:$tag" >/dev/null 2>&1 || true; done
  docker image prune -f >/dev/null
  log "deploy OK: $SHA is live"
  if ! reload_nginx; then
    log "deploy FAILED at the nginx step: the app is live, fix docker/nginx/ and redeploy"
    exit 1
  fi
  exit 0
fi

log "ERROR: $SHA did not become healthy"
docker logs --tail 50 "$APP_CONTAINER" 2>&1 | sed 's/^/[app] /' || true
if [[ -n "$PREV_TAG" ]]; then
  log "rolling back to $PREV_TAG"
  # --no-build: if that image were gone, compose would build THIS commit
  # under the old tag and "roll back" to the broken code.
  APP_TAG="$PREV_TAG" docker compose up -d --no-deps --no-build app
  if wait_for_version "$PREV_TAG"; then
    log "rollback OK: $PREV_TAG is serving again (this deploy still FAILED)"
  else
    log "ROLLBACK ALSO UNHEALTHY: manual action needed (docs/RUNBOOK.md)"
  fi
else
  log "no previous version to roll back to (first deploy)"
fi
exit 1
