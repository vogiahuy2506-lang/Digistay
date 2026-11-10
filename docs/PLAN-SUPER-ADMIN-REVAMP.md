# KẾ HOẠCH NÂNG CẤP & TÁI CẤU TRÚC TOÀN DIỆN SUPER ADMIN (SUPER ADMIN 2.0)

> **Tài liệu chiến lược & Lộ trình kỹ thuật**  
> **Dự án**: Digistay - Nền tảng Quản trị & Website Khách Sạn Trực Tuyến  
> **Ngày cập nhật**: 10/11/2026  
> **Mục tiêu**: Lột xác hoàn toàn giao diện (UI/UX) theo chuẩn Enterprise SaaS và nâng cấp bộ tính năng quản trị tối thượng, xóa bỏ triệt để các hạn chế hiện tại (đặc biệt là quản lý gói cước động & tạo gói tùy chỉnh).

---

## I. BỐI CẢNH & NHỮNG ĐIỂM BẤT TIỆN LỚN CẦN GIẢI QUYẾT

### 1. Vấn đề cốt lõi về Quản lý Gói cước (Plans Engine)
* **Hiện tại**: Hệ thống bị gắn chặt cứng vào 3 định danh gói (`starter`, `growth`, `business`) trong mã nguồn TypeScript (`PLAN_IDS = ['starter', 'growth', 'business'] as const`).
* **Hậu quả bất tiện**:
  - Super Admin **không thể tự tạo thêm gói mới** (ví dụ: *Gói Dùng thử VIP 30 ngày*, *Gói Homestay Mini*, *Gói Chuỗi Khách Sạn 20 Cơ Sở*...).
  - **Không thể tạo gói cước tùy chỉnh (Custom / Enterprise Plan)** riêng cho một đối tác hoặc chuỗi khách sạn đặc thù đàm phán giá và hạn mức riêng.
  - Không thể bật/tắt linh hoạt các tính năng (feature flags: tên miền riêng, chatbot AI, đồng bộ iCal, v.v.) theo từng gói mà phải sửa code.

### 2. Vấn đề về Giao diện & Trải nghiệm (UI/UX)
* **Header tab ngang lỗi thời**: `AdminFrame` dùng thanh tab ngang trượt ngang (`overflow-x-auto`). Khi thêm nhiều mục, thanh tab bị tràn mép, chữ bị che khuất trên laptop và tablet, không hiển thị trực quan cấu trúc trang.
* **Trang Hệ thống (`/admin/system`) quá thô sơ**: Dùng chữ và viền đơn sắc dạng báo cáo kỹ thuật thô, không có biểu đồ trạng thái, không thể hiện được đẳng cấp của một SaaS chuyên nghiệp.
* **Thiếu thanh tìm kiếm thông minh toàn cầu (Universal Search)**: Khi cần tìm một khách sạn, một chủ cơ sở, một mã đơn PayOS hay một voucher, admin phải vào từng trang riêng để gõ tìm kiếm.
* **Chưa có tính năng Đăng nhập hộ (Impersonation)**: Mỗi khi khách hàng cần hỗ trợ kỹ thuật, Super Admin không thể bấm vào xem Dashboard dưới góc nhìn của khách sạn đó mà phải hỏi mật khẩu hoặc đoán lỗi.

---

## II. MA TRẬN SO SÁNH: TÍNH NĂNG HIỆN CÓ VS TÍNH NĂNG CẦN CÓ (SUPER ADMIN 2.0)

