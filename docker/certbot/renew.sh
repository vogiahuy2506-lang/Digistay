#!/usr/bin/env bash
# ============================================================
# Renews the Let's Encrypt certificates, then reloads nginx.
# Run daily by docker/systemd/digistay-cert-renew.timer; certbot only
# renews a certificate in its last 30 days, so most runs do nothing.
#
# Until this existed nothing renewed them: the compose `certbot` service
# only sleeps, and certificates last 90 days.
#
# Renews the apex certificate and hotels' own domains, all issued over HTTP
# (webroot). Hotel subdomains use a Cloudflare Origin CA certificate valid
# 15 years, which nothing renews (docs/RUNBOOK.md, "SSL tên miền con qua
# Cloudflare"). /etc/digistay/cloudflare.ini is mounted when present, for a
# certificate issued over DNS with the dns-cloudflare image.
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
# nginx's workers read hotels' certificates per handshake (custom-domains.conf).
CERTBOT_IMAGE="$IMAGE" bash "$(dirname "${BASH_SOURCE[0]}")/nginx-readable.sh" \
  || echo "[renew] could not let nginx read the certificates (nginx-readable.sh)" >&2

# Serve the renewed files (harmless when nothing changed).
cd "$COMPOSE_DIR"
if docker compose ps --status running --services 2>/dev/null | grep -qx nginx; then
  docker compose exec -T nginx nginx -s reload
fi
