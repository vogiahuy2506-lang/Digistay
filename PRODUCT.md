# Tài Liệu Sản Phẩm: Digistay (Digistay Product Specification)

<!-- digistay:product-specification 2.0 -->

## 1. Tổng Quan Nền Tảng (Platform Overview)

**Digistay** là nền tảng tất-cả-trong-một (All-in-One Hospitality Operating System & Direct Booking Engine) dành cho các khách sạn độc lập, homestay cao cấp, boutique resort và chuỗi cơ sở lưu trú tại Việt Nam.

Digistay giải quyết hai bài toán sống còn của chủ khách sạn:
1. **Giải phóng khỏi phụ thuộc kênh trung gian (OTA Dependency)**: Cung cấp website đặt phòng trực tiếp không mất phí hoa hồng, tiền cọc chuyển khoản thẳng vào tài khoản ngân hàng của khách sạn thông qua VietQR / PayOS.
2. **Hợp nhất vận hành tại quầy lễ tân (Unified Front-Desk Operations)**: Quản lý toàn diện lịch buồng phòng, quy trình nhận/trả phòng nhanh, tích hợp thanh toán VietQR động, khai báo cư trú tự động gửi cơ quan Công an, xuất hóa đơn điện tử hợp chuẩn Tổng cục Thuế và sổ quỹ thu chi minh bạch.

---

## 2. Các Nhóm Người Dùng Mục Tiêu (Target Personas)

1. **Chủ cơ sở lưu trú (Hotel Owner / GM)**:
   - *Mục tiêu*: Giữ tối đa lợi nhuận biên bằng cách tăng tỷ trọng đặt phòng trực tiếp (Direct Booking), quản lý doanh thu theo thời gian thực từ xa, kiểm soát thất thoát tiền mặt và chi phí hoa hồng OTA.
   - *Tính năng trọng tâm*: Báo cáo doanh thu & công suất phòng, quản lý nhân viên & phân quyền RBAC, kết nối ngân hàng VietQR, website builder độc quyền, cấu hình gói cước và hóa đơn điện tử.

2. **Nhân viên Lễ tân & Quản lý Ca (Front-Desk Staff & Shift Leads)**:
   - *Mục tiêu*: Thao tác nhận phòng (Check-in), trả phòng (Check-out) trong vòng dưới 30 giây; không bao giờ bị overbooking; không nhầm lẫn tiền cọc/tiền phòng; vận hành ca đêm êm ái với Dark Mode.
   - *Tính năng trọng tâm*: Lịch phòng trực quan (Room Calendar Timeline), hộp thoại Check-out tự tính phụ thu và sinh mã VietQR động theo đơn, kiểm tra định danh CCCD/Hộ chiếu với tải ảnh giấy tờ, xuất báo cáo lưu trú BCA, ghi chép sổ quỹ tiền mặt hàng ngày.

3. **Khách Đặt Phòng Trực Tiếp (Guests & Travelers)**:
   - *Mục tiêu*: Xem phòng, chọn ngày và đặt phòng trên giao diện di động mượt mà, minh bạch về giá và phụ thu, thanh toán cọc nhanh chóng qua app ngân hàng bằng quét mã QR và nhận email xác nhận tức thì.
   - *Tính năng trọng tâm*: Website đặt phòng thương hiệu riêng (`[subdomain].digistay.vn` hoặc tên miền tùy chỉnh), giao diện song ngữ (Việt - Anh), hỗ trợ mã ưu đãi (Coupons), thanh toán VietQR tự động xác nhận đơn.

4. **Chủ Chuỗi Nhiều Cơ Sở (Multi-Property Enterprise Owners)**:
   - *Mục tiêu*: Quản lý tập trung nhiều khách sạn dưới một Workspace duy nhất; chuyển đổi cơ sở nhanh trong 1 click mà không cần đăng nhập lại; phân quyền chi tiết cho từng cơ sở.

---

## 3. Các Tính Năng & Phân Hệ Cốt Lõi (Core Capabilities)

### 3.1. Website Builder & Công Cụ Đặt Phòng Trực Tiếp (Direct Booking Engine)
- **Trình dựng trang không mã (No-Code Modular Builder)**: Tự do tùy biến các khối nội dung (Hero banner, Giới thiệu, Thư viện ảnh, Danh sách hạng phòng, Đánh giá của khách, Tiện ích xung quanh, Chân trang).
- **Xem trước trực quan thời gian thực (Live Responsive Preview)**: Chuyển đổi giữa chế độ xem Điện thoại, Máy tính bảng và Máy tính bàn ngay trong trình chỉnh sửa.
- **Hỗ trợ Tên Miền Riêng (Custom Domain) & Subdomain**: Cung cấp tên miền miễn phí dạng `tenkhachsan.digistay.vn` và hỗ trợ đấu nối tên miền riêng của khách sạn (ví dụ: `www.khachsangiatot.vn`) với SSL tự động.
- **Tối ưu hóa SEO & Đa ngôn ngữ**: Tự động sinh Meta tags, OpenGraph, sitemap và chuyển ngữ liền mạch Tiếng Việt - Tiếng Anh.

