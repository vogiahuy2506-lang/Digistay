# Digistay — Production Deployment Guide

This guide walks you from a brand-new Ubuntu 22.04 GCE VM to a fully
deployed, HTTPS-fronted `digistay.vn` running the Next.js app + Postgres
inside Docker Compose, with a GitHub Actions pipeline that ships every
push to `main` automatically.

```
                ┌──────────────┐
   git push ───►│ GitHub CI    │── build ──► ghcr.io/owner/digistay
                │ (test+tsc)   │
                └──────┬───────┘
                       │ workflow_run
                       ▼
                ┌──────────────┐   SSH         ┌─────────────────┐
                │ GitHub CD    │──────────────►│  GCE VPS Ubuntu │
                │ deploy.yml   │  deploy.sh    │  docker compose │
                └──────────────┘               └─────────────────┘
```

---

## 1. Prerequisites

| Item                                | Detail                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GCE VM                              | Ubuntu 22.04 LTS, e2-medium (or larger). Allow HTTP/HTTPS. Public static IP reserved.                                |
| GCP firewall rule                   | Allow ingress on TCP **80** and **443** to the VM's network tag.                                                      |
| DNS                                 | A records for `digistay.vn` **and** `www.digistay.vn` pointing at the VM's external IPv4. (AAAA optional for IPv6.)     |
| GitHub repo                         | This repo, with `main` as the default branch.                                                       |
| Image registry                      | GHCR is automatic — images go to `ghcr.io/<org-or-user>/digistay`. Make the package **public** or sign in from VPS.   |
| Local tooling                       | `gcloud` CLI, an SSH key you can paste into GitHub secrets.                                                            |

Create the VM (one-liner):

```bash
gcloud compute instances create digistay-vm \
  --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud \
  --machine-type=e2-medium --zone=asia-southeast1-b \
  --tags=http-server,https-server \
  --address=digistay-ip  # reserve a static IP first
```

Open the firewall:

```bash
gcloud compute firewall-rules create digistay-allow-http \
  --allow=tcp:80,tcp:443 --target-tags=http-server,https-server \
  --source-ranges=0.0.0.0/0
```

---

## 2. One-time VPS bootstrap

From your laptop:

```bash
# Copy the bootstrapper onto the VM
gcloud compute scp scripts/setup-vps.sh digistay-vm:/tmp/setup-vps.sh \
  --zone=asia-southeast1-b

# Run it as root
gcloud compute ssh digistay-vm --zone=asia-southeast1-b \
  --command='sudo bash /tmp/setup-vps.sh'
```

What it does:

- Installs Docker Engine + Compose plugin, OpenSSH server, UFW.
- Opens 22, 80, 443; closes everything else.
- Creates a `deploy` user in the `docker` group.
- Clones the repo to `/opt/digistay`.
- Writes a `.env.production` placeholder with a fresh `NEXTAUTH_SECRET`.
- Prints next-step commands.

If you ever need to override the repo URL, export it before invoking:

```bash
REPO_URL=git@github.com:your-org/digistay.git gcloud compute ssh digistay-vm \
  --command='sudo bash /tmp/setup-vps.sh'
```

> **Why two env files?** Compose interpolates `${VAR:?…}` in
> `docker-compose.yml` from the **project root `.env`** at *config
> resolution* time — before it reads `env_file:` from any service. So
> the `postgres` container's `POSTGRES_PASSWORD`, `DATABASE_URL`,
> `DOMAIN`, etc. must live in `/opt/digistay/.env` (git-ignored). The
> `app` service additionally gets `env_file: .env.production` so the
> variables are visible *inside* the running container. The setup
> script seeds both.

---

## 3. GitHub repo secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret             | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| `VPS_HOST`         | VM external IP, e.g. `34.126.xx.yy`.                                          |
| `VPS_USER`         | `deploy` (the user `setup-vps.sh` creates).                                  |
| `VPS_SSH_KEY`      | **Full** PEM-encoded private key (`-----BEGIN OPENSSH PRIVATE KEY-----…`). The matching public key must be in `/home/deploy/.ssh/authorized_keys` on the VM. |

> Generate a dedicated key for deploys — never reuse a personal one.

To install the public key on the VM:

```bash
gcloud compute ssh digistay-vm --command \
  'sudo -u deploy mkdir -p ~/.ssh && echo "ssh-ed25519 AAAA… deploy@digistay-ci" \
   | sudo tee -a /home/deploy/.ssh/authorized_keys \
   && sudo chmod 600 /home/deploy/.ssh/authorized_keys \
   && sudo chown -R deploy:deploy /home/deploy/.ssh'
```

