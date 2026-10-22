# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Bốn nhóm người dùng, đã được chủ dự án xác nhận:

- **Chủ khách sạn / homestay / resort nhỏ tại Việt Nam.** Tự vận hành hoặc thuê ít nhân sự, không có đội kỹ thuật, trước giờ nhận đặt phòng qua OTA, Zalo, Facebook và điện thoại. Việc cần làm: có website đặt phòng của riêng mình, nhận cọc thẳng vào tài khoản ngân hàng, biết doanh thu mà không ghi tay.
- **Lễ tân / nhân viên trực quầy.** Dùng trang quản lý nhiều giờ liền, kể cả ca đêm. Việc cần làm: xem mọi đặt phòng (từ website và khách đến trực tiếp) trong một danh sách, nhận phòng, trả phòng, ghi tiền mặt, không nhầm trạng thái thanh toán. Không được thấy doanh thu.
- **Khách đặt phòng trực tiếp**, chủ yếu trên điện thoại, đa số là người Việt, một phần là khách nước ngoài (có bản tiếng Anh). Việc cần làm: xem phòng và giá từng đêm, đặt, cọc bằng mã QR chuyển khoản, nhận xác nhận, tin rằng khoản cọc là thật.
- **Chủ chuỗi nhiều cơ sở.** Quản lý nhiều khách sạn trong một workspace, phân quyền Chủ / Quản lý / Lễ tân cho từng người.

## Product Purpose

Digistay là nền tảng cho khách sạn tại Việt Nam tự dựng website đặt phòng trực tiếp và quản lý toàn bộ vận hành (đặt phòng, lịch phòng, nhận / trả phòng, thanh toán, hoá đơn, báo cáo) trong cùng một tài khoản. Mỗi cơ sở có website riêng trên `ten-khach-san.digistay.vn` hoặc tên miền riêng.

Thành công là khách sạn nhận được đơn đặt trực tiếp mà không trả hoa hồng cho trung gian, tiền cọc về đúng tài khoản của mình, và lễ tân không phải đối chiếu tay giữa nhiều công cụ.

## Positioning

Ba điểm mà một sản phẩm hàng xóm khó sao chép trọn vẹn, đều do chủ dự án xác nhận:

- **Đặt phòng trực tiếp, không hoa hồng.** Digistay thu phí thuê bao theo gói (Starter / Growth / Business), không cắt phần trăm trên đơn đặt phòng và không giữ tiền của khách sạn. Tiền cọc vào thẳng tài khoản ngân hàng của khách sạn đã kết nối PayOS.
- **Làm đúng quy định và thói quen thanh toán Việt Nam.** Cọc bằng mã QR chuyển khoản (VietQR / PayOS), đối soát tự động, hoá đơn điện tử Mắt Bão (phát hành, điều chỉnh, thay thế), phí dịch vụ Digistay thanh toán bằng chuyển khoản ngân hàng.
- **Website không cần code, dựng nhanh.** Ghép các khối có sẵn thành website hoàn chỉnh. Mục tiêu sản phẩm là một khách sạn có website nhận đặt phòng trong khoảng 15 phút; đây là mục tiêu thiết kế, chưa phải số đo từ khách hàng thật.

## Operating Context

- Quầy lễ tân hoạt động cả ngày lẫn đêm, trên máy tính để bàn hoặc laptop, đôi khi trên điện thoại; ca đêm cần giao diện tối.
- Khách đặt phòng thường mở website khách sạn từ điện thoại, từ liên kết trên Facebook, Zalo hoặc Google.
- Tiền đi qua chuyển khoản ngân hàng và mã QR; tiền mặt vẫn tồn tại tại quầy và phải được ghi sổ quỹ hằng ngày.
- Hoá đơn điện tử gắn với đơn đặt phòng và gửi cho khách qua email.
- Ngôn ngữ chính là tiếng Việt, kèm tiếng Anh cho website khách sạn. Tiền tệ là VND; ngày giờ theo múi giờ Việt Nam.

## Capabilities and Constraints

Đang có trong sản phẩm (đọc từ mã nguồn và nội dung trang giới thiệu):

