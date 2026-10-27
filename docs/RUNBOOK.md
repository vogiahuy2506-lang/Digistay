# Digistay VPS Deploy — 10 bước thực hiện

> **VM info đã biết:**
> - name: `digistay`
> - zone: `asia-southeast1-c`
> - external IP: `136.85.106.193`
> - user mặc định của GCE: tự sinh theo SSH key bạn đã dùng lúc tạo

> **Domain:** `digistay.vn` (mua ở VNPT/Mắt Bão/Nhân Hòa/iNET)
> **Email cho Let's Encrypt:** một Gmail cá nhân (vd `admin@digistay.vn` nếu đã có,
>   nếu chưa thì Gmail của bạn cũng được — Let's Encrypt không kiểm tra domain
>   trên email, chỉ gửi thông báo tới đó).

---

## Bước 1 — Trỏ DNS về IP VM (làm trên web registrar)

Vào trang quản lý DNS của nhà cung cấp domain, tạo:

| Loại | Tên | Giá trị | TTL |
|---|---|---|---|
| A | `@` | `136.85.106.193` | 300 |
| A | `www` | `136.85.106.193` | 300 |

Đợi 5–30 phút cho DNS lan. Check:
```bash
dig digistay.vn +short
# phải trả về: 136.85.106.193

dig www.digistay.vn +short
# phải trả về: 136.85.106.193
```

> **Không được?** Đợi thêm hoặc kiểm tra nhà cung cấp đã apply chưa. Bước này
> **BẮT BUỘC** xong trước khi cấp SSL.

---

## Bước 2 — Mở firewall cho phép 80/443 trên GCE

Mặc định GCE chặn inbound trừ `http-server`/`https-server` network tags.
Khi tạo VM có thể bạn đã tick rồi, kiểm tra:

```bash
# Chạy trên máy local (cần gcloud) HOẶC dùng Cloud Shell
gcloud compute instances describe digistay \
  --zone=asia-southeast1-c \
  --format='get(tags.items)'
```

Nếu output KHÔNG có `http-server` và `https-server`:
```bash
gcloud compute instances add-tags digistay \
  --zone=asia-southeast1-c \
  --tags=http-server,https-server
```

Mở rule (mặc định `default-allow-http` + `default-allow-https` đã có sẵn trong
project, miễn là instance có tag trên là đủ). Nếu rule bị xóa, tạo lại:
```bash
gcloud compute firewall-rules create digistay-allow-web \
  --direction=INGRESS --action=ALLOW \
  --rules=tcp:80,tcp:443 \
  --target-tags=http-server,https-server \
  --source-ranges=0.0.0.0/0
```

---

## Bước 3 — SSH vào VM, chạy bootstrap

Vì bạn chọn **ssh_direct** (chưa có gcloud local), cách đơn giản nhất là dùng
nút **SSH** trên Google Cloud Console (mở https://console.cloud.google.com/compute/instances
→ click vào VM `digistay` → nút **SSH**). Nó mở terminal thẳng vào VM trên web.

Sau khi vào được VM, chạy:

```bash
# Tạm thời cho phép script tải repo (đổi URL cho đúng nếu cần)
export REPO_URL="https://github.com/vogiahuy2506-lang/Digistay.git"

# Tải script về (hoặc bạn tự paste nội dung từ repo)
curl -fsSL https://raw.githubusercontent.com/vogiahuy2506-lang/Digistay/main/scripts/setup-vps.sh \
  -o /tmp/setup-vps.sh

# Chạy với quyền root
sudo bash /tmp/setup-vps.sh
```

Script sẽ tự:
- Cài Docker
- Mở UFW (22, 80, 443)
- Tạo user `deploy`
- Clone repo về `/opt/digistay`
- Sinh `.env` + `.env.production` với NEXTAUTH_SECRET random

> **Nếu VM tạo user lạ tên `senna`/`admin`/...:** mình vẫn tạo user `deploy`.
> Mọi lệnh deploy sau này sẽ chạy với `deploy`. Bạn có thể đổi tên
> bằng cách `export DEPLOY_USER=yourname` trước khi chạy script.

---

## Bước 4 — Sinh SSH key cho GitHub Actions, copy lên VM

Mục đích: GitHub CI sẽ SSH vào VM với tư cách `deploy` mỗi lần deploy.
Key này KHÁC với key bạn dùng để SSH vào VM (key cá nhân).

Vẫn ở trong SSH session của VM:

```bash
# Sinh key mới (không passphrase, ED25519 hiện đại)
sudo -u deploy ssh-keygen -t ed25519 -N "" \
  -f /home/deploy/.ssh/id_ed25519 \
  -C "deploy@digistay-ci"

# Public key tự add vào authorized_keys luôn
sudo -u deploy bash -c \
  'cat /home/deploy/.ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys'
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh

# In PRIVATE key để copy vào GitHub Secret
sudo cat /home/deploy/.ssh/id_ed25519
# Copy TOÀN BỘ output (gồm cả -----BEGIN... và -----END...)
```

---

## Bước 5 — Thêm GitHub Secrets

Vào https://github.com/vogiahuy2506-lang/Digistay/settings/secrets/actions
→ **New repository secret**, thêm 3 cái:

| Secret name | Value |
|---|---|
| `VPS_HOST` | `136.85.106.193` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | (paste toàn bộ private key từ bước 4) |

> **Lưu ý:** private key phải có cả 2 dòng `-----BEGIN`/`-----END`. Không
> paste kèm khoảng trắng thừa ở đầu/cuối. GitHub tự strip newline trailing
> nên không sao.

---

## Bước 6 — Điền thông tin thật vào `.env` trên VM

Vẫn ở SSH session:

```bash
sudo -u deploy nano /opt/digistay/.env
sudo -u deploy nano /opt/digistay/.env.production
```

Cả 2 file phải **giống hệt nhau**. Sửa các dòng:

```bash
POSTGRES_PASSWORD=<mat-khau-manh-it-nhat-20-ky-tu>
CERTBOT_EMAIL=email-cua-ban@gmail.com

# Cập nhật DATABASE_URL với password giống POSTGRES_PASSWORD
DATABASE_URL=postgresql://digistay:<mat-khau-manh-it-nhat-20-ky-tu>@postgres:5432/digistay?schema=public
```

> **Trong Compose, `${VAR:?…}` được đọc từ `/opt/digistay/.env`** (project root)
> trước, còn file `.env.production` được `env_file:` của service `app` đọc
> lúc runtime. Hai file phải trùng nhau.

Save (Ctrl+O, Enter, Ctrl+X).

---

## Bước 7 — Cấp SSL lần đầu (Let's Encrypt)

Đảm bảo **Bước 1 (DNS) đã xong** trước khi chạy bước này, nếu không
certbot sẽ fail.

```bash
cd /opt/digistay
sudo CERTBOT_EMAIL=email-cua-ban@gmail.com \
    -u deploy bash docker/certbot/init-cert.sh
```

Sẽ mất ~30s. Nếu OK, certs sẽ nằm trong volume
`digistay_certbot_conf` và nginx reload.

Kiểm tra:
```bash
sudo -u deploy docker compose -f /opt/digistay/docker-compose.yml \
    exec nginx ls /etc/letsencrypt/live/digistay.vn/
# phải thấy: fullchain.pem  privkey.pem  chain.pem
```

---

## Bước 8 — Migration database lần đầu

Image production có sẵn Prisma CLI đúng phiên bản trong `package-lock.json`. **Không dùng
`npx prisma`** trong container: image không có lệnh `prisma` nên `npx` sẽ tải bản mới nhất
(khác major) từ internet.

```bash
cd /opt/digistay
sudo -u deploy docker compose up -d postgres
# đợi ~5s cho postgres healthy

sudo -u deploy docker compose run --rm app node node_modules/prisma/build/index.js migrate deploy
```

Nếu fail với "Can't reach database", đợi thêm 5s rồi chạy lại.

### DB đã có bảng từ `prisma db push` (dựng trước khi có `prisma/migrations`)

`migrate deploy` lên DB này dừng với lỗi `P3005 The database schema is not empty` và
không đụng vào dữ liệu. Baseline **một lần**:

```bash
cd /opt/digistay
PRISMA="sudo -u deploy docker compose run --rm app node node_modules/prisma/build/index.js"

# 1. Backup trước khi làm gì
sudo -u deploy docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
  > ~/digistay-before-baseline-$(date +%F).dump

# 2. DB phải khớp schema hiện tại — exit 0 mới được đi tiếp.
#    Khác 0: DỪNG, không baseline, gửi output cho người review.
sudo -u deploy docker compose run --rm app sh -c \
  'node node_modules/prisma/build/index.js migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code'
echo "exit=$?"

# 3. Đánh dấu migration gốc là đã chạy (không chạy SQL nào)
$PRISMA migrate resolve --applied 0_init

# 4. Kiểm tra — phải in "Database schema is up to date!"
$PRISMA migrate status
```

---

## Bước 9 — Bring up toàn bộ stack

```bash
cd /opt/digistay
sudo -u deploy docker compose up -d
# sẽ start: postgres (đã chạy), app, nginx

# Check status
sudo -u deploy docker compose ps
```

Test từ máy local (terminal trên Mac):
```bash
curl -I https://digistay.vn/
# kỳ vọng: HTTP/2 200 hoặc 30x, KHÔNG phải connection refused
```

---

## Bước 10 — Test CI/CD end-to-end

Từ máy local:

```bash
cd "/Users/senna/Code Project/Digistay"
git commit --allow-empty -m "ci: trigger first deploy pipeline"
git push origin main
```

Vào https://github.com/vogiahuy2506-lang/Digistay/actions — bạn sẽ thấy:
- **CI** chạy test + tsc + integration test + build image (mất ~3–5 phút)
- **Deploy to VPS** tự chạy sau khi CI xanh: backup DB, chạy migration, đổi container, chờ
  `/api/health` báo đúng commit (~1 phút). Deploy hỏng thì job **đỏ** và app tự quay về bản trước.

Check trên VM sau khi Deploy xong:
```bash
sudo -u deploy docker compose -f /opt/digistay/docker-compose.yml \
  logs --tail=50 app
```

---

## Deploy an toàn — cài đặt một lần trên VPS đang chạy

Người làm: người có quyền `gcloud` vào VM. Luồng deploy: GitHub Actions →
`sudo /usr/local/bin/digistay-deploy.sh <sha>` → khoá (mỗi lúc một deploy) → checkout đúng commit
đó → `docker/deploy.sh <sha>`: **build image ngay trên VPS** (`digistay-app:<sha>`) → backup →
migration bằng image mới trong khi app cũ vẫn chạy → đổi container → chờ `/api/health` báo đúng
SHA, không đạt thì tự quay về image trước. Không còn kéo image từ GHCR.

Bước nào làm rồi thì bỏ qua. `OWNER` dưới đây là người sở hữu bản checkout (VPS hiện tại:
`hotro_digibook`):

```bash
OWNER="$(stat -c '%U' /opt/digistay/.git)"; echo "$OWNER"
```

**1. `OWNER` đọc được repo private** (lỗi `Host key verification failed` / `Permission denied`).
Thử trước: `sudo -u "$OWNER" git -C /opt/digistay fetch origin main` chạy được, không hỏi gì, thì
sang bước 2. Chưa được thì tạo deploy key cho `OWNER`:

```bash
sudo -u "$OWNER" ssh-keygen -t ed25519 -N '' -C digistay-vps -f ~"$OWNER"/.ssh/github_deploy
sudo cat ~"$OWNER"/.ssh/github_deploy.pub
# → GitHub repo → Settings → Deploy keys → Add (KHÔNG tick "Allow write access")

sudo -u "$OWNER" sh -c 'ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts'
sudo -u "$OWNER" ssh-keygen -lf ~"$OWNER"/.ssh/known_hosts
# So fingerprint với trang "GitHub's SSH key fingerprints" trên docs.github.com — phải khớp.

sudo -u "$OWNER" git -C /opt/digistay config core.sshCommand \
  "ssh -i ~$OWNER/.ssh/github_deploy -o IdentitiesOnly=yes"
sudo -u "$OWNER" git -C /opt/digistay remote set-url origin git@github.com:vogiahuy2506-lang/Digistay.git
sudo -u "$OWNER" git -C /opt/digistay fetch origin main   # phải chạy được, không hỏi gì
```

