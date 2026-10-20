# CLAUDE.md

Hướng dẫn cho Claude Code trong repo Digistay. File này được nạp vào mọi phiên, nên chỉ ghi
điều **không đọc ra được từ code**. Chi tiết dài để ở `docs/`.

## Git — đọc trước khi commit

- **Merge vào `main` là deploy production.** Workflow `Deploy to VPS` chạy ngay sau khi CI xanh
  trên `main` (chỉ commit mới nhất). Không push thẳng `main`; làm trên nhánh
  `feat|fix|chore/<mô-tả>` rồi mở PR. Không merge PR khi CI đỏ, kể cả PR của Dependabot.
- **Chỉ commit file mình tạo hoặc sửa.** Không `git add -A` / `git add .`. Trước mỗi commit:
  `git status --short` và `git diff --cached --stat`. Lý do: `git commit` lấy *toàn bộ*
  staging area, không chỉ file vừa add — repo Founder AI từng kéo 6 file đang làm dở của
  người khác lên `main` theo đúng cách này.
- Nhiều người cùng làm repo: `git fetch` trước khi bắt đầu, `main` trên máy có thể đã cũ.
- Không force-push nhánh đã đẩy; không `git reset --hard` để "dọn" commit của người khác.
  Lỡ đẩy commit sai: hỏi trước, sửa bằng `git revert`.
- Commit message: Conventional Commits bằng tiếng Anh (`feat(scope): ...`, `fix`, `chore`,
  `docs`, `test`, `refactor`). **Không thêm dòng `Co-Authored-By`.**

## Lệnh

```bash
npm run dev            # Next dev server, cổng 3000
npm test               # Vitest unit — mock Prisma, không cần DB
npm run test:int       # integration — Postgres thật, cần DATABASE_URL *_test (xem dưới)
npx tsc --noEmit       # typecheck (CI chạy bước này)
npm run db:migrate -- --name <ten_thay_doi>   # sau khi sửa schema.prisma: tạo migration
npm run db:deploy      # áp migration vào DB local
npm run db:seed
```

Trước khi commit: `npm test` và `npx tsc --noEmit` phải xanh; sửa API chạm DB thì chạy cả
`npm run test:int`.
Chạy một file test: lọc theo tên (`npx vitest run confirm`) — đường dẫn chứa `[id]` không khớp.

Postgres cho integration test (một lần):

```bash
docker run -d --name digistay-test-pg -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:54329:5432 postgres:16-alpine
docker exec digistay-test-pg psql -U postgres -c "CREATE DATABASE digistay_test"
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/digistay_test" npm run test:int
```

## Migration

- Đổi `prisma/schema.prisma` thì **phải** có migration đi kèm (`npm run db:migrate`), commit
  cả hai. CI đỏ nếu schema và `prisma/migrations` lệch nhau.
- **Không sửa, xoá hay đổi tên migration đã có** — có thể nó đã chạy trên production. Cần
  sửa thì tạo migration mới. CI chặn việc này. Ngoại lệ duy nhất: migration đã **fail** khi
  deploy, sửa tại chỗ kèm dòng `-- fixed-after-failed-deploy: <lý do>` (RUNBOOK).
- **Migration phải chạy được với code của bản trước.** Deploy chạy migration trước khi đổi
  container, và khi rollback thì code cũ chạy trên schema mới — migration không được rollback.
  Thêm cột: nullable hoặc có `DEFAULT`, code dùng ở release sau. Xoá/đổi tên cột: ngừng dùng
  trong code ở một release, xoá ở release kế tiếp.
- SQL có thể mất dữ liệu (`DROP`, `RENAME`, đổi kiểu, `SET NOT NULL`, cột `NOT NULL` không
  `DEFAULT`) phải có dòng `-- destructive-ok: <lý do>` trong file, viết sau khi đã kiểm dữ
  liệu production. Thường nên tách: thêm cột nullable → backfill → `SET NOT NULL`.
