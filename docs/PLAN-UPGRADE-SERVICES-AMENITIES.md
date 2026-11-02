# Kế hoạch kỹ thuật: Nâng cấp Phân hệ Tiện ích & Dịch vụ (Amenities & Services)

Tài liệu kế hoạch kỹ thuật chi tiết nhằm nâng cấp phân hệ **Tiện ích (Amenities)** và **Dịch vụ gia tăng (Extra Services)** cho nền tảng quản lý khách sạn và website booking trực tiếp **Digistay**.

---

## 1. Giới thiệu & Mục tiêu kinh doanh

### 1.1. Bối cảnh
Hiện tại trên Digistay:
- **Tiện ích (Amenities)** chỉ dừng lại ở danh sách checkbox có sẵn, chưa cho phép chủ cơ sở bổ sung tiện ích đặc thù, chưa có phân cấp tiện ích nổi bật (Featured) và chưa hỗ trợ ảnh chụp thực tế.
- **Dịch vụ (Services)** chỉ hiển thị thông tin giới thiệu tĩnh trên trang web. Khách đặt phòng trực tuyến **không thể chọn mua thêm dịch vụ** (như đưa đón sân bay, ăn sáng, thuê xe máy, set BBQ, trang trí trăng mật...). Đồng thời lễ tân tại quầy cũng **chưa có công cụ ghi nhận dịch vụ phát sinh** vào đơn đặt phòng của khách đang lưu trú để tự động xuất hóa đơn.

### 1.2. Mục tiêu đạt được
1. **Tăng doanh thu trên mỗi lượt khách (RevPAG - Revenue Per Available Guest)**: Tận dụng cơ hội bán chéo (Upselling & Cross-selling) ngay tại luồng đặt phòng (`/dat-phong`).
2. **Minh bạch tài chính & Tối ưu vận hành quầy lễ tân**: Không bỏ sót tiền dịch vụ phát sinh (minibar, giặt ủi, thuê xe, ăn uống); tự động kết chuyển vào hóa đơn thanh toán lúc trả phòng.
3. **Nâng cao tỷ lệ chuyển đổi website (CRO)**: Làm nổi bật các tiện ích "ăn tiền" nhất của khách sạn (View biển, Hồ bơi vô cực, Sân pickleball, Bồn tắm nằm...) bằng huy hiệu nổi bật và hình ảnh minh họa chân thực.

---

## 2. Danh sách các tính năng nâng cấp (Tasks 51 - 55)

| Task ID | Tên tính năng | Phân loại | Mô tả chi tiết yêu cầu nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **51** | **Bán chéo Dịch vụ khi Đặt phòng (Booking Add-ons)** | Doanh thu / CRO | ✅ **Hoàn thành**: UI Card trực quan, chọn số lượng, ảnh đại diện, badge danh mục, cảnh báo lead time, hiển thị chi tiết trong StaySummary & Dashboard. |
| **52** | **Quản lý Dịch vụ phát sinh tại quầy cho Lễ tân** | Vận hành / Kế toán | Tại màn hình chi tiết đơn đặt phòng (`Bookings`), thêm tab hoặc nút "+ Thêm dịch vụ". Lễ tân ghi nhận đồ uống, giặt ủi, tour... Hệ thống tự động tính vào công nợ phòng và liệt kê chi tiết trong Hóa đơn / Phiếu thanh toán (`Invoices`). |
| **53** | **Cấu hình Vận hành Dịch vụ Nâng cao** | Quản trị / Vận hành | Mở rộng trang quản lý dịch vụ (`/services`): Thêm ảnh minh họa, quy định thời gian đặt trước tối thiểu (Lead time, vd: báo trước 24h đối với BBQ/Đón sân bay), giới hạn số lượng phục vụ tối đa mỗi ngày (Capacity), khung giờ phục vụ. |
| **54** | **Tiện ích Tùy chỉnh (Custom) & Tiện ích Nổi bật (Featured)** | Trải nghiệm / CRO | Cho phép chủ cơ sở tự tạo thêm tiện ích ngoài danh mục có sẵn; chọn 4-6 tiện ích đặc sắc nhất để gắn huy hiệu "Nổi bật" (Featured ⭐) hiển thị ưu tiên tại Hero Banner, thẻ tìm kiếm và thẻ chi tiết phòng. |
| **55** | **Thư viện ảnh Tiện ích & Trực quan hóa Website** | UI / Thị giác | Cho phép đính kèm 1-3 ảnh thực tế cho từng tiện ích chủ đạo (Hồ bơi, Spa, Gym, Nhà hàng view biển); khách bấm vào tiện ích trên website công khai có thể xem ngay hình ảnh thực tế sắc nét. |