**2. Cài script deploy** (thay script đang có ở `/usr/local/bin`, kể cả bản viết tay trên VPS):

```bash
sudo -u "$OWNER" git -C /opt/digistay checkout --detach origin/main
sudo install -m 0755 -o root -g root \
  /opt/digistay/docker/vps/digistay-deploy.sh /usr/local/bin/digistay-deploy.sh
```

Sửa `docker/vps/digistay-deploy.sh` thì phải chạy lại lệnh `install` này.

**3. Đo DB production trước lần deploy đầu** (deploy sẽ chạy migration):

```bash
cd /opt/digistay
sudo docker compose run --rm --no-deps app node node_modules/prisma/build/index.js migrate status
sudo docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
```

- `\dt` in `Did not find any relations.`: DB trống, sang bước 4 — migration sẽ tạo toàn bộ bảng.
- `migrate status` in `Database schema is up to date!`: đã migrate rồi, sang bước 4.
- `\dt` có bảng nhưng `migrate status` báo chưa áp dụng migration nào: DB dựng bằng `db push`.
  **Dừng**, làm "Bước 8 → DB đã có bảng từ `prisma db push`" trước (deploy sẽ fail `P3005`).

**4. Deploy:** GitHub → Actions → **Deploy to VPS** → **Run workflow**, hoặc trên VPS
`sudo /usr/local/bin/digistay-deploy.sh <sha của main>`. Kiểm tra:

```bash
sudo docker exec digistay-app wget -qO- http://127.0.0.1:3000/api/health
# {"status":"ok","version":"<sha của main>"}
```

Luật khi vận hành:
- Deploy tay **chỉ** qua `sudo /usr/local/bin/digistay-deploy.sh <sha>`: script giữ khoá, deploy
  thứ hai lúc đang có deploy sẽ dừng ngay ("another deploy is running"). Đừng chạy
  `docker compose build/up app` tay cùng lúc: 20/10/2026 hai lệnh chồng nhau làm deploy hỏng
  ("removal of container ... is already in progress").
- `APP_TAG` trong `/opt/digistay/.env` do `docker/deploy.sh` tự ghi — không sửa tay. Image
  `digistay-app:<sha>` của bản đang chạy và bản trước được giữ lại để quay về; `digistay-app:latest`
  là image dựng trước khi có tag theo commit (lần deploy đầu quay về nó nếu bản mới hỏng).
- Không cần `docker login ghcr.io` nữa; biến `GHCR_OWNER` không còn dùng.

---

## Backup & khôi phục

`docker/backup.sh` chạy mỗi đêm 03:00 (giờ VN) và trước mỗi lần deploy: `pg_dump`, **khôi
phục thử** vào DB tạm để chắc bản dump dùng được, giữ 14 ngày ở `/var/backups/digistay`, và
(bản hằng đêm) chép lên Google Cloud Storage.

### Cài đặt một lần

**1. Bucket GCS và service account riêng cho VM** (chạy trên máy có `gcloud`):

```bash
PROJECT_ID=$(gcloud config get-value project)
ZONE=asia-southeast1-c
BUCKET=gs://digistay-db-backups-$PROJECT_ID

gcloud storage buckets create "$BUCKET" --location=asia-southeast1 \
  --uniform-bucket-level-access --public-access-prevention
echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > /tmp/lifecycle.json
gcloud storage buckets update "$BUCKET" --lifecycle-file=/tmp/lifecycle.json   # tự xoá sau 30 ngày

# Service account riêng: chỉ được TẠO object trong bucket này — không đọc, không xoá được,
# nên VPS có bị chiếm cũng không xoá được backup. (Service account mặc định của GCE có quyền
# Editor cả project — đừng dùng nó.)
gcloud iam service-accounts create digistay-vm --display-name="Digistay VM"
SA=digistay-vm@$PROJECT_ID.iam.gserviceaccount.com
gcloud storage buckets add-iam-policy-binding "$BUCKET" \
  --member="serviceAccount:$SA" --role=roles/storage.objectCreator
```

Gắn service account vào VM **cần tắt VM vài phút**. Trước đó, chắc chắn IP ngoài là IP tĩnh,
nếu không tắt/bật sẽ đổi IP và DNS trỏ sai:

```bash
gcloud compute instances describe digistay --zone=$ZONE \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
gcloud compute addresses list --filter="address=<IP vừa in>"   # trống = IP tạm → giữ lại:
gcloud compute addresses create digistay-ip --region=asia-southeast1 --addresses=<IP vừa in>

gcloud compute instances stop digistay --zone=$ZONE
gcloud compute instances set-service-account digistay --zone=$ZONE \
  --service-account="$SA" --scopes=cloud-platform
gcloud compute instances start digistay --zone=$ZONE
```

**2. Trên VM:**

```bash
sudo mkdir -p /etc/digistay
echo "BACKUP_GCS_BUCKET=gs://digistay-db-backups-<PROJECT_ID>" | sudo tee /etc/digistay/backup.env
sudo chmod 600 /etc/digistay/backup.env

sudo cp /opt/digistay/docker/systemd/digistay-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now digistay-backup.timer

sudo systemctl start digistay-backup.service        # chạy thử ngay
sudo journalctl -u digistay-backup -n 20 --no-pager # phải có "restore check OK" và "uploading"
systemctl list-timers digistay-backup.timer         # lần chạy kế tiếp
```

### Khôi phục

Đã diễn tập với Postgres 16. Khôi phục vào DB **mới** trước, kiểm tra, rồi mới đổi tên — DB
hỏng được giữ lại để điều tra.

```bash
cd /opt/digistay
ls -lt /var/backups/digistay/ | head          # hoặc lấy từ GCS:
# gcloud storage ls gs://digistay-db-backups-<PROJECT_ID>/
# gcloud storage cp gs://digistay-db-backups-<PROJECT_ID>/<file>.dump /tmp/
DUMP=/var/backups/digistay/<file>.dump

sudo docker compose stop app                  # không ai ghi vào DB trong lúc khôi phục
sudo docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" digistay_restored'
sudo docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d digistay_restored --no-owner --exit-on-error' < "$DUMP"
# Kiểm tra vài bảng trong digistay_restored, rồi đổi tên:
sudo docker compose exec -T postgres psql -U digistay -d postgres \
  -c 'ALTER DATABASE digistay RENAME TO digistay_before_restore'
sudo docker compose exec -T postgres psql -U digistay -d postgres \
  -c 'ALTER DATABASE digistay_restored RENAME TO digistay'
sudo docker compose up -d app
sudo docker exec digistay-app wget -qO- http://127.0.0.1:3000/api/health
```

---

## Khoá mã hoá dữ liệu

Secret lưu trong DB (secret 2FA của người dùng, khoá thanh toán của từng khách sạn, tài khoản
hoá đơn điện tử) được mã hoá bằng `DATA_ENCRYPTION_KEYS` (`src/lib/security/secret-box.ts`).
**Bắt buộc từ Phần 4f:** thiếu hoặc sai định dạng thì `/api/health` báo lỗi và deploy quay về
bản cũ, nên phải đặt khoá **trước** khi merge 4f. Backup chỉ chứa bản đã mã hoá, nên:

- **Mất khoá** thì backup không cứu được các giá trị đó: người bật 2FA không đăng nhập được
  cho tới khi được đặt lại 2FA, mọi khách sạn phải nhập lại khoá thanh toán.
- **Lộ khoá cùng với DB hoặc một bản backup** thì coi như lộ hết các khoá bên thứ ba.

Vì vậy khoá nằm ở đúng hai nơi: `.env.production` trên VPS, và trình quản lý mật khẩu
(Bitwarden/1Password) của **hai người**. Không để trong bucket backup, không gửi qua chat
hay email, không commit.

### Cài đặt một lần

```bash
cd /opt/digistay
sudo grep -c '^DATA_ENCRYPTION_KEYS=' .env.production   # phải là 0
printf '\nDATA_ENCRYPTION_KEYS=1:%s\n' "$(openssl rand -base64 32)" \
  | sudo tee -a .env.production >/dev/null
sudo grep -c '^DATA_ENCRYPTION_KEYS=' .env.production   # phải là 1: hai dòng thì máy lấy dòng cuối
sudo sed -n 's/^DATA_ENCRYPTION_KEYS=1://p' .env.production | base64 -d | wc -c   # phải là 32
```

Chép giá trị (`sudo grep '^DATA_ENCRYPTION_KEYS=' .env.production`) vào trình quản lý mật
khẩu của hai người. Khoá có hiệu lực từ lần deploy kế tiếp. Sau deploy,
`curl -s https://digistay.vn/api/health` phải có `"status":"ok"`. Khoá sai định dạng làm
health trả 503 và deploy thất bại; xem lý do (log không in khoá):
`sudo docker logs digistay-app 2>&1 | grep -m1 DATA_ENCRYPTION_KEYS`.

### Đổi khoá (định kỳ, hoặc khi nghi lộ)

1. Tạo khoá mới với **mã mới** và đặt **lên đầu**, giữ khoá cũ phía sau:
   `DATA_ENCRYPTION_KEYS=2:<khoá mới>,1:<khoá cũ>`. Cập nhật cả hai bản sao.
2. Deploy. Giá trị mới mã hoá bằng khoá 2; giá trị cũ vẫn giải mã bằng khoá 1.
3. Mã hoá lại dữ liệu cũ bằng script (có từ Phần 5, khi đã có bảng lưu khoá).
4. Chỉ khi script báo không còn giá trị nào dùng khoá 1 mới bỏ `,1:<khoá cũ>` và deploy lại.
   Bỏ sớm hơn thì các giá trị đó không giải mã được nữa.

Không bao giờ dùng lại một mã khoá cho khoá khác. Nghi lộ khoá: làm như trên, **và** nhờ các
khách sạn tạo lại khoá ở nhà cung cấp, vì ai có DB cũ và khoá cũ vẫn đọc được giá trị cũ.

---

## Đối soát PayOS định kỳ

Timer `digistay-reconcile` cứ 10 phút chạy `docker/systemd/scheduled-jobs.sh`, gọi hai việc bên
trong container app (cần header `CRON_SECRET`; nginx không mở `/api/internal/` ra ngoài):

- `/api/internal/payos-reconcile`: webhook của PayOS có thể bị lỡ, ví dụ khi site đang deploy
  hoặc PayOS thử lại vài lần rồi bỏ. Việc này hỏi PayOS về các link đang chờ trong 3 ngày gần
  nhất, rồi ghi nhận kết quả giống hệt webhook (chạy lặp cũng không ghi hai lần).
