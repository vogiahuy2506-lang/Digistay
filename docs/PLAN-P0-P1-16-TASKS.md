# Kế hoạch chi tiết triển khai 16 Task P0 & P1 (Task 41 - 56)

Tài liệu này phân rã chi tiết yêu cầu kỹ thuật, giải pháp, file can thiệp và kịch bản kiểm thử cho 16 nhiệm vụ trọng điểm (Task 41 đến 56) nhằm chuẩn bị hệ thống **Digistay** sẵn sàng vận hành thực tế và mở bán thương mại.

---

## TỔNG QUAN PHÂN KỲ TRIỂN KHAI

| Giai đoạn | Nhóm Task | Mục tiêu cốt lõi |
| :--- | :--- | :--- |
| **Giai đoạn 1: Sửa lỗi khẩn cấp P0 (Luồng cốt lõi)** | **Task 41 - 47** | Đảm bảo xuất bản web tức thì, tính giá phòng chính xác, chặn lộ mật khẩu, thu tiền check-out, nguồn đơn chuẩn và khách sạn demo hoạt động. |
| **Giai đoạn 2: Quản trị, Gói cước & Bán hàng P1** | **Task 48 - 51** | Tích hợp PayOS mua gói, cập nhật bảng giá thật, hoàn thiện trang Superadmin (gói, voucher) và xử lý ân hạn dùng thử. |
| **Giai đoạn 3: Tính năng nâng cao P1 (AI, OTA, Gói cước)** | **Task 52 - 56** | Chatbot hỏi đáp phòng thật, tích hợp AI Gemini thật, nhãn OTA & đồng bộ iCal, bỏ xuất hóa đơn điện tử cho khách sạn (chỉ giữ Mắt Bão xuất hóa đơn khi mua gói Digistay) và kiểm thử luồng PayOS thật. |

---

## CHI TIẾT KỸ THUẬT TỪNG NHIỆM VỤ

---

### Task 41 [P0]: Sửa nút Xuất bản website
* **Hiện trạng & Nguyên nhân**: Công tắc "Công khai website cho du khách" trong modal cài đặt chỉ cập nhật state tạm thời, phải bấm thêm "Lưu thay đổi" ở thanh header trên mới gửi API. Nếu tải lại trang sẽ bị mất trạng thái, tên miền con `ten-ks.digistay.vn` bị 404. Ngoài ra, thiếu cảnh báo khi người dùng thoát trang khi còn thay đổi chưa lưu.
* **Giải pháp kỹ thuật**:
  1. Khi người dùng bật/tắt công tắc xuất bản (`isPublished`), gọi ngay API `PUT /api/website/settings` với `{ isPublished: boolean }` để lưu tức thì vào database.
  2. Bổ sung `beforeunload` event listener và Next.js navigation interceptor để cảnh báo: *"Bạn có thay đổi trên website chưa được lưu. Bạn có chắc muốn rời đi?"*.
  3. Đảm bảo cache được làm mới (`revalidateTag` / xóa Redis cache `public-site`) để tên miền con mở được ngay lập tức.
* **File can thiệp**:
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/website/website-settings-modal.tsx`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/website/page.tsx`
  - `src/app/api/website/settings/route.ts`
* **Kiểm thử**:
  - Mở website builder, bật công tắc xuất bản -> Không cần bấm Lưu thay đổi -> Mở tab ẩn danh `http://ten-ks.digistay.vn` thấy website hiển thị ngay trong < 5 giây.
  - Sửa nội dung khối chưa lưu -> bấm F5 hoặc chuyển trang -> hiển thị popup cảnh báo.

---