| Phân hệ chức năng | Hiện trạng (v1.0) | Đề xuất Super Admin 2.0 (Mới & Nâng cấp) |
| :--- | :--- | :--- |
| **Giao diện & Bố cục** | Header ngang trượt tab hẹp, thiếu sidebar, layout rời rạc. | **Sidebar cố định chuẩn SaaS Enterprise** (Collapsible, icon Lucide sắc nét, Dark/Light mode chuẩn token, badge cảnh báo đỏ). |
| **Tìm kiếm toàn cầu** | Không có (chỉ tìm trong từng bảng). | **Universal Search Bar (`Ctrl + K`)**: Gõ tìm tức thì Khách sạn, Email chủ, Mã đơn PayOS, Mã voucher, Subdomain. |
| **Quản lý Gói cước** | Cố định 3 gói (chỉ sửa được giá tiền và giới hạn phòng của 3 gói này). | **Engine Gói Động & Gói Tùy Chỉnh (Custom Plans)**: Tạo gói mới không giới hạn, bật/tắt Feature Flags, tạo Gói Riêng (Private) gán cho khách VIP. |
| **Hỗ trợ Khách hàng (CSKH)** | Không có tính năng đăng nhập hộ. | **Impersonation ("Xem dưới danh nghĩa khách")**: 1-click vào thẳng Dashboard khách sạn để hỗ trợ, có banner cảnh báo thoát admin. |
| **Quản lý Cơ sở (Properties)** | Chỉ xem danh sách gom theo Workspace. | **Trang quản lý tập trung toàn bộ Khách sạn (`/admin/properties`)**: Lọc theo tỉnh/thành, subdomain, tên miền riêng, trạng thái live, preview 1-click. |
| **Giám sát Đơn đặt phòng** | Chỉ xem đơn mua gói phần mềm của khách sạn. | **All Bookings Monitor (`/admin/bookings`)**: Theo dõi dòng đơn khách du lịch đặt phòng toàn sàn, tổng GMV, cảnh báo đơn cọc PayOS lỗi. |
| **Báo cáo & Tăng trưởng** | Chỉ có 4 ô KPI tĩnh đơn giản. | **Analytics Dashboard trực quan**: Biểu đồ doanh thu MRR/ARR, tỷ lệ chuyển đổi Trial → Paid, phân bổ gói cước, số phòng đang vận hành. |
| **Giám sát Hạ tầng** | Trang text thô sơ, khó đọc. | **System Health Dashboard**: Thẻ trạng thái Postgres, Redis latency, PayOS Webhook, hạn ngạch Gemini AI, dung lượng ảnh Cloudinary, Backup DB. |
| **Kiểm toán & Lịch sử** | Bảng activity log cơ bản. | **Audit Log chuyên sâu**: Lưu vết mọi can thiệp của Admin (tặng ngày dùng thử, đổi gói, khóa tài khoản, impersonation) kèm IP và lý do. |

---

## III. THIẾT KẾ CHI TIẾT TÍNH NĂNG TRỌNG TÂM: QUẢN LÝ GÓI ĐỘNG & GÓI TÙY CHỈNH

### 1. Cấu trúc Mô hình Dữ liệu Mới (`SubscriptionPlan`)
Chuyển đổi từ hằng số tĩnh (`PLANS`) sang bảng cơ sở dữ liệu `subscription_plans`:

```prisma
model SubscriptionPlan {
  id              String      @id @default(cuid())
  code            String      @unique // e.g. "starter", "growth", "business", "vip-homestay", "custom-vinpearl"
  name            String      // Tên hiển thị: "Gói Starter", "Gói Doanh Nghiệp VIP"
  description     String?     @db.Text
  priceMonthly    Float       // Giá thuê bao tháng (VNĐ)
  priceYearly     Float       // Giá thuê bao năm (VNĐ)
  
  // Hạn mức tài nguyên (Resource Limits)
  maxProperties   Int         @default(1)    // Số cơ sở tối đa
  maxRooms        Int         @default(15)   // Số phòng tối đa
  maxStaff        Int         @default(3)    // Số nhân viên tối đa
  monthlyAiQuota  Int         @default(30)   // Lượt tạo nội dung AI / tháng
  
  // Công tắc tính năng (Feature Flags)
  hasCustomDomain Boolean     @default(false)// Cho phép dùng tên miền riêng
  hasChatbotAi    Boolean     @default(true) // Cho phép bật AI Chatbot
  hasOtaIcalSync  Boolean     @default(true) // Cho phép đồng bộ iCal OTA
  hasDailyReports Boolean     @default(true) // Báo cáo nâng cao & sổ quỹ
  
  // Thuộc tính hiển thị & Phân loại
  isPublic        Boolean     @default(true) // Hiện công khai trên bảng giá website hay là Gói Riêng (Private/Custom)
  isActive        Boolean     @default(true) // Đang kinh doanh hay đã ngừng nhận đăng ký mới
  isFeatured      Boolean     @default(false)// Gắn nhãn "Phổ biến nhất" / "Được khuyên dùng"
  displayOrder    Int         @default(0)    // Thứ tự sắp xếp trên bảng giá
  
  // Liên kết
  workspaces      Workspace[] // Các workspace đang áp dụng gói này
  orders          PlanOrder[] // Các đơn hàng mua gói này
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@map("subscription_plans")
}
```

