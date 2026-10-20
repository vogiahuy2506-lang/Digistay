#!/usr/bin/env bash
# The app's scheduled jobs, run every 10 minutes by
# docker/systemd/digistay-reconcile.timer (RUNBOOK, "Đối soát PayOS định kỳ"):
#   - payos-reconcile: PayOS links whose webhook never came
#   - einvoice-jobs: auto-issue, uncertain publishes, invoice emails
#   - email-outbox: booking and invitation emails not sent yet
#   - ops-alerts: emails the people running Digistay about failed jobs,
#     late backups, stuck invoices, PayOS flags (last: it reads the others)
# Each is a POST to /api/internal/<job> from inside the app container, where
# CRON_SECRET is set (.env.production); nginx does not route /api/internal/.
# Every job runs each time; the exit code is non-zero if any failed.
set -u
APP_CONTAINER="${APP_CONTAINER:-digistay-app}"

rc=0
for job in payos-reconcile einvoice-jobs email-outbox ops-alerts; do
  # Single quotes: $CRON_SECRET is expanded by the container's shell.
  if docker exec -e "JOB=$job" "$APP_CONTAINER" sh -c \
    'wget -q -O- --header "x-cron-secret: $CRON_SECRET" --post-data "" "http://127.0.0.1:3000/api/internal/$JOB"'; then
    echo
  else
    echo "[scheduled-jobs] $job failed" >&2
    rc=1
  fi
done
exit "$rc"
