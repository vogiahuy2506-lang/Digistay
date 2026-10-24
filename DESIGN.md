---
name: Digistay — Trang công khai
description: "Hệ thống giao diện các trang của Digistay: landing, đăng nhập / đăng ký / quên mật khẩu, lời mời, 404. Giấy ấm, mực gần đen, tiêu đề có chân, ảnh chụp thật trong khung trình duyệt."
colors:
  page: "#FBF9F6"
  panel: "#FFFFFF"
  fg: "#1B1C1A"
  muted: "#6B6760"
  line: "#E7E2DA"
  ink: "#1C1B19"
  on-ink: "#FBF9F6"
  brand: "#A93119"
  acc: "#A93119"
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
  page-dark: "#1A1917"
  panel-dark: "#22201D"
  fg-dark: "#F2EEE8"
  muted-dark: "#ADA69B"
  line-dark: "#3A3631"
  ink-dark: "#F2EEE8"
  on-ink-dark: "#1C1B19"
  brand-dark: "#EE8B6F"
  acc-dark: "#EE8B6F"
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
rounded:
  ctl: 6px
  box: 10px
  sm: 4px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  gutter-sm: 32px
  gutter-lg: 80px
  section: 96px
  section-lg: 144px
  touch: 44px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.ctl}"
    height: 52px
    padding: "0 28px"
  button-secondary:
    backgroundColor: "{colors.page}"
    textColor: "{colors.fg}"
    rounded: "{rounded.ctl}"
    height: 52px
    padding: "0 26px"
  button-compact:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.small}"
    rounded: "{rounded.ctl}"
    height: 40px
    padding: "0 18px"
  nav-link:
    typography: "{typography.body}"
    height: 28px
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.ctl}"
    height: 46px
    padding: "0 14px"
  input-auth:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.ctl}"
    height: 48px
    padding: "0 14px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.box}"
    padding: 32px
  band-cta:
    backgroundColor: "{colors.plain-soft}"
    textColor: "{colors.fg}"
    rounded: "{rounded.box}"
    padding: "72px 64px"
  notice-err:
    backgroundColor: "{colors.err-soft}"
    textColor: "{colors.err}"
    rounded: "{rounded.ctl}"
    padding: "12px 16px"
  chip-selected:
    backgroundColor: "{colors.plain-soft}"
    textColor: "{colors.fg}"
    rounded: "{rounded.ctl}"
    height: 44px
    padding: "0 16px"
---

# Design System: Digistay — Trang công khai

## Overview

**Creative North Star: "Quầy lễ tán dưới tấm bảng tên khách sạn"**

Các trang này là mặt tiềp của một quầy lễ tân: giấy ấm, mực gần đen, tiêu đề có chân, và duy nhất một dấu đất nung — chính là dấu của Digistay. Chúng kể một câu chuyện ngắn: đây là phần mềm thật của một khách sạn Việt Nam, và mọi lời hứa trên trang đều chỉ mô tả những gì đang chạy hôm nay. Vì vậy hình ảnh là **ảnh chụp giao diện thật** đặt trong khung trình duyệt có thanh địa chỉ, không phải minh hoạ vẽ tay; và những gì chưa có bằng chứng thì để trống có dấu hiệu, không khoác bằng con số ảo.

Không gian thoáng và đọc theo một nhịp dọc: khối rộng 1440 px, tiêu đề căn trái (trang chủ căn giữa ở `lg`), khoảng cách giữa các mục lớn (96 px trên điện thoại, 128–144 px trên màn rộng). Đường kẻ 1 px và nền `panel` trên nền `page` đẩy các khối ra, không dùng bóng đổ — ngoại lệ duy nhất là ảnh chụp, vì ảnh phải bay.

Hệ thống này **từ chối**: giao diện SaaS tím-gradient, thẻ bóng đổ dày, nút bo tròn "dày", hiệu ứng trang trí, và bất kỳ bằng chứng giả nào — logo khách hàng, lời chứng thực, số liệu — như `PRODUCT.md` đã nêu.