### Task 42 [P0]: Sửa logic giá cuối tuần
* **Hiện trạng & Nguyên nhân**: Trong file `src/lib/pricing/quote.ts`, đêm cuối tuần đang tính theo `day === 0 || day === 6` (Chủ Nhật và Thứ Bảy). Nhưng trong ngành khách sạn Việt Nam và trên nhãn hệ thống ghi rõ: *"Giá cuối tuần (Thứ 6 & Thứ 7)"*. Đêm Chủ Nhật là đêm ngày thường (sáng thứ Hai đi làm). Do đó, khách đặt Thứ 6 -> Chủ Nhật (đêm T6 và đêm T7) đang bị tính 1 đêm thường + 1 đêm cuối tuần = 1.300.000đ (thay vì 2 đêm cuối tuần = 1.400.000đ).
* **Giải pháp kỹ thuật**:
  1. Chuẩn hóa định nghĩa đêm cuối tuần thành hàm tập trung:
     ```ts
     // Đêm cuối tuần là đêm Thứ Sáu (day === 5) và đêm Thứ Bảy (day === 6) theo giờ Việt Nam
     export function isWeekendNight(date: Date): boolean {
       const vnDay = getVietnamDayOfWeek(date) // 0: CN, 1: T2, ..., 5: T6, 6: T7
       return vnDay === 5 || vnDay === 6
     }
     ```
  2. Áp dụng đồng bộ cho:
     - `src/lib/pricing/quote.ts` (tính giá báo giá đặt phòng)
     - `src/app/(public)/[subdomain]/dat-phong/BookingForm.tsx` (tính giá public web)
     - `src/lib/ai/chatbot.ts` (chatbot báo giá)
     - `src/components/bookings/calendar-view.tsx` & trang lịch phòng (sửa màu đỏ hiển thị Thứ 6 & Thứ 7 khớp với giá).
  3. Viết bộ kiểm thử tự động `src/lib/pricing/quote.test.ts` kiểm tra đặt T6 -> CN tính đúng 2 đêm cuối tuần.
* **File can thiệp**:
  - `src/lib/pricing/quote.ts`
  - `src/lib/pricing/quote.test.ts`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/calendar/page.tsx`
  - `src/app/(public)/[subdomain]/rooms/[roomId]/BookingBox.tsx`

---

### Task 43 [P0]: Chặn trình duyệt tự điền mật khẩu vào ô khóa API
* **Hiện trạng & Nguyên nhân**: Trình duyệt Chrome tự động nhận diện các form có trường text/password và tự động điền (autofill) tài khoản/mật khẩu đăng nhập Digistay vào các ô `Hotel ID` hoặc `API Key` / `Secret`. Khi bấm Lưu, mật khẩu đăng nhập bị lưu đè vào cấu hình API sàn. Ngoài ra, trên trang Kênh bán OTA có chuỗi chưa render: `"Đồng bộ với {channel}"`.
* **Giải pháp kỹ thuật**:
  1. Thêm thuộc tính `autoComplete="new-password"` và `autoComplete="off"` cho tất cả các input nhạy cảm (Hotel ID, API Key, Secret, Passwords của Agoda, Booking, PayOS, SePay, Mắt Bão, MoMo).
  2. Bổ sung `name="channel_api_key_${channelId}"` độc lập để trình duyệt không gom nhóm với form đăng nhập.
  3. Sửa chuỗi i18n bị lỗi template: thay `{channel}` bằng tên kênh thực tế (Agoda, Booking.com, Airbnb...).
* **File can thiệp**:
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/channels/page.tsx`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/bank-accounts/payos-card.tsx`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/bank-accounts/sepay-card.tsx`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/bank-accounts/momo-card.tsx`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/invoices/einvoice-card.tsx`

---

### Task 44 [P0]: Bản xem trước cho chủ cơ sở & Chia sẻ phiên đăng nhập
* **Hiện trạng & Nguyên nhân**: Khi chủ khách sạn đã đăng nhập ở `digistay.vn`, mở `ten-ks.digistay.vn` vẫn bị 404 vì cookie phiên làm việc (`next-auth.session-token`) đang gắn chặt trên domain chính, không chia sẻ cho subdomains (`.digistay.vn`). Đồng thời trên bản xem trước nội bộ `digistay.vn/ten-ks`, khách hoặc chủ cơ sở điền hết form đặt phòng rồi mới báo lỗi 404 do API `/api/public/bookings` từ chối web chưa xuất bản.
* **Giải pháp kỹ thuật**:
  1. Cấu hình session cookie trong Auth options hỗ trợ wildcard domain:
     `cookie: { domain: process.env.NODE_ENV === 'production' ? '.digistay.vn' : undefined }`.
  2. Trong `src/middleware.ts` & public site resolver: Cho phép chủ cơ sở/nhân viên đã đăng nhập xem được website của cơ sở mình ngay cả khi `isPublished = false`.
  3. Trên giao diện trang xem trước chưa xuất bản: Hiển thị ngay banner cảnh báo cố định trên cùng: *"⚠️ Website đang ở chế độ xem trước (Chưa công khai cho du khách). Không thể thực hiện đặt phòng thật."* và vô hiệu hóa nút đặt phòng ngay tại bước chọn ngày/phòng, không để người dùng điền hết thông tin rồi mới báo lỗi.