- Không dùng `prisma db push` với DB dùng chung — nó đổi schema mà không để lại migration.
- Trong container production: `node node_modules/prisma/build/index.js migrate deploy`,
  **không** `npx prisma` (sẽ tải bản major mới nhất). Xem `docs/RUNBOOK.md` bước 8.

## Kiến trúc cần biết

- Next.js 15 App Router (React 19), một app. API ở `src/app/api/**/route.ts`, gọi Prisma trực tiếp.
  `params`/`searchParams` của page, layout và route handler là **Promise**: luôn `await params`
  (server) hoặc `React.use(params)` (client component).
- Multi-tenant: `Workspace` (chủ `ownerId` + `WorkspaceMember` vai trò ADMIN / MANAGER /
  RECEPTIONIST / USER) → nhiều `Property` (khách sạn) → `Booking`, `Payment`...
- `src/middleware.ts` chỉ làm một việc: chuyển `<subdomain>.digistay.vn/...` sang
  `/<subdomain>/...` (site công khai). Nó không đụng tới `/api` và không chặn gì: mỗi route API
  tự kiểm tra đăng nhập, còn `/` là trang giới thiệu.
  - Tên miền gốc lấy từ `ROOT_DOMAIN`, nếu không có thì từ `NEXTAUTH_URL`.
  - Tên subdomain dành riêng nằm ở `src/lib/subdomains.ts`. Thêm route cấp một mới trong
    `src/app` thì thêm tên đó vào danh sách này.
  - Trước 20/10/2026 file nằm ở thư mục gốc nên không bao giờ chạy.
- Biến môi trường khai báo ở `src/lib/env.ts`; thêm biến thì cập nhật cả `.env.example`. Lưu ý:
  chưa file nào import `env.ts`, nên schema zod của nó **không kiểm tra gì lúc chạy** (đo
  19/10/2026); biến nào cần kiểm thật thì kiểm ở nơi dùng (vd `DATA_ENCRYPTION_KEYS` ở
  `secret-box.ts` và `/api/health`).
- Deploy (`docker/deploy.sh`, gọi qua `docker/vps/digistay-deploy.sh` trên VPS): backup →
  migration bằng image mới trong khi app cũ vẫn chạy → đổi container → chờ `/api/health` báo
  đúng SHA; không đạt thì tự quay về bản trước và job đỏ. Vận hành VPS: `docs/RUNBOOK.md`.

## Luật bảo mật cho API

Rút ra từ các lỗ hổng đã sửa (webhook giả, PUT không đăng nhập, API trả dữ liệu của mọi khách
sạn, đặt lại mật khẩu chỉ cần email, email trong phiên do client tự đặt).

1. Mọi route gọi `auth()` hoặc `requireSession()` trước khi đọc DB, trừ route công khai có chủ
   đích. `src/app/api/route-policy.test.ts` bắt buộc điều này: handler nào không gọi hàm kiểm
   tra đăng nhập phải nằm trong `PUBLIC_HANDLERS` kèm lý do, nếu không CI đỏ. Thêm route công
   khai mới = thêm một dòng ở đó để người review thấy.
2. Truy vấn danh sách luôn lọc theo workspace của người dùng:
   `property: { workspace: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] } }`.
   `propertyId` / `bookingId` từ client chỉ được *cộng thêm* vào điều kiện, không thay thế nó.
3. Truy vấn theo id: lấy workspace của bản ghi rồi `getWorkspaceRole` (`src/lib/auth/rbac.ts`).
   Người ngoài workspace → 404 (không lộ id có tồn tại); thiếu vai trò → 403.
4. Thao tác chạm tiền (xác nhận thanh toán, ghi tiền mặt): chỉ `WorkspaceRoles.STAFF_AND_UP`.
   Đổi trạng thái bằng `updateMany` có điều kiện trạng thái cũ, trong `prisma.$transaction`,
   khoá dòng booking (`SELECT ... FOR UPDATE`), và ghi `activityLog`.
5. Webhook thanh toán đang **tắt** (`/api/payments/webhook` trả 404) cho tới Phần 5. Không bật
   lại khi chưa kiểm tra chữ ký.
