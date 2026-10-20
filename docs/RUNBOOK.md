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

Người làm: người có quyền `gcloud` vào VM. Làm **sau khi** nhánh Phần 3 đã merge vào `main`.
Luồng deploy: GitHub Actions → `sudo /usr/local/bin/digistay-deploy.sh <sha>` (secret
`VPS_DEPLOY_CMD`) → checkout đúng commit đó → `docker/deploy.sh <sha>`.

**1. Cho user `deploy` đọc được repo private** (sửa lỗi `Host key verification failed`):

```bash
sudo -u deploy ssh-keygen -t ed25519 -N '' -C digistay-vps -f /home/deploy/.ssh/github_deploy
sudo cat /home/deploy/.ssh/github_deploy.pub
# → GitHub repo → Settings → Deploy keys → Add (KHÔNG tick "Allow write access")

sudo -u deploy sh -c 'ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts'
sudo -u deploy ssh-keygen -lf /home/deploy/.ssh/known_hosts
# So fingerprint với trang "GitHub's SSH key fingerprints" trên docs.github.com — phải khớp.

sudo -u deploy git -C /opt/digistay config core.sshCommand \
  "ssh -i /home/deploy/.ssh/github_deploy -o IdentitiesOnly=yes"
sudo -u deploy git -C /opt/digistay remote set-url origin git@github.com:vogiahuy2506-lang/Digistay.git
sudo -u deploy git -C /opt/digistay fetch origin main   # phải chạy được, không hỏi gì
```

**2. Cho VPS kéo được image private từ GHCR.** Deploy chạy bằng `sudo`, nên đăng nhập cho
root, bằng một classic token chỉ có quyền `read:packages`:

```bash
sudo docker login ghcr.io -u <github-username>   # dán token khi được hỏi
```

**3. Đưa `/opt/digistay` lên `main` mới, cài script deploy:**

```bash
sudo -u deploy git -C /opt/digistay checkout --detach origin/main
sudo install -m 0755 -o root -g root \
  /opt/digistay/docker/vps/digistay-deploy.sh /usr/local/bin/digistay-deploy.sh
sudo -u deploy docker compose -f /opt/digistay/docker-compose.yml up -d nginx   # nếu nginx chưa chạy
```

`APP_TAG` trong `/opt/digistay/.env` do `docker/deploy.sh` tự ghi — không sửa tay. Biến
`GHCR_OWNER` cũ không còn dùng (mặc định đã là `vogiahuy2506-lang`).

**4. Deploy lần đầu:** GitHub → Actions → **Deploy to VPS** → **Run workflow**. DB production
đang trống nên bước migration sẽ tạo toàn bộ bảng. Kiểm tra:

```bash
sudo docker exec digistay-app wget -qO- http://127.0.0.1:3000/api/health
# {"status":"ok","version":"<sha của main>"}
```

Sửa `docker/vps/digistay-deploy.sh` thì phải chạy lại lệnh `install` ở bước 3.

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
| Deploy đỏ ở bước 1/5 `denied` / `unauthorized` | VPS chưa `docker login ghcr.io` (mục "Deploy an toàn", bước 2). |
| Deploy đỏ ngay đầu: `Host key verification failed` | User `deploy` chưa đọc được repo (mục "Deploy an toàn", bước 1). |
| App exit ngay khi start | `docker compose logs app` — thường do sai env var. |
| Deploy SSH step hangs | `VPS_SSH_KEY` paste thiếu newline. Re-paste nguyên cụm. |
| `permission denied` writing volumes | Lần đầu chạy với quyền khác. `sudo chown -R deploy:deploy /opt/digistay` rồi retry. |