* **File can thiệp**:
  - `src/lib/auth/auth-options.ts` / `src/lib/auth/index.ts`
  - `src/middleware.ts`
  - `src/app/(public)/[subdomain]/page.tsx`
  - `src/app/(public)/[subdomain]/rooms/[roomId]/BookingBox.tsx`

---

### Task 45 [P0]: Thu tiền khi trả phòng & Ghi nhận thanh toán
* **Hiện trạng & Nguyên nhân**: Khách trả phòng khi còn nợ tiền (ví dụ nợ 600.000đ) vẫn bấm Check-out thành công, nhưng không có hộp thoại thu tiền hoặc ghi nhận công nợ. Doanh thu và sổ quỹ không được cập nhật. Trên trang chi tiết đơn đặt phòng thiếu nút "Ghi nhận thanh toán" thủ công.
* **Giải pháp kỹ thuật**:
  1. Nâng cấp Modal "Trả phòng (Check-out)":
     - Nếu đơn còn số dư nợ (`remaining > 0`):
       - Hiển thị rõ số tiền cần thu.
       - Cho phép chọn: **"Thu tiền ngay"** (chọn hình thức: Tiền mặt, Chuyển khoản, Thẻ, VietQR) -> Hệ thống tự động tạo bản ghi `Payment`, ghi phiếu thu vào `Cashbook` (Sổ quỹ) và cập nhật doanh thu Báo cáo.
       - Hoặc chọn: **"Cho nợ / Trả phòng chưa thu hết"** -> Bắt buộc nhập ô Lý do (Ghi chú công nợ).
  2. Bổ sung nút **"Ghi nhận thanh toán"** trên trang chi tiết đơn đặt phòng (`/bookings/[id]`):
     - Lễ tân có thể bấm thu tiền bất cứ lúc nào (thu cọc thêm, thanh toán tiền phòng, dịch vụ phát sinh).