**Đặc điểm chính:**
- Tiêu đề có chân (Playfair, weight 500), thân bài và biểu mẫu không chân (Inter).
- Chỉ một dấu nhấn màu: đất nung `brand`, và nó xuất hiện ở dấu thương hiệu, số thứ tự tính năng và vòng focus.
- Nút chính là **mực** (`ink`), không phải màu thương hiệu.
- Bằng chứng là ảnh chụp thật trong `BrowserFrame`; giá và giới hạn là số thật, kể cả khi là nội dung mẫu thì được ghi rõ trong mã.
- Theme tối chỉ do cookie `ds-theme` bật, không theo hệ điều hành; các trang này chỉ dùng màu theo vai trò nên hai theme đều đúng.

**Phạm vi:** file này nói về các trang của chính Digistay — `/`, `/pricing`, `/contact`, `/terms`, `/privacy`, `/login`, `/register`, `/forgot-password`, `/invitations/*`, 404. Trang quản lý và website khách sạn có mật độ, bảng và bán kính riêng, không nằm trong tài liệu này.

**Nợ kế thừa quan sát được:** các trang này dùng `text-fg/80` cho thân bài nhạt thay vì `text-muted` (`src/components/marketing/styles.ts`), và bóng ảnh chụp viết thẳng trong class chứ không có token. Cả hai nên được thống nhất nếu có đợt sửa tiếp; hiện tại `DESIGN.md` ghi đúng những gì đang chạy.

## Colors

Một tờ giấy ấm, một mực gần đen, một dấu đất nung, và sáu màu trạng thái chỉ dùng cho thông báo. Giá trị lấy từ `src/styles/tokens.ts`; `src/styles/tokens.test.ts` kiểm tương phản.

### Primary
- **Đất nung** (`brand` `#A93119`, tối `#EE8B6F`): chấm vuông 3–4 px cạnh chữ "Digistay", số thứ tự tính năng (`01 / 05`) ở font mono. Không dùng làm nền nút.
- **Mực** (`ink` `#1C1B19`, chữ `on-ink` `#FBF9F6`): nền nút chính và nền viền của nút phụ. Ở theme tối, `ink` đảo thành `#F2EEE8` và chữ thành `#1C1B19`.

### Secondary
- **Nhấn theo ngữ cảnh** (`acc`, cùng giá trị `brand` ở đây): vòng focus 2 px lệch 2 px, và vòng focus của chip chọn. Không dùng `brand` trực tiếp cho vòng focus để còn dùng lại được ở nơi khác.

### Tertiary (chỉ ở biểu mẫu và thông báo)
- **Xanh lá** (`ok` `#2B6B45`): mật khẩu khỏe, bước đã xong, lời mời đã chấp nhận.
- **Hổ phách** (`warn` `#8A5600`): lời mời đang chờ, đồng hồ gửi lại mã.
- **Hồng đỏ** (`err` `#B0124F`): ô nhập sai, thông báo lỗi, nút xác nhận huỷ.
- **Xanh dương** (`info` `#284E92`): vai trò được gán trong lời mời.
- **Xám ấm** (`plain` `#5C5852`): lời mời đã dùng / hết hạn / không hợp lệ.

Mỗi trạng thái có nền `-soft` đi kèm cho chip và thông báo.

### Neutral
- **Giấy** (`page` `#FBF9F6`, tối `#1A1917`): nền ngoài cùng của mọi trang.
- **Tấm** (`panel` `#FFFFFF`, tối `#22201D`): thẻ gói, thẻ biểu mẫu liên hệ, khung trình duyệt, dải bảng so sánh.
- **Mực chữ** (`fg` `#1B1C1A`, tối `#F2EEE8`): tiêu đề, thân bài, số tiền.
- **Chữ phụ** (`muted` `#6B6760`, tối `#ADA69B`): nhãn, chú thích ảnh, giá phụ, thanh địa chỉ.
- **Đường kẻ** (`line` `#E7E2DA`, tối `#3A3631`): viền dưới tiêu đề điều hướng, kẻ ngang giữa các dòng bảng, viền ô nhập.
- **Dải mềm** (`plain-soft` `#EFEBE5`, tối `#33302B`): dải kêu gọi hành động cuối trang, thanh địa chỉ trong khung trình duyệt, chip chọn.

**Quy tắc Mực chính.** Nút chính là `ink`. Đất nung `brand` không bao giờ thành nền nút hay nền một mảng lớn; sự hiếm có của nó là điểm.