### 3.2. Quản Lý Buồng Phòng & Lịch Đặt Phòng (Property & Booking Management)
- **Lịch Timeline Trực Quan (Interactive Calendar)**: Kéo thả, hiển thị màu sắc theo trạng thái đặt phòng (Chờ cọc, Đã xác nhận, Đang ở, Đã trả phòng, Đã hủy).
- **Hạng Phòng & Buồng Vật Lý (Room Types & Inventory)**: Phân tầng giữa hạng phòng thương mại (Standard, Deluxe, Suite) và danh sách phòng vật lý cụ thể (P.101, P.102...).
- **Quy Trình Nhận/Trả Phòng Nhanh (Fast Check-in / Check-out)**:
  - Sinh mã VietQR động chứa chính xác số tiền cần thanh toán và mã đơn phòng.
  - Tự động tính phụ thu nhận phòng sớm / trả phòng muộn dựa trên chính sách khách sạn.
- **Định Danh Khách Lưu Trú & Báo Cáo Cư Trú BCA**:
  - Hỗ trợ lưu trữ số CCCD/CMND/Hộ chiếu, quốc tịch, ngày sinh và ảnh chụp 2 mặt giấy tờ tùy thân.
  - Xuất file danh sách khách lưu trú định dạng chuẩn nộp cho cơ quan Công an quản lý xuất nhập cảnh và trật tự xã hội.

### 3.3. Thanh Toán & Tài Chính Khách Sạn (Payments & Cashbook)
- **Cổng Thanh Toán VietQR Tự Động (PayOS Integration)**: Tiền cọc vào thẳng tài khoản ngân hàng của khách sạn, hệ thống tự động bắt webhook xác nhận thanh toán mà không cần kiểm tra sao kê thủ công.
- **Sổ Quỹ Tiền Mặt & Thu Chi (Cashbook)**: Ghi nhận mọi dòng tiền mặt phát sinh tại quầy lễ tân (tiền đặt cọc, thanh toán còn lại, tiền giặt ủi, nước uống, chi mua văn phòng phẩm).
- **Hóa Đơn Điện Tử Hợp Chuẩn (E-Invoices - Mắt Bão / TCT)**: Phát hành hóa đơn VAT điện tử gắn trực tiếp với booking, hỗ trợ gửi hóa đơn qua email, lập hóa đơn điều chỉnh và thay thế đúng chuẩn Nghị định 123 / Thông tư 78.

### 3.4. Quản Lý Kênh Phân Phối (Channel Manager - iCal Two-Way Sync)
- **Đồng bộ lịch hai chiều qua chuẩn iCal**: Kết nối tự động với các sàn OTA hàng đầu (Booking.com, Agoda, Airbnb, Traveloka) để ngăn chặn overbooking.

### 3.5. Trợ Giúp & Đào Tạo Vận Hành Tương Tác (Interactive Onboarding & Help Center)
- **Video Hướng Dẫn Tương Tác 5 Bước (Interactive Annotated Video Player)**: Mô phỏng giao diện thật với con trỏ chuột bay đến chính xác vị trí cần bấm/nhập liệu.
- **Ngân Hàng Bài Viết Nghiệp Vụ Thực Tế**: Hơn 20+ hướng dẫn chuyên sâu kèm ảnh chụp màn hình đánh dấu tọa độ từng điểm thao tác.

### 3.6. Quản Trị Hệ Thống Nền Tảng (Platform Admin)
- Kiểm soát danh sách Workspace, khách hàng, đơn hàng thuê bao gói (Orders), quản lý gói cước động (Platform Plans), voucher khuyến mãi, nhật ký bảo mật (Security audit) và kiểm tra sức khỏe hệ thống máy chủ (System health metrics).

---

## 4. Các Cam Kết Về Trải Nghiệm & Kỹ Thuật (Non-Functional Commitments)

1. **Hiệu năng & Tốc độ**: Tải trang dưới 1.2s; SSR đầu tiên có sẵn theme chuẩn qua cookie; không layout shift khi cuộn số nhờ `SlidingNumber [contain:paint]`.
2. **Khả năng tiếp cận & Chế độ tối**: Dark mode kích hoạt toàn diện 100% trên mọi route quản trị `/app/*` và `/admin/*`; độ tương phản chữ luôn đạt WCAG 2.1 AA.
3. **Bảo mật đa tầng**: Phân quyền nghiêm ngặt theo Tenant Isolation; webhook thanh toán xác thực bằng chữ ký SHA-256; bảo mật 2 lớp (2FA) tùy chọn cho chủ cơ sở.