Optional extra secrets (not strictly needed — env lives on the VPS):

| Secret             | Used for                                                |
| ------------------ | ------------------------------------------------------- |
| `NEXTAUTH_SECRET`  | If you want CI to inject it instead of using the VPS file (rare). |

---

## 4. First-time certificate issuance

**Make sure** DNS is live **before** this step (`dig digistay.vn` should return the VM IP, and the same for `www.`).

```bash
gcloud compute ssh digistay-vm --zone=asia-southeast1-b \
  --command='cd /opt/digistay && \
             sudo CERTBOT_EMAIL=you@digistay.vn \
             -u deploy docker compose --profile init run --rm certbot \
               certonly --webroot --webroot-path=/var/www/certbot \
               --email you@digistay.vn --agree-tos --no-eff-email \
               -d digistay.vn -d www.digistay.vn'
```

Or use the helper:

```bash
gcloud compute ssh digistay-vm --command \
  'sudo CERTBOT_EMAIL=you@digistay.vn \
   -u deploy bash /opt/digistay/docker/certbot/init-cert.sh'
```

What it does:

1. Spins up a one-shot certbot container (`profiles: ["init"]` keeps it dormant normally).
2. Writes certs into the `digistay_certbot_conf` named volume.
3. Renders `docker/nginx/conf.d/app-secure.conf` from the template via `envsubst`, substituting `DOMAIN`.
4. Reloads nginx.

Verify:

```bash
curl -I https://digistay.vn/    # expect 200/301/302, never connection-refused
```

To **force renewal** later (certbot auto-renews via the host's certbot.timer if you installed it on the host; otherwise re-running `init-cert.sh` is a no-op once certs exist).

> Tip: install `certbot` on the host (not just in the container) and enable its
> systemd timer to renew automatically. The renewed cert lives in the named
> volume, so nginx still picks it up after a `docker exec nginx nginx -s reload`.

---

## 5. First-time database migration

After the cert is in place and DNS is good, run Prisma migrations once:

```bash
gcloud compute ssh digistay-vm --zone=asia-southeast1-b --command \
  'cd /opt/digistay && \
   sudo -u deploy docker compose up -d postgres && \
   sudo -u deploy docker compose run --rm app node node_modules/prisma/build/index.js migrate deploy && \
   sudo -u deploy docker compose up -d'
```

This brings up `postgres` + `app`, applies migrations against the `postgres`
service, then starts the rest of the stack. The image ships the Prisma CLI at
the lockfile's version; do not use `npx prisma` in the container (it would
download the latest major).

If the database was created earlier with `prisma db push`, `migrate deploy`
stops with `P3005` without touching data: baseline it once as described in
`docs/RUNBOOK.md`, step 8.

Seed data (optional):

```bash
gcloud compute ssh digistay-vm --command \
  'cd /opt/digistay && \
   sudo -u deploy docker compose exec app npx tsx prisma/seed.ts'
```

---

## 6. How CI/CD works

```
push to main
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ CI (ci.yml)                                            │
│   ├─ vitest unit tests                                  │
│   ├─ tsc --noEmit                                       │
│   ├─ migration checks + integration tests (Postgres)    │
│   ├─ eslint (if script exists)                          │
│   └─ docker buildx → ghcr.io/<owner>/digistay:<sha>    │
│                       ghcr.io/<owner>/digistay:latest   │
└─────────────────────────────────────────────────────────┘
    │  workflow_run (only on success, push, branch=main,
    │  and only if that commit is still the tip of main)
    ▼
┌─────────────────────────────────────────────────────────┐
│ CD (deploy.yml) → sudo /usr/local/bin/digistay-deploy.sh <sha>
│   ├─ git checkout <sha> in /opt/digistay                │
│   └─ docker/deploy.sh <sha>                             │
│        1. docker compose pull app (APP_TAG=<sha>)       │
│        2. docker/backup.sh pre-deploy (dump + restore check)
│        3. prisma migrate deploy with the NEW image      │
│           (old app still serving; failure stops here)   │
│        4. docker compose up -d --no-deps app            │
│        5. wait for /api/health to report <sha>;         │
│           otherwise roll back to the previous tag, exit 1
└─────────────────────────────────────────────────────────┘
```

Image tags produced:

