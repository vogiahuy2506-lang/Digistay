# Deploy recovery — what to read when GitHub Actions says "Deploy to VPS" is red

`Deploy to VPS` (`.github/workflows/deploy.yml`) is broken into four steps.
When it fails, the first red step in the run usually tells you which
group of secrets / VPS state to check. **Read this file top to bottom in
the order the steps run.**

| # | Step name                       | What it covers                                                  |
|---|---------------------------------|-----------------------------------------------------------------|
| 1 | `Resolve the commit to deploy`  | GitHub API; almost never fails unless `permissions` is wrong.   |
| 2 | `Probe SSH + VPS environment`   | SSH key, port, firewall, deploy user, /opt/digistay, `digistay-deploy.sh`. |
| 3 | `Probe GHCR image pull`         | GHCR login on the VPS, image actually pushed by CI.             |
| 4 | `Deploy to VPS`                 | The real deploy. `docker/deploy.sh` on the VPS.                 |
| 5 | `Post-deploy smoke test`        | `/api/health` confirms the new SHA is what answered.            |

If only step 4 (the real deploy) is red, the problem is on the VPS.
Always check step 2 first — it's the one we added to catch 90% of
"secrets are wrong" issues before they get buried inside step 4.

---

## Step 2 red — SSH / VPS basics

**Likely causes, in order:**

1. Wrong `VPS_HOST`, `VPS_PORT`, `VPS_USER`, or `VPS_SSH_KEY` on
   <https://github.com/vogiahuy2506-lang/Digistay/settings/secrets/actions>.
   - The SSH key here is the **private** key (PEM body).
   - The matching **public** key must live in
     `/home/deploy/.ssh/authorized_keys` on the VPS, mode `600`,
     owner `deploy:deploy`.
   - `VPS_USER` must be the SSH login (usually `deploy`); the deploy
     script `sudo`s itself to root, so the SSH user itself doesn't need
     passwordless sudo.

2. UFW / firewall:
   ```
   sudo ufw status
   ```
   Port 22 (or whatever `VPS_PORT` says) must show `ALLOW IN` from
   anywhere (or, if you restricted GitHub's ranges, from
   `192.30.252.0/22`, `185.199.108.0/22`, `140.82.112.0/20`).

3. VPS not bootstrapped yet:
   ```
   sudo bash /path/to/scripts/setup-vps.sh
   ```
   See `docs/RUNBOOK.md` for the full bootstrap recipe.

4. Wrong OS:
   `setup-vps.sh` assumes **Debian-family** (Ubuntu 22.04 by default, but
   Debian 12 also works). On RHEL/Alpine/Arch the package names differ
   and `docker compose` may not be a plugin — install it manually.

5. `deploy` user missing SSH key, **and** the GitHub-side key has been
   rotated — paste the new public key in `/home/deploy/.ssh/authorized_keys`.

---

## Step 3 red — GHCR image pull

**Likely causes:**

1. CI is still building, or its `Build & push image` step was skipped.
   Open the matching `CI` run and confirm the `build-image` job is
   green and has `pushed=true` in its log.

2. The VPS lost its GHCR credentials.
   ```
   sudo cat /root/.docker/config.json
   ```
   On a fresh GCE VM SSHed to as the GitHub runner, this is usually a
   short-lived token; if the workflow did a round-trip it should
   persist. If empty, run on the VPS:
   ```
   sudo docker login ghcr.io -u vogiahuy2506-lang-lang
   ```
   and paste a token from <https://github.com/settings/tokens> with
   `read:packages`.

3. The image was tagged but not pushed (rare on `push` to `main`,
   possible if a fork PR opened a green CI without push access — CI
   detects this and skips `build-image`).

4. `IMAGE_REPO` was overridden in `.env.production` but doesn't match
   the build output. The build tag is
   `ghcr.io/<owner>/digistay`, so keep `IMAGE_REPO` aligned.

---

## Step 4 red — the deploy itself

This step runs `sudo /usr/local/bin/digistay-deploy.sh <sha>`. Almost
all failure modes are inside `docker/deploy.sh` on the VPS.

### 4a. `git fetch` / `git checkout` failed
- The `deploy` user can't read the repo (SSH key in deploy's
  `authorized_keys` doesn't match, or token expired). Re-add the key.
- The repo URL moved and `setup-vps.sh` still has the old one.
  `grep REPO_URL scripts/setup-vps.sh`.

### 4b. `docker compose pull app` timed out or 401/403
Same as step 3b. Authentication is read once per session.

### 4c. Migration step (`node … migrate deploy`) failed
- Read the SQL it printed — `prisma/migrations/<id>/migration.sql`.
  The deploy script does **not** roll migrations back; the previous
  app stays running on the previous image.
- See `CLAUDE.md § Migration`: every migration must work against the
  previous code (back-compat). If you need to fix the failing
  migration, do not edit it — add a follow-up migration.

### 4d. App container won't start
- `sudo docker logs digistay-app --tail 100`.
- Most common: missing env var. `compose.yml` requires
  `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
  `NEXT_PUBLIC_SITE_URL` in `.env.production`.

### 4e. `wait_for_version` timed out (90s default, overridable with
       `HEALTH_TIMEOUT`)
- The new container came up but `GET /api/health` is not 200 with the
  expected `version`. Look at `docker logs digistay-app --tail 100`.
- The deploy script will roll back to the previous image automatically
  if there is one; on a first deploy there's nothing to roll back to.

---

## Step 5 red — smoke test from the host

Means deploy itself succeeded but `/api/health` does not echo the new
SHA from outside the container.
- `sudo -E curl -i http://127.0.0.1/api/health` from the VPS.
- 503 with `status:"error"` → DB connection broken (probably
  `DATABASE_URL` wrong inside the new app).
- Connection refused → nginx isn't routing `/api/*` to the app; check
  `docker/nginx/conf.d/app.conf` (or the `*-secure.conf.template`
  variant if TLS is on).

---

## One-shot diagnostic

Run on the VPS as `deploy` (or via `sudo -u deploy -H`):

```bash
sudo bash -c '
  set -e
  echo "== host ==" ; hostname ; uptime
  echo "== docker ==" ; docker --version ; docker compose version
  echo "== images ==" ; docker image ls | head
  echo "== /opt/digistay ==" ; ls -la /opt/digistay
  echo "== current APP_TAG ==" ; grep "^APP_TAG=" /opt/digistay/.env || echo none
  echo "== health ==" ; curl -fsS http://127.0.0.1/api/health || echo "no response"
  echo "== ghcr login ==" ; docker login --get-password ghcr.io 2>&1 | head -1 || true
'
```

If you copy-paste this into the failing workflow's `ssh` step as the
script body, it shows up under the **Probe SSH + VPS environment**
step log. That's the fastest path to a complete picture when the
workflow alone isn't enough.