---

## 3. Kiến trúc Cơ sở dữ liệu (Prisma Schema)

### 3.1. Mô hình Dữ liệu Mới & Cập nhật

```prisma
// ============================================================================
// 1. DỊCH VỤ CỘNG THÊM (EXTRA SERVICES) - MỞ RỘNG
// ============================================================================
model ExtraService {
  id              String       @id @default(cuid())
  propertyId      String
  property        Property     @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  name            String       // Tên dịch vụ (VD: Thuê xe máy tay ga, Đưa đón sân bay 7 chỗ)
  description     String?      // Mô tả chi tiết
  translations    Json?        // Bản dịch đa ngôn ngữ: { en: { name?, description? } }
  category        String?      // laundry | transport | food | entertainment | wellness | other
  coverImage      String?      // Ảnh đại diện dịch vụ (tăng tỷ lệ click đặt)

  // Giá & Cách tính
  priceType       PriceType    @default(FIXED) // FIXED (theo lần) | PER_NIGHT (theo đêm) | PER_PERSON (theo người)
  price           Float        // Đơn giá VNĐ
  perPerson       Boolean      @default(false)

  // Cấu hình vận hành nâng cao
  leadTimeHours   Int?         @default(0)     // Số giờ phải đặt trước tối thiểu (0 = gọi lúc nào cũng được)
  dailyCapacity   Int?                         // Số lượng tối đa phục vụ mỗi ngày (null = không giới hạn)
  operatingHours  String?                      // VD: "06:00 - 22:00"

  isActive        Boolean      @default(true)  // Đang hoạt động / Tạm dừng
  showOnBooking   Boolean      @default(true)  // Có cho phép khách chọn lúc đặt phòng trực tuyến không

  bookingItems    BookingExtraServiceItem[]

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  deletedAt       DateTime?

  @@index([propertyId])
  @@map("extra_services")
}

// ============================================================================
// 2. MỤC DỊCH VỤ ĐÃ ĐẶT THEO BOOKING (BOOKING SERVICE ITEMS)
// ============================================================================
model BookingExtraServiceItem {
  id              String        @id @default(cuid())
  bookingId       String
  booking         Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  extraServiceId  String?
  extraService    ExtraService? @relation(fields: [extraServiceId], references: [id], onDelete: SetNull)

  serviceName     String        // Lưu snapshot tên dịch vụ tại thời điểm đặt
  unitPrice       Float         // Snapshot đơn giá
  quantity        Int           @default(1)
  totalAmount     Float         // = unitPrice * quantity (hoặc * số đêm nếu PER_NIGHT)
  notes           String?       // Ghi chú của khách hoặc lễ tân (vd: "Đón tại cột số 10 lúc 14h30, chuyến bay VN123")

  source          String        @default("ONLINE") // ONLINE (khách tự đặt trên web) | FRONTDESK (lễ tân thêm tại quầy)
  status          String        @default("CONFIRMED") // PENDING | CONFIRMED | COMPLETED | CANCELLED

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([bookingId])
  @@map("booking_extra_service_items")
}

// ============================================================================
// 3. TIỆN ÍCH CƠ SỞ (PROPERTY AMENITIES) - MỞ RỘNG
// ============================================================================
model PropertyAmenity {
  id              String       @id @default(cuid())
  propertyId      String
  amenityId       String

  isFeatured      Boolean      @default(false) // Đánh dấu là Tiện ích nổi bật (hiển thị Badge trang chủ)
  customName      String?      // Tùy biến tên hiển thị riêng theo phong cách của cơ sở
  images          String[]     @default([])    // Mảng URL ảnh minh họa tiện ích (hồ bơi, spa...)
  sortOrder       Int          @default(0)     // Thứ tự hiển thị ưu tiên

  property        Property     @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  amenity         Amenity      @relation(fields: [amenityId], references: [id], onDelete: Cascade)

  @@unique([propertyId, amenityId])
  @@map("property_amenities")
}
```

---

## 4. Thiết kế Chi tiết Kỹ thuật theo từng Task

