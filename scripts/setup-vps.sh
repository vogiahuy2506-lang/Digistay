#!/usr/bin/env bash
# ============================================================
# One-shot VPS bootstrap for Digistay.
# Run once on a fresh Ubuntu 22.04 LTS GCE VM as root.
#
# Usage (from your laptop):
#   gcloud compute ssh digistay-vm -- sudo bash -s < scripts/setup-vps.sh
#
# Re-running is safe — each step is idempotent.
# ============================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/vogiahuy2506-lang/Digistay.git}"   # adjust if needed
APP_DIR="/opt/digistay"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"

# -------- helpers --------
say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mFATAL:\033[0m %s\n' "$*" >&2; exit 1; }

# -------- preflight --------
[[ $EUID -eq 0 ]] || die "Must run as root (try: sudo bash $0)"

say "Updating apt cache ..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

say "Installing OS packages ..."
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release git ufw \
  openssh-server openssl

# -------- docker --------
if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker (official repo) ..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
else
  say "Docker already installed — skipping."
fi

# -------- deploy user --------
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  say "Creating deploy user '$DEPLOY_USER' ..."
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  mkdir -p /home/"$DEPLOY_USER"/.ssh
  chmod 700 /home/"$DEPLOY_USER"/.ssh
fi

# Grant docker access.
usermod -aG docker "$DEPLOY_USER"

# -------- firewall --------
say "Configuring ufw (22, 80, 443) ..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# -------- ssh hardening --------
say "Ensuring sshd is enabled and running ..."
systemctl enable --now ssh

# -------- app directory --------
say "Preparing $APP_DIR ..."
mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"

# -------- repo --------
if [[ ! -d "$APP_DIR/.git" ]]; then
  say "Cloning repo into $APP_DIR ..."
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
else
  say "Repo already present — pulling latest ..."
  sudo -u "$DEPLOY_USER" -H bash -c "cd $APP_DIR && git pull --ff-only || true"
fi

# -------- env file placeholders --------
# Compose interpolates ${VAR:?…} from the PROJECT `.env`, so we keep
# both files in sync. .env is read at config-resolution time; .env.production
# is the app's runtime env_file. Both are git-ignored.
if [[ ! -f "$APP_DIR/.env.production" ]]; then
  say "Generating .env + .env.production placeholders ..."
  NEXTAUTH_SECRET=$(openssl rand -hex 32)
  ENV_BLOCK=$(cat <<EOF
DOMAIN=digistay.vn
GHCR_OWNER=senna

# --- App / NextAuth ---
NEXTAUTH_URL=https://digistay.vn
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXT_PUBLIC_SITE_URL=https://digistay.vn

# --- Postgres (matches docker-compose.yml) ---
POSTGRES_USER=digistay
POSTGRES_PASSWORD=
POSTGRES_DB=digistay
# NOTE: the container hostname is "postgres", not "localhost".
DATABASE_URL=postgresql://digistay:REPLACE_ME@postgres:5432/digistay?schema=public

# --- Certbot ---
CERTBOT_EMAIL=

# --- Optional integrations (leave blank if unused) ---
# RESEND_API_KEY=
# EMAIL_FROM=Digistay <noreply@digistay.vn>
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
EOF
)
  printf '%s\n' "$ENV_BLOCK" > "$APP_DIR/.env.production"
  printf '%s\n' "$ENV_BLOCK" > "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env.production" "$APP_DIR/.env"
  chown "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR/.env.production" "$APP_DIR/.env"
  say ".env + .env.production created with a random NEXTAUTH_SECRET."
  say "  >>> You still need to set POSTGRES_PASSWORD and CERTBOT_EMAIL"
  say "  >>> in BOTH files (use the same value), then re-edit DATABASE_URL"
  say "  >>> so the password matches POSTGRES_PASSWORD."
fi

# -------- fin --------
say "Bootstrap complete."
cat <<'NEXT'

============================================================
      Next steps (manual)
============================================================
  1. Edit BOTH /opt/digistay/.env AND /opt/digistay/.env.production
     (same keys, same values) and fill in:
       POSTGRES_PASSWORD, DATABASE_URL, CERTBOT_EMAIL
     Keep POSTGRES_PASSWORD and the password inside DATABASE_URL in sync.
  2. Add the GitHub Actions deploy public key to:
       /home/deploy/.ssh/authorized_keys
     (and chmod 600 it, owned by deploy:deploy).
  3. Make sure DNS A records for digistay.vn and www.digistay.vn
     point at this VM's external IP.
  4. From your laptop, first-time cert issuance:
       gcloud compute ssh digistay-vm -- sudo bash /opt/digistay/docker/certbot/init-cert.sh
  5. First-time DB migration:
       gcloud compute ssh digistay-vm -- 'cd /opt/digistay && \
         sudo -u deploy docker compose run --rm app npx prisma migrate deploy'
  6. Bring the stack up:
       gcloud compute ssh digistay-vm -- 'cd /opt/digistay && \
         sudo -u deploy docker compose up -d'

  See docs/DEPLOYMENT.md for the full guide.
============================================================
NEXT