* **File can thiệp**:
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/bookings/[bookingId]/page.tsx`
  - `src/components/bookings/checkout-modal.tsx`
  - `src/app/api/bookings/[id]/checkout/route.ts`
  - `src/app/api/bookings/[id]/payments/route.ts`

---

### Task 46 [P0]: Nguồn đơn & Xác nhận đơn đặt phòng từ Website
* **Hiện trạng & Nguyên nhân**: Đơn tạo tại quầy đang bị lưu mặc định nguồn là `"Website"` (DIRECT), gây sai lệch báo cáo kênh bán. Đơn khách đặt qua website chọn hình thức "Thanh toán tại khách sạn" thì khách thấy "Chờ khách sạn xác nhận", nhưng trong admin đơn lại ghi "Chờ thanh toán" và thiếu nút xác nhận đơn.
* **Giải pháp kỹ thuật**:
  1. Trong form tạo đặt phòng nội bộ (`/bookings/new`):
     - Thêm ô chọn nguồn đơn rõ ràng: **"Tại quầy (Walk-in)"** [Mặc định] và **"Gọi điện (Phone)"**. Lưu đúng enum `source: 'WALK_IN' | 'PHONE'`.
  2. Với đơn từ website có phương thức thanh toán tại quầy (`PAY_ON_ARRIVAL`):
     - Hiển thị badge trạng thái chuẩn: **"Chờ xác nhận"**.
     - Bổ sung nút bấm **"Xác nhận đơn"** (Confirm Booking):
       - Khi bấm, cập nhật trạng thái đơn thành `CONFIRMED`.
       - Tự động kích hoạt gửi Email xác nhận đặt phòng chính thức tới email của khách hàng.
* **File can thiệp**:
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/bookings/new/page.tsx`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/bookings/[bookingId]/page.tsx`
  - `src/app/api/bookings/[id]/confirm/route.ts`

---

### Task 47 [P0]: Khách sạn mẫu (Demo Hotel) để bán hàng & Sửa ảnh vỡ trang 404
* **Hiện trạng & Nguyên nhân**: Trang chủ quảng bá liên kết `khach-san-demo.digistay.vn` nhưng đang bị 404 do chưa có dữ liệu cơ sở này trong database hoặc chưa xuất bản. Trang 404 của subdomain bị vỡ ảnh logo.
* **Giải pháp kỹ thuật**:
  1. Tạo kịch bản seed dữ liệu chuẩn cho cơ sở `khach-san-demo`:
     - Tên cơ sở: "Khách sạn Mẫu Digistay Demo Resort & Spa".
     - Subdomain: `khach-san-demo`.
     - Cấu hình đầy đủ: 4 hạng phòng (ảnh đẹp, giá ngày thường, giá cuối tuần), tiện ích, 4 dịch vụ, 6 món thực đơn, 2 bài viết tin tức, website đã xuất bản với giao diện mẫu Grand Luxury.
  2. Sửa đường dẫn ảnh logo trên trang lỗi 404 subdomain: sử dụng logo SVG hoặc đường dẫn tuyệt đối ổn định `/logo.png`.
* **File can thiệp**:
  - `prisma/seed.ts` hoặc script `scripts/seed-demo-hotel.ts`
  - `src/app/(public)/[subdomain]/not-found.tsx`
  - `src/app/(public)/not-found.tsx`

---

### Task 48 [P1]: Khách mua gói Digistay bằng PayOS (Tài khoản DIGISO)
* **Hiện trạng**: Trang Gói & thanh toán thông báo: *"Digistay chưa kết nối PayOS để nhận tiền mua gói"*.
* **Giải pháp kỹ thuật**:
  1. Cấu hình biến môi trường PayOS chính thức của DIGISO cho nền tảng:
     `DIGISTAY_PAYOS_CLIENT_ID`, `DIGISTAY_PAYOS_API_KEY`, `DIGISTAY_PAYOS_CHECKSUM_KEY`.
  2. Hoàn thiện luồng tạo đơn thanh toán gói: Tạo link thanh toán PayOS -> Hiển thị mã VietQR -> Khách quét mã chuyển tiền.
  3. Hoàn thiện webhook endpoint `/api/billing/webhook/payos`: Xác thực checksum -> Kích hoạt gói dịch vụ tự động cho Workspace -> Gửi email biên nhận thanh toán -> Lưu lịch sử thanh toán.
* **File can thiệp**:
  - `src/lib/billing/checkout.ts`
  - `src/app/api/billing/webhook/route.ts`
  - `src/app/(dashboard)/workspace/[slug]/(level)/billing/purchase-dialog.tsx`

---

### Task 49 [P1]: Cập nhật bảng giá thực tế & Cho phép Superadmin sửa giá
* **Hiện trạng**: Giá gói đang để số thử nghiệm: 2.000 / 5.000 / 10.000 đ/tháng, mua thêm 500 - 1.000 đ.
* **Giải pháp kỹ thuật**:
  1. Cập nhật bảng giá thực tế theo định vị sản phẩm (VD: Gói Starter ~199.000đ/tháng, Gói Growth ~399.000đ/tháng, Gói Pro ~799.000đ/tháng).
  2. Đồng bộ giá trên: Trang chủ, Trang Bảng giá (`/pricing`), Modal mua gói trong Workspace.
  3. Lưu bảng giá vào bảng `PlatformPlan` trong cơ sở dữ liệu để Superadmin có thể sửa giá trực tiếp từ trang Admin mà không cần phải deploy code.
* **File can thiệp**:
  - `src/lib/marketing/plans.ts`
  - `src/app/(public)/pricing/page.tsx`
  - `prisma/schema.prisma`

---

### Task 50 [P1]: Hoàn thiện tính năng Superadmin [ĐÃ HOÀN THÀNH 10/11/2026]
* **Hiện trạng & Lỗi đã xử lý**:
  1. Ngày kết thúc mặc định trong modal `PlanForm` ở trang chi tiết workspace bị trùng ngày hiện tại (nhỏ hơn `min = ngày mai`), khiến submit lỗi hoặc không phản hồi. Đã sửa default date tự động cộng 30 ngày và tối ưu quick buttons.
  2. Bọc và làm nổi bật link tên workspace trong danh sách khách hàng (`/admin/customers`) mở trực tiếp `/admin/customers/[workspaceId]`.
  3. Hoàn thiện 2 trang quản trị cốt lõi:
     - `/admin/plans`: Quản lý danh sách gói cước và giá bán động (Task 49).
     - `/admin/vouchers`: Quản lý voucher khuyến mãi toàn hệ thống (Task 50), hỗ trợ tạo voucher % hoặc số tiền cố định, giới hạn lượt dùng, thời hạn, gói áp dụng, bật/tắt, xóa voucher.
  4. Script cấp gói cước nội bộ `scripts/assign-user-plan.ts` hỗ trợ tìm kiếm linh hoạt theo email, username, họ tên (anh Thống hoặc nhân sự nội bộ).
  5. Script `scripts/cleanup-test-workspaces.ts` dọn dẹp các workspace test rác an toàn có cờ bảo vệ chống xóa nhầm đơn đã thanh toán.
* **File can thiệp**:
  - `prisma/schema.prisma` & migration `20261110200000_platform_vouchers`
  - `src/app/api/admin/vouchers/route.ts` & `src/app/api/admin/vouchers/[id]/route.ts`
  - `src/app/(dashboard)/admin/vouchers/page.tsx`
  - `src/components/admin/admin-frame.tsx`
  - `src/app/(dashboard)/admin/customers/[workspaceId]/page.tsx`
  - `src/app/(dashboard)/admin/customers/page.tsx`
  - `src/components/admin/account-actions.tsx`
  - `scripts/assign-user-plan.ts` & `scripts/cleanup-test-workspaces.ts`
  - `messages/dash/vi/admin.json` & `messages/dash/en/admin.json`

---

### Task 51 [P1]: Xử lý hết hạn dùng thử (7 ngày ân hạn website) [ĐÃ HOÀN THÀNH 10/11/2026]
* **Hiện trạng & Giải pháp đã hoàn thành**:
  1. Khi hết hạn dùng thử:
     - Dashboard chuyển sang chế độ **Chỉ xem (View-only)**: Chặn tạo thêm cơ sở mới (`POST /api/properties`), tạo thêm phòng (`POST /api/properties/[id]/room-types`), tạo đơn mới tại quầy (`POST /api/bookings`) trả về mã 402 với thông báo rõ ràng `TRIAL_EXPIRED_READONLY`.
     - Website khách sạn (`[subdomain].digistay.vn` và `POST /api/public/bookings`) vẫn tiếp tục hoạt động nhận khách bình thường trong **7 ngày ân hạn (Grace Period)**.
     - Sau 7 ngày nếu không gia hạn (`state === 'locked'`), website chuyển sang trạng thái tạm dừng nhận khách online (thông báo khách gọi điện thoại trực tiếp). Toàn bộ dữ liệu được bảo lưu 100%.
  2. Hệ thống Cron tự động gửi email nhắc hạn đa tầng trước **7 ngày**, **3 ngày** (`soon3`) và **1 ngày** (`soon1`), trong email có sẵn nút gia hạn 1-click dẫn thẳng vào thanh toán PayOS.
* **File can thiệp**:
  - `src/lib/billing/period.ts` & `src/lib/billing/period.test.ts`
  - `src/lib/billing/guard.ts`
  - `src/lib/billing/emails.ts`
  - `src/app/api/bookings/route.ts`
  - `src/app/(public)/[subdomain]/dat-phong/page.tsx`
  - `src/app/(public)/[subdomain]/_components/booking/frame.tsx`
  - `src/lib/i18n/api-errors.en.json`

---

### Task 52 [P1]: Chatbot AI trả lời đúng phòng trống theo thời gian thực [ĐÃ HOÀN THÀNH 10/11/2026]
* **Hiện trạng & Lỗi đã xử lý**:
  1. Hỏi "Cuối tuần này (14-15/11) còn phòng cho 2 người lớn không" -> Bộ trích xuất ngày bị match trước bởi từ khóa "cuối tuần" nhảy sang Thứ 6 (13/11) đến Chủ Nhật (15/11) thay vì 14-15/11, và regex cũ thiếu pattern ngày rút gọn `14-15/11`. Đã nâng cấp parser ưu tiên các pattern ngày tường minh (`14-15/11`, `14 đến 15/11`, `14 - 15 tháng 11`, `thứ 7 tuần sau`, `thứ bảy tuần sau`) trước khi xét từ khóa tương đối ("cuối tuần", "ngày mai").
  2. Đồng bộ truy vấn tồn kho thời gian thực với Booking Engine qua `roomsTakenByType` và định giá chuẩn xác `quoteStay`.
  3. Xử lý trường hợp cơ sở chưa kích hoạt nhận đặt phòng online (chưa xuất bản web, hết hạn gói khóa read-only, hoặc chưa có phòng): Bot phản hồi lịch thiệp *"Dạ hiện khách sạn chưa mở nhận đặt trực tuyến qua website, quý khách vui lòng liên hệ hotline: [SĐT] để được phục vụ chu đáo nhất ạ!"*.
  4. Chuẩn hóa link đặt phòng trực tiếp trên thẻ phòng (`roomCards`): Sử dụng tham số chuẩn `room=${rt.id}` (và `roomTypeId`) kết hợp hook `useSiteHref()` điều hướng chính xác vào bước điền thông tin đặt phòng trên cả subdomain riêng lẫn domain chính.
* **File can thiệp**:
  - `src/lib/ai/room-finder.ts` & `src/lib/ai/room-finder.test.ts`
  - `src/lib/ai/chatbot.ts` & `src/lib/ai/chatbot.test.ts`
  - `src/app/(public)/[subdomain]/_components/WebsiteChatbot.tsx`

---

### Task 53 [P1]: Tích hợp AI thật (Google Gemini) viết bài & mô tả phòng [ĐÃ HOÀN THÀNH 10/11/2026]
* **Hiện trạng & Lỗi đã xử lý**:
  1. Tích hợp trực tiếp Google Gemini API chính thức với model `gemini-2.5-flash` (tương thích `gemini-1.5-flash` và `gemini-2.0-flash`), loại bỏ định danh model hư cấu `gemini-3.1-flash-lite` gây lỗi 404.
  2. Bổ sung `GEMINI_API_KEY` vào `.env.production.template` để triển khai đồng bộ lên VPS môi trường Docker production.
  3. Xóa bỏ hoàn toàn text điền sẵn mẫu (hardcoded state) trong ô nhập từ khóa của `AiWriterModal`, ô nhập bắt đầu trống với placeholder gợi ý trực quan, người dùng không cần phải xóa text trước khi gõ.
  4. Nâng cấp bộ parse JSON phản hồi từ Gemini tự động trích xuất khối JSON chuẩn xác ngay cả khi model trả về markdown fence hoặc phần giới thiệu.
  5. Xây dựng module quản lý hạn ngạch AI (`src/lib/ai/quota.ts`) kiểm soát lượt sinh nội dung hàng tháng theo từng gói cước:
     - Dùng thử (Trial): 15 lượt / tháng
     - Gói Starter: 30 lượt / tháng
     - Gói Growth: 100 lượt / tháng
     - Gói Business / Pro: 300 lượt / tháng
     - Tự động ghi nhận `ActivityLog` và hiển thị trực quan số lượt còn lại trên giao diện modal AI.
* **File can thiệp**:
  - `src/lib/ai/quota.ts`
  - `src/lib/ai/content-generator.ts` & `src/lib/ai/content-generator.test.ts`
  - `src/lib/ai/chatbot.ts`
  - `src/lib/pricing/dynamic-pricing.ts`
  - `src/app/api/properties/[id]/ai/generate-content/route.ts`
  - `src/app/api/properties/[id]/ai/config/route.ts`
  - `src/components/ai/ai-writer-modal.tsx`
  - `src/lib/i18n/api-errors.en.json`
  - `.env.production.template`

---

### Task 54 [P1]: Gắn nhãn "Sắp ra mắt" kênh OTA & Triển khai đồng bộ iCal [ĐÃ HOÀN THÀNH 10/11/2026]
* **Hiện trạng & Giải pháp đã thực hiện**:
  1. Gắn nhãn badge **"Sắp ra mắt"** trên thẻ các kênh direct API (`AGODA`, `BOOKING_COM`, `TRAVELOKA`, `EXPEDIA`), tạm khóa nút kết nối API trực tiếp kèm tooltip hướng dẫn dùng đồng bộ lịch iCal trong khi chờ đối tác chứng thực API chính thức.
  2. Kênh `AIRBNB`: Gắn nhãn **"Hỗ trợ qua iCal (.ics)"** kèm nút tắt chuyển nhanh đến phần Đồng bộ iCal.
  3. Xây dựng model `IcalSyncFeed` và migration cơ sở dữ liệu `20261110210000_ical_sync_feeds` liên kết `Property` và `RoomType`.
  4. Triển khai engine đồng bộ lịch 2 chiều chuẩn RFC 5545 (`src/lib/ota/ical-sync.ts`):
     - **Export iCal**: Sinh nội dung `.ics` chuẩn chứa các đơn đặt phòng hiện có (`Booking`) và các khoảng khóa/bảo trì (`RoomLock`) qua endpoint công khai an toàn `/api/channels/ical/export/[token]`.
     - **Import iCal**: Tải và phân tích cú pháp `.ics` (unfolding multi-line, UID, DTSTART, DTEND, SUMMARY) từ link sàn (Airbnb, Booking.com, v.v.), tự động tạo các bản ghi `RoomLock` (`type: 'BLOCKED'`) để trừ phòng trống trên toàn bộ website đặt phòng trực tiếp và trợ lý ảo AI chatbot, ngăn chặn 100% tình trạng trùng phòng (overbooking).
  5. Cung cấp bộ API quản trị CRUD và kích hoạt đồng bộ thủ công:
     - `GET/POST /api/properties/[id]/channels/ical`
     - `PUT/DELETE /api/properties/[id]/channels/ical/[feedId]`
     - `POST /api/properties/[id]/channels/ical/[feedId]/sync`
  6. Xây dựng giao diện khu vực **Đồng bộ lịch chuẩn iCalendar (.ics)** trên trang Kênh OTA: bảng quản lý các feed theo loại phòng, sao chép Export URL 1-click, trạng thái lần đồng bộ cuối, và modal tạo liên kết iCal mới.
* **File can thiệp**:
  - `prisma/schema.prisma`
  - `prisma/migrations/20261110210000_ical_sync_feeds/migration.sql`
  - `src/lib/ota/ical-sync.ts` & `src/lib/ota/ical-sync.test.ts`
  - `src/app/api/channels/ical/export/[token]/route.ts`
  - `src/app/api/properties/[id]/channels/ical/route.ts`
  - `src/app/api/properties/[id]/channels/ical/[feedId]/route.ts`
  - `src/app/api/properties/[id]/channels/ical/[feedId]/sync/route.ts`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/channels/page.tsx`
  - `src/app/api/route-policy.test.ts`
  - `src/lib/i18n/api-errors.en.json`