6. Không tin dữ liệu client gửi vào phiên: callback `jwt` khi `update()` đọc lại từ DB.
   `session.user.email` được dùng để phân quyền (khách của đơn, lời mời).
7. Mã một lần (OTP) và token đặt lại mật khẩu chỉ đi qua `src/lib/auth/otp.ts` (lưu dạng băm,
   theo mục đích, 5 lần thử, dùng một lần). **Không bao giờ ghi mã hay token vào log.**
8. Endpoint công khai hoặc kiểm mật khẩu/mã phải có giới hạn tần suất: dùng
   `src/lib/security/rate-limit.ts`, số liệu tập trung ở `limits.ts`. IP chỉ lấy qua
   `getClientIp()` (tin `X-Real-IP` từ nginx, không đọc `X-Forwarded-For`).
9. Đổi/đặt lại mật khẩu thì gọi `revokeSessions()` (đăng xuất mọi thiết bị).
10. Không commit secret. Chỉ `.env.example`, `.env.*.example`, `.env.production.template` (giá
    trị `CHANGE_ME`) được commit. gitleaks (`.gitleaks.toml`) quét mọi PR và push vào `main`;
    lỡ commit secret thì **đổi secret trước**, rồi mới thêm vào `.gitleaksignore`.

## Test — báo đúng những gì đã kiểm

- Unit test (`*.test.ts`) mock toàn bộ Prisma: chứng minh logic và điều kiện truy vấn,
  **không** chứng minh truy vấn chạy được trên Postgres. Integration test (`*.int.test.ts`)
  dùng Postgres thật, chỉ mock phiên đăng nhập (`vi.mock('@/lib/auth')`) — đây là nơi kiểm
  `$queryRaw`, transaction, khoá dòng và request đồng thời. Ví dụ đã đo: đổi tên bảng trong
  `FOR UPDATE` thì unit test vẫn xanh 16/16, integration test đỏ. Chưa chạy integration thì
  báo cáo phải nói rõ.
- Integration test chỉ chạy với DB tên kết thúc bằng `_test` (mọi bảng bị TRUNCATE giữa các
  test). Dữ liệu tạo bằng `src/test/integration/fixtures.ts`, không dựa vào seed.
- Test chạy đua (`Promise.all` nhiều request): lặp vài vòng — một vòng đơn đôi khi tình cờ
  chạy tuần tự và xanh dù thiếu khoá.
- Sửa logic bảo mật hoặc tiền: gỡ thử chính điều kiện vừa thêm, xác nhận có test đỏ, rồi
  khôi phục. Không có test nào đỏ nghĩa là test chưa bảo vệ điều kiện đó.

## Quy ước code

- Comment và tên test bằng tiếng Anh, khớp code hiện có. Chuỗi hiển thị cho người dùng và
  thông báo lỗi API bằng tiếng Việt.
- Theo pattern có sẵn trong file đang sửa; không thêm tầng hay abstraction mới khi chưa cần.
- Mọi file text dùng LF (`.gitattributes`). Script `.sh` chạy trên VPS — CRLF làm deploy hỏng.
- Bộ tối ưu ảnh của Next đang **tắt** (`images.unoptimized`), để server không phải giải mã ảnh lạ
  (lỗ hổng RCE AVIF chỉ được vá từ Next 15.5.24; đang dùng 15.5.28). Muốn bật lại thì chỉ với
  `remotePatterns` liệt kê đúng host của mình, không bao giờ `**`; có test chặn.
- Chứng chỉ HTTPS gia hạn bằng timer `digistay-cert-renew` (RUNBOOK). Trước đó không có gì
  gia hạn.
- `/workspace-picker/*` luôn chuyển về `/workspaces`: layout của nó nằm trên `[slug]` nên không
  bao giờ nhận được `slug` (có từ trước, Next 15 mới lộ ra khi kiểm kiểu). Dọn hay sửa là quyết
  định sản phẩm; trang lời mời đang trỏ tới đó.
- Header bảo mật nằm ở nginx: `docker/nginx/conf.d/security-headers.inc`, include ở server
  và ở mọi `location` có `add_header` riêng. Sửa `app-secure.conf.template`, không sửa file
  sinh ra — `docker/deploy.sh` sinh lại và reload nginx mỗi lần deploy.
