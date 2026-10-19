# Digistay - Quản lý Khách sạn & Nhà hàng

Nền tảng quản lý khách sạn và nhà hàng chuyên nghiệp, được xây dựng với Next.js 14, Prisma, PostgreSQL và Redis.

## Tính năng (Giai đoạn 1)

- ✅ **Xác thực người dùng**: Đăng ký, đăng nhập bằng Email/Password hoặc Google OAuth
- ✅ **Quản lý Workspace**: Tạo và quản lý nhiều không gian làm việc
- ✅ **Mời thành viên**: Gửi lời mời qua email với phân quyền Admin/Staff
- ✅ **Quản lý Property**: Tạo cơ sở kinh doanh (Khách sạn, Homestay, Resort, Nhà hàng)
- ✅ **Subdomain**: Mỗi cơ sở được cấp một subdomain riêng
- ✅ **Quản lý phòng**: Cấu hình hạng phòng, số lượng phòng
- ✅ **Tiện ích**: Chọn và quản lý các tiện ích có sẵn
- ✅ **Bảng giá**: Thiết lập giá ngày thường, cuối tuần, phụ phí
- ✅ **Chính sách**: Cài đặt giờ check-in/out, quy định
- ✅ **Dashboard**: Tổng quan với các chỉ số nhanh
- ✅ **Quản lý đặt phòng**: Tạo, xem, quản lý booking
- ✅ **Thanh toán VietQR**: Tích hợp mã QR thanh toán ngân hàng
- ✅ **Website Builder**: Tạo trang public cho cơ sở

## Yêu cầu hệ thống

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm hoặc yarn

## Cài đặt

### 1. Clone dự án

```bash
git clone https://github.com/vogiahuy2506-lang/Digistay.git
cd Digistay
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Thiết lập database

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Chỉnh sửa `.env` và cập nhật các giá trị:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/digistay?schema=public"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"
```

### 4. Khởi tạo database

```bash
# Tạo bảng từ prisma/migrations
npm run db:deploy

# (Tùy chọn) Chạy seed để tạo dữ liệu demo
npm run db:seed
```

### 5. Chạy ứng dụng

```bash
npm run dev
```

Mở trình duyệt và truy cập http://localhost:3000

## Tài khoản Demo

Sau khi chạy seed:

- **Email**: demo@digistay.vn
- **Mật khẩu**: demo123

## Cấu trúc dự án

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Trang đăng nhập, đăng ký
│   ├── (dashboard)/       # Dashboard và các trang quản lý
│   ├── (public)/          # Trang public cho khách
│   └── api/               # API routes
├── components/
│   ├── ui/               # UI components cơ bản
│   └── layout/           # Layout components
├── lib/
│   ├── auth/             # NextAuth configuration
│   ├── db/               # Prisma & Redis clients
│   ├── utils/            # Utility functions
│   └── validations/      # Zod schemas
├── types/                # TypeScript types
└── prisma/
    ├── schema.prisma     # Database schema
    └── seed.ts           # Seed data
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

### Users
- `GET/PATCH /api/users/me` - Thông tin & cập nhật profile

### Workspaces
- `GET /api/workspaces` - Danh sách workspace
- `POST /api/workspaces` - Tạo workspace mới
- `GET/PATCH/DELETE /api/workspaces/[id]` - Chi tiết/cập nhật/xóa workspace

### Members & Invitations
- `GET/POST /api/workspaces/[id]/members` - Quản lý thành viên
- `GET/POST /api/workspaces/[id]/invitations` - Quản lý lời mời

### Properties
- `GET/POST /api/properties` - Danh sách & tạo cơ sở
- `GET/PATCH/DELETE /api/properties/[id]` - Chi tiết/cập nhật/xóa cơ sở
- `GET/POST /api/properties/[id]/room-types` - Quản lý hạng phòng
- `GET/POST/PATCH/DELETE /api/properties/[id]/pricing` - Quản lý bảng giá
- `GET/PATCH /api/properties/[id]/policy` - Quản lý chính sách
- `GET/POST /api/properties/[id]/amenities` - Quản lý tiện ích
- `GET/POST/DELETE /api/properties/[id]/images` - Quản lý hình ảnh

### Bookings
- `GET/POST /api/bookings` - Danh sách & tạo booking
- `GET/PATCH/DELETE /api/bookings/[id]` - Chi tiết/cập nhật/xóa booking
- `POST /api/bookings/[id]/check-in` - Check-in khách
- `POST /api/bookings/[id]/check-out` - Check-out khách
- `GET /api/bookings/availability` - Kiểm tra availability

### Bank Accounts & Payments
- `GET/POST /api/bank-accounts` - Quản lý tài khoản ngân hàng
- `GET/POST /api/payments` - Quản lý thanh toán

### Invoices
- `GET/POST /api/invoices` - Danh sách & tạo hóa đơn
- `GET/PATCH/DELETE /api/invoices/[id]` - Chi tiết/cập nhật/xóa hóa đơn

## Công nghệ sử dụng

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL với Prisma ORM
- **Cache**: Redis với ioredis
- **Authentication**: NextAuth.js v5 (Auth.js)
- **Validation**: Zod
- **UI Components**: Custom components với Tailwind
- **QR Code**: qrcode library

## Phát triển tiếp theo (Giai đoạn 2)

- [ ] Thanh toán trực tuyến (VNPay, Momo, ZaloPay)
- [ ] Gửi email tự động
- [ ] Tích hợp Cloudinary/S3 cho hình ảnh
- [ ] Quản lý review/đánh giá
- [ ] Báo cáo doanh thu chi tiết
- [ ] Mobile app

## License

MIT
