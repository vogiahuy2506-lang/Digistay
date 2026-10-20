#!/usr/bin/env bash
# Single-quoted `sh -c` scripts in this file are expanded inside the postgres
# container on purpose ($POSTGRES_USER/$POSTGRES_DB live there).
# shellcheck disable=SC2016
# ============================================================
# Backs up the Digistay database and proves the backup restores.
#
#   bash docker/backup.sh [label]    # label: daily (default), manual, pre-deploy-<sha>...
#
# 1. pg_dump (custom format) from the postgres container
# 2. restore it into a scratch database and compare its tables and
#    migration history with the source: a dump never restored is a guess
# 3. copy it to Google Cloud Storage (BACKUP_GCS_BUCKET), if configured
# 4. delete local dumps older than BACKUP_KEEP_DAYS
#
# Settings: /etc/digistay/backup.env (root-owned, optional), e.g.
#   BACKUP_GCS_BUCKET=gs://digistay-db-backups-<project>
#   BACKUP_DIR=/var/backups/digistay
#   BACKUP_KEEP_DAYS=14
# BACKUP_SKIP_UPLOAD=1 keeps the dump local (docker/deploy.sh uses it for
# the pre-migration backup, so a GCS hiccup never blocks a deploy).
#
# Runs daily from docker/systemd/digistay-backup.timer and before every
# deploy from docker/deploy.sh. Restore: docs/RUNBOOK.md, "Backup & khôi phục".
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

BACKUP_CONFIG="${BACKUP_CONFIG:-/etc/digistay/backup.env}"
if [[ -f "$BACKUP_CONFIG" ]]; then
  # shellcheck disable=SC1090
  source "$BACKUP_CONFIG"
fi
BACKUP_DIR="${BACKUP_DIR:-/var/backups/digistay}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BACKUP_GCS_BUCKET="${BACKUP_GCS_BUCKET:-}"
BACKUP_SKIP_UPLOAD="${BACKUP_SKIP_UPLOAD:-0}"

LABEL="${1:-daily}"
if [[ ! "$LABEL" =~ ^[a-z0-9-]+$ ]]; then
  echo "usage: $0 [label]   (lowercase letters, digits and dashes)" >&2
  exit 2
fi

SCRATCH_DB=digistay_restore_check

log() { echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

# Runs a command inside the postgres container (stdin passed through).
pg() { docker compose exec -T postgres "$@"; }

# Runs SQL from stdin against database $1 ("" = the app database).
psql_in() {
  pg sh -c 'psql -U "$POSTGRES_USER" -d "${1:-$POSTGRES_DB}" -tA -v ON_ERROR_STOP=1' psql_in "$1"
}

# Prints the structure the restore must reproduce: tables + migration count.
# Row counts of app tables are not compared: the database is live and may
# change between the dump and this check.
fingerprint() {
  local tables migrations=0
  tables="$(psql_in "$1" <<<"SELECT coalesce(string_agg(table_name, ',' ORDER BY table_name), '')
    FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")"
  if [[ "$(psql_in "$1" <<<"SELECT to_regclass('public._prisma_migrations') IS NOT NULL")" == "t" ]]; then
    migrations="$(psql_in "$1" <<<'SELECT count(*) FROM _prisma_migrations')"
  fi
  echo "tables=[$tables] migrations=$migrations"
}

TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/digistay-$TS-$LABEL.dump"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
UPLOADED=false
OUTCOME=FAILURE

# Records this run in job_runs (src/lib/ops/job-runs.ts); the ops alerts
# read it ("no daily backup for 30 hours", "the last backup failed"). Never
# fails the backup: on a fresh database the table does not exist yet.
record_run() {
  local status="$1" error="${2:-}"
  psql_in "" >/dev/null 2>&1 <<SQL || log "note: could not record this run in job_runs"
INSERT INTO job_runs (id, job, status, "startedAt", "finishedAt", summary, error)
VALUES (gen_random_uuid()::text, 'backup', '$status', '$STARTED', now(),
        jsonb_build_object('label', '$LABEL', 'file', '$(basename "$FILE")', 'uploaded', $UPLOADED),
        NULLIF('$error', ''));
SQL
}

cleanup() {
  local rc=$?
  rm -f "$FILE.partial"
  pg sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$1"' dropdb "$SCRATCH_DB" >/dev/null 2>&1 || true
  if [[ "$OUTCOME" != SUCCESS ]]; then record_run FAILURE "backup.sh exited with code $rc"; fi
}
trap cleanup EXIT

umask 077
mkdir -p "$BACKUP_DIR"

log "dumping database to $FILE"
pg sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$FILE.partial"
mv "$FILE.partial" "$FILE"

log "restore check: restoring into scratch database $SCRATCH_DB"
pg sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$1" && createdb -U "$POSTGRES_USER" "$1"' sh "$SCRATCH_DB"
pg sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error' sh "$SCRATCH_DB" < "$FILE"
SOURCE="$(fingerprint '')"
RESTORED="$(fingerprint "$SCRATCH_DB")"
if [[ "$SOURCE" != "$RESTORED" ]]; then
  log "FATAL: restored copy differs from the source"
  log "  source:   $SOURCE"
  log "  restored: $RESTORED"
  exit 1
fi
log "restore check OK ($RESTORED)"

if [[ "$BACKUP_SKIP_UPLOAD" == "1" ]]; then
  log "upload skipped (BACKUP_SKIP_UPLOAD=1) — local copy only"
elif [[ -n "$BACKUP_GCS_BUCKET" ]]; then
  log "uploading to $BACKUP_GCS_BUCKET/"
  gcloud storage cp --quiet "$FILE" "$BACKUP_GCS_BUCKET/$(basename "$FILE")"
  UPLOADED=true
else
  log "WARNING: BACKUP_GCS_BUCKET is not set — this backup exists on this VPS only"
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'digistay-*.dump' -mtime +"$BACKUP_KEEP_DAYS" -print -delete \
  | sed 's/^/[backup] pruned /'

log "done: $FILE ($(du -h "$FILE" | cut -f1))"
OUTCOME=SUCCESS
record_run SUCCESS