- Trình dựng website theo khối, subdomain và tên miền riêng, bản tiếng Anh.
- Đặt phòng trực tiếp với giá theo hạng phòng, giá cuối tuần, phụ thu và tiền cọc tính tự động; cọc qua PayOS.
- Quản lý đặt phòng và lịch phòng, khách walk-in, nhận / trả phòng, phí trả phòng muộn.
- Đối soát thanh toán, sổ quỹ hằng ngày, báo cáo doanh thu, hoá đơn điện tử Mắt Bão.
- Nhiều cơ sở trong một workspace; vai trò Chủ, Quản lý, Lễ tân; giao diện tối; đăng nhập hai lớp tuỳ chọn.

Ràng buộc:

- Đa tenant: mỗi workspace chỉ thấy dữ liệu của mình; Lễ tân không thấy báo cáo doanh thu.
- Đăng nhập hai lớp là tuỳ chọn, không bao giờ bắt buộc.
- Website khách sạn dùng màu và phông do chính khách sạn chọn, nên giao diện của Digistay không được giả định một màu hay một phông cố định ở đó.
- Webhook thanh toán và các thao tác chạm tiền chịu ràng buộc bảo mật riêng (xem `CLAUDE.md`).

Chưa quyết định: nhà cung cấp thanh toán thứ hai (SePay), thanh toán trực tuyến ngoài khoản cọc.

## Brand Commitments

- Tên: **Digistay**. Lời hứa thương hiệu là sự minh bạch về tiền: khách sạn giữ tiền của mình, Digistay không là bên trung gian giữ tiền.
- Giọng văn: tiếng Việt thẳng, cụ thể, nói bằng việc sản phẩm làm được hôm nay; không dùng số liệu hay lời hứa chưa có bằng chứng.
- Dấu hiệu thương hiệu hiện có: chấm vuông nhỏ màu đất nung cạnh chữ "Digistay" và dòng "Vận hành bởi Digistay" trên website khách sạn.

## Evidence on Hand

- Sản phẩm đang ở giai đoạn trước ra mắt: **chưa có khách hàng trả tiền, chưa có lời chứng thực, chưa có số liệu sử dụng, chưa có logo khách hàng.** Không được bịa các thứ này trong nội dung hay giao diện, kể cả ở chỗ giữ chỗ trông như thật.
- Có sẵn: ảnh chụp giao diện thật của trang quản lý và website khách sạn dùng trên trang giới thiệu; bảng giá ba gói trong `messages/vi.json`; tài liệu vận hành trong `docs/`.

## Product Principles

1. **Tiền phải rõ ràng.** Mọi con số, trạng thái thanh toán và hành động chạm tiền phải đọc được ngay, không nhầm, không phải suy ra. Trạng thái tiền không bao giờ chỉ dựa vào màu.
2. **Quầy lễ tân là nơi thử thách chính.** Việc hằng ngày (tìm đơn, nhận phòng, trả phòng, ghi tiền) phải nhanh, ít bước, bền với ca đêm và với người dùng ít kinh nghiệm công nghệ.
3. **Khách sạn là chủ, Digistay đứng sau.** Website khách phải mang diện mạo của khách sạn; Digistay chỉ hiện ở mức một dấu ghi nhận nhỏ.
4. **Nói đúng những gì đang chạy.** Chỉ mô tả tính năng đã có; không hứa, không thổi phồng, không thêm bằng chứng giả.
5. **Mặc định an toàn.** Quyền truy cập, dữ liệu khách và khoá thanh toán được bảo vệ trước khi tiện lợi; người dùng không phải tự bật các bảo vệ cơ bản.

## Accessibility & Inclusion

- Độ tương phản chữ tối thiểu 4,5:1 (WCAG 2.x AA) ở cả giao diện sáng và tối; đã có test kiểm trong `src/styles/tokens.test.ts`.
- Vùng chạm tối thiểu 44 px trên điện thoại; ô nhập 16 px trên điện thoại để iOS không tự phóng to.
- Điều hướng bằng bàn phím với vòng focus nhìn thấy; tôn trọng `prefers-reduced-motion`.
- Người dùng chính không phải dân công nghệ và có thể đọc trên màn hình cũ, ánh sáng xấu: ưu tiên chữ rõ, nhãn bằng lời thay vì chỉ biểu tượng.
- Xác nhận đầy đủ WCAG cần kiểm thử thủ công với công nghệ hỗ trợ; tài liệu này chỉ ghi mục tiêu.