**Quy tắc Không chỉ màu.** Trạng thái luôn có chữ đi kèm: thông báo lỗi mở đầu bằng `⚠` và câu tiếng Việt; chip trạng thái lời mời có chữ "Chờ xử lý", "Đã chấp nhận"...; ô nhập lỗi đổi cả viền lẫn nền.

**Quy tắc Trung thực nội dung mẫu.** Nội dung chưa xác nhận được hiện trong khung **viền đứt** (`border-dashed`) — ví dụ dải tên khách sạn đang dùng Digistay ở trang chủ. Không bao giờ biến nội dung mẫu thành con số trông như thật.

## Typography

**Display / Heading:** Playfair Display Variable (dự phòng Playfair Display, Georgia, serif) — mọi tiêu đề, tên tính năng, tên bước, tiêu đề dải CTA.
**Body / UI:** Inter Variable (dự phòng Inter, system-ui, sans-serif) — thân bài, nút, biểu mẫu, bảng, điều hướng.
**Mono:** JetBrains Mono Variable — số thứ tự tính năng và bước, địa chỉ trong thanh trình duyệt, mã nhập một lần.

**Tính cách:** tiêu đề có chân, độ đậm 500, dấu cân bằng chữ (`text-balance`) để câu ngắn không đứt vỡ; thân bài không chân để bảng giá và biểu mẫu đọc nhanh. Cả hai phông đều không in đậm mạnh — đậm 600 chỉ dành cho số tiền và mã.

### Thang chữ
- **Display** (72px / 1.08, -0.025em): tiêu đề hero trang chủ; tiêu đề trang bảng giá cùng cỡ. Trên điện thoại 38–40 px (1.1–1.12).
- **H1** (52px / 1.15, -0.02em): tiêu đề trang liên hệ, điều khoản, bảo mật, 404; trang tài khoản nhỏ hơn ở 44 px.
- **H2** (36px / 1.2, -0.015em): tên tính năng; điện thoại 28 px. Tiêu đề mục (`sectionTitle`) lớn hơn: 52px từ `lg`, 32 px trên điện thoại.
- **H3** (28px / 1.25): tên bước trong "Ba bước", điện thoại 24 px.
- **Lead** (400, 16–18px / 1.65–1.7): đoạn mở đầu dưới tiêu đề, tối đa 720 px.
- **Body** (400, 15–16px / 1.65–1.7): thân bài, nút 15 px, ô nhập 15 px.
- **Small** (400, 12.5–14.5px / 1.55): nhãn ô nhập, gợi ý, chú thích, mô tả hạng phòng, chân bảng.
- **Label** (500, 11px, 0.16em, HOA, `text-muted`): mắt trên hero, tên cột thông tin, tiêu đề nhóm trong bảng so sánh.
- **Mono** (500, 10–13px, `text-muted`): `01 / 05`, `digistay.vn/workspace/…/bookings`, chữ trong ô mã.

**Quy tắc Số tiền.** Mọi số tiền, số phòng, số nhân viên dùng `tabular-nums` và `font-semibold` (600) để cột thẳng hàng giữa ba thẻ gói.

**Quy tắc 16 px trên điện thoại.** Ô nhập giữ 15–16 px; không bao giờ xuống 13 px trên điện thoại để iOS không tự phóng to khi focus.

**Quy tắc Nhãn HOA.** Chỉ nhãn 11 px mới HOA và giãn chữ. Tiêu đề không HOA; nút không HOA.

## Layout

Một khung ngang cho toàn bộ trang, một nhịp dọc thưa, hai đối chiếu lặp lại: **tiêu đề + đoạn dẫn** đặt cạnh nhau ở màn rộng, rồi nội dung đầy khung bên dưới.

### Khung và lề
- `frame` = `mx-auto w-full max-w-[1440px]`, lề ngang 20 px (điện thoại) → 32 px từ `sm` → 80 px từ `lg`.
- Trang chủ căn giữa toàn bộ chữ ở `lg` (`text-center`), các trang khác căn trái.

