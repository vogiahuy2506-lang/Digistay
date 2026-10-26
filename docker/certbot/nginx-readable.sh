#!/usr/bin/env bash
# ============================================================
# Lets nginx's worker processes read the certificates it loads per
# handshake: hotels' own domains (custom-domains.conf, live/<domain>/) and
# the Cloudflare Origin CA certificate of *.digistay.vn (app-secure.conf,
# cloudflare-origin/). A certificate path with a variable is read by the
# workers, which run as user nginx (uid/gid 101 in the nginx image), not by
# the root master; certbot makes live/ and archive/ root-only (0700) and
# private keys 0600, so those handshakes failed with "Permission denied".
#
# Directories become traversable and private keys readable by group 101
# only. The volume sits under /var/lib/docker, which other users on the
# host cannot enter. certbot keeps a key's group and group bits when it
# renews; new certificates still need this, so it runs after every
# issuance (custom-domains.sh) and renewal (renew.sh). Idempotent.
# ============================================================
set -euo pipefail
IMAGE="${CERTBOT_IMAGE:-certbot/dns-cloudflare:v5.8.0}"
NGINX_GID=101

docker run --rm --entrypoint sh -e "NGINX_GID=$NGINX_GID" -v digistay_certbot_conf:/etc/letsencrypt "$IMAGE" -c '
  cd /etc/letsencrypt || exit 1
  for dir in live archive cloudflare-origin; do
    [ -d "$dir" ] && chmod 0755 "$dir"
  done
  for dir in archive cloudflare-origin; do
    [ -d "$dir" ] || continue
    find "$dir" -type f \( -name "privkey*.pem" -o -name "key.pem" \) \
      -exec chgrp "$NGINX_GID" {} + -exec chmod 0640 {} +
  done
  exit 0'