- `/api/internal/einvoice-jobs`: tự xuất hoá đơn cho đơn đã trả đủ (khách sạn nào bật), phát hành
  lại hoá đơn tự động chưa rõ kết quả, và gửi email hoá đơn còn chờ (xem "Hoá đơn tự động và
  email" bên dưới).
- `/api/internal/purge-deleted`: xoá hẳn cơ sở / workspace đã bị xoá quá 30 ngày (xem "Xoá cơ sở
  và workspace" bên dưới).

### Cài đặt một lần

```bash
cd /opt/digistay
sudo grep -c '^CRON_SECRET=' .env.production   # phải là 0
printf '\nCRON_SECRET=%s\n' "$(openssl rand -hex 32)" | sudo tee -a .env.production >/dev/null
# Có hiệu lực từ lần deploy kế tiếp (container app đọc .env.production lúc khởi động).

sudo cp docker/systemd/digistay-reconcile.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now digistay-reconcile.timer
sudo systemctl start digistay-reconcile.service          # chạy thử ngay
sudo journalctl -u digistay-reconcile -n 5 --no-pager    # hai dòng {"success":true,...}
```

Đã cài bản cũ (chỉ đối soát PayOS)? Chép lại hai file unit như trên rồi `daemon-reload`.

Log của app có dòng `[payos] reconcile {...}` và `[einvoice] jobs {...}` sau mỗi lượt. Nếu thấy `paid without a webhook`
nghĩa là webhook của khách sạn đó đang lỡ: kiểm tra URL webhook trong PayOS (bấm "Đổi khoá" ở
trang Tài khoản ngân hàng để đăng ký lại).

PayOS là cổng thanh toán duy nhất: khách trả cọc online bằng chuyển khoản / VietQR, app không có
thanh toán thẻ online. Khách quẹt thẻ ở quầy thì nhân viên ghi khoản thanh toán bằng tay (phương
thức "Thẻ nội địa" / "Thẻ quốc tế") ở trang Thanh toán.

### Hoá đơn tự động và email

- **Email hoá đơn**: hoá đơn vừa phát hành được gửi cho người mua, đính kèm PDF lấy từ Mắt Bão
  (email công ty nếu là hoá đơn công ty). Cần SMTP (`EMAIL_SERVER_*` trong `.env.production`);
  chưa cấu hình thì hoá đơn hiện "Gửi email lỗi: Máy chủ chưa cấu hình gửi email". Lỗi được thử
  lại sau 10 phút, 30 phút, 2 giờ, 6 giờ rồi dừng; nhân viên bấm "Gửi lại email" bất cứ lúc nào.
  Khách sạn tắt được việc gửi trong thẻ Mắt Bão ở trang Hoá đơn.
- **Tự xuất hoá đơn** (mặc định tắt, owner/ADMIN bật trong thẻ Mắt Bão): đơn **thanh toán đủ** kể
  từ lúc bật, chưa có hoá đơn nào, được xuất một hoá đơn bằng tổng tiền đơn. Người mua là công ty
  khách nhập khi đặt phòng (`vatCompany`, `vatTaxCode`...), không có thì là khách. Thông tin công ty
  không hợp lệ thì hoá đơn nằm ở "Chờ phát hành" kèm lý do, chờ nhân viên sửa. Mỗi đơn chỉ một lần:
  đơn đã có hoá đơn (kể cả đã huỷ) thì để nhân viên lo; đơn trả thêm sau đó (gia hạn) thì nhân viên
  lập điều chỉnh tăng.
- Kiểm tra: `docker logs digistay-app --since 1h | grep '\[einvoice\]'`.

---

## Giám sát và cảnh báo

**`/api/health`** trả 200 `{"status":"ok","version":"<sha>","redis":"ok"}` khi app chạy được:
DB trả lời, khoá mã hoá hợp lệ, và **DB đã có mọi migration của bản đang chạy**. Thiếu migration
(ví dụ DB trống) thì trả 503 và log ghi tên migration thiếu, nên `docker/deploy.sh` sẽ quay về
bản trước. Redis chết chỉ hiện `"redis":"down"`, không làm health đỏ.

**Kiểm tra từ bên ngoài** (cài một lần): tạo monitor HTTP miễn phí (UptimeRobot, Better Stack…)
cho `https://digistay.vn/api/health`, 5 phút/lần, báo khi mã khác 200 hoặc nội dung không có
`"status":"ok"`. Đây là thứ duy nhất báo được khi chính app hoặc VPS chết.

**Email cảnh báo** (`src/lib/ops/alerts.ts`): job `ops-alerts` chạy cuối mỗi lượt 10 phút của
`scheduled-jobs.sh`, gửi cho `ALERT_EMAILS` (trong `.env.production`, cách nhau dấu phẩy) hoặc
mọi user `SUPER_ADMIN`. Cần SMTP. Một vấn đề được gửi một lần, nhắc lại mỗi 6 giờ (nghiêm trọng)
hoặc 24 giờ (cảnh báo) tới khi hết; có mục mới thì gửi ngay.

| Cảnh báo | Mức | Xử lý |
|---|---|---|
| Job `payos-reconcile` / `einvoice-jobs` / `purge-deleted` / `backup` lỗi hoặc chạy dở quá 1 giờ | cảnh báo (backup: nghiêm trọng) | `journalctl -u digistay-reconcile` hoặc `-u digistay-backup`; log app (`[deletion] purge of …`) |
| Chưa có / quá 30 giờ không có backup hằng ngày | nghiêm trọng | "Backup & khôi phục" |
| Backup chỉ nằm trên VPS | cảnh báo | đặt `BACKUP_GCS_BUCKET` |
| Hoá đơn điện tử kẹt (`PUBLISHING` > 10 phút, chưa rõ kết quả > 1 giờ) | nghiêm trọng | mở hoá đơn, bấm phát hành lại (Mắt Bão trả 304, không xuất trùng) |
| Email hoá đơn đã thử hết lần | cảnh báo | kiểm SMTP, bấm "Gửi lại email" |
| PayOS về sai số tiền | nghiêm trọng | khoản đó **không** được ghi nhận: liên hệ khách, hoàn hoặc ghi tay |
| PayOS trả vào link đã huỷ/hết hạn hay đơn đã đóng | cảnh báo | đã ghi nhận; nhân viên quyết hoàn hay giữ |
| PayOS chỉ được ghi nhận nhờ đối soát | cảnh báo | webhook của khách sạn đó hỏng: "Đổi khoá" ở trang Tài khoản ngân hàng |
| Mua gói: tiền về sai số tiền (`plan_amount_mismatch`) | nghiêm trọng | gói **không** được áp dụng: mở đơn ở `/admin/orders`, liên hệ khách, hoàn tiền hoặc cho mua lại |
| Mua gói: tiền về đơn đã huỷ/hết hạn (`plan_paid_late`) | cảnh báo | đã áp dụng cho gói; `/admin/orders` lọc "Chưa xem": kiểm khách có trả trùng không, hoàn nếu cần, rồi "Đánh dấu đã xem" (hết cảnh báo) |
| Mua gói chỉ được ghi nhận nhờ hỏi lại PayOS (`plan_missed_webhook`) | cảnh báo | job đối soát mới thấy tiền, webhook PayOS của Digistay không tới: kiểm và đăng ký lại (mục "Bán gói", lệnh `confirm-webhook`). Trang thanh toán của khách và nút "Hỏi lại PayOS" ở `/admin/orders` hỏi trước webhook thì không tính |

Lịch sử chạy job nằm ở bảng `job_runs` (giữ 30 ngày); `backup.sh` cũng ghi vào đó.

**Trang quản trị** (`/admin`, chỉ user `SUPER_ADMIN`, kiểm trong DB; người khác thấy trang 404):

- **Khách hàng** (`/admin/customers`): mỗi workspace đang dùng gói gì, hết hạn khi nào, dùng bao
  nhiêu so với gói. Trong một workspace: **Đổi gói / gia hạn** (tặng gói, kéo dài dùng thử, bù ngày
  sự cố; không tạo đơn, không thu tiền, bắt buộc ghi lý do). Tab Tài khoản: **khoá / mở khoá** tài
  khoản (không đăng nhập được bằng cách nào, mọi phiên bị đăng xuất; workspace họ sở hữu vẫn chạy
  cho nhân viên) và **đặt lại 2FA** (mục "Đặt lại xác thực hai lớp"). Không thao tác được trên tài
  khoản `SUPER_ADMIN`.
- **Đơn hàng gói** (`/admin/orders`): mọi lần mua gói, doanh thu, huỷ đơn đang chờ, hỏi lại PayOS,
  và các đơn **trả sau khi huỷ / hết hạn** (đã áp vào gói, cần người xem rồi bấm "Đánh dấu đã xem"
  kèm ghi chú). Không hoàn tiền: ca hiếm phải trả lại tiền thì chuyển khoản tay rồi ghi vào ghi chú.
- **Nhật ký** (`/admin/activity`): mọi thao tác trên Digistay (ai, ở workspace/cơ sở nào, lúc nào),
  lọc theo người, workspace, mã đặt phòng, loại thao tác, ngày. Trả lời "ai đã xoá đặt phòng này"
  ở đây thay vì SQL.
- **Hệ thống** (`/admin/system`): tình trạng (phiên bản, migration, Redis), vấn đề hiện tại theo
  các luật cảnh báo, từng job (lần chạy gần nhất, lỗi 24 giờ), hàng đợi email, cảnh báo đã gửi.

Mọi thao tác ở đây được ghi vào Nhật ký kèm email người làm. Cấp quyền:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "UPDATE users SET role = '"'"'SUPER_ADMIN'"'"' WHERE email = '"'"'ban@digistay.vn'"'"'"'
```

Link "Trang quản trị" hiện ở trang Tài khoản của tôi (`/profile`), cạnh nhãn Super Admin.

Email xác nhận đặt phòng, báo đơn mới cho chủ và lời mời đi qua hàng đợi `email_outbox` (nội dung
mã hoá): gửi ngay sau request, lỗi thì job `email-outbox` thử lại sau 10 phút, 30 phút, 2 giờ,
6 giờ; hết lượt thì có cảnh báo "email đã thử hết số lần". Email đã gửi được xoá sau 30 ngày.

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT job, status, \"startedAt\", error FROM job_runs ORDER BY \"startedAt\" DESC LIMIT 20"'
```

---

## Xoá cơ sở và workspace (khôi phục trong 30 ngày)

Chủ sở hữu workspace xoá một cơ sở (thẻ "Vùng nguy hiểm" ở trang cơ sở) hoặc cả workspace (Cài đặt
→ Bảo mật), sau khi gõ đúng tên. Không xoá được khi còn khách đang ở hoặc đơn sắp tới chưa huỷ (và,
với workspace, khi đang có link thanh toán gói chưa hết hạn). Khoá gói không chặn việc xoá.

- Xoá là **xoá mềm** (`deletedAt`): mọi truy vấn qua `prisma` bỏ qua cơ sở / workspace đã xoá và mọi
  thứ của chúng (`src/lib/db/soft-delete.ts`), nên chúng biến mất ngay khỏi bảng điều khiển, website,
  tên miền riêng, quyền truy cập và các job. Subdomain, slug và tên miền riêng vẫn bị giữ.
- 30 ngày khôi phục: "Đã xoá gần đây" ở trang chủ workspace (cơ sở) và `/workspaces` (workspace).
  Khôi phục cơ sở phải còn chỗ trong gói (số cơ sở, số phòng). Gói của workspace không bị đụng tới:
  thời gian còn lại không hoàn tiền, khôi phục thì ngày hết hạn giữ nguyên.
- Sau 30 ngày, job `purge-deleted` (cùng lượt 10 phút) xoá hẳn: đơn, thanh toán, hoá đơn, hạng phòng,
  ảnh, website… Ảnh trên Cloudinary không bị xoá. Hoá đơn điện tử đã phát hành vẫn còn ở Mắt Bão.

Những gì đang chờ bị xoá hẳn (cột `deletedAt` + 30 ngày là lúc job xoá):

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT id, name, \"deletedAt\" FROM properties WHERE \"deletedAt\" IS NOT NULL ORDER BY \"deletedAt\""'
```

---

## Bật Cloudflare proxy (đám mây cam)

DNS của digistay.vn nằm ở Cloudflare. Kế hoạch từ 26/10/2026: **chỉ `*` (subdomain khách sạn) bật
proxy**, theo mục "SSL tên miền con qua Cloudflare". `digistay.vn`, `www`, `domains` và tên miền riêng
của khách sạn vẫn **DNS only** (mây xám).

IP thật của khách: `docker/nginx/conf.d/cloudflare-real-ip.inc`, include ở **mọi** server block, lấy IP
từ `CF-Connecting-IP` **chỉ** khi kết nối đến từ dải IP của Cloudflare; kết nối khác giữ địa chỉ của
chính nó, nên không ai tự chọn được IP bằng header. Không có file này, mọi khách đi qua Cloudflare sẽ
mang IP của Cloudflare và giới hạn số lần thử/khoá tài khoản sẽ khoá nhầm cả đám đông.
`scripts/nginx-config.test.mjs` chặn `set_real_ip_from` ở bất kỳ chỗ nào khác.

Bật proxy cho `digistay.vn` và `www` là việc **sau**, chưa làm. Trước khi bật phải kiểm:
- Chứng chỉ Let's Encrypt của `digistay.vn` gia hạn qua **HTTP (webroot)**, không phải DNS-01 như mục
  này từng ghi. Bật proxy xong chạy `sudo bash docker/certbot/renew.sh --dry-run`; lỗi thì tắt proxy lại.
- Webhook PayOS / Mắt Bão gọi `digistay.vn`: Bot Fight Mode, WAF hay Under Attack không được chặn chúng.
- Bản ghi A của khách sạn lấy IP của `domains.digistay.vn` khi đã đặt `CUSTOM_DOMAIN_CNAME_TARGET`; chưa
  đặt thì lấy IP của `digistay.vn`, tức IP của Cloudflare: sai.
- Chế độ SSL đã là Full (strict) và chứng chỉ Let's Encrypt hợp lệ, nên phần chứng chỉ không phải đổi.

**Không** chặn cổng 80/443 với IP ngoài dải Cloudflare ở firewall: các tên DNS only ở trên đi thẳng tới VPS.

Dải IP Cloudflare đổi rất hiếm. Kiểm trên máy dev (mỗi quý, hoặc khi Cloudflare thông báo):
`bash docker/nginx/update-cloudflare-ips.sh --check`. Báo khác thì chạy lại không có `--check`, xem
diff, commit, deploy (deploy reload nginx). Thiếu một dải thì mọi khách đi qua dải đó bị tính chung một
IP của Cloudflare.

---

## Kiểm thử trình duyệt (e2e)

Workflow `E2E` (`.github/workflows/e2e.yml`) chạy Playwright mỗi đêm lúc 03:00 trên `main`, với bản
build production; PayOS, Mắt Bão và SMTP là bản giả (`e2e/fakes.ts`). Kịch bản ở `e2e/specs/`:
đăng nhập, xác thực hai lớp, PayOS (kết nối → link → webhook → tiền cọc), hoá đơn (phát hành → email
kèm PDF → điều chỉnh giảm → tự xuất khi đơn trả đủ), trang Hệ thống, và vài kiểm tra cơ bản (health,
404 thay vì 500). Đỏ thì tải artifact `playwright-report` trong lần chạy đó (có trace và ảnh).
Chạy cho một nhánh: Actions → E2E → Run workflow.

Chạy trên máy (cần Postgres và Redis; database **phải** tên `*_e2e` vì mọi bảng bị xoá):

```bash
docker exec digistay-test-pg psql -U postgres -c "CREATE DATABASE digistay_e2e"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/digistay_e2e" REDIS_URL=redis://127.0.0.1:6379
npx prisma migrate deploy
npm run build && npm run e2e:prepare
npx playwright install chromium   # một lần
npm run e2e
```

---

## Gia hạn chứng chỉ HTTPS

Chứng chỉ Let's Encrypt chỉ có hạn 90 ngày. Trước đây **không có gì tự gia hạn**: dịch vụ
`certbot` trong compose chỉ chạy `sleep`. Timer `digistay-cert-renew` chạy
`docker/certbot/renew.sh` mỗi ngày; certbot chỉ gia hạn khi chứng chỉ còn dưới 30 ngày, rồi
script reload nginx.

### Cài đặt một lần

```bash
cd /opt/digistay
sudo docker run --rm -v digistay_certbot_conf:/etc/letsencrypt certbot/dns-cloudflare:v5.8.0 certificates
#   → xem "Expiry Date" của chứng chỉ hiện tại
sudo bash docker/certbot/renew.sh --dry-run    # thử với máy chủ staging, không đổi gì

sudo cp docker/systemd/digistay-cert-renew.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now digistay-cert-renew.timer
systemctl list-timers digistay-cert-renew.timer
```

Nếu VPS đã có cron gia hạn riêng (ngoài repo) thì bỏ cron đó, để không chạy hai nơi.

- Chứng chỉ **Origin CA** của `*.digistay.vn` (mục "SSL tên miền con qua Cloudflare") **không** gia
  hạn: hạn 15 năm. Ghi ngày hết hạn (`notAfter` in ra lúc cài) vào lịch; trước hạn tạo cái mới trên
  Cloudflare và chạy lại khối lệnh cài.
- nginx đọc chứng chỉ tên miền riêng và chứng chỉ Origin CA theo từng lượt bắt tay, bằng tiến trình
  worker (user `nginx`, nhóm 101), không phải root; certbot để `live/`, `archive/` và khoá riêng chỉ root
  đọc được. Vì vậy `renew.sh` và `custom-domains.sh` chạy `docker/certbot/nginx-readable.sh` sau khi
  gia hạn/cấp (cho nhóm 101 đọc khoá). Log nginx có `cannot load certificate ... Permission denied` thì
  chạy tay: `sudo bash docker/certbot/nginx-readable.sh`.

---

## Lưu ảnh (Cloudinary)

Ảnh tải lên trong dashboard (ảnh cơ sở, ảnh loại phòng, ảnh bìa website, ảnh món, logo, ảnh đại
diện) lưu ở Cloudinary, **dùng chung tài khoản với UKNOW**, trong thư mục riêng `digistay/`
(`digistay/<workspace>/<property>`, `digistay/<workspace>`, `digistay/users/<user>` — server chọn,
không phải trình duyệt). Chưa có 3 biến `CLOUDINARY_*` trong `.env.production` (hoặc còn giá trị mẫu
`CHANGE_ME` / `PASTE_…`) thì nút tải ảnh báo "Chưa cấu hình nơi lưu ảnh"; dán link ảnh vẫn dùng được.

- Trình duyệt thu nhỏ ảnh còn tối đa 2400px trước khi gửi (`src/lib/media/upload-client.ts`). Server
  nhận JPG, PNG, WebP, GIF, AVIF (không SVG), tối đa 10 MB, kiểm cả byte đầu file, rồi ký request
  bằng API secret (`src/lib/cloudinary`). Chủ, admin và quản lý mới tải được; 120 ảnh/giờ mỗi người.
- Website xin Cloudinary đúng cỡ đang hiện (`f_auto,q_auto,c_limit,w_…`, `src/lib/media/image-url.ts`),
  5 cỡ cố định mỗi ảnh cho đỡ tốn lượt biến đổi. Ảnh thêm bằng link giữ nguyên.
- Xoá ảnh trong Digistay **không** xoá file trên Cloudinary (link đó có thể vẫn là ảnh bìa hay ảnh món).
- Dung lượng, băng thông và lượt biến đổi tính chung với UKNOW: xem Cloudinary Console → Usage.

**Cài trên VPS (một lần).** Khối lệnh hỏi lần lượt 3 giá trị (lấy ở Cloudinary Console của tài khoản
UKNOW → Settings → API Keys, hoặc trong file `.env` của UKNOW), ghi vào `.env.production` (giữ bản sao
`.env.production.bak-…`), khởi động lại app và in `set`/`MISSING` cho từng biến (không in giá trị):

```bash
{
cd /opt/digistay
read -r -p "CLOUDINARY_CLOUD_NAME: " CN
read -r -p "CLOUDINARY_API_KEY: " CK
read -r -s -p "CLOUDINARY_API_SECRET: " CS; echo
sudo cp -p .env.production ".env.production.bak-$(date +%Y%m%d%H%M%S)"
( umask 077
  sudo grep -vE '^CLOUDINARY_(CLOUD_NAME|API_KEY|API_SECRET)=' .env.production > /tmp/digistay-env.new
  printf 'CLOUDINARY_CLOUD_NAME=%s\nCLOUDINARY_API_KEY=%s\nCLOUDINARY_API_SECRET=%s\n' "$CN" "$CK" "$CS" >> /tmp/digistay-env.new
  sudo sh -c 'cat /tmp/digistay-env.new > /opt/digistay/.env.production'
  rm -f /tmp/digistay-env.new )
unset CN CK CS
sudo docker compose up -d --no-deps --no-build --force-recreate app
sleep 25
sudo docker compose exec -T app node -e 'for (const k of ["CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET"]) { const v = process.env[k] || ""; console.log(k, v && v !== "CHANGE_ME" && v.indexOf("PASTE_") === -1 ? "set" : "MISSING") }'
curl -fsS https://digistay.vn/api/health; echo
}
```

`cat … >` ghi đè nội dung mà giữ nguyên chủ sở hữu và quyền của file. Mã `node -e` nằm trong nháy
đơn: trong nháy kép, bash tương tác coi `!` là lệnh lịch sử ("event not found") và bỏ cả dòng. Chỉ `.env.production` cần
các biến này (`env_file:` của service `app`; `docker-compose.yml` không đọc chúng).

## Đăng nhập bằng Google

Nút "Tiếp tục với Google" (Đăng nhập) và "Đăng ký bằng Google" (Đăng ký) chỉ hiện khi app có đủ
`GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` (`src/lib/auth/google.ts`, đọc mỗi lần tải trang). Lần đầu
đăng nhập bằng Google, tài khoản tự được tạo theo email Google; email đã có tài khoản thì gắn vào
tài khoản đó.

**Tạo OAuth client (một lần)** ở https://console.cloud.google.com/apis/credentials:

1. Create credentials → OAuth client ID → Application type: **Web application**.
2. Authorized JavaScript origins: `https://digistay.vn`
3. Authorized redirect URIs: `https://digistay.vn/api/auth/callback/google`
4. Nếu chưa có OAuth consent screen: User type **External**, tên app "Digistay", email hỗ trợ; ở
   Publishing status bấm **Publish app** (để ở Testing thì chỉ email trong danh sách test mới vào được).

**Cài trên VPS.** Khối lệnh hỏi Client ID và Client secret, ghi vào `.env.production` (giữ bản sao
`.env.production.bak-…`), khởi động lại app và in `set`/`MISSING` (không in giá trị):

```bash
{
cd /opt/digistay
read -r -p "GOOGLE_CLIENT_ID: " GI
read -r -s -p "GOOGLE_CLIENT_SECRET: " GS; echo
sudo cp -p .env.production ".env.production.bak-$(date +%Y%m%d%H%M%S)"
( umask 077
  sudo grep -vE '^GOOGLE_CLIENT_(ID|SECRET)=' .env.production > /tmp/digistay-env.new
  printf 'GOOGLE_CLIENT_ID=%s\nGOOGLE_CLIENT_SECRET=%s\n' "$GI" "$GS" >> /tmp/digistay-env.new
  sudo sh -c 'cat /tmp/digistay-env.new > /opt/digistay/.env.production'
  rm -f /tmp/digistay-env.new )
unset GI GS
sudo docker compose up -d --no-deps --no-build --force-recreate app
sleep 25
sudo docker compose exec -T app node -e 'for (const k of ["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"]) { const v = process.env[k] || ""; console.log(k, v && v !== "CHANGE_ME" && v.indexOf("PASTE_") === -1 ? "set" : "MISSING") }'
curl -fsS https://digistay.vn/api/health; echo
}
```

Thử: mở https://digistay.vn/login trong cửa sổ ẩn danh, bấm "Tiếp tục với Google". Về lại trang đăng
nhập với `?error=OAuthSignin` là thiếu biến; Google báo `redirect_uri_mismatch` là thiếu redirect URI ở
bước 3.

---

## Bán gói (PayOS của Digistay)

Khách sạn mua gói ở **Gói & thanh toán** (`/workspace/<slug>/billing`): mã VietQR trên chính trang đó,
tiền vào **tài khoản PayOS của Digistay** (khác với PayOS của từng khách sạn). Code: `src/lib/billing`.
Quy tắc (chốt 26–27/10/2026, giống Founder AI, `src/lib/billing/period.ts` `planChange`): workspace mới
dùng thử 14 ngày gói Growth; không tính chênh lệch, không hoàn tiền.
- **Nâng gói** (gói đắt hơn, hoặc tháng → năm): hiệu lực ngay, kỳ mới từ lúc trả, ngày còn lại của
  gói cũ bỏ (trang hỏi xác nhận, nói rõ số ngày).
- **Hạ gói**: trả trước, gói mới bắt đầu đúng ngày gói hiện tại hết hạn (`Subscription.next*`); một
  lệnh hẹn một lúc; năm → tháng bị chặn khi gói năm còn ≥ 30 ngày.
- **Gia hạn cùng gói**: mở trong 7 ngày cuối (gói năm: 30 ngày), kỳ mới nối tiếp ngày hết hạn.
- Hết hạn 7 ngày thì workspace chỉ còn xem và website ngừng nhận đặt phòng online cho tới khi trả tiền.

Giá và giới hạn: `src/lib/marketing/plans.ts` (đang là **giá test** 2.000/5.000/10.000 ₫ một tháng).
Job `subscription-jobs` (10 phút/lần) bật gói đã hẹn khi tới ngày, gửi email nhắc trước 30 ngày (gói
năm), 7 ngày, 1 ngày, khi hết hạn và khi khoá, và xuất/gửi lại hoá đơn gói; `payos-reconcile` bắt các
khoản webhook bỏ sót.

**Cài trên VPS (một lần).** Trong PayOS, tạo một **kênh thanh toán riêng** cho Digistay (không dùng
lại kênh của app khác: bước đăng ký webhook dưới đây sẽ thay webhook của kênh đó). Khối lệnh hỏi 3
khoá của kênh, ghi vào `.env.production` (giữ bản sao), khởi động lại app, đăng ký webhook
`https://digistay.vn/api/webhooks/payos/digistay` với PayOS, rồi in tên tài khoản nhận tiền:

```bash
{
cd /opt/digistay
read -r -p "DIGISTAY_PAYOS_CLIENT_ID: " PI
read -r -s -p "DIGISTAY_PAYOS_API_KEY: " PA; echo
read -r -s -p "DIGISTAY_PAYOS_CHECKSUM_KEY: " PC; echo
sudo cp -p .env.production ".env.production.bak-$(date +%Y%m%d%H%M%S)"
( umask 077
  sudo grep -vE '^DIGISTAY_PAYOS_(CLIENT_ID|API_KEY|CHECKSUM_KEY)=' .env.production > /tmp/digistay-env.new
  printf 'DIGISTAY_PAYOS_CLIENT_ID=%s\nDIGISTAY_PAYOS_API_KEY=%s\nDIGISTAY_PAYOS_CHECKSUM_KEY=%s\n' "$PI" "$PA" "$PC" >> /tmp/digistay-env.new
  sudo sh -c 'cat /tmp/digistay-env.new > /opt/digistay/.env.production'
  rm -f /tmp/digistay-env.new )
unset PI PA PC
sudo docker compose up -d --no-deps --no-build --force-recreate app
sleep 25
sudo docker compose exec -T app sh -c 'wget -q -O- --header "x-cron-secret: $CRON_SECRET" --post-data "" http://127.0.0.1:3000/api/internal/platform-payos/confirm-webhook'; echo
curl -fsS https://digistay.vn/api/health; echo
}
```

Kết quả đúng: `{"success":true,"data":{"webhookUrl":"https://digistay.vn/api/webhooks/payos/digistay",...}}`.
Thử bằng tiền thật: vào Gói & thanh toán của một workspace, chọn Starter theo tháng (2.000 ₫), quét QR;
trong vài giây trang báo "Đã kích hoạt" và email biên nhận gửi tới chủ workspace.

### Hoá đơn gói (Mắt Bão của Digistay)

Mỗi khoản mua gói có một hoá đơn điện tử do **Digistay** xuất, đứng tên MST của Digistay, qua tài
khoản Mắt Bão của Digistay (khác với Mắt Bão của từng khách sạn). Code: `src/lib/billing/einvoice.ts`,
cách làm như Founder AI:
- Khi mua, người trả chọn **Không lấy hoá đơn** (vẫn xuất, ghi "Bán cho người tiêu dùng", không gửi
  email), **Cá nhân** (họ tên + CCCD) hoặc **Công ty** (MST tự điền tên, địa chỉ). Bước này chỉ hiện khi
  đã cài tài khoản dưới đây.
- Tiền về → tạo hoá đơn trong cùng giao dịch, xuất ngay sau khi trả lời PayOS; lỗi tạm thì
  `subscription-jobs` thử lại (2, 10, 30 phút…); Mắt Bão từ chối thì chờ người xử lý ở `/admin/system`
  (mục "Hoá đơn gói": Phát hành lại / Gửi lại email) và có cảnh báo vận hành.
- MaTraCuu = `DSG` + mã đơn PayOS, nên thử lại sau khi timeout không xuất trùng (Mắt Bão trả 304).
- Thuế suất `DIGISTAY_MATBAO_VAT` (mặc định `-1` = không chịu thuế, KCT); giá đã gồm thuế, không cộng
  thêm. Đổi thuế suất là quyết định của kế toán.
- File PDF gửi tới email người trả tiền (Cá nhân/Công ty); chủ workspace tải lại ở Lịch sử thanh toán.

**Cài trên VPS (một lần).** Cần tài khoản Mắt Bão HĐĐT của Digistay, mẫu số và ký hiệu hoá đơn năm
nay. Thử trước với `DEMO` (không tạo hoá đơn thật), bán thật thì chạy lại khối này với `PRODUCTION`.
Khối lệnh hỏi từng giá trị, tạo secret cho webhook, ghi vào `.env.production` (giữ bản sao), khởi động
lại app và in `set`/`MISSING` cùng địa chỉ webhook để gửi bộ phận hỗ trợ Mắt Bão:

```bash
{
cd /opt/digistay
read -r -p "Môi trường Mắt Bão (DEMO hoặc PRODUCTION): " ME
read -r -p "MST của Digistay: " MT
read -r -p "Tên đăng nhập Mắt Bão: " MU
read -r -s -p "Mật khẩu Mắt Bão: " MP; echo
read -r -p "Mẫu số hoá đơn (thường là 1): " MK
read -r -p "Ký hiệu hoá đơn (vd C26TDG): " MS
MW=$(openssl rand -hex 24)
sudo cp -p .env.production ".env.production.bak-$(date +%Y%m%d%H%M%S)"
( umask 077
  sudo grep -vE '^DIGISTAY_MATBAO_(ENV|TAX_CODE|USERNAME|PASSWORD|TEMPLATE|SERIES|VAT|WEBHOOK_SECRET)=' .env.production > /tmp/digistay-env.new
  printf 'DIGISTAY_MATBAO_ENV=%s\nDIGISTAY_MATBAO_TAX_CODE=%s\nDIGISTAY_MATBAO_USERNAME=%s\nDIGISTAY_MATBAO_PASSWORD=%s\nDIGISTAY_MATBAO_TEMPLATE=%s\nDIGISTAY_MATBAO_SERIES=%s\nDIGISTAY_MATBAO_VAT=-1\nDIGISTAY_MATBAO_WEBHOOK_SECRET=%s\n' "$ME" "$MT" "$MU" "$MP" "$MK" "$MS" "$MW" >> /tmp/digistay-env.new
  sudo sh -c 'cat /tmp/digistay-env.new > /opt/digistay/.env.production'
  rm -f /tmp/digistay-env.new )
unset ME MT MU MP MK MS
sudo docker compose up -d --no-deps --no-build --force-recreate app
sleep 25
sudo docker compose exec -T app node -e 'for (const k of ["DIGISTAY_MATBAO_ENV","DIGISTAY_MATBAO_TAX_CODE","DIGISTAY_MATBAO_USERNAME","DIGISTAY_MATBAO_PASSWORD","DIGISTAY_MATBAO_SERIES","DIGISTAY_MATBAO_WEBHOOK_SECRET"]) { const v = process.env[k] || ""; console.log(k, v && v.indexOf("PASTE_") === -1 ? "set" : "MISSING") }'
echo "Webhook gửi Mắt Bão: https://digistay.vn/api/webhooks/matbao/digistay/$MW"
unset MW
curl -fsS https://digistay.vn/api/health; echo
}
```

Thử: mua Starter theo tháng, chọn **Công ty** với một MST thật; sau vài giây Lịch sử thanh toán có
"Số …" (bấm để xem PDF), email kèm PDF tới người trả, và `/admin/system` → "Hoá đơn gói" ghi ISSUED.

---

## Subdomain cho site khách sạn

Site công khai của khách sạn luôn có ở `digistay.vn/<subdomain>`. Địa chỉ `<subdomain>.digistay.vn`:
- **Code:** đã sẵn sàng. `src/middleware.ts` chuyển request sang đúng site; nginx có server block riêng
  cho `*.digistay.vn` (`app-secure.conf.template`); app tự lấy tên miền gốc từ `NEXTAUTH_URL`.
- **Còn thiếu (26/10/2026):** chứng chỉ Cloudflare Origin CA trên VPS và bản ghi DNS `*` bật proxy
  Cloudflare. Làm theo mục "SSL tên miền con qua Cloudflare" ngay dưới. Cách ghi ở đây trước kia
  (chứng chỉ wildcard Let's Encrypt qua DNS-01 bằng API token Cloudflare, bản ghi `*` DNS only) đã bỏ;
  lý do ở mục dưới.

Các tên dành riêng (`www`, `api`, `login`, `domains`...) không bao giờ thành site khách sạn
(`src/lib/subdomains.ts`).

---

## SSL tên miền con qua Cloudflare

Cách chạy:
- Khách mở `<subdomain>.digistay.vn` → **Cloudflare** (bản ghi `*` bật proxy, đám mây cam). Trình duyệt
  thấy chứng chỉ của Cloudflare (Universal SSL: miễn phí, tự gia hạn, phủ `digistay.vn` và
  `*.digistay.vn`).
- Cloudflare gọi VPS bằng HTTPS ở chế độ **Full (strict)**: nginx trình chứng chỉ **Cloudflare Origin CA**
  (`*.digistay.vn` + `digistay.vn`, hạn 15 năm) từ server block `*.digistay.vn` trong
  `docker/nginx/conf.d/app-secure.conf.template`. File nằm trong volume certbot,
  `cloudflare-origin/digistay.vn/{cert,key}.pem`; nginx đọc theo từng lượt bắt tay, nên khi chưa có file
  nginx vẫn chạy và deploy vẫn qua, chỉ subdomain lỗi.
- IP thật của khách: `cloudflare-real-ip.inc` (mục "Bật Cloudflare proxy").
- `digistay.vn` và `www` **không đổi**: DNS only, Let's Encrypt qua HTTP, timer `digistay-cert-renew`.
- Tên miền riêng của khách sạn **không đổi**: DNS only, Let's Encrypt qua HTTP (`custom-domains.sh`).
  Riêng đích CNAME đổi: không còn là `<subdomain>.digistay.vn` (đã đi qua proxy) mà là
  **`domains.digistay.vn`**, bản ghi A **DNS only** về IP của VPS, đặt qua biến
  `CUSTOM_DOMAIN_CNAME_TARGET`. CNAME tới một tên đang bật proxy đưa khách tới Cloudflare, nơi không biết
  tên miền của khách sạn: lỗi 1001, hoặc lỗi **1014 (CNAME Cross-User Banned)** nếu DNS của khách sạn
  cũng ở Cloudflare (tài khoản khác); Let's Encrypt cũng không tới được nginx để cấp chứng chỉ. Bản ghi
  A của tên miền gốc khách sạn lấy IP của `domains.digistay.vn`. Mọi khách sạn trỏ cùng một tên, như
  bản ghi A xưa nay: bản ghi TXT mới là thứ chứng minh tên miền thuộc workspace nào.

**Vì sao Origin CA, không phải Let's Encrypt wildcard (DNS-01).** DNS-01 cần một API token sửa được
DNS của cả zone `digistay.vn` nằm trên VPS: ai chiếm được VPS thì sửa được mọi bản ghi, kể cả email.
Việc gia hạn mỗi 60 ngày phụ thuộc token đó, và cấp lại chứng chỉ `digistay.vn` theo cách ấy kéo luôn
tên miền gốc vào. Origin CA không cần secret nào trên VPS ngoài khoá của chính nó và không phải gia hạn.
Đổi lại: chỉ Cloudflare tin chứng chỉ này, nên `*` phải **luôn bật proxy**; tắt proxy (mây xám) là trình
duyệt báo lỗi chứng chỉ và HSTS `includeSubDomains` không cho bỏ qua. Muốn gỡ thì **xoá** bản ghi
(phần Gỡ bỏ).

**Làm đúng thứ tự:** (1) deploy → (2) Cloudflare: bản ghi `domains` + tạo chứng chỉ → (3) khối lệnh VPS →
(4) Cloudflare: Full (strict), tắt tính năng sửa HTML, rồi mới thêm `*` → (5) kiểm tra. Thêm `*` trước
bước 3 thì subdomain lỗi 526 (VPS chưa có chứng chỉ); trước khi chọn Full (strict) thì có thể lỗi chuyển
hướng vòng tròn. App không bao giờ hướng dẫn CNAME vào một subdomain đã đi qua proxy (IP khác IP của
bản ghi A), nên thứ tự sai không làm hỏng tên miền riêng.

### 1. Deploy

Bản có server block `*.digistay.vn`, `docker/certbot/nginx-readable.sh` và `CUSTOM_DOMAIN_CNAME_TARGET`
phải đang chạy trên VPS (đã merge vào `main`, workflow Deploy xanh). Khối lệnh ở bước 3 tự kiểm.

### 2. Cloudflare (trước khối lệnh VPS)

1. dash.cloudflare.com → zone `digistay.vn` → **DNS → Records → Add record**: Type **A**, Name **`domains`**,
   IPv4 **`136.85.106.193`** (IP của VPS, giống bản ghi `digistay.vn`), Proxy status **DNS only** (mây
   xám), TTL Auto → Save.
2. **SSL/TLS → Origin Server → Create Certificate**: "Generate private key and CSR with Cloudflare",
   Private key type **RSA (2048)**, Hostnames giữ mặc định **`*.digistay.vn`** và **`digistay.vn`**,
   Certificate Validity **15 years** → Create. Key Format **PEM**. **Giữ trang này mở**: Private key chỉ
   hiện một lần. Không gửi khoá qua email/chat; lỡ lộ hay mất thì tạo chứng chỉ mới, chạy lại bước 3, rồi
   Revoke cái cũ ở cùng trang.

### 3. Trên VPS: dán nguyên khối

Khối lệnh: kiểm trước khi đổi gì (bản deploy, `domains.digistay.vn` trỏ đúng IP của VPS, không cơ sở nào
dùng subdomain `domains`; in các tên miền riêng đang gắn, cái nào **KIỂM TRA** thì báo khách sạn trỏ lại);
hỏi chứng chỉ rồi khoá (khoá không hiện trên màn hình) và kiểm: đúng Cloudflare Origin CA, gồm
`*.digistay.vn`, còn hạn, khoá khớp chứng chỉ; ghi vào volume certbot (giữ bản cũ nếu có) và cho nginx
đọc được (`nginx-readable.sh`, sửa luôn chứng chỉ tên miền riêng đã cấp); đặt
`CUSTOM_DOMAIN_CNAME_TARGET=domains.digistay.vn` trong `.env.production` (bản sao
`.env.production.bak-…`) và khởi động lại app; `nginx -t` rồi mới reload; tự kiểm. Có gì sai thì in
**DỪNG** và không làm tiếp.

Khi khối lệnh hỏi: chép **Origin Certificate** trên trang Cloudflare (nút copy), dán, Enter; rồi chép
**Private key**, dán, Enter.

```bash
(
set -u
cd /opt/digistay || exit 1
TARGET=domains.digistay.vn
STAMP="$(date +%Y%m%d%H%M%S)"
TMP="$(mktemp -d)"
trap 'stty echo 2>/dev/null; rm -rf "$TMP"' EXIT
stop() { echo; echo "DỪNG: $*"; echo "Không có gì bị đổi thêm từ chỗ này. Gửi toàn bộ output cho người review."; exit 1; }
# Đọc một khối PEM từ bàn phím: bỏ qua dòng trước -----BEGIN, dừng ở -----END.
read_pem() {
  local line started=0
  : > "$1"
  while IFS= read -r line; do
    line="${line%$'\r'}"
    case "$line" in -----BEGIN*) started=1 ;; esac
    [ "$started" = 1 ] && printf '%s\n' "$line" >> "$1"
    case "$line" in -----END*) [ "$started" = 1 ] && return 0 ;; esac
  done
  return 1
}

echo "== 1/6 Kiểm tra trước (chưa đổi gì)"
sudo grep -q 'server_name \*\.digistay\.vn;' docker/nginx/conf.d/app-secure.conf && [ -f docker/certbot/nginx-readable.sh ] \
  || stop "VPS chưa chạy bản có block *.digistay.vn: deploy bản mới trước (bước 1)"
VPS_IP="$(getent ahostsv4 digistay.vn | awk 'NR==1{print $1}')"
TARGET_IP="$(getent ahostsv4 "$TARGET" | awk 'NR==1{print $1}')"
echo "digistay.vn -> ${VPS_IP:-?}    $TARGET -> ${TARGET_IP:-?}"
[ -n "$TARGET_IP" ] && [ "$TARGET_IP" = "$VPS_IP" ] \
  || stop "$TARGET chưa trỏ về IP của VPS (bước 2.1: bản ghi A, DNS only), hoặc DNS chưa cập nhật: đợi 5 phút rồi chạy lại"
USED="$(sudo docker compose exec -T postgres psql -U digistay -d digistay -tAc "SELECT count(*) FROM properties WHERE lower(subdomain) = 'domains'")" \
  || stop "không đọc được database"
[ "$USED" = 0 ] || stop "đã có cơ sở dùng subdomain 'domains'"
echo "Tên miền riêng đang gắn (sau khi bật proxy cho *, chỉ tên trỏ thẳng về VPS mới chạy):"
sudo docker compose exec -T postgres psql -U digistay -d digistay -tAc \
  "SELECT \"customDomain\" FROM website_settings WHERE \"customDomain\" IS NOT NULL AND \"domainVerificationStatus\" = 'verified' ORDER BY 1" \
  | while read -r d; do
      [ -n "$d" ] || continue
      ip="$(getent ahostsv4 "$d" | awk 'NR==1{print $1}')"
      if [ "$ip" = "$VPS_IP" ]; then echo "  OK        $d"; else echo "  KIỂM TRA  $d -> ${ip:-không phân giải được} (báo khách sạn trỏ CNAME về $TARGET hoặc A về $VPS_IP)"; fi
    done

echo "== 2/6 Chứng chỉ Origin CA (dán từ trang Cloudflare, bước 2.2)"
echo "Dán Origin Certificate (cả dòng -----BEGIN CERTIFICATE----- và -----END CERTIFICATE-----) rồi Enter:"
read_pem "$TMP/cert.pem" || stop "không đọc được chứng chỉ"
echo "Dán Private key (KHÔNG hiện trên màn hình, cả dòng BEGIN và END) rồi Enter:"
stty -echo 2>/dev/null
read_pem "$TMP/key.pem"; rc=$?
stty echo 2>/dev/null; echo
[ "$rc" = 0 ] || stop "không đọc được khoá"
openssl x509 -in "$TMP/cert.pem" -noout -subject -issuer -enddate || stop "chứng chỉ hỏng (dán thiếu dòng?)"
openssl x509 -in "$TMP/cert.pem" -noout -issuer | grep -qi 'CloudFlare Origin' || stop "đây không phải chứng chỉ Cloudflare Origin CA"
openssl x509 -in "$TMP/cert.pem" -noout -checkhost kiem-tra.digistay.vn | grep -q 'does match' || stop "chứng chỉ không gồm *.digistay.vn"
openssl x509 -in "$TMP/cert.pem" -noout -checkend 2592000 >/dev/null || stop "chứng chỉ đã hoặc sắp hết hạn"
[ "$(openssl x509 -in "$TMP/cert.pem" -noout -pubkey | openssl sha256)" = "$(openssl pkey -in "$TMP/key.pem" -pubout | openssl sha256)" ] \
  || stop "khoá không khớp chứng chỉ (dán nhầm khoá?)"
echo "Chứng chỉ và khoá hợp lệ, khớp nhau."

echo "== 3/6 Ghi vào volume certbot (bản cũ nếu có được giữ lại)"
VOL="$(sudo docker volume inspect -f '{{.Mountpoint}}' digistay_certbot_conf)" || stop "không thấy volume digistay_certbot_conf"
DEST="$VOL/cloudflare-origin/digistay.vn"
if sudo test -e "$DEST"; then sudo cp -a "$DEST" "$DEST.bak-$STAMP" && echo "Bản cũ: $DEST.bak-$STAMP"; fi
sudo install -d -m 755 "$VOL/cloudflare-origin" "$DEST"
sudo install -m 644 "$TMP/cert.pem" "$DEST/cert.pem"
sudo install -m 600 "$TMP/key.pem" "$DEST/key.pem"
# Cho tiến trình worker của nginx (nhóm 101) đọc được khoá; sửa luôn chứng chỉ tên miền riêng.
sudo bash docker/certbot/nginx-readable.sh || stop "nginx-readable.sh lỗi"
sudo ls -l "$DEST"

echo "== 4/6 CUSTOM_DOMAIN_CNAME_TARGET=$TARGET, khởi động lại app"
sudo cp -p .env.production ".env.production.bak-$STAMP"
sudo grep -v '^CUSTOM_DOMAIN_CNAME_TARGET=' .env.production > "$TMP/env.new"
printf 'CUSTOM_DOMAIN_CNAME_TARGET=%s\n' "$TARGET" >> "$TMP/env.new"
sudo sh -c "cat '$TMP/env.new' > /opt/digistay/.env.production"
sudo docker compose up -d --no-deps --no-build --force-recreate app
ok=0
for i in $(seq 1 40); do
  if sudo docker exec digistay-app wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null | grep -q '"status":"ok"'; then ok=1; break; fi
  sleep 3
done
[ "$ok" = 1 ] || stop "app chưa khoẻ sau 2 phút: xem 'sudo docker compose logs --tail 50 app'; bản cũ .env.production.bak-$STAMP"
echo "app đọc được: CUSTOM_DOMAIN_CNAME_TARGET=$(sudo docker exec digistay-app printenv CUSTOM_DOMAIN_CNAME_TARGET)"

echo "== 5/6 nginx -t rồi reload"
sudo docker compose exec -T nginx nginx -t || stop "nginx -t báo lỗi: chưa reload, nginx vẫn chạy cấu hình cũ"
sudo docker compose exec -T nginx nginx -s reload

echo "== 6/6 Kiểm tra trên VPS"
echo "*.digistay.vn (phải là CloudFlare Origin):"
echo | openssl s_client -connect 127.0.0.1:443 -servername kiem-tra.digistay.vn 2>/dev/null | openssl x509 -noout -issuer -enddate
echo "digistay.vn (vẫn là Let's Encrypt):"
echo | openssl s_client -connect 127.0.0.1:443 -servername digistay.vn 2>/dev/null | openssl x509 -noout -issuer -enddate
echo "kiem-tra.digistay.vn qua nginx -> app: HTTP $(curl -sk -o /dev/null -w '%{http_code}' --resolve kiem-tra.digistay.vn:443:127.0.0.1 https://kiem-tra.digistay.vn/) (404 là đúng: không có khách sạn tên này)"
curl -fsS https://digistay.vn/api/health; echo
echo "XONG phần VPS. Tiếp: bước 4 trên Cloudflare."
)
```

Ghi lại ngày `notAfter` của chứng chỉ Origin CA (in ở bước 2/6 và 6/6) vào lịch: không có gì tự gia hạn
nó.

### 4. Cloudflare (sau khối lệnh VPS)

1. **SSL/TLS → Overview → Configure**: chọn **Custom SSL/TLS → Full (strict)** → Save. Chế độ này áp cho
   cả zone nhưng chỉ ảnh hưởng tên bật proxy (lúc này chỉ có `*`). Đừng dùng "Flexible": Cloudflare sẽ
   gọi VPS bằng HTTP và nginx chuyển hướng vòng tròn (ERR_TOO_MANY_REDIRECTS).
2. **SSL/TLS → Edge Certificates**: Universal SSL **Active** (gồm `digistay.vn, *.digistay.vn`);
   **Always Use HTTPS: On**; **Minimum TLS Version: TLS 1.2**; **Automatic HTTPS Rewrites: Off** (nó sửa
   HTML; app đã chỉ dùng https).
3. Tắt các tính năng **sửa HTML** (tìm theo tên bằng ô tìm kiếm của dashboard: Cloudflare hay dời chỗ
   các mục này):
   **Email Address Obfuscation: Off** (thay email trong HTML bằng link `/cdn-cgi/...` và thêm script:
   React thấy HTML khác bản server, bỏ đi vẽ lại, lỗi #418 trên trang có email khách sạn);
   **Rocket Loader: Off**. **Bot Fight Mode: Off**. Không tạo Cache Rule "Cache Everything" cho
   subdomain (giá, phòng trống, trang đặt phòng phải luôn mới).
4. **DNS → Records → Add record**: Type **A**, Name **`*`**, IPv4 **`136.85.106.193`**, Proxy status
   **Proxied** (mây cam), TTL Auto → Save. Bản ghi có tên riêng (`www`, `domains`...) vẫn theo cài đặt
   của chính nó; đừng tạo bản ghi riêng DNS only cho một khách sạn.

### 5. Kiểm tra

Trên **máy của bạn** (Terminal macOS, zsh hay bash đều được), sau bước 4 khoảng 1–2 phút. Khối lệnh hỏi
subdomain của một khách sạn đã xuất bản website (xem ở trang Website khách sạn):

```bash
(
printf 'Subdomain của một khách sạn đã xuất bản website: '; read -r SUB
H="$SUB.digistay.vn"
echo "== Phải thấy HTTP/2 200, server: cloudflare, cf-ray:"
curl -sI "https://$H/" | grep -iE '^(HTTP|server|cf-ray|strict-transport-security)'
echo "== Chứng chỉ trình duyệt thấy: của Cloudflare (Google Trust Services, Let's Encrypt hoặc SSL.com), KHÔNG phải 'CloudFlare Origin':"
echo | openssl s_client -connect "$H:443" -servername "$H" 2>/dev/null | openssl x509 -noout -issuer -subject
echo "== IP của bạn theo Cloudflare:"
curl -s "https://$H/cdn-cgi/trace" | grep '^ip='
curl -s -o /dev/null -A digistay-ip-check "https://$H/"
echo "Giờ chạy lệnh xem log trên VPS: dòng digistay-ip-check phải bắt đầu bằng đúng IP này."
)
```

Trên **VPS** (IP thật của khách tới được nginx và app; app nhận nó qua `X-Real-IP`):

```bash
sudo docker compose -f /opt/digistay/docker-compose.yml logs --since 15m nginx | grep digistay-ip-check
```

Dòng log bắt đầu bằng IP của bạn (không phải `104.16…`, `172.64…`, `162.158…` hay dải nào của
Cloudflare). Mở thêm subdomain trên điện thoại (4G) cho chắc: hiện trang khách sạn, ổ khoá hợp lệ.

Lỗi thường gặp:
- **526** (Invalid SSL certificate): VPS chưa có chứng chỉ Origin CA hoặc sai → xem lại bước 3, dòng 6/6.
- **525** (SSL handshake failed): nginx không đọc được khoá. `sudo docker compose -f /opt/digistay/docker-compose.yml logs --tail 50 nginx | grep 'cannot load'`;
  có `Permission denied` thì `cd /opt/digistay && sudo bash docker/certbot/nginx-readable.sh`.
- **ERR_TOO_MANY_REDIRECTS**: SSL đang Flexible → Full (strict).
- **521/522**: VPS hay nginx không trả lời (giống như khi không có Cloudflare).
- Khách sạn báo **1014** hay **1001** trên tên miền riêng: CNAME của họ trỏ vào `<subdomain>.digistay.vn`
  (đã đi qua proxy). Trỏ lại về `domains.digistay.vn`; DNS của họ ở Cloudflare thì để bản ghi đó **DNS
  only** (trang Tên miền riêng đã ghi), rồi bấm Kiểm tra lại.

### Lưu ý và rủi ro

- `*` phải luôn **Proxied** (Origin CA chỉ Cloudflare tin). Gỡ thì xoá bản ghi, không chuyển sang DNS only.
- Giới hạn của Cloudflare (gói Free) cho subdomain: request tối đa **100 MB** (nginx đã cắt ở 12 MB, ảnh
  tối đa 10 MB; dashboard và tải ảnh nằm ở `digistay.vn`, không qua proxy); chờ origin tối đa **100 giây**
  rồi trả 524 (nginx cắt ở 60 giây trước); WebSocket: app không dùng.
- Cache mặc định của Cloudflare chỉ giữ file tĩnh theo đuôi (`.js`, `.css`, ảnh, font, `.pdf`...) và tôn
  trọng `Cache-Control`; HTML và `/api` không bị cache. `/_next/static/` cache 1 năm là đúng (tên file có
  hash). Không route riêng tư nào có đuôi file tĩnh (PDF hoá đơn là `/api/invoices/<id>/pdf`, cần đăng
  nhập, và cookie đăng nhập chỉ thuộc `digistay.vn`). Đổi hình ảnh trong `public/` mà giữ tên file thì
  Cloudflare có thể giữ bản cũ tới hết hạn: Caching → Configuration → Purge Cache.
- Cloudflare giải mã toàn bộ lưu lượng subdomain (TLS kết thúc ở Cloudflare), kể cả form đặt phòng (tên,
  số điện thoại, email khách). Chính sách bảo mật nên nhắc Cloudflare là đơn vị xử lý.
- Dải IP Cloudflare: kiểm định kỳ (`update-cloudflare-ips.sh --check`, mục "Bật Cloudflare proxy").

### Gỡ bỏ

**Gỡ nhanh, đủ cho mọi sự cố của subdomain:** Cloudflare → DNS → xoá bản ghi `*` (không chuyển sang DNS
only, lý do ở trên). Subdomain trở lại như trước (chưa có); website vẫn ở `digistay.vn/<subdomain>`. Giữ
bản ghi `domains`, chế độ Full (strict) và mọi thứ trên VPS: vô hại, và tên miền riêng đang trỏ về
`domains.digistay.vn` vẫn chạy.

**Gỡ cả phần VPS** (chỉ khi thật cần): bỏ biến `CUSTOM_DOMAIN_CNAME_TARGET` (bản sao
`.env.production.bak-…`), khởi động lại app, cất chứng chỉ Origin CA sang `…disabled-<giờ>`, `nginx -t`
rồi reload, và in các tên miền riêng đang trỏ CNAME về `domains.digistay.vn`: còn tên nào thì **giữ** bản
ghi `domains` trên Cloudflare (xoá thì các site đó mất).

```bash
(
set -u
cd /opt/digistay || exit 1
TARGET=domains.digistay.vn
STAMP="$(date +%Y%m%d%H%M%S)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
stop() { echo; echo "DỪNG: $*"; echo "Gửi toàn bộ output cho người review."; exit 1; }

echo "== 1/4 Bỏ CUSTOM_DOMAIN_CNAME_TARGET (bản sao .env.production.bak-$STAMP), khởi động lại app"
sudo cp -p .env.production ".env.production.bak-$STAMP"
sudo grep -v '^CUSTOM_DOMAIN_CNAME_TARGET=' .env.production > "$TMP/env.new"
sudo sh -c "cat '$TMP/env.new' > /opt/digistay/.env.production"
sudo docker compose up -d --no-deps --no-build --force-recreate app
ok=0
for i in $(seq 1 40); do
  if sudo docker exec digistay-app wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null | grep -q '"status":"ok"'; then ok=1; break; fi
  sleep 3
done
[ "$ok" = 1 ] || stop "app chưa khoẻ sau 2 phút: xem 'sudo docker compose logs --tail 50 app'; bản cũ .env.production.bak-$STAMP"

echo "== 2/4 Cất chứng chỉ Origin CA"
VOL="$(sudo docker volume inspect -f '{{.Mountpoint}}' digistay_certbot_conf)" || stop "không thấy volume digistay_certbot_conf"
DEST="$VOL/cloudflare-origin/digistay.vn"
if sudo test -e "$DEST"; then sudo mv "$DEST" "$DEST.disabled-$STAMP" && echo "Đã cất: $DEST.disabled-$STAMP"; else echo "Không có chứng chỉ Origin CA để cất"; fi

echo "== 3/4 nginx -t rồi reload"
sudo docker compose exec -T nginx nginx -t || stop "nginx -t báo lỗi: chưa reload"
sudo docker compose exec -T nginx nginx -s reload

echo "== 4/4 Tên miền riêng đang trỏ CNAME về $TARGET (còn tên nào thì GIỮ bản ghi domains trên Cloudflare)"
sudo docker compose exec -T postgres psql -U digistay -d digistay -tAc \
  "SELECT \"customDomain\" FROM website_settings WHERE \"customDomain\" IS NOT NULL AND \"domainVerificationStatus\" = 'verified' ORDER BY 1" \
  | while read -r d; do
      [ -n "$d" ] || continue
      [ "$(getent ahostsv4 "$d" | awk 'NR==1{print $3}')" = "$TARGET" ] && echo "  $d"
    done
echo "XONG. Trên Cloudflare: xoá bản ghi * nếu chưa xoá."
)
```

---

## Tên miền riêng của khách sạn

Khách sạn gắn tên miền của mình (vd `www.khachsan.vn`) bằng nút xác minh tên miền
(`POST /api/website/domain/verify`, chỉ ADMIN/MANAGER). Chỉ gắn được khi DNS có đủ hai thứ:
- **Trỏ đúng site:** CNAME `www.khachsan.vn` → `<subdomain của chính site đó>.digistay.vn`. Tên miền
  gốc (`khachsan.vn`) không đặt CNAME được: dùng bản ghi A, mọi địa chỉ phải là IP của `digistay.vn`.
  Khi đã đặt `CUSTOM_DOMAIN_CNAME_TARGET=domains.digistay.vn` (mục "SSL tên miền con qua Cloudflare"):
  CNAME của mọi khách sạn → `domains.digistay.vn` (DNS only), bản ghi A → IP của tên đó; CNAME về
  `<subdomain>.digistay.vn` bị từ chối vì tên đó đi qua proxy Cloudflare (khách sẽ gặp lỗi 1001/1014).
- **Chứng minh chủ sở hữu:** TXT `_digistay-verify.<tên miền>` = `digistay-verify=<mã>`. Mã do app
  tính từ workspace + tên miền (HMAC, khoá dẫn xuất từ `NEXTAUTH_SECRET`); API trả về trong
  `data.records.txt`.

Chỉ CNAME/A là chưa đủ: khách sạn cũ rời đi mà quên xoá DNS thì tên miền vẫn trỏ về Digistay, và
ai cũng gắn được. Đổi `NEXTAUTH_SECRET` làm đổi mọi mã: tên miền đã gắn không bị ảnh hưởng, chỉ lần
gắn mới phải thêm TXT mới. Kiểm thất bại (kể cả DNS lỗi tạm thời) không ghi gì vào DB.

**Phục vụ và HTTPS (tự động):**
- Khách sạn nhập tên miền ở **Website khách sạn → Cài đặt → Tên miền riêng**, thêm các bản ghi
  được hướng dẫn rồi bấm Kiểm tra. Giao diện hướng dẫn bản ghi **A** (về IP của `digistay.vn`, hoặc của
  `domains.digistay.vn` khi đã đặt biến) cho tên miền gốc + TXT, và **CNAME** cho `www.` tới đích CNAME
  (`domains.digistay.vn`, chưa đặt biến thì `<subdomain>.digistay.vn`). CNAME chỉ được đưa ra khi đích
  đó phân giải về đúng IP của bản ghi A (`records.cnameReady`): chưa có DNS thì CNAME qua được bước kiểm
  nhưng không dẫn tới đâu, còn subdomain đi qua proxy Cloudflare (IP khác) thì dẫn tới Cloudflare.
- Khách sạn dùng DNS của Cloudflare phải để các bản ghi này **DNS only** (mây xám; trang Tên miền riêng
  có ghi): bật proxy thì bước kiểm chỉ thấy IP của Cloudflare, và Let's Encrypt có thể không tới được
  nginx. Lỗi **1014 (CNAME Cross-User Banned)** chỉ xảy ra khi CNAME của họ trỏ vào một tên đang bật
  proxy ở tài khoản Cloudflare khác, tức `<subdomain>.digistay.vn`: trỏ về `domains.digistay.vn` thì hết.
- Xác minh xong, app phục vụ site trên tên miền đó: `src/middleware.ts` hỏi
  `/api/public/site-host` tên miền thuộc site nào (nhớ 60 giây), như với subdomain.
- Chứng chỉ: xác minh xong là vào hàng đợi (`sslRequestedAt`). Timer `digistay-custom-domains` chạy
  `docker/certbot/custom-domains.sh` mỗi phút: hỏi app danh sách (`/api/internal/custom-domains`, có
  `CRON_SECRET`, nginx không mở đường này ra ngoài), xin chứng chỉ Let's Encrypt qua HTTP (cổng 80
  là server mặc định cho mọi tên miền và trả thư mục challenge), rồi báo kết quả về app. nginx
  (`docker/nginx/conf.d/custom-domains.conf`, server mặc định của cổng 443) chọn chứng chỉ theo tên
  trình duyệt hỏi, từ `live/<tên miền>/`. Thất bại thì một giờ sau tự thử lại, hoặc khách sạn bấm
  "Thử lại ngay". `renew.sh` hằng ngày gia hạn cả các chứng chỉ này.
- nginx đọc các chứng chỉ này theo từng lượt bắt tay, bằng tiến trình worker (nhóm 101), mà certbot để
  `live/`, `archive/` và khoá chỉ root đọc được: trước bản sửa ngày 26/10/2026, tên miền riêng lỗi bắt tay
  TLS dù chứng chỉ đã cấp (`cannot load certificate ... Permission denied` trong log nginx; tái hiện với
  nginx:1.31-alpine và volume do certbot tạo, chưa xem trên VPS).
  `custom-domains.sh` và `renew.sh` nay chạy `docker/certbot/nginx-readable.sh` sau khi cấp/gia hạn;
  chứng chỉ cấp trước đó cần chạy tay một lần: `cd /opt/digistay && sudo bash docker/certbot/nginx-readable.sh`
  (khối lệnh của mục "SSL tên miền con qua Cloudflare" đã gồm bước này).
- Header HSTS của tên miền riêng **không** có `includeSubDomains` và chỉ một ngày
  (`security-headers-site.inc`): các subdomain khác của khách sạn không phải của Digistay.

### Cài đặt một lần (sau khi deploy bản có `custom-domains.sh`)

```bash
cd /opt/digistay
sudo docker compose exec -T nginx nginx -t
sudo cp docker/systemd/digistay-custom-domains.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now digistay-custom-domains.timer
systemctl list-timers digistay-custom-domains.timer
```

Email nhận thông báo hết hạn của Let's Encrypt (tuỳ chọn; không có thì dùng lại tài khoản certbot đã
tạo lúc cấp chứng chỉ đầu tiên): `echo 'CERTBOT_EMAIL=<email>' | sudo tee /etc/digistay/custom-domains.env`.
Xem log: `journalctl -u digistay-custom-domains -n 50`. Thử với máy chủ staging của Let's Encrypt:
`sudo CERTBOT_STAGING=1 bash docker/certbot/custom-domains.sh`.

**Trước khi deploy migration `20261021050000_custom_domain_unique`**, đo trên production:
```bash
sudo docker compose exec -T postgres psql -U digistay -d digistay -c \
  "SELECT lower(\"customDomain\"), count(*) FROM website_settings
   WHERE \"customDomain\" IS NOT NULL AND btrim(\"customDomain\") <> ''
   GROUP BY 1 HAVING count(*) > 1;"
```
Phải ra 0 dòng. Có dòng thì DỪNG: chọn site nào giữ tên miền là việc của người, không để migration
chọn (migration sẽ fail nếu trùng đúng chữ).

**Tên miền đang bị site khác giữ (API trả 409).** App không bao giờ tự gỡ khỏi site cũ. Người vận hành:
1. Người yêu cầu thêm bản ghi TXT có trong phản hồi 409 (`data.records.txt`).
2. Kiểm: `dig +short TXT _digistay-verify.<tên miền>` phải ra đúng giá trị đó.
3. Gỡ khỏi site cũ, ghi lại ai yêu cầu và lúc nào:
   ```bash
   sudo docker compose exec -T postgres psql -U digistay -d digistay -c \
     "UPDATE website_settings SET \"customDomain\" = NULL, \"domainVerificationStatus\" = NULL,
      \"domainVerifiedAt\" = NULL, \"sslEnabled\" = false WHERE \"customDomain\" = '<tên miền>';"
   ```
4. Người yêu cầu bấm xác minh lại.

---

## Đặt lại xác thực hai lớp

Xác thực hai lớp (2FA) là **tuỳ chọn**, người dùng tự bật ở Hồ sơ → Bảo mật. Mất điện thoại thì
họ dùng một mã khôi phục để đăng nhập, rồi tự tắt hoặc tạo bộ mã mới. Chỉ khi mất **cả** điện
thoại **lẫn** mã khôi phục mới cần làm mục này.

**Không có đường tự đặt lại qua email, và đừng đặt lại chỉ vì nhận được email hay tin nhắn**:
email là thứ kẻ gian thường chiếm trước, đặt lại theo yêu cầu đó là mở cửa cho họ.

1. Xác minh người yêu cầu đúng là chủ tài khoản: gọi vào số điện thoại đã biết từ trước hoặc
   gọi video, và với nhân viên thì hỏi lại chủ workspace của họ.
2. Đặt lại ở `/admin/customers` → tab **Tài khoản** → tìm email → ⋮ → **Đặt lại 2FA**: chọn đã
   xác minh bằng cách nào và ghi chú (gọi số nào, lúc nào). Nhật ký ghi
   `TWO_FACTOR_RESET_BY_OPERATOR` kèm ai làm và cách xác minh.

   Khi không vào được trang quản trị, chạy script (ghi cùng nhật ký đó):

   ```bash
   cd /opt/digistay
   sudo docker compose exec -T postgres psql -U digistay -d digistay \
     -v email='nguoi@example.com' -v by='<ai làm>' -v via='<xác minh bằng cách nào>' \
     < docker/sql/reset-two-factor.sql
   ```

   Dòng `SELECT` in ra đúng tài khoản đó, rồi `DELETE 1`. In ra 0 dòng và `DELETE 0` nghĩa là
   sai email hoặc tài khoản không bật 2FA.
3. Báo người dùng đăng nhập bằng mật khẩu (hoặc Google), rồi bật lại 2FA nếu muốn.

Người nhập sai mã 5 lần bị khoá nhập mã 15 phút; cái đó tự hết, không cần đặt lại.

---

## Migration fail khi deploy (`P3018`, sau đó `P3009`)

Deploy dừng ở bước 3/5, **trước** khi đổi container: bản cũ vẫn phục vụ. Nhưng Prisma ghi
migration đó là "failed" và **chặn mọi lần deploy sau** (`P3009`) cho tới khi xử lý:

1. Xem log deploy, xác định migration nào fail và nó đã làm được gì (Postgres thường huỷ cả
   câu lệnh lỗi; kiểm tra lại các bảng liên quan). Cần thì khôi phục từ bản
   `pre-deploy-<sha>` trong `/var/backups/digistay`.
2. Đánh dấu nó đã rollback (chạy bằng image đang chạy, không cần file migration):

   ```bash
   cd /opt/digistay
   sudo docker compose run --rm --no-deps app \
     node node_modules/prisma/build/index.js migrate resolve --rolled-back <ten_migration>
   ```

3. Sửa **chính file migration đó** (giữ nguyên tên thư mục) trong một PR, thêm dòng
   `-- fixed-after-failed-deploy: <deploy nào fail, vì sao chưa từng chạy được>`. CI chỉ cho
   sửa migration cũ khi có dòng này; người review phải xác nhận nó chưa chạy thành công ở đâu.
4. Merge → deploy chạy lại migration đã sửa.

---

## Troubleshooting nhanh

| Triệu chứng | Nguyên nhân / fix |
|---|---|
| `curl https://digistay.vn` → connection refused | DNS chưa trỏ, hoặc firewall chặn. Check lại bước 1+2. |
| `certbot` exit Unauthorized | Port 80 chưa mở ra internet, hoặc DNS chưa lan. |
| `prisma migrate deploy` → Can't reach DB | Postgres chưa healthy. `docker compose ps` xem status. |
| `prisma migrate deploy` → `P3005 schema is not empty` | DB dựng bằng `db push`. Baseline theo bước 8. |
| Deploy đỏ ở bước 3/5, `P3018` hoặc `P3009` | Migration fail. Xem mục "Migration fail khi deploy". |
| Deploy đỏ ở bước 5/5 "did not become healthy" | App mới không lên; script đã tự quay về bản trước. Log `[app]` ngay trong job. |
| Deploy đỏ ở bước 1/5 (build image) | Đọc log build ngay trong job. Hết đĩa/RAM: `sudo docker system df`, `sudo docker builder prune`. App cũ vẫn chạy. |
| Deploy đỏ ở bước "Check the installed deploy script" | Script ở `/usr/local/bin/digistay-deploy.sh` không phải bản đã review trong commit này (bản cũ có thể bật code mới mà không chạy migration). Cài lại theo mục "Deploy an toàn", bước 2, rồi chạy lại workflow. |
| Deploy đỏ ngay đầu: `another deploy is running` | Đang có deploy khác (CI hoặc tay). Chờ nó xong rồi chạy lại. |
| Deploy đỏ ngay đầu: `Host key verification failed` | User `deploy` chưa đọc được repo (mục "Deploy an toàn", bước 1). |
| App exit ngay khi start | `docker compose logs app` — thường do sai env var. |
| Deploy SSH step hangs | `VPS_SSH_KEY` paste thiếu newline. Re-paste nguyên cụm. |
| `permission denied` writing volumes | Lần đầu chạy với quyền khác. `sudo chown -R deploy:deploy /opt/digistay` rồi retry. |