### Nhịp dọc
- Đầu trang sau đầu điều hướng: 44 px trên điện thoại, 88 px từ `lg`.
- Nghỉ giữa các mục: 96 px (`pt-24`) trên điện thoại; 112–144 px từ `lg`.
- Lưới cột tiêu đề: `minmax(0,1fr) + 420px`, cách 96 px (`gap-24`), hai bên đều nhau (`items-end`) để tiêu đề và đoạn dẫn cùng đường chân.
- Cột trái cố định 420 px cho FAQ (tiêu đề bên trái, câu hỏi bên phải); trang liên hệ dùng 520 px + biểu mẫu.
- Lưới tính năng xen kẽ: `1fr + 1.33fr` rồi đảo, chừa 72 px giữa hai cột.
- Bảng so sánh: cột tính năng chiếm 40%, ba cột gói chia đều phần còn lại.

### Chiều rộng đọc
Đoạn dẫn 600–720 px; thân bài trong cột 640 px; mô tả bước 340 px. Không để đoạn chạy quá 75 ký tự.

### Điểm ngắt
Dùng mặc định Tailwind (640 / 768 / 1024 / 1280 / 1536). Trang chủ và bảng giá đổi bố cục lớn ở `lg` (1024); biểu mẫu liên hệ hai cột từ `lg`, hai cột ô nhập từ `sm`.

### Vùng chạm
Nút hành động 52 px. Ô nhập 46 px (liên hệ) và 48 px (tài khoản). Nút trong đầu điều hướng 44 px trên điện thoại, 40 px từ `lg`. Ô mã một lần 56–60 px.

### Quy tắc Phân nhóm
Kẻ ngang trước, khoảng trắng sau: danh sách tính năng, các bước, bảng giá trong lời mời, chân thẻ đều mở đầu bằng `border-t border-line` rồi mỗi dòng `border-b border-line/70`. Không lồng thẻ trong thẻ.

## Elevation & Depth

Hệ thống **phẳng**, trừ một ngoại lệ có chủ đích: **ảnh chụp thì bay**. Mọi thứ khác — thẻ gói, thẻ biểu mẫu, dải CTA, bảng so sánh, khung FAQ — nằm phẳng, tách bằng nền `panel` trên nền `page` và một đường kẻ 1 px.

### Thang bóng
- **Không có bóng** cho thẻ, bảng, ô nhập, nút, dải CTA.
- **Ảnh chụp — chính** (`0 40px 80px -48px rgb(28 27 25 / 0.45)`): khung trình duyệt lớn ở trang chủ.
- **Ảnh chụp — phụ** (`0 40px 80px -40px rgb(28 27 25 / 0.5)`): khung nhỏ hơn đè lên khung lớn; và `0 24px 48px -32px / -24px` cho cặp ảnh trên điện thoại.
- **Ảnh chụp — tính năng** (`0 32px 64px -44px rgb(28 27 25 / 0.4)`): mỗi khối tính năng.
- **Menu di động** (`shadow-lift`, `--ds-shadow-raised`): `0 28px 48px -32px rgb(28 27 25 / 0.35)` ở theme sáng, không có ở theme tối.
- Thanh địa chỉ trong khung trình duyệt nền `plain-soft/60`, ba chấm tròn đường kẻ 8 px.

**Quy tắc Phẳng trừ ảnh.** Bóng đổ chỉ xuất hiện khi thứ đó thực sự bay khỏi trang — ảnh chụp và menu đang mở. Không bóng cho thẻ và bảng ở bất kỳ trang nào của nhóm này.

**Quy tắc Chuyển động.** Một đường cong duy nhất `cubic-bezier(0.2, 0.7, 0.2, 1)` (`ease-ds`), 160 ms (`duration-160`) cho mọi chuyển trạng thái màu và viền. Nút chính nhấc 1 px (`hover:-translate-y-px`) và tắt khi `motion-reduce`. Không hiệu ứng vào, cuộn hay nổi.

## Shapes

Góc bo nhẹ và thống nhất: `rounded-ctl` 6 px cho nút, ô nhập, chip, ô vuông dấu `+`/`−`; `rounded-box` 10 px cho thẻ gói, thẻ biểu mẫu, dải CTA, khung trình duyệt, bảng so sánh. Badge và chấm tròn nhỏ dùng 4 px (`rounded-sm`); chấm logo 3 px; avatar và con dấu tròn dùng `rounded-full`.