- Khoá bên thứ ba lưu trong DB (khoá thanh toán, tài khoản hoá đơn, secret 2FA) **luôn** qua
  `src/lib/security/secret-box.ts`: `encryptSecret(giá trị, secretContext(bảng, id, cột))`.
  Chưa cấu hình thì lưu `null`. Không bao giờ trả giá trị đã giải mã ra trình duyệt: trả
  `maskSecret()`, ô nhập để trống nghĩa là giữ nguyên. Khoá mã hoá: RUNBOOK, "Khoá mã hoá dữ liệu".
- Không lưu token OAuth: chỉ dùng Google để đăng nhập (`src/lib/auth/adapter.ts`).
- **Thanh toán:** mọi chỗ ghi nhận tiền hoặc đổi số tiền phải trả của một đơn đều gọi
  `lockBooking()` rồi `syncBookingPayments()` (`src/lib/payments/booking-payments.ts`) trong cùng
  transaction. Hàm này tính `depositAmount` (= tổng đã trả) và `paymentStatus` từ các khoản `PAID`.
  Đừng tự đặt `paymentStatus: 'PAID'`: các nhánh tiền mặt cũ làm vậy, khiến cọc 200k báo là trả đủ.
- **PayOS** (`src/lib/payments/payos.ts`): mỗi khách sạn tự gắn tài khoản PayOS của mình, tiền vào
  thẳng tài khoản khách sạn. Mỗi khách sạn có một URL webhook riêng
  (`/api/webhooks/payos/<propertyId>`), chữ ký được kiểm bằng khoá của đúng khách sạn đó. Chuyển
  sang `PAID` chỉ qua một UPDATE có điều kiện (webhook, đối soát hay nhân viên: ai tới trước
  thắng), và số tiền phải khớp đúng. Tiền về cho link đã huỷ/hết hạn vẫn được ghi nhận và gắn cờ;
  khoản `REFUNDED` không bao giờ sống lại. Return URL không bao giờ đánh dấu đã trả.
  `PAYOS_BASE_URL` chỉ dùng cho test (PayOS giả ở `src/test/integration/fake-payos.ts`).
  Đối soát định kỳ: timer systemd `digistay-reconcile`, 10 phút một lần, gọi
  `/api/internal/payos-reconcile` (RUNBOOK, "Đối soát PayOS định kỳ").
- Job định kỳ nằm ở `/api/internal/*`: cần header `CRON_SECRET`, nginx không mở ra ngoài, và
  timer systemd gọi từ bên trong container app.
- **Hoá đơn điện tử** (`src/lib/einvoice/`): mỗi khách sạn tự gắn tài khoản Mắt Bão của mình,
  hoá đơn xuất dưới mã số thuế của khách sạn.
  - **Giá phòng đã gồm VAT**: tổng hoá đơn = số khách trả; chưa thuế và thuế được tách ra bằng
    `splitGross`. Không cộng VAT lên trên.
  - **Thuế suất** do kế toán của khách sạn chọn, và được chụp lại vào từng hoá đơn lúc tạo.
  - **Tổng các hoá đơn của một đơn không vượt quá tổng của đơn.**
  - **Chống xuất trùng:** `MaTraCuu = DS<invoiceNumber>` cố định cho mỗi hoá đơn. Phát hành
    lại sau timeout thì Mắt Bão trả 304, không xuất lần hai. Trạng thái `PUBLISHING` được giành
    bằng một UPDATE có điều kiện.
  - **Sau một lần phát hành chưa rõ kết quả** (`lookupCode` đã có), không cho sửa, xoá hay huỷ
    cho tới khi phát hành lại xong.
  - **Hoá đơn đã phát hành không huỷ trong app**: phải lập mẫu 04/SS-HĐĐT trên cổng Mắt Bão.
  - **Ký hiệu đổi theo năm**: sang năm mới phải sửa ký hiệu trong thẻ Mắt Bão.
  - **Môi trường Chính thức** là hoá đơn thật, có giá trị pháp lý.
  - Trạng thái từ cơ quan thuế về qua webhook `/api/webhooks/matbao/<propertyId>/<token>`. Mắt
    Bão không ký callback, nên token bí mật trong URL chính là thứ xác thực: token được mã hoá, và
    chỉ owner/ADMIN thấy URL. Trạng thái cuối (4, 6, 9) không bị thông báo đến muộn ghi đè.
  - `MATBAO_BASE_URL` chỉ dùng cho test (Mắt Bão giả ở `src/test/integration/fake-matbao.ts`).
