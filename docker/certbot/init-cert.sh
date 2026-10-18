#!/usr/bin/env bash
# ============================================================
# First-time Let's Encrypt cert issuance for digistay.vn.
# Idempotent — re-running is a no-op once certs exist.
# ============================================================
set -euo pipefail

DOMAIN="${DOMAIN:-digistay.vn}"
WILDCARD_DOMAIN="${WILDCARD_DOMAIN:-}"
EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set (e.g. you@digistay.vn)}"
WEBROOT="/var/www/certbot"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/digistay}"
STAGING="${CERTBOT_STAGING:-0}"   # 1 = use Let's Encrypt staging (for testing)

cd "$COMPOSE_DIR"

LIVE_DIR="volumes/digistay_certbot_conf/_data/live/$DOMAIN"

if [[ -f "$LIVE_DIR/fullchain.pem" ]]; then
  echo "[certbot] Existing cert found at $LIVE_DIR — skipping issuance."
  docker compose exec nginx nginx -s reload || true
  exit 0
fi

STAGING_FLAG=()
if [[ "$STAGING" == "1" ]]; then
  STAGING_FLAG=(--staging)
  echo "[certbot] WARNING: using Let's Encrypt STAGING server (cert will be invalid)."
fi

DOMAINS=("-d" "$DOMAIN" "-d" "www.$DOMAIN")

echo "[certbot] Requesting certificate for $DOMAIN + www.$DOMAIN ..."
docker compose --profile init run --rm certbot certonly \
  --webroot \
  --webroot-path="$WEBROOT" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  "${STAGING_FLAG[@]}" \
  "${DOMAINS[@]}"

# ---- Materialise the secure nginx config from the template ----
if [[ ! -f docker/nginx/conf.d/app-secure.conf ]]; then
  echo "[certbot] Rendering app-secure.conf from template (DOMAIN=$DOMAIN) ..."
  DOMAIN="$DOMAIN" envsubst '$DOMAIN' \
    < docker/nginx/conf.d/app-secure.conf.template \
    > docker/nginx/conf.d/app-secure.conf
fi

# ---- Reload nginx so it picks up the new certs ----
echo "[certbot] Reloading nginx ..."
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload

echo "[certbot] Done. Certs live at volumes/digistay_certbot_conf/_data/live/$DOMAIN"