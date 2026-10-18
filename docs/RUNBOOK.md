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
POSTGRES_PASSWORD=MotPassManhVaDai-Nhay-Dai-ItNhat-20-KyTu-Khong-Dau
CERTBOT_EMAIL=email-cua-ban@gmail.com

# Cập nhật DATABASE_URL với password giống POSTGRES_PASSWORD
DATABASE_URL=postgresql://digistay:MotPassManhVaDai-Nhay-Dai-ItNhat-20-KyTu-Khong-Dau@postgres:5432/digistay?schema=public
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

```bash
cd /opt/digistay
sudo -u deploy docker compose up -d postgres
# đợi ~5s cho postgres healthy

sudo -u deploy docker compose run --rm app npx prisma migrate deploy
```

Nếu fail với "Can't reach database", đợi thêm 5s rồi chạy lại.

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
- **CI** chạy test + tsc + build image (mất ~2–4 phút)
- **Deploy** tự fire sau khi CI xanh (mất ~30s để SSH + pull + restart)

Check trên VM sau khi Deploy xong:
```bash
sudo -u deploy docker compose -f /opt/digistay/docker-compose.yml \
  logs --tail=50 app
```

---

## Troubleshooting nhanh

| Triệu chứng | Nguyên nhân / fix |
|---|---|
| `curl https://digistay.vn` → connection refused | DNS chưa trỏ, hoặc firewall chặn. Check lại bước 1+2. |
| `certbot` exit Unauthorized | Port 80 chưa mở ra internet, hoặc DNS chưa lan. |
| `prisma migrate deploy` → Can't reach DB | Postgres chưa healthy. `docker compose ps` xem status. |
| App exit ngay khi start | `docker compose logs app` — thường do sai env var. |
| Deploy SSH step hangs | `VPS_SSH_KEY` paste thiếu newline. Re-paste nguyên cụm. |
| `permission denied` writing volumes | Lần đầu chạy với quyền khác. `sudo chown -R deploy:deploy /opt/digistay` rồi retry. |
