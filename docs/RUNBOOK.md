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
| Job `payos-reconcile` / `einvoice-jobs` / `backup` lỗi hoặc chạy dở quá 1 giờ | cảnh báo (backup: nghiêm trọng) | `journalctl -u digistay-reconcile` hoặc `-u digistay-backup`; log app |
| Chưa có / quá 30 giờ không có backup hằng ngày | nghiêm trọng | "Backup & khôi phục" |
| Backup chỉ nằm trên VPS | cảnh báo | đặt `BACKUP_GCS_BUCKET` |
| Hoá đơn điện tử kẹt (`PUBLISHING` > 10 phút, chưa rõ kết quả > 1 giờ) | nghiêm trọng | mở hoá đơn, bấm phát hành lại (Mắt Bão trả 304, không xuất trùng) |
| Email hoá đơn đã thử hết lần | cảnh báo | kiểm SMTP, bấm "Gửi lại email" |
| PayOS về sai số tiền | nghiêm trọng | khoản đó **không** được ghi nhận: liên hệ khách, hoàn hoặc ghi tay |
| PayOS trả vào link đã huỷ/hết hạn hay đơn đã đóng | cảnh báo | đã ghi nhận; nhân viên quyết hoàn hay giữ |
| PayOS chỉ được ghi nhận nhờ đối soát | cảnh báo | webhook của khách sạn đó hỏng: "Đổi khoá" ở trang Tài khoản ngân hàng |

Lịch sử chạy job nằm ở bảng `job_runs` (giữ 30 ngày); `backup.sh` cũng ghi vào đó.

**Trang Hệ thống** (`/admin/system`, chỉ user `SUPER_ADMIN`; người khác thấy "Không tìm thấy"):
tình trạng (phiên bản, migration, Redis), vấn đề hiện tại theo các luật cảnh báo, từng job (lần
chạy gần nhất, lỗi 24 giờ), hàng đợi email, cảnh báo đã gửi. Cấp quyền:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "UPDATE users SET role = '"'"'SUPER_ADMIN'"'"' WHERE email = '"'"'ban@digistay.vn'"'"'"'
```

Link "Trang Hệ thống" hiện ở trang Tài khoản của tôi (`/profile`), cạnh nhãn Super Admin.

Email xác nhận đặt phòng, báo đơn mới cho chủ và lời mời đi qua hàng đợi `email_outbox` (nội dung
mã hoá): gửi ngay sau request, lỗi thì job `email-outbox` thử lại sau 10 phút, 30 phút, 2 giờ,
6 giờ; hết lượt thì có cảnh báo "email đã thử hết số lần". Email đã gửi được xoá sau 30 ngày.

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT job, status, \"startedAt\", error FROM job_runs ORDER BY \"startedAt\" DESC LIMIT 20"'
```

---

## Bật Cloudflare proxy (đám mây cam)

DNS của digistay.vn nằm ở Cloudflare nhưng **chưa bật proxy** (response không có header `cf-ray`).
Bật proxy thì có chống DDoS, cache file tĩnh ở biên, và giấu IP của VPS. nginx đã sẵn sàng:
`docker/nginx/conf.d/cloudflare-real-ip.inc` lấy IP thật của khách từ `CF-Connecting-IP`, **chỉ**
khi kết nối đến từ dải IP của Cloudflare. Không có file này, mọi khách sẽ mang IP của Cloudflare
và giới hạn số lần thử/khoá tài khoản sẽ khoá nhầm cả đám đông.