### Task 51: Bán chéo Dịch vụ khi Đặt phòng (Booking Add-ons Upsell) ✅ *Đã hoàn thành*
- **Frontend (`src/app/(public)/[subdomain]/dat-phong/BookingForm.tsx`)**:
  - Thêm section **"Dịch vụ cộng thêm & Trải nghiệm"** nằm giữa phần chọn phòng và thông tin liên hệ.
  - Mỗi dịch vụ hiển thị dạng card tinh gọn: Ảnh thumbnail, Tên, Mô tả ngắn, Badge phân loại, Đơn giá minh bạch.
  - Nút thêm dịch vụ: Click **"+ Thêm"** sẽ xuất hiện bộ đếm số lượng `[- 1 +]`, hoặc tự động tính theo số đêm/số người của booking.
  - Phần **Tóm tắt đơn đặt phòng (StaySummary)**: Bổ sung các dòng chi tiết dịch vụ đã chọn (VD: `Thuê xe máy 2 ngày: 300,000đ`), tự động cập nhật tổng tiền thanh toán và số tiền đặt cọc cần trả.
- **Backend (`src/app/api/bookings/route.ts`)**:
  - Nhận mảng `selectedServices: [{ id, quantity, notes }]`.
  - Validate giá từ cơ sở dữ liệu (chống giả mạo client-side).
  - Kiểm tra `leadTimeHours` so với thời điểm check-in của đơn đặt.
  - Lưu bản ghi vào bảng `BookingExtraServiceItem` và cộng dồn vào `totalAmount` của `Booking`.

---

### Task 52: Giao diện Thêm dịch vụ tại quầy cho Lễ tân (Frontdesk Folio) ✅ *Đã hoàn thành*
- **Frontend (`src/components/bookings/booking-detail.tsx`, `src/components/bookings/add-service-dialog.tsx`)**:
  - Trong phần Tiền / Chi phí của chi tiết đơn đặt phòng, hiển thị phân mục Dịch vụ đã đặt kèm ghi chú và nút xóa nhanh.
  - Nút **"+ Thêm dịch vụ"** mở Modal nhanh (`AddServiceDialog`):
    - Tìm kiếm và chọn từ danh mục `ExtraService` có sẵn của khách sạn hoặc chọn "Dịch vụ tự do / Nhập tay".
    - Tự động điền đơn giá theo danh mục, cho phép tùy chỉnh đơn giá linh hoạt.
    - Nhập số lượng và ghi chú phát sinh (VD: *Khách phòng 201 dùng 2 lon bia Tiger, 1 gói snack*).
  - Khi thêm hoặc xóa dịch vụ, hệ thống tự động cập nhật `extraCharges`, `totalAmount`, chạy `syncBookingPayments` điều chỉnh trạng thái thanh toán (PAID -> PARTIAL nếu phát sinh thêm nợ), và ghi ActivityLog đầy đủ.
- **Backend (`src/app/api/bookings/[id]/services/route.ts`)**:
  - `GET`: Lấy danh sách dịch vụ hiện tại và catalog dịch vụ khả dụng của property.
  - `POST`: Thêm dịch vụ (catalog hoặc tự do), lock dòng booking, cập nhật phụ phí, tính lại tổng tiền và đồng bộ thanh toán.
  - `DELETE`: Xóa dịch vụ theo vị trí index, trừ phí tương ứng và đồng bộ thanh toán.

---

### Task 53: Cấu hình Vận hành Nâng cao cho Dịch vụ ✅ *Đã hoàn thành*
- **Backend API (`/api/extra-services` & `/api/extra-services/[id]`)**:
  - Mở rộng Zod validation & Prisma update hỗ trợ đầy đủ `coverImage`, `leadTimeHours`, `dailyCapacity`, `operatingHours`, `showOnBooking`.
  - Tự động làm sạch URL, kiểm tra số nguyên không âm và invalidate cache website công khai tức thì.
- **Giao diện Quản trị (`src/app/(dashboard)/workspace/[slug]/(property)/properties/[id]/services/page.tsx`)**:
  - Modal tạo/sửa dịch vụ bổ sung phân mục "Cấu hình Vận hành & Đặt trước":
    - Upload ảnh thumbnail trực tiếp hoặc nhập URL ảnh cover, hỗ trợ xóa/đổi ảnh.
    - Cấu hình số giờ báo trước tối thiểu `leadTimeHours` (VD: 24h).
    - Cấu hình giới hạn công suất phục vụ mỗi ngày `dailyCapacity`.
    - Cấu hình khung giờ hoạt động `operatingHours` (VD: 06:00 - 22:00).
    - Checkbox bật/tắt hiển thị trên luồng đặt phòng trực tuyến `showOnBooking`.
  - Danh sách dịch vụ hiển thị thumbnail ảnh cover thực tế cùng hệ thống Badge thông minh: `🌐 Đặt trước khi book`, `⏰ Báo trước Xh`, `📊 X lượt/ngày`, `🕒 Giờ phục vụ`.