Không dùng `rounded-lg` / `rounded-xl` / `rounded-2xl` cứng: nó sẽ vỡ khi bán kính đổi theo bề mặt.

**Quy tắc Bán kính theo bề mặt.** Các trang này không đặt `data-surface`, nên nhận giá trị mặc định 6 px / 10 px. Nếu một trang sau này chuyển sang bề mặt khác, bán kính đổi theo biến `--ds-r-ctl` / `--ds-r-box` chứ không sửa class.

**Quy tắc Viền.** Viền luôn mảnh 1 px và màu `line`. Dày hơn chỉ ở hai chỗ: gạch dưới tiêu đề điều hướng đang chọn, và mảng `bg-plain-soft` của dải CTA (không viền).

## Components

### Buttons
- **Hình dáng:** `rounded-ctl`, chữ 15 px 500, canh giữa cả hai chiều.
- **Chính** (`inkButton`): nền `ink`, chữ `on-ink`, cao 52 px, đệm ngang 28 px. Hover nền `ink/90` và nhấc 1 px. Vô hiệu: nền `muted`.
- **Phụ** (`lineButton`): nền trong suốt hoặc `panel`, **viền `ink` dày 1 px**, chữ `fg`, cùng cao 52 px. Hover nền `panel`; trong thẻ gói (nút "Xem chi tiết gói") cao 44 px và hover đảo thành nền `ink` chữ `on-ink`.
- **Nhỏ trong đầu điều hướng:** "Đăng ký" dùng `inkButton` cao 44 / 40 px, đệm ngang 16 / 18 px.
- **Focus:** vòng 2 px `acc`, lệch 2 px so với nền `page`, chỉ với bàn phím.
- **Vùng chạm:** không nút nào dưới 40 px trên điện thoại.

### Inputs / Fields
- **Kiểu:** nền `panel`, viền `line` 1 px, `rounded-ctl`, đệm ngang 14 px, cao 46 px (liên hệ) hoặc 48 px (tài khoản), chữ 15 px.
- **Focus:** viền chuyển sang `ink` kèm vòng 3 px `ink/10` — không dùng `acc`, để đúng với cảm giác "viết tay trên giấy".
- **Lỗi:** viền `err`, nền `err-soft/40`, thông báo 13 px `text-err` mở đầu bằng `⚠`, gắn bằng `aria-invalid` + `aria-describedby`.
- **Vô hiệu:** `opacity-60`.
- **Nhãn:** 14 px 500 phía trên, cách 8 px; gợi ý hoặc lỗi 13 px phía dưới.
- **Thông báo khối** (`Notice`): `rounded-ctl`, viền `-soft` 25%, nền `-soft`, đệm 12 × 16 px, chữ 14 px; `role="alert"` khi lỗi, `role="status"` khi thông tin.
- **Tóm tắt lỗi:** khối `err-soft` không viền, đếm số ô sai bằng ICU (`{count, plural}`).

### Ô mã một lần và thanh độ mật khẩu
- Sáu ô vuông `rounded-ctl`, cao 56 px (60 px từ `sm`), font mono 24 px, đệm 8–10 px; ô đang nhập viền `ink` + vòng `ink/10`; lỗi thì viền `err` và nền `err-soft/40`. Một `input` thật phủ lên trên, trong suốt, `autocomplete="one-time-code"` để dán và gợi ý mã của điện thoại vẫn chạy.
- Thanh độ mật khẩu: ba thanh 3 px bo tròn, `err` / `warn` / `ok` theo điểm, nhãn chữ 12.5 px bên phải đặt sẵn 72 px.

### Chips (chọn chủ đề liên hệ, chọn gói trên điện thoại)
- **Kiểu:** `rounded-ctl`, cao 44 px, viền 1 px, đệm ngang 16 px, chữ 15 px, có nhãn bằng chữ.
- **Chưa chọn:** nền `panel`, viền `line`, hover viền `muted`.
- **Đã chọn:** nền `plain-soft/60`, viền `ink`, thêm vòng 1 px `ink`, và một chấm tròn 8 px `ink` trong vòng tròn viền 16 px (radio tự vẽ, `sr-only`).