### 2. Giao diện Quản lý Gói cước (Super Admin Plans UI)
* **Lưới thẻ gói trực quan (Grid Cards)**:
  - Hiển thị từng gói kèm giá tiền, hạn mức phòng/cơ sở/nhân viên, số workspace hiện đang dùng gói.
  - Huy hiệu phân biệt: `Công khai (Public)` vs `Gói tùy chỉnh (Custom / Private)`.
  - Nút bật/tắt trạng thái kinh doanh nhanh chóng (`Active / Inactive`).
* **Modal "Tạo gói cước mới" / "Tạo gói tùy chỉnh"**:
  - **Thông tin chung**: Tên gói, Mã gói (`slug`), Mô tả ngắn, Thứ tự hiển thị.
  - **Định giá**: Giá theo tháng (VNĐ) và Giá theo năm (VNĐ hoặc tự động tính -2 tháng).
  - **Hạn mức**: Số cơ sở tối đa, Số phòng tối đa, Số nhân sự tối đa, Hạn ngạch AI Gemini/tháng.
  - **Bộ chọn tính năng (Feature Switches)**: Checkbox bật/tắt Tên miền riêng, Chatbot AI, Đồng bộ iCal, Hóa đơn VAT, v.v.
  - **Phân loại**:
    - `Gói công khai`: Hiện lên trang Bảng giá (`/pricing`) cho mọi khách hàng tự mua.
    - `Gói tùy chỉnh (Custom Private)`: Ẩn khỏi bảng giá chung. Super Admin gán trực tiếp cho một Workspace cụ thể, hoặc cấp link mua gói riêng có mã bảo mật.
* **Gán gói tùy chỉnh cho Khách hàng**:
  - Tại trang chi tiết Workspace (`/admin/customers/[workspaceId]`), Super Admin có thể chọn bất kỳ gói nào (kể cả gói Custom) hoặc chỉnh tay hạn mức riêng (Overriding limits) mà không cần can thiệp database.

---

## IV. THIẾT KẾ GIAO DIỆN MỚI (SUPER ADMIN 2.0 UI/UX DESIGN SYSTEM)

### 1. Bố cục Khung làm việc (Sidebar Layout)
* **Bên trái: Sidebar Cố định (Fixed Navigation)**
  - Logo Digistay & Huy hiệu phát sáng: `SUPER ADMIN PLATFORM`.
  - Danh mục được nhóm logic:
    - **TỔNG QUAN**:
      - 📊 `Tổng quan & Tăng trưởng` (`/admin`)
      - 📈 `Phân tích Doanh thu (SaaS MRR)` (`/admin/analytics`)
    - **QUẢN TRỊ KHÁCH HÀNG & CƠ SỞ**:
      - 🏢 `Danh sách Workspace & Chủ` (`/admin/customers`)
      - 🏨 `Tất cả Khách sạn & Website` (`/admin/properties`)
      - 🛎️ `Giám sát Đơn đặt phòng` (`/admin/bookings`)
    - **KINH DOANH & GÓI CƯỚC**:
      - 💳 `Quản lý Gói cước & Tùy chỉnh` (`/admin/plans`)
      - 🧾 `Đơn hàng thanh toán gói` (`/admin/orders`)
      - 🎟️ `Voucher & Khuyến mãi` (`/admin/vouchers`)
    - **HẠ TẦNG & HỆ THỐNG**:
      - 🖥️ `Sức khỏe Hệ thống (Health & Jobs)` (`/admin/system`)
      - 📜 `Nhật ký Hoạt động (Audit Logs)` (`/admin/activity`)
  - Chân Sidebar: Hồ sơ Admin, Nút chuyển Dark/Light mode, Nút "Thoát về Workspace".