---

### Task 55 [P1]: Bỏ tính năng xuất hóa đơn điện tử cho khách sạn (Chỉ giữ Mắt Bão xuất hóa đơn khi mua gói Digistay) [ĐÃ HOÀN THÀNH 10/11/2026]
* **Hiện trạng & Giải pháp đã thực hiện**:
  1. **Ẩn menu Hóa đơn điện tử phía khách sạn**:
     - Loại bỏ mục `{ key: 'invoices', href: routes.propertyInvoices(slug, id), can: ['invoices_manage'], group: 'finance' }` khỏi Sidebar điều hướng cơ sở trong [`src/components/layout/nav.ts`](file:///d:/workInProcess/Digistay/src/components/layout/nav.ts). Tất cả vai trò (Chủ, Quản lý, Lễ tân) không còn thấy mục HĐĐT khách sạn trên thanh điều hướng.
     - Cập nhật unit test điều hướng [`src/components/layout/nav.test.ts`](file:///d:/workInProcess/Digistay/src/components/layout/nav.test.ts).
     - Thêm banner thông báo chính sách rõ ràng trên trang [`properties/[id]/invoices/page.tsx`](file:///d:/workInProcess/Digistay/src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/invoices/page.tsx) trong trường hợp người dùng truy cập trực tiếp bằng URL.
  2. **Dọn dẹp nội dung Marketing & Bảng giá**:
     - Cập nhật [`messages/vi.json`](file:///d:/workInProcess/Digistay/messages/vi.json) và [`messages/en.json`](file:///d:/workInProcess/Digistay/messages/en.json): Chuyển khối tính năng tài chính từ "Đối soát PayOS và hoá đơn điện tử" sang "Đối soát PayOS và quản lý dòng tiền", tập trung vào kiểm soát cọc tự động 24/7, sổ quỹ và báo cáo doanh thu.
     - Cập nhật câu hỏi thường gặp FAQ: Khẳng định rõ Digistay xuất hóa đơn điện tử GTGT qua Mắt Bão khi khách hàng mua/gia hạn các gói phần mềm Digistay.
     - Cập nhật bảng so sánh tính năng [`src/lib/marketing/plans.ts`](file:///d:/workInProcess/Digistay/src/lib/marketing/plans.ts): Dòng `einvoice` đổi thành "Hoá đơn VAT gói Digistay" (áp dụng cho mọi gói thanh toán).
  3. **Bảo toàn 100% module Mắt Bão cho Gói cước phần mềm Digistay**:
     - Giữ nguyên toàn bộ logic phát hành HĐĐT tự động của nền tảng tại [`src/lib/billing/einvoice.ts`](file:///d:/workInProcess/Digistay/src/lib/billing/einvoice.ts), bảng `SubscriptionInvoice`, webhook Mắt Bão nền tảng và trang quản trị hóa đơn gói `/admin/system`.
* **File can thiệp**:
  - `src/components/layout/nav.ts` & `src/components/layout/nav.test.ts`
  - `src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/invoices/page.tsx`
  - `src/lib/marketing/plans.ts`
  - `messages/vi.json` & `messages/en.json`

---

### Task 56 [P1]: Thử nghiệm thật PayOS nhận cọc của khách sạn
* **Mục tiêu**: Kiểm thử thực tế dòng tiền nhận cọc của khách sạn qua tài khoản PayOS thật.
* **Kịch bản thực hiện**:
  1. Cấu hình 1 tài khoản PayOS thật cho cơ sở test.
  2. Đặt phòng trên website cơ sở với số tiền cọc nhỏ (ví dụ 2.000đ).
  3. Quét mã QR VietQR từ app ngân hàng thanh toán thật 2.000đ.
  4. Kiểm chứng: Webhook PayOS bắt tự động -> Đơn đổi sang "Đã cọc" -> Email gửi cho khách và chủ -> Ghi nhận tự động vào mục Thanh toán và Báo cáo.
* **File can thiệp**:
  - `src/lib/payments/payos.ts`
  - `src/app/api/payments/webhook/payos/route.ts`

---

## LỘ TRÌNH THỰC HIỆN ĐỀ XUẤT (3 BƯỚC)

```mermaid
flowchart TD
    subgraph Sprint 1: Khẩn cấp P0
        T41[Task 41: Nút Xuất bản website tức thì]
        T42[Task 42: Sửa giá cuối tuần T6-T7]
        T43[Task 43: Chặn autofill mật khẩu ô API]
        T44[Task 44: Bản xem trước & Session subdomain]
        T45[Task 45: Thu tiền khi Check-out & Nút thanh toán]
        T46[Task 46: Nguồn đơn & Xác nhận đơn Web]
        T47[Task 47: Khách sạn Demo & Sửa logo 404]
    end

    subgraph Sprint 2: Quản trị & Bán gói P1
        T48[Task 48: Mua gói bằng PayOS]
        T49[Task 49: Bảng giá thật & sửa giá]
        T50[Task 50: Chức năng Superadmin]
        T51[Task 51: Xử lý hết hạn dùng thử & Ân hạn]
    end

    subgraph Sprint 3: Tính năng nâng cao P1
        T52[Task 52: Chatbot hỏi phòng trống chuẩn]
        T53[Task 53: Tích hợp Gemini AI thật]
        T54[Task 54: Gắn nhãn OTA & Đồng bộ iCal]
        T55[Task 55: Bỏ HĐĐT khách sạn, giữ HĐĐT gói Digistay]
        T56[Task 56: Test thực tế PayOS nhận cọc 2k]
    end

    T41 --> T44
    T42 --> T45
    T45 --> T46
    T46 --> T47
    T47 --> Sprint 2
    Sprint 2 --> Sprint 3
```

