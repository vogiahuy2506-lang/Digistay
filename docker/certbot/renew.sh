#!/usr/bin/env bash
# ============================================================
# Renews the Let's Encrypt certificates, then reloads nginx.
# Run daily by docker/systemd/digistay-cert-renew.timer; certbot only
# renews a certificate in its last 30 days, so most runs do nothing.
#
# Until this existed nothing renewed them: the compose `certbot` service
# only sleeps, and certificates last 90 days.
#
# The dns-cloudflare image renews both kinds: the apex certificate issued
# over HTTP (webroot) and, once subdomains are enabled, the wildcard
# issued over DNS, which needs /etc/digistay/cloudflare.ini
# (docs/RUNBOOK.md, "Subdomain cho site khách sạn").
# ============================================================
set -euo pipefail

IMAGE="certbot/dns-cloudflare:v5.8.0"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/digistay}"
CLOUDFLARE_INI=/etc/digistay/cloudflare.ini

MOUNTS=(-v digistay_certbot_conf:/etc/letsencrypt -v digistay_certbot_www:/var/www/certbot)
if [[ -f "$CLOUDFLARE_INI" ]]; then
  MOUNTS+=(-v "$CLOUDFLARE_INI:$CLOUDFLARE_INI:ro")
fi

docker run --rm "${MOUNTS[@]}" "$IMAGE" renew --quiet "$@"

# Serve the renewed files (harmless when nothing changed).
cd "$COMPOSE_DIR"
if docker compose ps --status running --services 2>/dev/null | grep -qx nginx; then
  docker compose exec -T nginx nginx -s reload
fi