### Cards / Thẻ gói và dải CTA
- **Góc:** `rounded-box` 10 px.
- **Nền:** `panel`, viền `line` 1 px, không bóng.
- **Đệm:** 24 px trên điện thoại, 32 px từ `lg`.
- **Thẻ gói:** tên gói ở dạng nhãn HOA, dòng "hợp với…" 14 px `text-muted`, giá 30 px (trang chủ) / 34 px (trang bảng giá) `font-semibold` `tabular-nums` cùng hậu tố `/tháng`, ghi chú VAT 13 px, nút, rồi `dl` giới hạn chia bằng đường kẻ.
- **Dải CTA:** nền `plain-soft`, không viền, `rounded-box`, đệm 24 × 40 px trên điện thoại và 56–72 px từ `lg`; hai cột `[tiêu đề + đoạn dẫn] [nút]`, nút xếp dọc và trái trên điện thoại.

### Bảng so sánh gói
- Bọc trong `rounded-box` + viền + nền `panel`, chữ 14.5 px, `border-collapse`.
- Đầu bảng viền dưới `ink` (nặng hơn hàng), tên gói 14 px 600 canh giữa, cột tính năng 40 % căn trái.
- Hàng tiêu đề nhóm: nền `page`, nhãn 11 px HOA `text-muted`, viền dưới `line/70`.
- Hàng dữ liệu viền `line/70`, dòng cuối không viền. Ô "có" là `✓` kèm chữ ẩn cho trình đọc màn hình; ô "không" là `—` màu `muted`; giới hạn là số `tabular-nums` 13.5 px 500.
- Trên điện thoại thay bằng `ComparePicker`: dải chọn gói `role="radiogroup"` trong khung `rounded-box` nền `panel`, gói đang chọn nền `ink` chữ `on-ink`.

### Khung trình duyệt (thành phần đặc trưng)
`BrowserFrame` là dấu vân tay của nhóm trang này: một khối `rounded-box` viền `line` nền `panel`, bên trên là thanh địa chỉ cao 24 px (36 px từ `sm`) nền `plain-soft/60` với ba chấm tròn đường kẻ và địa chỉ font mono 10–11.5 px `text-muted`, bên dưới là ảnh cắt theo tỉ lệ khung (`aspect`). Có `darkSrc` thì đổi ảnh theo theme. Luôn kèm bóng.

Quy tắc: **chỉ dùng ảnh chụp thật** của sản phẩm đang chạy (`public/marketing/*.jpg`), chụp rộng 1440 px; không minh hoạ vẽ, không khung giả có số liệu bịa.

### Điều hướng
- **Đầu trang:** `relative`, viền dưới `line/70`, đệm dọc 12 px (20 px từ `lg`). Bên trái logo rồi các liên kết cách nhau 32 px; bên phải nút theme, chọn ngôn ngữ, "Đăng nhập", "Đăng ký".
- **Liên kết chính:** 14 px, gạch dưới bằng `border-b` 1 px kèm đệm 6 px — trang đang xem dùng viền `text-fg` + `font-medium`, còn lại viền trong suốt và hover viền `line`.
- **Chọn ngôn ngữ:** hai ô trong khung `rounded-ctl` viền `line`, cao 28 px, chữ 12.5 px HOA; ô đang chọn nền `ink` chữ `on-ink`. Ở chân trang đổi thành dạng chữ "Tiếng Việt · English".
- **Nút theme:** vuông 40 px `rounded-ctl`, biểu tượng mặt trăng / mặt trời 18 px, hover `fg/5`.
- **Đã đăng nhập:** thay cặp "Đăng nhập / Đăng ký" bằng avatar tròn `plain-soft` 32 px chứa hai chữ cái đầu email và chính email bị cắt bớt (tối đa 200 px).
- **Dưới `lg`:** liên kết, ngôn ngữ và đăng nhập chuyển vào `MobileMenu` — nút hai vạch 1.5 px rộng 20 px trong vùng 44 × 44, mở ra một bảng phẳng `absolute` ngay dước đầu trang, viền dưới `line`, nền `panel`, đệm 20 × 20, bóng `shadow-lift`; bấm vào liên kết hoặc Esc thì đóng.