* **Ở trên: Topbar Thông Minh (Universal Topbar)**
  - Thanh tìm kiếm thông minh `Universal Search` với phím tắt `Ctrl + K`.
  - Trạng thái kết nối nhanh (Redis OK, DB OK, PayOS OK).
  - Chuông thông báo sự cố hệ thống hoặc đơn hàng quá hạn chưa xử lý.
* **Khu vực Nội dung (Content Canvas)**:
  - Khung rộng `max-w-7xl`, nền phân tầng `bg-page` và thẻ `bg-panel` hiện đại, bo góc mềm mại (`rounded-box`), viền tinh tế (`border-line`).

---

## V. CÁC TÍNH NĂNG MỚI NỔI BẬT KHÁC

### 1. Tính năng "Đăng nhập hộ" (Impersonation)
* **Mục đích**: Hỗ trợ kỹ thuật và chăm sóc khách hàng tức thì không cần xin mật khẩu.
* **Cách vận hành**:
  1. Trên dòng thông tin bất kỳ Workspace nào tại `/admin/customers`, có nút **"Truy cập Workspace" (Impersonate)**.
  2. Hệ thống mã hóa một phiên tạm thời an toàn (thời hạn 2 giờ, lưu nhật ký `IMPERSONATION_STARTED`).
  3. Mở thẳng Dashboard của khách sạn đó với một **Banner màu cam cố định ở đỉnh màn hình**:
     > ⚠️ *Bạn đang đăng nhập dưới danh nghĩa: **Khách sạn Biển Nhớ** (hoangphuc@gmail.com). Mọi thao tác đều được ghi lại trong nhật ký kiểm toán. [Quay lại Super Admin]*
  4. Bấm nút "Quay lại Super Admin" để lập tức hủy phiên tạm và trở về trang quản trị tối cao.

### 2. Giám sát Toàn bộ Khách sạn (`/admin/properties`)
* Tra cứu danh sách toàn bộ khách sạn đang tạo trên hệ thống.
* Bộ lọc đa chiều:
  - Trạng thái: Đã xuất bản (Live) / Đang soạn thảo (Draft) / Đang khóa (Locked do nợ cước).
  - Tỉnh / Thành phố: Đà Lạt, Nha Trang, Vũng Tàu, Đà Nẵng, Hà Nội, TP.HCM...
  - Tên miền: Có tên miền riêng / Dùng subdomain Digistay.
* Tác vụ nhanh:
  - 1-Click mở link xem trực tiếp website của khách sạn (`nhphuc.digistay.vn` hoặc `tenmienrieng.vn`).
  - Khóa tạm thời website nếu khách sạn có dấu hiệu lừa đảo / nợ cước.

### 3. Giám sát Đơn đặt phòng Toàn sàn (`/admin/bookings`)
* Thống kê tổng số đêm phòng và tổng doanh thu đặt phòng (GMV) toàn nền tảng.
* Tìm kiếm đơn phòng theo mã đơn (ví dụ `BK-2026-XXXX`), tên khách, số điện thoại hoặc cơ sở lưu trú.
* Hỗ trợ gỡ lỗi giao dịch: Xem chi tiết trạng thái thanh toán PayOS cọc của khách, lịch sử webhook để hỗ trợ chủ cơ sở khi khách thắc mắc tiền cọc.