---

### Task 54: Tiện ích Tùy chỉnh (Custom) & Tiện ích Nổi bật (Featured Badges)
- **Giao diện Quản lý Tiện ích (`/services`)**:
  - Nút ghim sao ⭐ **"Nổi bật"** ngay cạnh từng tiện ích (tối đa chọn 6 tiện ích nổi bật).
  - Nút **"+ Thêm tiện ích riêng"** cho phép tạo tiện ích tùy biến nếu khách sạn có những tiện nghi đặc biệt (sân tennis, trạm sạc xe điện, phòng thiền, máy chiếu phim ngoài trời).
- **Hiển thị trên Public Site (`src/app/(public)/[subdomain]`)**:
  - Khối Hero Banner và phần Giới thiệu phòng sẽ render các Badge nổi bật nổi bật màu Accent (VD: ⭐ *Hồ bơi vô cực* • ⭐ *Bồn tắm nằm hướng biển* • ⭐ *Bữa sáng buffet miễn phí*).

---

### Task 55: Thư viện ảnh Tiện ích & Trực quan hóa Website
- **Frontend Quản trị**:
  - Bấm vào tiện ích cho phép upload 1–3 ảnh chụp góc rộng của tiện ích đó.
- **Frontend Public Site (`AmenitiesBlock.tsx`)**:
  - Nâng cấp khối Tiện ích trên website từ danh sách chữ đơn điệu thành dạng lưới ảnh (Photo Grid & Lightbox) tương tự Airbnb/Booking.com: khách hàng click vào tiện ích để xem cận cảnh hồ bơi, phòng gym hoặc quầy bar.

---

## 5. Kế hoạch Kiểm thử & Đảm bảo Chất lượng (QA & Test Strategy)

| Loại kiểm thử | Phạm vi kiểm thử | Mục tiêu xác nhận |
| :--- | :--- | :--- |
| **Unit Test (Vitest)** | `src/lib/services/pricing.test.ts` | Kiểm tra tính toán chính xác đơn giá theo ngày, theo người, theo lần và cộng tổng đơn booking. |
| **Validation Test** | `src/app/api/bookings/route.test.ts` | Xác thực từ chối các yêu cầu đặt dịch vụ vi phạm lead-time hoặc giả mạo đơn giá. |
| **Dark Mode Test** | Kiểm tra toàn bộ UI trên Dashboard và Modal | Không xảy ra lỗi tương phản màu, sử dụng đúng theme tokens (`bg-panel`, `text-fg`, `border-line`). |
| **i18n Symmetry Test** | `messages/dash/**` & `messages/site/**` | Đồng bộ 100% khóa ngôn ngữ tiếng Việt (`vi`) và tiếng Anh (`en`). |
| **TypeScript & Lint** | `npx tsc --noEmit` & `npm run lint` | 0 lỗi biên dịch, không có warnings nguy hiểm. |

---

## 6. Lộ trình Triển khai Đề xuất

```
Tuần 1: Task 51 & Task 53 (Upsell Đặt phòng & Nâng cấp Dịch vụ)
├── Prisma migration: Mở rộng ExtraService, thêm BookingExtraServiceItem
├── API routes: Lưu và tính toán dịch vụ trong booking
└── UI: Khối chọn Add-on trong BookingForm và StaySummary

Tuần 2: Task 52 (Quản lý Dịch vụ tại quầy cho Lễ tân)
├── Dashboard: Tab Dịch vụ trong chi tiết đơn đặt phòng
├── Thao tác nhanh cho lễ tân: Thêm/Sửa/Xóa dịch vụ phát sinh
└── Tích hợp bảng kê thanh toán và hóa đơn lúc Check-out

Tuần 3: Task 54 & Task 55 (Tiện ích Tùy chỉnh & Thư viện ảnh)
├── Đánh dấu Tiện ích nổi bật (Featured Badges)
├── Tùy biến và upload ảnh tiện ích
└── Nâng cấp khối hiển thị AmenitiesBlock trên website công khai
```

---
*Tài liệu được cập nhật ngày 02/11/2026. Sẵn sàng bắt đầu triển khai theo từng Task cụ thể.*