- Xác thực hai lớp (`src/lib/auth/two-factor.ts`) là **tuỳ chọn, không bao giờ bắt buộc**. Khi
  đã bật, mật khẩu đúng hoặc Google đúng **không tạo phiên**: chỉ trả "vé" chờ nhập mã, provider
  `two-factor` mới tạo phiên. Thêm cách đăng nhập mới thì phải đi qua bước này. Không có đường
  tắt 2FA qua email; đặt lại theo RUNBOOK, "Đặt lại xác thực hai lớp".

## Giao diện mới (thiết kế lại 2026)

- Màu đặt theo **vai trò** trong `src/styles/tokens.ts` (`bg-page`, `bg-panel`, `bg-raised`,
  `text-fg`, `text-muted`, `border-line`, `bg-ink text-on-ink`, `text-acc`, `bg-ok-soft text-ok`…).
  Trang mới hoặc trang đang chuyển: chỉ dùng các tên này, không `bg-white` / `text-gray-*` /
  `[#hex]`, không cần `dark:` — biến CSS tự đổi theo theme. Tên kiểu Material cũ (`primary`,
  `surface`…) chờ xoá khi mọi trang đã chuyển.
- Theme tối chỉ bật theo vùng bằng `data-theme="dark"` (trang quản lý), không theo cài đặt hệ
  điều hành: trang chưa chuyển vẫn dùng màu viết cứng, tự đổi theo OS sẽ vỡ nửa chừng.
- `text-acc` là màu nhấn theo ngữ cảnh: màu Digistay trong trang quản lý, màu khách sạn trên
  website khách sạn. `text-brand` chỉ cho logo và "Vận hành bởi Digistay". Màu lỗi (`err`)
  phải khác rõ màu nhấn; `tokens.test.ts` kiểm tương phản và khoảng cách màu.
- Bo góc theo bề mặt: `rounded-ctl` (nút, ô nhập), `rounded-box` (thẻ, panel); `data-surface="site"`
  đổi sang góc gần vuông của website khách sạn.
- Thêm cỡ chữ / bo góc / bóng mới vào `tailwind.config.ts` thì thêm tên vào `src/lib/utils/index.ts`,
  không thì `cn()` (tailwind-merge) xoá mất class đó khi đi cùng một màu; `cn.test.ts` sẽ báo.
- Nhãn trạng thái đặt phòng / thanh toán: `BookingStatusBadge`, `PaymentStatusBadge` (chữ và màu ở
  `src/lib/booking-status.ts`), không tự viết bảng màu riêng trong trang.
- Modal và `SidePanel` render tại chỗ, không portal, để ăn theo `data-theme` gần nhất. Esc chỉ đóng
  lớp trên cùng (`dialog-behavior.ts`); menu bên trong gọi `preventDefault()` để giữ phím Esc cho mình.
