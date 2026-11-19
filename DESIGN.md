---
name: Digistay — Hệ Thống Thiết Kế (Toàn Diện: Marketing & Dashboard)
description: "Hệ thống thiết kế toàn diện của nền tảng Digistay: từ trang công khai (landing, auth) đến không gian quản trị vận hành khách sạn (dashboard, admin). Bảng màu semantic tự nhiên, typography sang trọng, motion spring physics cao cấp và hỗ trợ dark mode toàn diện."
colors:
  # Light Mode Semantic Tokens
  page: "#FBF9F6"
  panel: "#FFFFFF"
  raised: "#FFFFFF"
  fg: "#1B1C1A"
  muted: "#6B6760"
  line: "#E7E2DA"
  ink: "#1C1B19"
  on-ink: "#FBF9F6"
  brand: "#A93119"
  acc: "#A93119"
  acc-soft: "#F9ECE8"
  plain: "#5C5852"
  plain-soft: "#EFEBE5"
  ok: "#2B6B45"
  ok-soft: "#E3F1E8"
  warn: "#8A5600"
  warn-soft: "#FBF0D6"
  err: "#B0124F"
  err-soft: "#FCE7EF"
  info: "#284E92"
  info-soft: "#E6EDF8"

  # Dark Mode Semantic Tokens
  page-dark: "#1A1917"
  panel-dark: "#22201D"
  raised-dark: "#262420"
  fg-dark: "#F2EEE8"
  muted-dark: "#ADA69B"
  line-dark: "#3A3631"
  ink-dark: "#F2EEE8"
  on-ink-dark: "#1C1B19"
  brand-dark: "#EE8B6F"
  acc-dark: "#EE8B6F"
  acc-soft-dark: "#35231E"
  plain-dark: "#C9C2B7"
  plain-soft-dark: "#33302B"
  ok-dark: "#7FD1A0"
  ok-soft-dark: "#1E3127"
  warn-dark: "#EBBE64"
  warn-soft-dark: "#352A16"
  err-dark: "#F58BB0"
  err-soft-dark: "#3A1D29"
  info-dark: "#9DBDF5"
  info-soft-dark: "#1E2A3F"

typography:
  display:
    fontFamily: "Playfair Display Variable, Playfair Display, Georgia, serif"
    fontSize: 72px
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: -0.025em
  h1:
    fontFamily: "Playfair Display Variable, Playfair Display, Georgia, serif"
    fontSize: 52px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.02em
  h2:
    fontFamily: "Playfair Display Variable, Playfair Display, Georgia, serif"
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.015em
  h3:
    fontFamily: "Playfair Display Variable, Playfair Display, Georgia, serif"
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.25
  lead:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.7
  small:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: 0.16em
  mono:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Menlo, monospace"
    fontSize: 13px
    fontWeight: 500

motion:
  springs:
    interactive:
      type: spring
      stiffness: 400
      damping: 30
    dialog:
      type: spring
      stiffness: 300
      damping: 28
    slidingNumber:
      type: spring
      stiffness: 280
      damping: 28
    cardHover:
      type: spring
      stiffness: 350
      damping: 25

rounded:
  sm: 4px
  ctl: 6px
  box: 10px
  xl: 16px
  full: 9999px
---

# Hệ Thống Thiết Kế Digistay (Digistay Design System)

## 1. Triết Lý Thiết Kế & Định Hướng Cốt Lõi

**Creative North Star: "Quầy lễ tân dưới tấm bảng tên khách sạn"**

Digistay kết hợp hai phẩm chất: sự ấm áp, lịch lãm của ngành hiếu khách (Hospitality) và sự chính xác, tin cậy tuyệt đối của công cụ điều hành doanh nghiệp (Enterprise SaaS).

1. **Vật liệu tự nhiên & Thật thà**: Nền giấy ấm (`bg-page`), bề mặt bảng điều khiển mịn màng (`bg-panel`), thanh phân cách 1px thanh mảnh (`border-line`), và dấu màu đất nung (`acc` - Terracotta). Từ chối mọi hiệu ứng gradient SaaS lòe loẹt, bóng mờ nặng nề hoặc đồ họa giả lập 3D.
2. **Minh bạch thông tin & Trọng lượng thị giác**: Dữ liệu tài chính, buồng phòng, khách lưu trú và tình trạng hóa đơn luôn hiển thị sắc nét bằng font chữ tabular-nums rõ ràng, tương phản đạt chuẩn WCAG 2.1 AA.
3. **Chuyển động có vật lý thực (Physics-based Motion)**: Mọi chuyển động vi mô (micro-interactions) sử dụng lò xo (spring physics) từ `framer-motion` thay vì chuyển động tuyến tính hay easing giả tạo, tạo cảm giác xúc giác (tactile feedback) mượt mà như nút bấm cơ học trên quầy lễ tân.

---

## 2. Hệ Thống Màu Semantic (Color Tokens)

Mọi thành phần trong Digistay đều sử dụng **Semantic Tokens** để đảm bảo khả năng chuyển đổi liền mạch giữa Light Mode và Dark Mode:

| Token Name | Light Value | Dark Value | Mục Đích Sử Dụng |
|---|---|---|---|
| `bg-page` | `#FBF9F6` (Giấy kem) | `#1A1917` (Đá basalt) | Nền khung bao ngoài cùng toàn màn hình |
| `bg-panel` | `#FFFFFF` (Trắng ngà) | `#22201D` (Gỗ gụ đậm) | Nền thẻ (cards), danh sách bảng, container nội dung |
| `bg-raised` | `#FFFFFF` | `#262420` (Bề mặt nổi) | Dropdown menu, Modal popover, Sticky header |
| `text-fg` | `#1B1C1A` (Mực đen) | `#F2EEE8` (Mực trắng) | Tiêu đề chính, nhãn quan trọng, con số tài chính |
| `text-muted` | `#6B6760` (Chì tro) | `#ADA69B` (Bạc mờ) | Nhãn phụ, phụ đề, hướng dẫn, thời gian |
| `border-line` | `#E7E2DA` (Kẻ cát) | `#3A3631` (Kẻ than) | Đường phân chia 1px, viền input, viền bảng |
| `acc` / `bg-acc` | `#A93119` (Đất nung) | `#EE8B6F` (Gốm nung sáng) | Nhấn thương hiệu Digistay, focus ring, highlight |
| `bg-acc-soft` | `#F9ECE8` | `#35231E` | Nền chip kích hoạt, nhãn đính kèm nhẹ |
| `ok` / `text-ok` | `#2B6B45` (Xanh rừng) | `#7FD1A0` (Lá non) | Đã xác nhận, đã thanh toán đủ, có khách ở |
| `bg-ok-soft` | `#E3F1E8` | `#1E3127` | Nền nhãn trạng thái thành công |
| `warn` / `text-warn` | `#8A5600` (Hổ phách) | `#EBBE64` (Vàng cát) | Chờ thanh toán, sắp đến hạn, đơn tạm giữ |
| `bg-warn-soft` | `#FBF0D6` | `#352A16` | Nền nhãn cảnh báo |
| `err` / `text-err` | `#B0124F` (Đỏ son) | `#F58BB0` (Hồng đá) | Quá hạn, thất bại, đã hủy, lỗi hệ thống |
| `bg-err-soft` | `#FCE7EF` | `#3A1D29` | Nền thông báo lỗi |

---

## 3. Kiến Trúc Dark Mode (Dark Mode Architecture)

1. **Cơ chế lưu trữ & Khởi tạo**:
   - `THEME_COOKIE`: `ds-theme` lưu trạng thái `'light' | 'dark'` với thời hạn 1 năm.
   - Server-side rendering (SSR) đọc cookie ngay tại Root Layout để gán `data-theme` trước khi gửi HTML về client, loại bỏ hiện tượng giật sáng/chớp màn hình (Flash of unstyled content).
2. **Quy tắc bộ điều hướng & URL Whitelist**:
   - Mọi route trong dashboard (bao gồm URL rút gọn `/app/[slug]/*` và URL canonical `/workspace/[slug]/*`) đều được chuẩn hóa qua `normalizeDashboardPath()`.
   - Toàn bộ các trang nghiệp vụ lễ tân, buồng phòng, khách hàng, kênh bán, sổ quỹ, cài đặt và toàn bộ trang quản trị hệ thống (`/admin/*`) đều được kích hoạt dark mode 100%.

---

## 4. Hệ Thống Chuyển Động & Lò Xo Vật Lý (Motion System)

Digistay áp dụng triết lý chuyển động vật lý đàn hồi mượt mà:

```typescript
// Các cấu hình lò xo chuẩn mực của Digistay
export const interactiveSpring = { type: 'spring', stiffness: 400, damping: 30 }
export const dialogSpring      = { type: 'spring', stiffness: 300, damping: 28 }
export const slidingNumberSpring = { type: 'spring', stiffness: 280, damping: 28 }
export const cardHoverSpring   = { type: 'spring', stiffness: 350, damping: 25 }
```

### Motion Primitives:
- **`SlidingNumber`**: Cuộn số tự nhiên khi giá trị thay đổi (KPI cards, số tiền, công suất phòng). Tích hợp placeholder layout giữ nguyên chiều cao baseline và thuộc tính CSS `[contain:paint]` bảo vệ chống tràn layout.
- **`SlidingTabs`**: Viên thuốc (pill) trượt chuyển mượt mà giữa các tab danh mục nhờ cơ chế Framer Motion `layoutId`.
- **`AnimatedCheckmark`**: Hiệu ứng vẽ nét vòng tròn và tích chữ V bằng SVG path drawing khi hoàn thành tác vụ (check-in thành công, lưu thành công).
- **`Collapsible`**: Đóng mở các khối nội dung phụ trợ mượt mà với tính toán auto-height không bị giật.
- **`Accessibility First`**: Tự động vô hiệu hóa toàn bộ chuyển động khi hệ thống phát hiện cờ `prefers-reduced-motion` của người dùng (`useReducedMotion()`).

---

## 5. Quy Chuẩn Thành Phần Giao Diện (Component Standards)

1. **Buttons & Controls**:
   - Bán kính chuẩn: `rounded-ctl` (6px) cho nút bấm, ô input, menu item; `rounded-box` (10px) cho card và modal; `rounded-full` cho badge trạng thái.
   - Chiều cao điều khiển: `h-9` (36px) cho bảng quản lý mật độ cao; `h-10` (40px) cho thao tác chuẩn; `h-12` (48px) cho mobile & form đăng nhập.
2. **Bảng & Danh Sách Quản Trị (Data Grids)**:
   - Header bảng luôn `sticky top-0 bg-panel border-b border-line z-10`.
   - Hàng bảng có hiệu ứng hover mờ `hover:bg-fg/5 transition-colors`.
3. **Thanh Thông Báo Nổi (Universal Toast System)**:
   - Sử dụng Sonner / Custom Motion Toaster neo ở góc phải dưới (`bottom-right`), hỗ trợ tự động đếm ngược, nút hoàn tác và màu viền tương ứng trạng thái.
