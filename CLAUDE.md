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

Postgres cho integration test (một lần). Volume có tên để xoá/tạo lại container không bỏ lại
volume ẩn danh mồ côi; muốn làm sạch hẳn thì `docker rm -f digistay-test-pg && docker volume rm digistay-test-pg-data`:

```bash
docker run -d --name digistay-test-pg -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:54329:5432 \
  -v digistay-test-pg-data:/var/lib/postgresql/data postgres:16-alpine
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
- Nhân viên như UKNOW (trang Thành viên, `src/lib/members`): mời qua email kèm quyền và cơ sở
  (`Invitation` lưu sẵn), người chưa có tài khoản đặt mật khẩu ngay từ link
  (`POST /api/invitations/[token]/register`); gửi lại / huỷ lời mời (REVOKED); khoá / mở
  (`disabledAt`, không tính chỗ của gói); rời workspace (xoá dòng của chính mình). Không ai cấp hơn
  quyền mình có (`src/lib/members/grant.ts`). Mọi thao tác ghi `activity_logs` (entityType MEMBER /
  INVITATION), tab Nhật ký đọc lại.
- **Xoá cơ sở / workspace là xoá mềm** (`deletedAt`, khôi phục 30 ngày, rồi job `purge-deleted` xoá
  hẳn; `src/lib/deletion`). `prisma` (`src/lib/db`) có extension `src/lib/db/soft-delete.ts`: mọi
  lệnh **đọc** tự bỏ cơ sở / workspace đã xoá và mọi bản ghi thuộc chúng (đơn, thanh toán, hoá đơn,
  thành viên, lời mời…), kể cả trong bộ lọc quan hệ và danh sách `include`. Không cần tự thêm
  `deletedAt: null`. Muốn thấy bản ghi đã xoá: đặt `deletedAt` trong `where`, hoặc dùng
  `prismaWithDeleted` (code xoá / khôi phục, và kiểm tra subdomain, slug, tên miền còn trống: bản ghi
  đã xoá vẫn giữ chúng tới khi xoá hẳn). Không áp dụng: `Subscription`, `SubscriptionPayment`, SQL thô.
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

1. Mọi route gọi `auth()`, `requireSession()` hoặc `requireAccess()` / `requirePropertyAccess()`
   trước khi đọc DB, trừ route công khai có chủ đích. `src/app/api/route-policy.test.ts` bắt buộc
   điều này: handler nào không gọi hàm kiểm tra đăng nhập phải nằm trong `PUBLIC_HANDLERS` kèm lý
   do, nếu không CI đỏ. Thêm route công khai mới = thêm một dòng ở đó để người review thấy.
2. Phân quyền theo **quyền**, không theo vai trò (như UKNOW): `src/lib/auth/permissions.ts` là
   danh mục 20 quyền; vai trò (ADMIN/MANAGER/RECEPTIONIST/USER) chỉ là bộ quyền mẫu, admin có thể
   tick bộ riêng cho từng người (`customPermissions`) và giới hạn họ ở vài cơ sở
   (`allProperties` + `MemberProperty`). Mọi kiểm tra đi qua `src/lib/auth/access.ts`
   (`requireAccess`, `requirePropertyAccess`, `checkPropertyAccess`, `can`) ở server và `useCan()`
   ở dashboard. Không viết `role === 'ADMIN'` hay `role: { in: [...] }`:
   `src/app/api/access-checks.test.ts` bắt. Thành viên bị khoá (`disabledAt`, do admin) hay khoá do
   vượt gói (`planLockedAt`) không có quyền gì (`member-filter.test.ts`).
3. Truy vấn danh sách lọc bằng `accessibleProperties(userId, quyền)` (mọi workspace, đúng cơ sở
   được giao). `propertyId` / `bookingId` từ client chỉ được *cộng thêm* vào điều kiện, không thay
   thế nó. Truy vấn theo id: lấy `propertyId` của bản ghi rồi `checkPropertyAccess(userId,
   propertyId, quyền, thông báo 404)`. Người ngoài (hoặc thành viên không được giao cơ sở đó) → 404
   (không lộ id có tồn tại); thiếu quyền → 403.
4. Thao tác chạm tiền (xác nhận thanh toán, ghi tiền mặt): quyền `payments_manage`.
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

Test trình duyệt (Playwright, `e2e/`): chạy hằng đêm trên CI với bản build production
(`npm run e2e`, RUNBOOK "Kiểm thử trình duyệt (e2e)"). Thêm tính năng có giao diện thì thêm một
kịch bản ở `e2e/specs/`; dịch vụ bên ngoài phải đi qua `e2e/fakes.ts`, không gọi thật.

## Quy ước code

- **API danh sách** dùng `src/lib/api/list-params.ts`: `page`/`limit` (tối đa 100), enum và ngày
  sai trả 400 (đừng để Prisma ném 500), tìm kiếm và lọc chạy trong DB để phủ mọi trang. Thẻ
  thống kê đếm bằng `groupBy` trên server, không cộng ở trình duyệt.
- **Giá và phòng trống — một nguồn duy nhất:**
  - Giá: `src/lib/pricing/quote.ts` (`ratesFrom`, `quoteStay`). Giá phòng là giá **riêng của hạng
    phòng** (trang "Hạng phòng"); Bảng giá chung chỉ cấp phụ thu mặc định. Hạng phòng chưa có giá
    thì không đặt được. Ngày cuối tuần tính theo giờ Việt Nam. Giá đã gồm VAT. Trang nào báo giá
    (site, trang tìm phòng, ước tính của nhân viên) cũng gọi đúng hàm này; đừng tự tính lại.
  - Phòng trống: `src/lib/bookings/occupancy.ts` (`roomsTaken`): đếm theo hạng phòng, khoá gắn với
    đơn không đếm lại, khoá bảo trì/chặn luôn tính, khoá giữ phòng của chính khách không chặn họ.
  - Phòng thật (`src/lib/bookings/rooms.ts`, bảng `rooms`): khách sạn liệt kê số phòng của từng hạng
    (Hạng phòng → Danh sách phòng). Vẫn đếm phòng trống **theo hạng**: hạng đã có danh sách thì
    `RoomType.totalRooms` = số phòng đang dùng, do route quản lý phòng ghi (kèm `invalidatePublicSite`);
    hạng chưa có danh sách chạy như cũ. Không bớt phòng dưới số đã bán của một đêm sắp tới (`peakTaken`).
    Xếp / đổi phòng chỉ qua `assignRoomTx` (`POST /api/bookings/[id]/room`): khoá đơn rồi khoá dòng
    phòng, chặn trùng đêm với đơn khác, chặn phòng bảo trì / ngừng dùng; sang hạng khác chỉ khi hạng đó
    còn phòng mọi đêm, giá giữ nguyên. Số phòng là một phòng của cả khách sạn (không phân biệt hoa
    thường): số gõ tay cũng bị chặn trùng (khoá advisory theo số). Bảo trì có thể khoá một phòng
    (`RoomLock.roomId`). Sơ đồ phòng × ngày: `room-timeline.tsx`, chế độ "Sơ đồ phòng" của trang Đặt phòng (`/calendar?view=rooms`; Danh sách | Lịch tháng | Sơ đồ phòng: `src/components/bookings/bookings-views.tsx`). Số liệu hôm nay ở Tổng quan (`src/components/property/today-overview.tsx`).
  - Tạo đơn: chỉ qua `src/lib/bookings/create-booking.ts` (nhân viên `POST /api/bookings`, khách
    `POST /api/public/bookings`), dưới khoá dòng hạng phòng. `subtotal` = tiền phòng,
    `extraCharges` = phụ thu + dịch vụ, `totalAmount` = tổng.
  - Phí trả phòng muộn: `src/lib/bookings/late-checkout.ts`, tính từ giờ trả phòng của khách sạn
    (Chính sách) vào **ngày trả đã đặt**, giờ Việt Nam. Cộng vào tổng hiện có (không dựng lại tổng
    từ `subtotal`, sẽ mất giảm giá). Mức theo bậc của khách sạn (`Policy.lateCheckoutTiers`: null =
    mặc định 30% trước 15:00 / 50% trước 18:00 / 100% giá một đêm, `[]` = không thu). Đây là **gợi
    ý**: lễ tân áp dụng, thu số khác hoặc miễn trong hộp thoại trả phòng (`check-out-dialog.tsx`);
    hai cách sau bắt buộc lý do, nhật ký ghi số gợi ý, số thu, lý do, người làm. Server luôn tự tính
    lại lúc trả phòng, không lấy số của trình duyệt.
  - Hoàn tiền khi hủy đơn: `src/lib/bookings/cancel-refund.ts`. Trước hạn hủy miễn phí
    (`Policy.cancellationHours`; **để trống = không có hủy miễn phí**, đúng như trang Chính sách và
    website nói) hoàn toàn bộ; sau hạn, trước khi nhận phòng hoàn `Policy.lateCancelRefundPercent`%;
    đã nhận phòng: không gợi ý. Cũng là **gợi ý** như phí trả muộn: hộp thoại hủy
    (`cancel-dialog.tsx`) cho hoàn đúng gợi ý, số khác hoặc không hoàn; khác gợi ý thì bắt buộc lý do,
    nhật ký ghi gợi ý, số hoàn, lý do. App chỉ ghi nhận; tiền trả lại khách theo cách khách đã trả.
- **Site công khai của khách sạn được cache** theo khách sạn (`src/lib/public-site/site.ts`, tối
  đa 5 phút). Handler nào ghi dữ liệu site hiển thị (khách sạn, ảnh, tiện ích, hạng phòng, giá,
  dịch vụ, thực đơn, website) phải gọi `invalidatePublicSite(propertyId)`; `public-site-cache.test.ts` chặn.
  Không bao giờ cache phòng trống theo ngày hay dữ liệu riêng của khách.

- Comment và tên test bằng tiếng Anh, khớp code hiện có. Chuỗi hiển thị cho người dùng và
  thông báo lỗi API bằng tiếng Việt.
- Theo pattern có sẵn trong file đang sửa; không thêm tầng hay abstraction mới khi chưa cần.
- Mọi file text dùng LF (`.gitattributes`). Script `.sh` chạy trên VPS — CRLF làm deploy hỏng.
- Bộ tối ưu ảnh của Next đang **tắt** (`images.unoptimized`), để server không phải giải mã ảnh lạ
  (lỗ hổng RCE AVIF chỉ được vá từ Next 15.5.24; đang dùng 15.5.28). Muốn bật lại thì chỉ với
  `remotePatterns` liệt kê đúng host của mình, không bao giờ `**`; có test chặn.
- Chứng chỉ HTTPS gia hạn bằng timer `digistay-cert-renew` (RUNBOOK). Trước đó không có gì
  gia hạn. Subdomain khách sạn (`*.digistay.vn`) đi qua proxy Cloudflare, chứng chỉ Origin CA 15 năm
  không gia hạn (RUNBOOK "SSL tên miền con qua Cloudflare"). Chứng chỉ có biến trong đường dẫn được
  worker nginx (nhóm 101) đọc theo từng lượt bắt tay, không phải root: certbot để khoá chỉ root đọc,
  nên sau khi cấp/gia hạn phải chạy `docker/certbot/nginx-readable.sh`.
- `/workspace-picker/*` luôn chuyển về `/workspaces`: layout của nó nằm trên `[slug]` nên không
  bao giờ nhận được `slug` (có từ trước, Next 15 mới lộ ra khi kiểm kiểu). Dọn hay sửa là quyết
  định sản phẩm; trang lời mời đang trỏ tới đó.
- IP khách: app chỉ tin `X-Real-IP` do nginx đặt bằng `$remote_addr`; sau Cloudflare thì
  `cloudflare-real-ip.inc` sửa `$remote_addr` thành IP thật, chỉ với kết nối từ dải IP Cloudflare.
  Không bao giờ thêm dải nội bộ hay `0.0.0.0/0` vào đó (`scripts/nginx-config.test.mjs` chặn).
- Header bảo mật nằm ở nginx: `docker/nginx/conf.d/security-headers.inc`, include ở server
  và ở mọi `location` có `add_header` riêng. Sửa `app-secure.conf.template`, không sửa file
  sinh ra — `docker/deploy.sh` sinh lại và reload nginx mỗi lần deploy.
- React mà Next 15.5 đóng gói (canary 19.2) hydrate sai khi chunk JS của một component đến đúng lúc
  React đang tạm dừng: lỗi #418 chập chờn (React bỏ HTML của server, vẽ lại trên client, có lúc thấy
  trang hai bản) và `useId` lệch với server. `scripts/patch-react-replay.mjs` vá bản sửa của React
  19.3 (react#35494, react#35518) vào `node_modules/next` khi `npm ci` (`postinstall`, Dockerfile
  chép script vào bước cài) và trước `npm run build`. Đừng bỏ bước đó. Lên Next mới: React đóng gói
  từ 19.3 thì script tự bỏ qua; code khác dạng thì script báo lỗi và cài đặt hỏng, khi đó xem lại.
- Không bọc trang bằng provider đổi giá trị ngay sau khi tải (như `SessionProvider` không kèm
  session): nội dung dashboard được stream, React 19.2 hoãn hiện nó một chút, và context đổi trước
  lúc đó làm React bỏ HTML của server để vẽ lại trên client (trước đây ở 85% lần tải). `useSession`
  chỉ dùng dưới `SessionScope` (`src/components/providers.tsx`) với session server đã đọc; spec báo
  cáo kiểm id `_R_` (hydrate) thay vì `_r_` (vẽ lại).
- Khoá bên thứ ba lưu trong DB (khoá thanh toán, tài khoản hoá đơn, secret 2FA) **luôn** qua
  `src/lib/security/secret-box.ts`: `encryptSecret(giá trị, secretContext(bảng, id, cột))`.
  Chưa cấu hình thì lưu `null`. Không bao giờ trả giá trị đã giải mã ra trình duyệt: trả
  `maskSecret()`, ô nhập để trống nghĩa là giữ nguyên. Khoá mã hoá: RUNBOOK, "Khoá mã hoá dữ liệu".
- Không lưu token OAuth: chỉ dùng Google để đăng nhập (`src/lib/auth/adapter.ts`).
- **Thanh toán:** mọi chỗ ghi nhận tiền hoặc đổi số tiền phải trả của một đơn đều gọi
  `lockBooking()` rồi `syncBookingPayments()` (`src/lib/payments/booking-payments.ts`) trong cùng
  transaction. Hàm này tính `depositAmount` (= tổng đã trả) và `paymentStatus` từ các khoản `PAID`.
  Đừng tự đặt `paymentStatus: 'PAID'`: các nhánh tiền mặt cũ làm vậy, khiến cọc 200k báo là trả đủ.
- **PayOS** (`src/lib/payments/payos.ts`) là cổng thanh toán **duy nhất** (chủ sản phẩm quyết định
  25/10/2026): khách trả bằng chuyển khoản / VietQR, app không nhận thanh toán thẻ online (PayOS không
  nhận thẻ quốc tế). Mỗi khách sạn tự gắn tài khoản PayOS của mình, tiền vào thẳng tài khoản khách
  sạn. Mỗi khách sạn có một URL webhook riêng (`/api/webhooks/payos/<propertyId>`), chữ ký được kiểm bằng khoá của đúng khách sạn đó. Chuyển
  sang `PAID` chỉ qua một UPDATE có điều kiện (webhook, đối soát hay nhân viên: ai tới trước
  thắng), và số tiền phải khớp đúng. Tiền về cho link đã huỷ/hết hạn vẫn được ghi nhận và gắn cờ;
  khoản `REFUNDED` không bao giờ sống lại. Return URL không bao giờ đánh dấu đã trả.
  `PAYOS_BASE_URL` chỉ dùng cho test (PayOS giả ở `src/test/integration/fake-payos.ts`).
  - **Khách đặt cọc trên website** (`src/lib/payments/guest-deposit.ts`): khách sạn đặt % ở trang
    Chính sách (`Policy.onlineDepositPercent`) và chọn cách thu ở trang Ngân hàng
    (`Property.depositMode`, `src/lib/payments/deposit-mode.ts`): **Tự động** qua PayOS của khách
    sạn, hoặc **Thủ công**: VietQR tới tài khoản/ví MoMo của khách sạn (`depositAccountId`), khách
    bấm "Tôi đã chuyển khoản" (gia hạn hạn cọc một lần, báo lễ tân), lễ tân bấm "Xác nhận đã nhận
    tiền" (`POST /api/payments/[id]/confirm`). Không chọn: PayOS nếu đã kết nối, không thì thủ công.
    Số tiền chỉ tính bằng `depositFor()` (`src/lib/pricing/quote.ts`). Đơn tạo như thường (PENDING)
    rồi mới tạo link; PayOS lỗi thì đơn vẫn giữ, khách được báo khách sạn sẽ liên hệ. Chỉ webhook /
    đối soát đánh dấu đã trả; `syncBookingPayments` xác nhận đơn, và khoản cọc của khách
    (`metadata.guestDeposit`) gửi email "đã nhận cọc" cho khách (trừ đơn đã huỷ). Trang
    `/thanh-toan` chỉ hiển thị trạng thái trong DB theo `orderCode`, không tin query string.
    Hạn cọc (`Policy.depositDeadlineMinutes`, 0 = không tự huỷ): link hết hạn đúng lúc đó, và job
    `payos-reconcile` (sau phần đối soát) gọi `expireUnpaidDeposits()`: **hỏi PayOS trước** (đã trả
    thì xác nhận đơn, không huỷ), huỷ link, rồi huỷ đơn dưới khoá dòng nếu vẫn PENDING và chưa có
    khoản nào PAID, mở lại phòng, email cho khách. Link tạo lỗi thì không tự huỷ (khách được báo
    khách sạn sẽ gọi).
    Đặt cọc lại: trang `/<subdomain>/dat-coc/<token>` (link trong email xác nhận và nút "Thanh toán
    lại" ở `/thanh-toan`), token = id đơn + HMAC (`deposit-link.ts`, khoá dẫn xuất từ
    `NEXTAUTH_SECRET`). **Mở trang không tạo gì** (trình quét email mở link); chỉ nút bấm gọi
    `POST /api/public/deposits/[token]`: dùng lại link còn hạn, không thì tạo link mới cùng số tiền,
    hết hạn đúng hạn cọc cũ; quá hạn hay đơn không còn chờ thì từ chối. Một đơn có thể có nhiều link:
    job hết hạn hỏi PayOS **mọi** link của đơn trước khi huỷ.
  Đối soát định kỳ: timer systemd `digistay-reconcile`, 10 phút một lần, gọi
  `/api/internal/payos-reconcile` (RUNBOOK, "Đối soát PayOS định kỳ").
- Job định kỳ nằm ở `/api/internal/*`: kiểm `checkCronSecret()` (header `CRON_SECRET`), nginx
  không mở ra ngoài, và timer `digistay-reconcile` gọi từ bên trong container app qua
  `docker/systemd/scheduled-jobs.sh` (thêm job mới = thêm tên vào vòng lặp trong script đó).
  Bọc job bằng `recordJobRun()` (`src/lib/ops/job-runs.ts`) để có lịch sử và cảnh báo khi lỗi.
- **Giám sát** (`src/lib/ops/`): `/api/health` đỏ khi DB thiếu migration của bản đang chạy (sự cố
  20/10/2026: DB trống mà health vẫn ok). Cảnh báo vận hành gửi email cho `ALERT_EMAILS` hoặc
  `SUPER_ADMIN`; thêm luật mới trong `alerts.ts`, mỗi luật trả về fingerprint các mục để không gửi
  lặp. RUNBOOK, "Giám sát và cảnh báo".
- **Trang quản trị Digistay** (`/admin`): Khách hàng, Đơn hàng gói, Nhật ký, Hệ thống. Chỉ user
  `SUPER_ADMIN` (đọc trong DB, không tin token): trang kiểm ở `src/app/(dashboard)/admin/layout.tsx`,
  mọi route `/api/admin/*` gọi `requirePlatformAdmin()` (`src/lib/admin/guard.ts`) đầu tiên; người
  khác nhận 404. Thao tác của operator ghi ActivityLog với `userId` = operator và `metadata.by` =
  email của họ. Không thao tác được trên tài khoản `SUPER_ADMIN` (cấp/bỏ quyền vẫn bằng SQL,
  RUNBOOK). Tài khoản bị khoá (`User.disabledAt`) không đăng nhập được bằng mật khẩu, mã 2FA lẫn
  Google, và khoá thì thu hồi phiên (`revokeSessions`): đường đăng nhập mới phải kiểm cả nó.
- **Email gửi sau request** đi qua hàng đợi `src/lib/email/outbox.ts` (`queue*` rồi
  `sendAfterResponse`): lưu mã hoá, gửi ngay sau response, job `email-outbox` thử lại, hết lượt thì
  có cảnh báo. Đừng gửi kiểu "bắn rồi quên": `send()` báo lỗi bằng giá trị trả về chứ không ném,
  nên lỗi bị nuốt. Email người dùng đang chờ (mã OTP) vẫn gửi trực tiếp để báo lỗi ngay.
  Kiểm "đã gửi" bằng `result.sent`, không phải `result.success` (không có SMTP thì stub vẫn
  `success`).
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
    Nhưng có thể **thay thế** (`replacement.ts`, TCHDon 1):
    - Bản nháp chép từ hoá đơn gốc. Khi phát hành, hoá đơn mới ghi rõ thay cho mẫu số, ký
      hiệu, số và ngày của hoá đơn gốc; hoá đơn gốc chuyển sang `REPLACED`.
    - Mỗi hoá đơn chỉ có một bản thay thế còn hiệu lực.
    - Khi tính tổng tiền đã xuất cho một đơn, hoá đơn gốc không bị tính hai lần.
  - **Điều chỉnh** (`adjustment.ts`, TCHDon 2 tăng / 3 giảm): hoá đơn mới chỉ ghi phần chênh
    lệch, có dấu: `totalAmount` âm là điều chỉnh giảm (NĐ 123 Điều 19: "ghi dấu âm"). Hoá đơn
    gốc vẫn `PUBLISHED`. Mỗi lúc chỉ một bản nháp điều chỉnh; giảm không quá giá trị hiện tại của
    hoá đơn gốc; một hoá đơn hoặc bị thay thế, hoặc được điều chỉnh, không cả hai.
    - Dấu âm **đã kiểm trên DEMO của Mắt Bão** ngày 21/10/2026: gốc số 11368, giảm 11369
      (−108.000, PDF ghi "Hóa đơn điều chỉnh giảm cho hóa đơn điện tử số 11368…"), tăng 11370.
      Ví dụ Postman của Mắt Bão cũng ghi âm toàn bộ (đặt dấu ở số lượng; mình đặt ở đơn giá, DEMO
      nhận cả hai). Tài khoản DEMO dùng chung: MST `0302712571-999`, ký hiệu `C26TAT`, mẫu số 1
      (mật khẩu trong file Postman Mắt Bão gửi; không ghi vào repo).
    - Điều chỉnh thông tin (TCHDon 4) không hỗ trợ: sai thông tin người mua thì thay thế.
    - Khi tính tổng đã xuất của một đơn, bản nháp điều chỉnh giảm chưa được trừ cho tới khi
      phát hành (`invoicedTotal`).
  - **Ký hiệu đổi theo năm**: sang năm mới phải sửa ký hiệu trong thẻ Mắt Bão.
  - **Môi trường Chính thức** là hoá đơn thật, có giá trị pháp lý.
  - Trạng thái từ cơ quan thuế về qua webhook `/api/webhooks/matbao/<propertyId>/<token>`. Mắt
    Bão không ký callback, nên token bí mật trong URL chính là thứ xác thực: token được mã hoá, và
    chỉ owner/ADMIN thấy URL. Trạng thái cuối (4, 6, 9) không bị thông báo đến muộn ghi đè.
  - **Email hoá đơn** (`delivery.ts`): phát hành xong thì `emailStatus = PENDING` (nếu khách sạn
    bật), gửi ngay sau response (`after()`), job định kỳ gửi phần còn lại. Gửi qua SMTP của
    Digistay, PDF lấy từ Mắt Bão đính kèm; không nhờ Mắt Bão gửi. Giành quyền gửi bằng UPDATE có
    điều kiện (`SENDING` + lease ở `emailNextAt`), lỗi thử lại 10 phút/30 phút/2 giờ/6 giờ rồi dừng.
  - **Tự xuất hoá đơn** (`jobs.ts`, mặc định tắt, owner/ADMIN bật; thẻ Mắt Bão gọi là "Thủ công" /
    "Tự động"): đơn **thanh toán đủ** từ lúc bật, chưa có hoá đơn nào → một hoá đơn bằng tổng đơn,
    người mua lấy từ `vat*` của booking (không có thì là khách). Tiền cọc không kích hoạt (luật không
    tính cọc là thời điểm lập hoá đơn). Mỗi đơn một lần; thông tin công ty sai thì để `PENDING` kèm
    lý do cho nhân viên. Phát hành **ngay sau response** của lần ghi tiền làm đơn đủ tiền:
    `syncBookingPayments` gọi `autoIssueAfterResponse` (`issue-now.ts`, `after()`), nên mọi đường ghi
    tiền (PayOS, nhân viên xác nhận, tiền mặt...) đều có; job 10 phút chỉ còn là dự phòng / thử lại.
    Hai đường dùng chung luật và các lần giành (khoá dòng booking, `PUBLISHING`, MaTraCuu 304).
  - **Link tra cứu cho khách** (`lookup-link.ts`): `/<subdomain>/hoa-don/<token>` trên website khách
    sạn (mở được cả khi website chưa xuất bản), token = id hoá đơn + HMAC (khoá dẫn xuất từ
    `NEXTAUTH_SECRET`), không bao giờ là MaTraCuu (đoán được). Trang hiện người bán, người mua, số,
    ký hiệu, ngày, tiền, trạng thái và nút "Tải PDF" (`GET /api/public/invoices/<token>/pdf`, giới
    hạn theo IP, Mắt Bão lỗi thì quay lại trang với `?pdf=failed`). Link có trong email hoá đơn và
    nút "Sao chép link tra cứu" ở chi tiết hoá đơn.
  - `MATBAO_BASE_URL` chỉ dùng cho test (Mắt Bão giả ở `src/test/integration/fake-matbao.ts`).
  - **Tra cứu mã số thuế** (`tax-lookup.ts`, `GET /api/public/tax-lookup`): form đặt phòng của khách và
    hộp thoại hoá đơn tự điền tên, địa chỉ công ty từ dữ liệu cơ quan thuế qua API miễn phí của VietQR.
    Chỉ để điền sẵn: ô vẫn sửa được, tra cứu lỗi không chặn gì. Kết quả giữ trong bộ nhớ (1 ngày),
    giới hạn theo IP. `TAX_LOOKUP_BASE_URL` chỉ dùng cho test (e2e giả ở `e2e/fakes.ts`).
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
- Theme tối chỉ bật theo vùng bằng `data-theme="dark"` (trang quản lý, trang của Digistay, website
  khách sạn), theo cookie `ds-theme` do người xem chọn, không theo cài đặt hệ điều hành: trang chưa
  chuyển vẫn dùng màu viết cứng, tự đổi theo OS sẽ vỡ nửa chừng.
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
  `data-theme`. Chỉ trang có trong `darkReadyPaths` (`src/lib/theme.ts`) mới thật sự tối — nay là
  mọi trang quản lý của workspace và khách sạn, hồ sơ và `/admin/system` (Thanh toán, Hóa đơn và
  `/admin/system` chuyển sau cùng, trên bản đã có PayOS / Mắt Bão).
  Trang quản lý mới phải dùng màu vai trò rồi thêm vào đó. Phần xem trước website
  khách sạn (trình dựng website, `website/site-preview.tsx`) dùng `data-surface="site"` và sáng/tối như
  chính website; khung quanh nó theo giao diện của trang quản lý.
- Phiếu in / HTML tự ghép (`document.write`, email): mọi giá trị từ khách phải qua `escapeHtml`
  (`src/lib/bookings/display.ts`) — tên khách đến từ form đặt phòng công khai.
- Thứ tự làm: (1) token màu + font — xong (`feat/ui-tokens`); (2) thành phần dùng chung — xong
  (`feat/ui-components`); (3) khung + danh sách đặt phòng + panel — xong (`feat/ui-dashboard-bookings`);
  (4) các trang quản lý còn lại — xong (4a `feat/ui-workspace-pages`, 4b `feat/ui-operations-pages`,
  4c `feat/ui-config-pages`); (5) website khách sạn — xong (`feat/ui-hotel-site`).
- Website khách sạn: `src/app/(public)/[subdomain]/layout.tsx` đặt khung cho mọi trang (theme sáng /
  tối theo cookie `ds-theme`, nút đổi `SiteThemeToggle` ở đầu trang — trong menu trên điện thoại;
  `data-surface="site"`; màu nhấn của khách sạn qua `hotelAccentVariables` cho cả hai theme — làm đậm
  trên nền sáng, làm sáng trên nền tối tới 4.5:1, `tailwind.config.ts` đổi `--site-acc*` thành
  `--ds-acc`; font qua `fontStack`, tiêu đề trang). Mã QR giữ nền trắng ở cả hai theme. Link nội bộ luôn qua `SiteLink` / `useSiteHref` (có hay không
  tiền tố `/<subdomain>` tùy host). Nội dung khối đọc khóa của trình dựng trước (`heroTitle`,
  `roomsTitle`…) qua `cfgText`. Không hiển thị nội dung bịa (đánh giá mẫu, chính sách mẫu). Bản thiết kế: file Claude Design "Digistay hotel booking platform".
  Website chỉ công khai khi đã xuất bản: trang nào của website (trừ trang trả về PayOS) cũng qua
  `loadVisibleSite`, API công khai qua `siteVisibility` (`src/lib/public-site/visibility.ts`);
  chưa xuất bản thì 404 với khách, thành viên đã đăng nhập thấy bản xem trước. Đặt phòng công
  khai chỉ nhận website đã xuất bản. Test tích hợp đặt phòng của khách: gọi `publishSite()` trước.
- Ảnh: `POST /api/upload` lưu ở Cloudinary (tài khoản chung với UKNOW, thư mục `digistay/`, server chọn
  thư mục; `src/lib/cloudinary`), trả URL để API của từng thứ lưu (ảnh cơ sở, ảnh loại phòng
  `/api/properties/[id]/room-types/[roomTypeId]/images`, món, logo). Trình duyệt thu nhỏ trước
  (`src/lib/media/upload-client.ts`, nút `PhotoUploadButton`); website hiện ảnh qua
  `responsiveImage`/`resizedImage` (`src/lib/media/image-url.ts`). Không bao giờ lưu `data:` URL.
  RUNBOOK "Lưu ảnh (Cloudinary)".
- Trình dựng website: ảnh bìa chọn trong ảnh của cơ sở hoặc tải lên (`config.backgroundImage`);
  đánh giá là đánh giá thật khách sạn tự nhập (`config.reviews`); màu nút (`buttonColor` → `--ds-ink`
  của website) và màu tiêu đề (`headingColor`, tiêu đề `font-site`) tự chỉnh cho đọc được ở hai theme
  (`hotelButtonVariables` / `hotelHeadingVariables`, `src/lib/public-site/accent.ts`); khối Dịch vụ và
  Thực đơn lấy dữ liệu từ trang Dịch vụ / Thực đơn, không có gì thì không hiện.
- Lịch sử phiên bản website (`src/lib/public-site/versions.ts`, bảng `site_versions`): mỗi lần lưu khối /
  cài đặt website giữ một phiên bản trong cùng transaction (`keepSiteBaseline` trước khi ghi,
  `recordSiteVersion` sau khi ghi; cùng người trong 2 phút thì gộp; giữ 50 bản). Route mới ghi khối hay
  giao diện website cũng phải gọi hai hàm này. Khôi phục (`/api/website/versions/[versionId]/restore`) lưu
  bản hiện tại trước (`BEFORE_RESTORE`); không đụng trạng thái xuất bản và tên miền. Xem trước:
  `/<subdomain>/phien-ban/<id>`, chỉ owner/ADMIN/MANAGER.
- Tên miền riêng: xác minh ở `/api/website/domain/verify` (A hoặc CNAME cho www + TXT); middleware phục vụ site trên tên
  miền đó qua `/api/public/site-host` (`src/lib/public-site/custom-host.ts`); chứng chỉ HTTPS do
  `docker/certbot/custom-domains.sh` trên VPS cấp mỗi phút (`/api/internal/custom-domains`), nginx
  `custom-domains.conf` chọn theo SNI. RUNBOOK "Tên miền riêng của khách sạn". Đích CNAME/A lấy từ
  `pointingTarget()` (`src/lib/custom-domain.ts`): `CUSTOM_DOMAIN_CNAME_TARGET` (tên DNS only) khi
  subdomain đã qua proxy Cloudflare, không bao giờ một subdomain đang bật proxy (lỗi 1001/1014).

## Song ngữ (tiếng Việt / tiếng Anh)

- Thư viện `next-intl`. Chữ hiển thị nằm trong `messages/vi.json` và `messages/en.json` (cùng khoá,
  `src/i18n/messages.test.ts` kiểm: đủ khoá, cùng biến, đúng cú pháp ICU). Không viết cứng chữ mới
  trong component: thêm khoá vào cả hai file rồi dùng `useTranslations('nhóm')` (server lẫn client
  component) hoặc `getTranslations` trong component async. Số nhiều tiếng Anh dùng ICU
  (`{count, plural, one {# night} other {# nights}}`). Giá: `formatVnd(số, locale)`.
- Ngôn ngữ lấy từ đâu (`src/i18n/locales.ts`): website khách sạn theo URL — `/en/...` là tiếng Anh,
  middleware bỏ `/en` rồi báo qua header `x-site-locale`; mọi trang khác theo cookie `NEXT_LOCALE`.
  Middleware cũng báo đường dẫn gốc qua `x-site-base` (Host không tin được: `next start` chạy
  middleware lần hai như request nội bộ). Link trong website khách sạn luôn qua `SiteLink` /
  `useSiteHref` để giữ `/en`; nút đổi ngôn ngữ là `LanguageSwitch`.
- Chữ cho client component gửi ở **một** `NextIntlClientProvider` duy nhất trong layout gốc
  (website khách sạn: `common` + `site`; các trang khác: `common`, `marketing.contact`, `auth`, `dash`,
  `workspaces`, `workspaceHome`); khu vực mới thì thêm nhóm của nó vào đó. Nhóm `email` chỉ dùng ở
  server, không đưa vào đây. Không lồng provider thứ hai trong
  layout con: bản build production khi đó thỉnh thoảng lỗi hydrate (React #418) ở website khách sạn.
- Trang của chính Digistay (`src/app/(marketing)`: trang chủ, bảng giá, liên hệ, điều khoản, bảo
  mật) theo Claude Design "Digistay Gioi Thieu" / "Bang Gia" / "Lien He": đầu và chân trang ở
  `src/components/marketing`, nút VI | EN (`LocaleToggle`) ghi cookie `NEXT_LOCALE`. Tên gói, giá,
  giới hạn ở `src/lib/marketing/plans.ts` (đang là giá test) và là gói thật: mua ở Gói & thanh toán
  (`src/lib/billing`: PayOS của Digistay, quy tắc nâng/hạ/gia hạn trong `period.ts` `planChange`,
  hoá đơn gói qua Mắt Bão của Digistay trong `einvoice.ts`; RUNBOOK "Bán gói"). Form liên hệ gửi email cho `CONTACT_EMAILS` (không có thì
  `ALERT_EMAILS`) qua outbox; không có ai nhận thì báo chưa gửi được, không giả vờ đã nhận.
- Giới hạn gói: route chặn bằng `planResponse` / `planResponseForProperty` (`src/lib/billing/guard.ts`),
  trả `code` (`PLAN_LIMIT`, `WORKSPACE_LOCKED`, `PROPERTY_PLAN_LOCKED`) và với `PLAN_LIMIT` thêm `limit`
  (đã dùng, giới hạn, gói gợi ý). `PlanLimitPrompt` trong layout workspace bắt mọi phản hồi đó và mở
  hộp gợi ý nâng cấp, nên route mới chỉ cần trả đúng `code`, trang không phải tự xử lý. Chủ workspace
  được nhắc trong chuông (và email) khi gần hết hạn, khi vượt gói và khi dùng tới 80% / 100% giới hạn
  (`src/lib/billing/usage-alerts.ts`); xem mọi thông báo ở `/workspace/<slug>/notifications`.
- Đăng nhập / đăng ký / quên mật khẩu / lời mời / 404 / trang lỗi theo Claude Design "Dang Nhap",
  "Dang Ky", "Quen Mat Khau", "Loi Moi", "Loi". Lỗi từ `/api/auth` vẫn là câu tiếng Việt cố định:
  trang dịch bằng `AUTH_ERROR_KEYS` (`src/lib/auth/error-messages.ts`); thêm câu lỗi mới ở route thì
  thêm vào đó, `error-messages.test.ts` quét các route và báo câu nào thiếu. Sau đăng nhập về
  `?callbackUrl=` nếu là đường dẫn trong site (`src/lib/auth/after-login.ts`).
- Trang quản lý: chữ ở `messages/dash/{vi,en}/<khu>.json` (nhóm `dash.<khu>`, gộp trong
  `src/i18n/request.ts`); nhãn dùng chung (vai trò, trạng thái, nguồn, tiền, ngày) qua
  `useDashLabels()` (`src/lib/i18n/dash.ts`). Nút VI | EN: trong header của trang ngoài (LocaleToggle) và
  trong menu tài khoản ở chân thanh bên (`useLanguageSwitch`), ghi cookie `NEXT_LOCALE`.
- Khung: trang ngoài, /workspaces, /profile dùng header trang chủ (`MarketingHeader`); mọi trang trong một
  workspace (danh sách cơ sở, thành viên, gói, cài đặt và các trang của cơ sở) dùng chung một khung có thanh
  bên (`src/app/(dashboard)/workspace/[slug]/layout.tsx`, `WorkspaceShell`). Trên trang của workspace, thanh
  bên giữ menu của cơ sở mở gần nhất.
- Nội dung khách sạn tự nhập có bản tiếng Anh: cột `translations` `{ en: {...} }` (Property, RoomType,
  ExtraService, Policy, WebsiteSettings) và `config.en` của khối website; đọc qua `localized` /
  `localizeRow` / `blockText` (`src/lib/i18n/content.ts`), lưu qua `translationsInput` /
  `mergeTranslations` (`src/lib/i18n/translations-input.ts`); form dùng `EnglishCopy`. Ô tiếng Anh
  để trống thì hiện bản tiếng Việt. Tên tiện ích theo slug (`site.amenityNames`).
- Thông báo từ API: route vẫn trả câu tiếng Việt; trang tiếng Anh dịch qua từ điển
  `src/lib/i18n/api-errors.en.json` (câu tiếng Việt → tiếng Anh, `{0}`… cho giá trị) bằng
  `apiError(data.error) || t('…')`. Thêm câu mới ở API thì thêm bản tiếng Anh vào từ điển:
  `api-errors.test.ts` quét route và báo câu thiếu.
- Email: gửi khách theo ngôn ngữ của đặt phòng (`Booking.locale`, form đặt phòng gửi kèm), email tài
  khoản và lời mời theo cookie của trang gửi (`src/lib/i18n/request-locale.ts`); chữ ở nhóm `email`
  của `messages/*.json` (`src/lib/email/i18n.ts`). Email cho chủ khách sạn, liên hệ và cảnh báo vận
  hành vẫn tiếng Việt.
- Tiến độ: website khách sạn, trang của Digistay, đăng nhập…, trang quản lý, nội dung khách sạn nhập,
  thông báo API, email — xong.

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
   tiền và không cập nhật `depositAmount` — xong; có thêm đối soát định kỳ 10 phút, và khách tự
   đặt cọc khi đặt trên website. Không có cổng thứ hai: khách trả bằng chuyển khoản / VietQR qua
   PayOS, không nhận thẻ (quyết định 25/10/2026).
6. Hoá đơn điện tử Mắt Bão, mỗi khách sạn một tài khoản, kèm trạng thái từ cơ quan thuế — xong.
   Thêm: hoá đơn thay thế, hoá đơn điều chỉnh tăng/giảm, tự gửi email hoá đơn (kèm PDF), tự xuất
   hoá đơn khi đơn thanh toán đủ — xong.

Tài liệu deploy: `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`.