- `<sha>` — full 40-character commit SHA, immutable. This is what gets
  deployed; the deployed tag is recorded as `APP_TAG` in `/opt/digistay/.env`.
- `latest` — most recent successful main build (not used by deploys).

Manual rollback to an earlier build: run `sudo /usr/local/bin/digistay-deploy.sh <older-sha>`
on the VPS. Migrations are not reverted, so each migration must work with the
previous release's code (see CLAUDE.md, "Migration"). One-time VPS setup,
backups and restore: `docs/RUNBOOK.md`.

---

## 7. Day-to-day operations

### View logs

```bash
# App + nginx (streamed)
gcloud compute ssh digistay-vm --command \
  'cd /opt/digistay && sudo -u deploy docker compose logs -f --tail=200 app nginx'

# Postgres
gcloud compute ssh digistay-vm --command \
  'cd /opt/digistay && sudo -u deploy docker compose logs -f --tail=200 postgres'
```

### Rollback

Pick the previous SHA from GHCR:

```bash
gcloud compute ssh digistay-vm --command \
  'cd /opt/digistay && \
   sudo -u deploy docker compose pull app:abc1234 && \
   sudo -u deploy docker compose up -d --no-deps app'
```

> `docker image prune -f` only removes dangling layers, so the old
> `:abc1234` image stays around until you manually prune it.

### Update environment variables

1. `ssh` into the VPS, edit `/opt/digistay/.env.production`.
2. Recreate **only** the app:
   ```bash
   sudo -u deploy docker compose up -d --no-deps app
   ```

If you change a Postgres variable, you also need to recreate the postgres
container (data persists in the `digistay_postgres_data` volume).

### Update the deploy key or secrets

```bash
# Regenerate on the VM
gcloud compute ssh digistay-vm --command \
  'sudo -u deploy ssh-keygen -t ed25519 -N "" -f /home/deploy/.ssh/id_ed25519 -C deploy@digistay-ci'

# Paste the new public key into GitHub Secrets → VPS_SSH_KEY (the private half)
```

---

## 8. Troubleshooting checklist

| Symptom                                                | Likely cause / fix                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `curl https://digistay.vn` → connection refused        | DNS not pointing at the VM, or `setup-vps.sh` UFW rule missing. `gcloud compute firewall-rules list`.               |
| `curl -I http://digistay.vn` returns 200, not 301      | The HTTPS config hasn't been rendered yet — run `docker/certbot/init-cert.sh`.                                       |
| `certbot` exits with `Unauthorized` / `Timeout`        | Port 80 not reachable from the internet, or `.well-known/acme-challenge/` blocked. Check `docker compose logs nginx`. |
| App container exits immediately                        | `docker compose logs app` — usually a missing env var in `.env.production`.                                          |
| `prisma migrate deploy` fails with `Can't reach DB`     | Wait for `postgres` healthcheck, then retry. Or `docker compose exec postgres pg_isready -U digistay`.                |
| Deploy SSH step hangs                                  | `VPS_SSH_KEY` secret contains the wrong key or has trailing newline. Re-paste the full PEM block.                    |
| New image pushed but VPS still runs old version        | `docker compose pull` failed silently — check `docker compose logs app`. Usually a private GHCR package with no login. |
| `permission denied` writing volumes                    | First run was as root. `sudo chown -R deploy:deploy /opt/digistay` then retry.                                       |
| `nginx -s reload` fails after cert renewal             | New cert path missing for `www.` subdomain. Re-run `init-cert.sh`.                                                    |
| Build fails on `prisma generate` in Docker             | `package.json` has `postinstall: prisma generate` — `npm ci` already runs it; the Dockerfile calls it explicitly too. |

---

## Appendix: Local "production-like" run

If you want to smoke-test the stack on your laptop (no HTTPS):

```bash
# 1. Render the secure conf to a local-only copy that points at digistay.vn.
DOMAIN=digistay.vn envsubst '$DOMAIN' \
  < docker/nginx/conf.d/app-secure.conf.template \
  > docker/nginx/conf.d/app-secure.conf

# 2. Run it
docker compose up -d

# 3. Hit it on http://localhost (nginx will redirect to https, which fails
#    locally — use a /etc/hosts entry to map digistay.vn to 127.0.0.1 and
#    trust the self-signed local CA instead, OR skip the secure conf in dev).
```

For a true dev loop (hot reload), just keep using `npm run dev` — the
Compose stack is only meant for production-simulation and VPS deploys.