- Toast (`toast.success()`…) chỉ hiện trong trang quản lý: `ToastProvider` nằm ở `(dashboard)/layout.tsx`.
- Theme tối của trang quản lý lưu ở cookie `ds-theme`, `ThemeRoot` (`(dashboard)/layout.tsx`) đặt
  `data-theme`. Chỉ trang có trong `darkReadyPaths` (`src/lib/theme.ts`) mới thật sự tối — từ bước 4 là
  mọi trang quản lý trừ Thanh toán và Hóa đơn (chuyển sau khi #41 và chuỗi PayOS / Mắt Bão merge);
  trang quản lý mới phải dùng màu vai trò rồi thêm vào đó. Phần xem trước website
  khách sạn (trình dựng website) giữ `data-theme="light"`: website khách sạn chỉ có theme sáng.
- Phiếu in / HTML tự ghép (`document.write`, email): mọi giá trị từ khách phải qua `escapeHtml`
  (`src/lib/bookings/display.ts`) — tên khách đến từ form đặt phòng công khai.
- Thứ tự làm: (1) token màu + font — xong (`feat/ui-tokens`); (2) thành phần dùng chung — xong
  (`feat/ui-components`); (3) khung + danh sách đặt phòng + panel — xong (`feat/ui-dashboard-bookings`);
  (4) các trang quản lý còn lại — xong (4a `feat/ui-workspace-pages`, 4b `feat/ui-operations-pages`,
  4c `feat/ui-config-pages`); (5) website khách sạn — xong (`feat/ui-hotel-site`).
- Website khách sạn: `src/app/(public)/[subdomain]/layout.tsx` đặt khung cho mọi trang (theme sáng,
  `data-surface="site"`, màu nhấn của khách sạn qua `hotelAccentVariables` — tự làm đậm tới 4.5:1,
  font qua `fontStack`, tiêu đề trang). Link nội bộ luôn qua `SiteLink` / `useSiteHref` (có hay không
  tiền tố `/<subdomain>` tùy host). Nội dung khối đọc khóa của trình dựng trước (`heroTitle`,
  `roomsTitle`…) qua `cfgText`. Không hiển thị nội dung bịa (đánh giá mẫu, chính sách mẫu). Bản thiết kế: file Claude Design "Digistay hotel booking platform".

## Kế hoạch gia cố

Làm từng phần, theo thứ tự, lấy repo Founder AI (UKNOW) làm tham khảo. Mỗi phần: đọc cách
Founder AI làm và cái Digistay đang có, liệt kê khác biệt và bài học, **chưa sửa gì** — người
dùng duyệt rồi mới làm, trên nhánh riêng. Cập nhật trạng thái ở đây khi xong một phần.

1. Webhook thanh toán — xong (`fix/part-1-payment-security`)
2. File quy trình: `.gitattributes`, `CLAUDE.md`, `dependabot.yml` — xong (`chore/part-2-process-files`)
3. Chuyển sang `prisma migrate`, kèm: deploy an toàn (chỉ deploy khi CI xanh, chạy migration
   bằng image mới trước khi thay container, kiểm `/api/health` sau deploy), integration test
   với Postgres thật trong CI, backup database định kỳ (lưu ngoài VPS: bucket GCS) — code xong
   (`chore/part-3-prisma-migrate`); còn các bước cài một lần trên VPS và GCP trong RUNBOOK
   ("Deploy an toàn", "Backup & khôi phục")
4. Bảo mật nền — 4a vá chiếm tài khoản (PR #2), 4b giới hạn tần suất + khoá tài khoản + đăng
   xuất khi đổi mật khẩu (PR #3), 4c test chính sách route + gitleaks + `.gitignore` — xong.
   4d header bảo mật + tắt bộ tối ưu ảnh, 4e tiện ích mã hoá khoá bên thứ ba + bỏ lưu token
   OAuth, 4f xác thực hai lớp TOTP (**không bắt buộc** — người dùng tự bật) — xong.
   Thêm: lên Next 15.5.28 + React 19 (hết các lỗ hổng của Next 14) — xong.
5. Thanh toán PayOS, mỗi khách sạn một bộ khoá; sửa các nhánh tiền mặt đặt `PAID` bất kể số
   tiền và không cập nhật `depositAmount` — xong; có thêm đối soát định kỳ 10 phút. Còn: SePay
   (nếu khách sạn cần), khách tự trả cọc trên site công khai.
6. Hoá đơn điện tử Mắt Bão, mỗi khách sạn một tài khoản, kèm trạng thái từ cơ quan thuế — xong.
   Còn: hoá đơn điều chỉnh/thay thế, tự gửi email hoá đơn cho khách, tự xuất hoá đơn khi đơn
   thanh toán xong.

Tài liệu deploy: `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`.
