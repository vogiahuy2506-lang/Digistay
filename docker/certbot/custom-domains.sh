#!/usr/bin/env bash
# ============================================================
# HTTPS certificates for hotels' own domains (www.khachsan.vn), every
# minute from docker/systemd/digistay-custom-domains.timer.
#
# 1. Asks the app which verified domains wait for a certificate
#    (GET /api/internal/custom-domains, from inside the app container with
#    CRON_SECRET; nginx never routes /api/internal/).
# 2. Issues each with Let's Encrypt over HTTP: nginx's port-80 default server
#    serves /.well-known/acme-challenge/ for every host from the certbot
#    webroot volume. The certificate lands in live/<domain>/, where
#    custom-domains.conf finds it by the name the browser asks for.
# 3. Tells the app the outcome (POST domain=...&ok=1|0); a failure is tried
#    again an hour later (src/lib/public-site/custom-domains.ts).
#
# Renewal is docker/certbot/renew.sh's daily `certbot renew`, which renews
# these certificates too. Install: docs/RUNBOOK.md, "Tên miền riêng".
# ============================================================
set -uo pipefail
APP_CONTAINER="${APP_CONTAINER:-digistay-app}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/digistay}"
IMAGE="certbot/dns-cloudflare:v5.8.0"
EMAIL="${CERTBOT_EMAIL:-}"
STAGING="${CERTBOT_STAGING:-0}"

app() {
  # Single quotes: $CRON_SECRET is expanded by the container's shell.
  docker exec -e "METHOD=$1" -e "BODY=${2:-}" "$APP_CONTAINER" sh -c '
    if [ "$METHOD" = POST ]; then
      wget -q -O- --header "x-cron-secret: $CRON_SECRET" --post-data "$BODY" http://127.0.0.1:3000/api/internal/custom-domains
    else
      wget -q -O- --header "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3000/api/internal/custom-domains
    fi'
}

domains="$(app GET)" || { echo "[custom-domains] could not ask the app" >&2; exit 1; }
[ -z "$domains" ] && exit 0

account=(--register-unsafely-without-email)
[ -n "$EMAIL" ] && account=(--email "$EMAIL" --no-eff-email)
staging=()
[ "$STAGING" = "1" ] && staging=(--staging)

issued=0
while IFS= read -r domain; do
  # The app only lists hostnames it normalized; check again before using one as a path.
  if ! [[ "$domain" =~ ^[a-z0-9-]+(\.[a-z0-9-]+)+$ ]]; then
    echo "[custom-domains] skipping a malformed name" >&2
    continue
  fi
  echo "[custom-domains] issuing $domain"
  if docker run --rm -v digistay_certbot_conf:/etc/letsencrypt -v digistay_certbot_www:/var/www/certbot "$IMAGE" \
      certonly --webroot --webroot-path=/var/www/certbot --cert-name "$domain" -d "$domain" \
      --non-interactive --agree-tos --keep-until-expiring "${account[@]}" ${staging[@]+"${staging[@]}"}; then
    issued=1
    app POST "domain=$domain&ok=1" >/dev/null || echo "[custom-domains] could not report $domain" >&2
  else
    echo "[custom-domains] $domain failed (DNS not pointing here yet, or Let's Encrypt refused)" >&2
    app POST "domain=$domain&ok=0" >/dev/null || echo "[custom-domains] could not report $domain" >&2
  fi
done <<< "$domains"

# nginx reads certificates per handshake (ssl_certificate_cache valid=1m); the
# reload only makes a new one show at once.
if [ "$issued" = 1 ]; then
  cd "$COMPOSE_DIR" && docker compose exec -T nginx nginx -s reload || true
fi
exit 0
