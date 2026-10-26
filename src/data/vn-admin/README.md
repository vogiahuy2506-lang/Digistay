# Đơn vị hành chính Việt Nam (từ 1/7/2025)

34 tỉnh / thành phố và 3.321 phường / xã / đặc khu, không còn cấp quận / huyện
(Nghị quyết 202/2025/QH15 và các nghị quyết sắp xếp đơn vị cấp xã; sau đó Đồng Nai,
Quảng Ninh, Bắc Ninh thành thành phố trực thuộc trung ương trong năm 2026).

- **Nguồn:** [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database),
  bản `v5.2.0` (MIT), dựng từ danh mục của Cục Thống kê (danhmuchanhchinh.nso.gov.vn), cập nhật tới
  nghị quyết 388/NQ-UBTVQH16 (hiệu lực 20/09/2026). Đối chiếu với `provinces.open-api.vn/api/v2`:
  cùng 34 tỉnh, cùng 3.321 mã; khác 22 xã của Đồng Nai và Bắc Ninh mà API đó chưa đổi thành phường.
- **Ngày lấy:** 26/10/2026 (`fetchedAt` trong `provinces.json`).
- `provinces.json`: mã (2 số), tên ngắn (`name`, lưu vào `Property.city`), tên đầy đủ, tên tiếng Anh,
  `kind` (`city` = thành phố trực thuộc trung ương). Xếp theo tên, thứ tự tiếng Việt.
- `wards.json`: `{ "<mã tỉnh>": [["<mã 5 số>", "Phường …"], …] }`, xếp theo tên. Chỉ server đọc
  (`src/lib/vn-admin/wards.ts`); trình duyệt lấy từng tỉnh qua `GET /api/vn-admin/provinces/<mã>/wards`.

App không gọi dịch vụ ngoài lúc chạy. Cập nhật khi có nghị quyết mới:

```bash
node scripts/fetch-vn-admin.mjs --release <bản mới> --cross-check
npx vitest run vn-admin
```

Xem diff rồi sửa nguồn / ngày ở đây. Khách sạn đã lưu vẫn giữ tên lúc lưu; tên không còn trong
danh sách thì vẫn hiển thị, ô chọn chỉ yêu cầu chọn lại khi sửa.