### Chân trang
Cách nội dung 96 px (128 px từ `lg`), viền trên `line`. Lưới `2 cột` trên điện thoại, `3 cột` từ `sm`, `[1.6fr_1fr_1fr_1fr]` từ `lg`: ô đầu là logo + câu mô tả tối đa 300 px `muted` 14px/1.6, ba cột là link dạng chữ 14 px giãn dòng 2, tiêu đề cột là nhãn HOA `muted`. Dải cuối cách `line/70`, 12.5 px `muted`: bản quyền và chọn ngôn ngữ dạng chữ.

### Câu hỏi thường gặp
`<details>` không cần mã: `<summary>` cao 18–22 px, câu hỏi 15.5–17 px 500, bên phải một ô vuông 28 px `rounded-ctl` viền `line` chứa `+` (16px) đổi thành `−` khi mở bằng `group-open`. Câu trả lời 14.5–15 px `text-fg/80`, cách dưới 18–24 px, thụt phải 64 px từ `lg`. Câu đầu mở sẵn.

### Dấu thương hiệu
Chấm vuông bo 3 px màu `brand` đặt trước chữ "Digistay" (`font-semibold`, 18 px ở đầu trang và chân trang, 17 px trên điện thoại). Chỉ xuất hiện trên trang của Digistay.

## Do's and Don'ts

### Do
- **Do** dùng màu theo vai trò (`bg-panel`, `text-muted`, `border-line`, `bg-plain-soft`, `bg-ok-soft text-ok`) cho mọi thành phần mới trong nhóm trang này.
- **Do** để nút chính là `ink` và nút phụ là **viền `ink`**; trang này không có nút "màu thương hiệu".
- **Do** đặt tiêu đề bằng `font-serif` 500 và thân bài bằng phông không chân.
- **Do** giữ nhịp thưa: 96 px giữa các mục trên điện thoại, 128–144 px từ `lg`.
- **Do** dùng `frame` (`max-w-[1440px]`, lề 20/32/80 px) cho mọi khối ngang.
- **Do** dùng `tabular-nums` + `font-semibold` cho mọi số tiền và số giới hạn.
- **Do** gắn lỗi bằng `aria-invalid` + `aria-describedby`, và luôn có chữ đi cùng màu.
- **Do** dùng ảnh chụp thật trong `BrowserFrame`, có thanh địa chỉ và bóng.
- **Do** dùng `ease-ds` 160 ms và thêm `motion-reduce:` khi thêm chuyển động.
- **Do** đánh dấu nội dung mẫu bằng viền đứt hoặc lời trong mã, không khoác bằng con số trông như thật.
- **Do** kiểm tương phản chữ ≥ 4,5:1 ở cả hai theme và thêm cặp mới vào `src/styles/tokens.test.ts`.

### Don't
- **Don't** dùng hex cứng, `text-gray-*` hay tên Material cũ (`primary`, `surface`, `on-surface`, `terracotta`, `sand`) trong trang mới.
- **Don't** để `brand` thành nền nút hay nền một mảng lớn; dấu đất nung phải hiếm.
- **Don't** đặt bóng đổ lên thẻ, bảng, dải CTA hay ô nhập; chỉ ảnh chụp và menu đang mở mới có bóng.
- **Don't** dùng `rounded-lg`/`xl`/`2xl` cứng; dùng `rounded-ctl` và `rounded-box`.
- **Don't** viết tiêu đề bằng phông không chân, hoặc viết nhãn HOA trên tiêu đề và nút.
- **Don't** dùng chữ gradient, hiệu ứng trang trí trong `globals.css` (`float`, `morph-*`, `glow-pulse`, `text-shimmer`) hay chuyển động vào / cuộn.
- **Don't** bịt trạng thái bằng màu: mọi chip, thông báo và ô nhập lỗi đều phải có chữ.
- **Don't** thêm logo khách hàng, lời chứng thực, số liệu dùng thử hay "đã tin dùng" khi chưa có bằng chứng thật (`PRODUCT.md`, "Evidence on Hand").
- **Don't** đổi theme theo cài đặt hệ điều hành; chỉ cookie `ds-theme` quyết định.
- **Don't** lồng thẻ trong thẻ, hay dùng viền đậm một bên làm điểm nhấn.
- **Don't** viết chữ hiển thị cứng trong component; thêm khoá vào cả `messages/vi.json` và `messages/en.json` rồi dùng `useTranslations` / `getTranslations`.