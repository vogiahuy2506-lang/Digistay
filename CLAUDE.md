# CLAUDE.md

Hướng dẫn cho Claude Code trong repo Digistay. File này được nạp vào mọi phiên, nên chỉ ghi
điều **không đọc ra được từ code**. Chi tiết dài để ở `docs/`.

## Git — đọc trước khi commit

- **Push vào `main` là deploy production.** Workflow `Deploy to VPS` chạy ngay khi có push vào
  `main` và không chờ CI xanh. Không push thẳng `main`; làm trên nhánh `feat|fix|chore/<mô-tả>`
  rồi mở PR. Không merge PR khi CI đỏ, kể cả PR của Dependabot.
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
npm test               # Vitest — mock Prisma, không cần DB
npx tsc --noEmit       # typecheck (CI chạy bước này)
npx prisma generate    # sau khi sửa prisma/schema.prisma
npm run db:push        # áp schema vào DB local (sẽ đổi sang prisma migrate — xem kế hoạch)
npm run db:seed
```

Trước khi commit: `npm test` và `npx tsc --noEmit` phải xanh.
Chạy một file test: lọc theo tên (`npx vitest run confirm`) — đường dẫn chứa `[id]` không khớp.

## Kiến trúc cần biết

- Next.js 14 App Router, một app. API ở `src/app/api/**/route.ts`, gọi Prisma trực tiếp.
- Multi-tenant: `Workspace` (chủ `ownerId` + `WorkspaceMember` vai trò ADMIN / MANAGER /
  RECEPTIONIST / USER) → nhiều `Property` (khách sạn) → `Booking`, `Payment`...
- `middleware.ts` rewrite subdomain `<slug>.digistay.vn` → `/<slug>` và **bỏ qua `/api`**:
  không có lớp nào chặn trước API, mỗi route tự kiểm tra đăng nhập.
- Biến môi trường khai báo và kiểm tra ở `src/lib/env.ts`; thêm biến thì cập nhật cả `.env.example`.
- Production chưa có bước áp schema vào DB khi deploy (không `db push`, không `migrate deploy`).
  Đổi `schema.prisma` hiện không tự lên production.

## Luật bảo mật cho API

Rút ra từ các lỗ hổng đã sửa ở Phần 1 (webhook giả, PUT không đăng nhập, API trả dữ liệu của
mọi khách sạn).

1. Mọi route gọi `auth()` hoặc `requireSession()` trước khi đọc DB, trừ route công khai có chủ
   đích (trang public, webhook có kiểm tra chữ ký).
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

## Test — báo đúng những gì đã kiểm

- Vitest mock toàn bộ Prisma. Test xanh chứng minh logic và điều kiện truy vấn, **không**
  chứng minh truy vấn chạy được trên Postgres (tên bảng trong `$queryRaw`, ràng buộc,
  transaction thật). Chưa chạy với DB thật thì báo cáo phải nói rõ như vậy. Founder AI từng
  để lọt SQL sai tên cột vì "test xanh" trên DB mock.
- Sửa logic bảo mật hoặc tiền: gỡ thử chính điều kiện vừa thêm, xác nhận có test đỏ, rồi
  khôi phục. Không có test nào đỏ nghĩa là test chưa bảo vệ điều kiện đó.

## Quy ước code

- Comment và tên test bằng tiếng Anh, khớp code hiện có. Chuỗi hiển thị cho người dùng và
  thông báo lỗi API bằng tiếng Việt.
- Theo pattern có sẵn trong file đang sửa; không thêm tầng hay abstraction mới khi chưa cần.
- Mọi file text dùng LF (`.gitattributes`). Script `.sh` chạy trên VPS — CRLF làm deploy hỏng.

## Kế hoạch gia cố

Làm từng phần, theo thứ tự, lấy repo Founder AI (UKNOW) làm tham khảo. Mỗi phần: đọc cách
Founder AI làm và cái Digistay đang có, liệt kê khác biệt và bài học, **chưa sửa gì** — người
dùng duyệt rồi mới làm, trên nhánh riêng. Cập nhật trạng thái ở đây khi xong một phần.

1. Webhook thanh toán — xong (`fix/part-1-payment-security`)
2. File quy trình: `.gitattributes`, `CLAUDE.md`, `dependabot.yml` — xong (`chore/part-2-process-files`)
3. Chuyển sang `prisma migrate`, kèm: deploy an toàn (chỉ deploy khi CI xanh, chạy migration
   bằng image mới trước khi thay container, kiểm `/api/health` sau deploy), integration test
   với Postgres thật trong CI, backup database định kỳ
4. Bảo mật nền: chặn dò mật khẩu, 2FA, header bảo mật, mã hoá khoá bên thứ ba; test chính sách
   route (route không kiểm tra đăng nhập phải nằm trong danh sách công khai), quét secret trên PR
5. Thanh toán PayOS hoặc SePay, mỗi khách sạn một bộ khoá; sửa nhánh tiền mặt đang đặt
   `PAID` bất kể số tiền và không cập nhật `depositAmount`
6. Hoá đơn điện tử Mắt Bão

Tài liệu deploy: `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`.