### 4. Bảng điều khiển Sức khỏe Hệ thống (`/admin/system` 2.0)
* Giao diện thẻ trực quan thay thế bảng chữ đơn điệu:
  - **Database Postgres**: Tình trạng kết nối, số connection hoạt động, kích thước DB, thời gian backup gần nhất.
  - **Redis Cache**: Tỷ lệ bộ nhớ, ping latency, số khóa rate limit đang lưu.
  - **Google Gemini AI**: Số lượt tạo nội dung và hỏi chatbot trong tháng, trạng thái API Key.
  - **Cổng PayOS**: Tình trạng Webhook nền tảng, danh sách giao dịch gần nhất.
  - **Hàng đợi Email & Cronjob**: Trạng thái các tiến trình chạy nền (nhắc giỏ hàng bỏ quên, nhắc thanh toán gói, dọn dẹp dữ liệu quá 30 ngày).

---

## VI. LỘ TRÌNH THỰC HIỆN CHI TIẾT (4 SPRINT)

```mermaid
flowchart TD
    subgraph Sprint 1: Khung Layout & Giao diện Sidebar Mới
        S1_1[Thiết kế AdminSidebarLayout chuẩn SaaS]
        S1_2[Universal Search Bar Ctrl+K]
        S1_3[Chuyển đổi theme & responsive hoàn chỉnh]
    end

    subgraph Sprint 2: Engine Gói Động & Gói Tùy Chỉnh
        S2_1[Tạo model SubscriptionPlan & Migration DB]
        S2_2[API CRUD gói cước động & Feature Flags]
        S2_3[Giao diện /admin/plans mới: Thẻ gói & Modal tạo gói Custom]
        S2_4[Chức năng gán gói Custom cho Workspace tại /admin/customers]
    end

    subgraph Sprint 3: Impersonation & Quản trị Cơ sở Toàn sàn
        S3_1[Cơ chế bảo mật phiên tạm Impersonate & Banner cảnh báo]
        S3_2[Trang quản lý toàn bộ cơ sở /admin/properties]
        S3_3[Trang giám sát đơn đặt phòng toàn sàn /admin/bookings]
    end

    subgraph Sprint 4: Nâng cấp Overview & System Health
        S4_1[Làm mới Dashboard /admin với biểu đồ MRR & tăng trưởng]
        S4_2[Làm mới /admin/system với thẻ đo lường Postgres/Redis/PayOS/AI]
        S4_3[Kiểm thử toàn diện, verify 100% test suite & build production]
    end

    Sprint 1 --> Sprint 2
    Sprint 2 --> Sprint 3
    Sprint 3 --> Sprint 4
```

---

## VII. TIÊU CHÍ NGHIỆM THU (SUCCESS CRITERIA)

1. **Giao diện hiện đại**: Super Admin sở hữu thanh Sidebar cố định chuyên nghiệp, sang trọng, tương thích tốt trên cả máy tính để bàn, laptop và thiết bị di động.
2. **Linh hoạt tối đa về gói cước**:
   - Super Admin có thể tạo gói cước mới tùy ý trực tiếp trên giao diện chỉ trong 30 giây.
   - Hỗ trợ tạo gói Tùy chỉnh (Custom Private Plan) và gán ngay cho khách hàng cụ thể.
   - Bảng giá công khai (`/pricing`) và trang Mua gói (`/billing/checkout`) tự động cập nhật đồng bộ từ cơ sở dữ liệu.
3. **Hiệu suất hỗ trợ khách hàng**:
   - Tính năng "Đăng nhập hộ" (Impersonation) hoạt động trơn tru, giúp kỹ thuật viên và CSKH kiểm tra lỗi của khách sạn trong vòng 5 giây.
4. **Độ ổn định & An toàn**:
   - Đảm bảo 100% unit tests và integration tests vượt qua (`0 failed`).
   - Mọi hành động can thiệp của Super Admin đều được ghi nhận vào nhật ký kiểm toán `ActivityLog`.