1. Deploy bản có file này. Kiểm: `curl -sI https://digistay.vn | grep -i server` vẫn ra nginx.
2. Cloudflare → SSL/TLS: chế độ **Full (strict)** (VPS có chứng chỉ Let's Encrypt hợp lệ). Đừng
   dùng "Flexible": Cloudflare sẽ gọi VPS bằng HTTP và nginx chuyển hướng vòng tròn.
3. Cloudflare → DNS: bật đám mây cam cho `digistay.vn`, `www` và `*` (nếu đã có).
4. Kiểm: `curl -sI https://digistay.vn | grep -i cf-ray` có kết quả; đăng nhập sai vài lần rồi xem
   log app: IP trong cảnh báo là IP thật, không phải `172.64…`/`104.16…`.
5. Gia hạn chứng chỉ dùng DNS-01 qua API Cloudflare nên không bị ảnh hưởng.

Tuỳ chọn, sau khi ổn định: chặn cổng 80/443 với mọi IP ngoài dải Cloudflare (firewall GCE) để
không ai đi vòng qua Cloudflare. Danh sách dải IP đổi rất hiếm; khi Cloudflare thông báo thay đổi:
`bash docker/nginx/update-cloudflare-ips.sh`, xem diff, commit.

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
Quy tắc (chốt 26/10/2026): workspace mới dùng thử 14 ngày gói Growth; mỗi lần thanh toán bắt đầu kỳ
mới từ ngày trả (phần còn lại của kỳ cũ không cộng dồn); hết hạn 7 ngày thì workspace chỉ còn xem và
website ngừng nhận đặt phòng online cho tới khi trả tiền. Giá và giới hạn: `src/lib/marketing/plans.ts`
(đang là **giá test** 2.000/5.000/10.000 ₫ một tháng). Job `subscription-jobs` gửi email nhắc trước
7 ngày, 1 ngày, khi hết hạn và khi khoá; `payos-reconcile` bắt các khoản webhook bỏ sót.

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

---

## Subdomain cho site khách sạn

Site công khai của khách sạn luôn có ở `digistay.vn/<subdomain>`. Phần dưới đây bật thêm địa
chỉ `<subdomain>.digistay.vn`:
- **Code:** đã sẵn sàng. `src/middleware.ts` chuyển request sang đúng site; nginx đã có
  `*.digistay.vn` trong `server_name`; app tự lấy tên miền gốc từ `NEXTAUTH_URL`.
- **Còn thiếu:** chứng chỉ wildcard và bản ghi DNS.

**Làm đúng thứ tự: chứng chỉ trước, DNS sau.** Nếu thêm DNS trước, khách vào subdomain sẽ gặp
lỗi chứng chỉ không thể bỏ qua, vì HSTS đang bật `includeSubDomains`.

1. **API token Cloudflare** (DNS của digistay.vn ở Cloudflare): My Profile → API Tokens →
   Create Token → mẫu "Edit zone DNS", Zone Resources = chỉ `digistay.vn`.
2. **Trên VPS:**

   ```bash
   sudo install -m 600 /dev/null /etc/digistay/cloudflare.ini
   echo 'dns_cloudflare_api_token = <token>' | sudo tee /etc/digistay/cloudflare.ini >/dev/null
   ```

3. **Cấp lại chứng chỉ** cùng tên, gồm cả `*.digistay.vn`. Chạy thử trước bằng `--dry-run`, ổn
   rồi chạy lại không có cờ đó:

   ```bash
   cd /opt/digistay
   sudo docker run --rm -v digistay_certbot_conf:/etc/letsencrypt \
     -v /etc/digistay/cloudflare.ini:/etc/digistay/cloudflare.ini:ro \
     certbot/dns-cloudflare:v5.8.0 certonly --non-interactive --dry-run \
     --dns-cloudflare --dns-cloudflare-credentials /etc/digistay/cloudflare.ini \
     --cert-name digistay.vn -d digistay.vn -d '*.digistay.vn' \
     --email <email> --agree-tos --no-eff-email
   sudo docker compose exec -T nginx nginx -s reload
   ```

   Không ghi thêm `www.digistay.vn`: wildcard đã gồm nó, và Let's Encrypt từ chối tên trùng.
   Từ đó `renew.sh` gia hạn cả chứng chỉ này qua DNS (file `cloudflare.ini` phải còn đó).
4. **DNS trên Cloudflare:** bản ghi `A`, tên `*`, trỏ về IP của VPS, **DNS only** (mây xám). Bật
   proxy (mây cam) sẽ làm hỏng cách lấy IP thật của các giới hạn tần suất.
5. **Kiểm tra:** `curl -sI https://<subdomain của một khách sạn>.digistay.vn` trả `200`. Subdomain
   không tồn tại trả `404`. Các tên dành riêng (`www`, `api`, `login`...) không bao giờ thành site
   khách sạn.

---

## Tên miền riêng của khách sạn

Khách sạn gắn tên miền của mình (vd `www.khachsan.vn`) bằng nút xác minh tên miền
(`POST /api/website/domain/verify`, chỉ ADMIN/MANAGER). Chỉ gắn được khi DNS có đủ hai thứ:
- **Trỏ đúng site:** CNAME `www.khachsan.vn` → `<subdomain của chính site đó>.digistay.vn`. Tên miền
  gốc (`khachsan.vn`) không đặt CNAME được: dùng bản ghi A, mọi địa chỉ phải là IP của `digistay.vn`.
- **Chứng minh chủ sở hữu:** TXT `_digistay-verify.<tên miền>` = `digistay-verify=<mã>`. Mã do app
  tính từ workspace + tên miền (HMAC, khoá dẫn xuất từ `NEXTAUTH_SECRET`); API trả về trong
  `data.records.txt`.

Chỉ CNAME/A là chưa đủ: khách sạn cũ rời đi mà quên xoá DNS thì tên miền vẫn trỏ về Digistay, và
ai cũng gắn được. Đổi `NEXTAUTH_SECRET` làm đổi mọi mã: tên miền đã gắn không bị ảnh hưởng, chỉ lần
gắn mới phải thêm TXT mới. Kiểm thất bại (kể cả DNS lỗi tạm thời) không ghi gì vào DB.

**Phục vụ và HTTPS (tự động):**
- Khách sạn nhập tên miền ở **Website khách sạn → Cài đặt → Tên miền riêng**, thêm các bản ghi
  được hướng dẫn rồi bấm Kiểm tra. Giao diện chỉ hướng dẫn bản ghi **A** (về IP của `digistay.vn`) +
  TXT: CNAME tới `<subdomain>.digistay.vn` chỉ chạy khi `*.digistay.vn` đã có DNS (mục
  "Subdomain cho site khách sạn" ở trên).
- Xác minh xong, app phục vụ site trên tên miền đó: `src/middleware.ts` hỏi
  `/api/public/site-host` tên miền thuộc site nào (nhớ 60 giây), như với subdomain.
- Chứng chỉ: xác minh xong là vào hàng đợi (`sslRequestedAt`). Timer `digistay-custom-domains` chạy
  `docker/certbot/custom-domains.sh` mỗi phút: hỏi app danh sách (`/api/internal/custom-domains`, có
  `CRON_SECRET`, nginx không mở đường này ra ngoài), xin chứng chỉ Let's Encrypt qua HTTP (cổng 80
  là server mặc định cho mọi tên miền và trả thư mục challenge), rồi báo kết quả về app. nginx
  (`docker/nginx/conf.d/custom-domains.conf`, server mặc định của cổng 443) chọn chứng chỉ theo tên
  trình duyệt hỏi, từ `live/<tên miền>/`. Thất bại thì một giờ sau tự thử lại, hoặc khách sạn bấm
  "Thử lại ngay". `renew.sh` hằng ngày gia hạn cả các chứng chỉ này.
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
2. Đặt lại (ghi nhật ký `TWO_FACTOR_RESET_BY_OPERATOR`, kèm ai làm và xác minh bằng cách nào):

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
