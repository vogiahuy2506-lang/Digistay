export interface VideoChapter {
  id: string
  stepNumber: number
  timestamp: string
  seconds: number
  title: string
  summary: string
}

export interface QuickstartStep {
  id: string
  stepNumber: number
  title: string
  description: string
  estimatedMinutes: number
  actionLabel: string
  /** Relative path builder from workspace slug and optional propertyId */
  hrefType: 'propertySettings' | 'rooms' | 'website' | 'bookingNew' | 'members'
}

export interface HelpCategory {
  id: string
  title: string
  description: string
  iconName: 'concierge' | 'bed' | 'globe' | 'wallet' | 'share' | 'shield'
}

export interface GuideAnnotationSpot {
  id: number
  kind: 'click' | 'input'
  label: string
  hint: string
  x: number
  y: number
  w: number
  h: number
  badgePos?: 'top' | 'bottom'
}

export interface HelpArticle {
  id: string
  categoryId: string
  title: string
  summary: string
  readTimeMinutes: number
  tags: string[]
  screenshot?: string
  spots?: GuideAnnotationSpot[]
  steps: {
    heading: string
    detail: string
  }[]
  tip?: string
}

export const QUICKSTART_VIDEO_META = {
  title: '5 Bước Bắt Đầu Dành Cho Chủ Khách Sạn Trên Digistay',
  durationLabel: '45 giây',
  subtitle:
    'Hướng dẫn trực quan trên giao diện thật từ lúc cập nhật hồ sơ khách sạn, tạo hạng phòng, xuất bản website đặt phòng đến khi nhận đơn & mời lễ tân.',
  embedUrl: '',
}

export const VIDEO_CHAPTERS: VideoChapter[] = [
  {
    id: 'chap-1',
    stepNumber: 1,
    timestamp: '00:00',
    seconds: 0,
    title: 'Hoàn tất hồ sơ & hình ảnh khách sạn',
    summary: 'Tải lên logo, ảnh bìa, nhập tên cơ sở và nhấn Lưu thay đổi để xây dựng uy tín với khách.',
  },
  {
    id: 'chap-2',
    stepNumber: 2,
    timestamp: '00:09',
    seconds: 9,
    title: 'Tạo hạng phòng & bảng giá linh hoạt',
    summary: 'Thêm hạng phòng (Deluxe, Suite...), cập nhật giá & ảnh phòng, và đánh số phòng cụ thể (P.101, P.102...).',
  },
  {
    id: 'chap-3',
    stepNumber: 3,
    timestamp: '00:18',
    seconds: 18,
    title: 'Xuất bản Website đặt phòng trực tiếp',
    summary: 'Dùng thanh Yêu cầu AI tinh chỉnh nội dung, bật chế độ Đã xuất bản và nhấn Lưu thay đổi.',
  },
  {
    id: 'chap-4',
    stepNumber: 4,
    timestamp: '00:27',
    seconds: 27,
    title: 'Tạo đơn đặt phòng & thanh toán VietQR',
    summary: 'Chọn ngày nhận/trả phòng, chọn hạng phòng còn trống và điền thông tin khách để hoàn tất đơn.',
  },
  {
    id: 'chap-5',
    stepNumber: 5,
    timestamp: '00:36',
    seconds: 36,
    title: 'Mời nhân viên lễ tân & phân quyền',
    summary: 'Mời email nhân viên, theo dõi lời mời và bấm Phân quyền để bảo mật doanh thu.',
  },
]

export const QUICKSTART_STEPS: QuickstartStep[] = [
  {
    id: 'step-property',
    stepNumber: 1,
    title: 'Cập nhật hồ sơ & ảnh đại diện khách sạn',
    description: 'Điền tên khách sạn, số điện thoại hotline, địa chỉ và tải lên ít nhất 3 hình ảnh không gian thực tế.',
    estimatedMinutes: 3,
    actionLabel: 'Cập nhật thông tin',
    hrefType: 'propertySettings',
  },
  {
    id: 'step-rooms',
    stepNumber: 2,
    title: 'Tạo hạng phòng & gán số phòng',
    description: 'Thiết lập các hạng phòng đang kinh doanh kèm giá niêm yết, sức chứa và danh sách số phòng.',
    estimatedMinutes: 4,
    actionLabel: 'Quản lý phòng',
    hrefType: 'rooms',
  },
  {
    id: 'step-website',
    stepNumber: 3,
    title: 'Thiết kế & xuất bản Website đặt phòng trực tiếp',
    description: 'Dùng AI hoặc kéo thả các khối giao diện để hoàn thiện trang web bán phòng riêng mang thương hiệu của bạn.',
    estimatedMinutes: 3,
    actionLabel: 'Mở Website Builder',
    hrefType: 'website',
  },
  {
    id: 'step-booking',
    stepNumber: 4,
    title: 'Tạo đơn đặt phòng đầu tiên (Check-in thử)',
    description: 'Làm quen với thao tác tạo booking khách lẻ (Walk-in), gán phòng trống và xuất mã QR thanh toán.',
    estimatedMinutes: 3,
    actionLabel: 'Tạo booking mới',
    hrefType: 'bookingNew',
  },
  {
    id: 'step-members',
    stepNumber: 5,
    title: 'Mời nhân viên lễ tân & phân quyền',
    description: 'Thêm email nhân sự lễ tân hoặc quản lý để vận hành giao ca chuyên nghiệp, minh bạch.',
    estimatedMinutes: 2,
    actionLabel: 'Mời thành viên',
    hrefType: 'members',
  },
]

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'operations',
    title: 'Lễ tân & Vận hành hằng ngày',
    description: 'Tổng quan, lịch đặt phòng, tạo booking tại quầy và quản lý danh bạ khách hàng.',
    iconName: 'concierge',
  },
  {
    id: 'rooms',
    title: 'Phòng, Dịch vụ & Chính sách',
    description: 'Hạng phòng, số phòng, tiện ích dịch vụ gia tăng và quy định giờ check-in/out.',
    iconName: 'bed',
  },
  {
    id: 'website',
    title: 'Website & Khuyến mãi trực tiếp',
    description: 'Thiết kế website bằng AI, xuất bản web đặt phòng và tạo mã giảm giá thu hút khách.',
    iconName: 'globe',
  },
  {
    id: 'finance',
    title: 'Thanh toán VietQR & Báo cáo',
    description: 'Kết nối ngân hàng VietQR/PayOS, xác nhận giao dịch tiền cọc và báo cáo doanh thu.',
    iconName: 'wallet',
  },
  {
    id: 'channels',
    title: 'Kênh phân phối & Hồ sơ cơ sở',
    description: 'Cập nhật hồ sơ thương hiệu khách sạn và đồng bộ lịch phòng OTA (Booking, Agoda, Airbnb).',
    iconName: 'share',
  },
  {
    id: 'account',
    title: 'Tài khoản & Phân quyền nhân sự',
    description: 'Mời nhân viên lễ tân, quản lý, cấu hình quyền truy cập và bảo mật tài khoản.',
    iconName: 'shield',
  },
]

export const HELP_ARTICLES: HelpArticle[] = [
  // 1. Operations
  {
    id: 'art-overview-dashboard',
    categoryId: 'operations',
    title: 'Xem Tổng quan công suất phòng & khách đến/đi hôm nay',
    summary: 'Nắm bắt nhanh số phòng đang ở, lượt khách check-in hôm nay và doanh thu dự kiến trong 1 màn hình.',
    readTimeMinutes: 2,
    tags: ['tổng quan', 'dashboard', 'công suất', 'lễ tân'],
    screenshot: '/guides/overview.png',
    spots: [
      { id: 1, kind: 'click', label: 'Xem nhanh web', hint: 'Bấm để mở trang web đặt phòng của khách sạn', x: 50.2, y: 19.2, w: 10.6, h: 5.2, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Theo dõi hôm nay', hint: 'Xem tổng phòng đang ở, khách sắp đến & doanh thu', x: 22.8, y: 31.8, w: 74.5, h: 14.5, badgePos: 'bottom' },
      { id: 3, kind: 'click', label: 'Bấm xử lý khách', hint: 'Danh sách khách Check-in / Check-out trong ngày', x: 61.0, y: 48.0, w: 36.2, h: 19.5, badgePos: 'top' },
    ],
    steps: [
      { heading: 'Bước 1: Kiểm tra thẻ thống kê trên cùng', detail: '4 ô thống kê hiển thị tức thì Tổng số phòng, Số phòng đang có khách, Dự kiến đến hôm nay và Doanh thu dự kiến tháng.' },
      { heading: 'Bước 2: Theo dõi tình trạng từng hạng phòng', detail: 'Cột bên trái hiển thị số phòng còn trống của từng hạng phòng để lễ tân báo giá nhanh cho khách hỏi trực tiếp.' },
      { heading: 'Bước 3: Xử lý danh sách Lượt đến & đi hôm nay', detail: 'Bấm vào từng đơn ở cột bên phải để tiến hành Check-in hoặc thu tiền cọc còn thiếu.' },
    ],
  },
  {
    id: 'art-walkin-booking',
    categoryId: 'operations',
    title: 'Tạo đơn đặt phòng nhanh cho khách tại quầy (Walk-in / Gọi điện)',
    summary: 'Cách tạo booking trực tiếp khi khách đến hỏi thuê phòng hoặc đặt qua điện thoại/Zalo.',
    readTimeMinutes: 3,
    tags: ['walk-in', 'tạo đơn', 'khách lẻ', 'đặt phòng', 'booking'],
    screenshot: '/guides/step-4.png',
    spots: [
      { id: 1, kind: 'input', label: 'Chọn ngày ở', hint: 'Chọn ngày Nhận phòng, Trả phòng & số lượng khách', x: 22.8, y: 19.5, w: 33.0, h: 8.5, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Bấm chọn phòng', hint: 'Nhấn + Chọn hạng này ở hạng phòng còn trống', x: 52.6, y: 55.2, w: 12.6, h: 5.8, badgePos: 'top' },
      { id: 3, kind: 'input', label: 'Điền thông tin khách', hint: 'Nhập Họ tên, Số điện thoại và bấm Tạo đơn bên dưới', x: 68.4, y: 74.2, w: 27.8, h: 14.5, badgePos: 'top' },
    ],
    steps: [
      { heading: 'Bước 1: Chọn ngày lưu trú & số khách', detail: 'Chọn ngày nhận/trả phòng ở thanh phía trên, hệ thống sẽ tự động lọc các hạng phòng còn trống.' },
      { heading: 'Bước 2: Bấm + Chọn hạng này', detail: 'Chọn hạng phòng phù hợp và chọn số phòng cụ thể (P.101, P.102...).' },
      { heading: 'Bước 3: Nhập thông tin khách và lưu đơn', detail: 'Điền tên, số điện thoại khách vào khung bên phải và nhấn Tạo đơn đặt phòng.' },
    ],
  },
  {
    id: 'art-calendar-view',
    categoryId: 'operations',
    title: 'Sử dụng Lịch đặt phòng & Sơ đồ phòng trực quan',
    summary: 'Chuyển đổi giữa Danh sách, Lịch tháng và Sơ đồ phòng để quản lý tình trạng trống/bận toàn khách sạn.',
    readTimeMinutes: 2,
    tags: ['lịch', 'sơ đồ phòng', 'calendar', 'checkin', 'checkout'],
    screenshot: '/guides/calendar.png',
    spots: [
      { id: 1, kind: 'click', label: 'Chuyển chế độ xem', hint: 'Bấm chuyển giữa Danh sách, Lịch tháng và Sơ đồ phòng', x: 22.8, y: 14.8, w: 27.5, h: 5.5, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Bấm tạo đơn mới', hint: 'Nhấn + Tạo đặt phòng hoặc bấm + Thêm ngay trên ô ngày', x: 87.0, y: 6.5, w: 11.2, h: 5.2, badgePos: 'bottom' },
      { id: 3, kind: 'click', label: 'Xem chi tiết đơn', hint: 'Bấm trực tiếp vào thẻ đơn màu xanh trên lịch để Check-in/đổi phòng', x: 44.2, y: 73.0, w: 10.2, h: 12.2, badgePos: 'top' },
    ],
    steps: [
      { heading: 'Bước 1: Chọn chế độ xem phù hợp', detail: 'Dùng "Lịch tháng" để xem tổng thể công suất theo ngày, hoặc "Sơ đồ phòng" để kéo thả xếp phòng.' },
      { heading: 'Bước 2: Bấm vào từng đơn trên lịch', detail: 'Bấm trực tiếp vào tên khách trên ô lịch để mở chi tiết đơn, xác nhận Check-in, thêm dịch vụ hoặc Check-out.' },
    ],
  },
  {
    id: 'art-customers-crm',
    categoryId: 'operations',
    title: 'Quản lý Danh bạ khách hàng & Lịch sử lưu trú (CRM)',
    summary: 'Tự động lưu trữ thông tin khách hàng, phân loại khách VIP/Thân thiết và ghi chú sở thích phục vụ.',
    readTimeMinutes: 2,
    tags: ['khách hàng', 'crm', 'vip', 'đồng bộ'],
    screenshot: '/guides/customers.png',
    spots: [
      { id: 1, kind: 'click', label: 'Đồng bộ từ đơn cũ', hint: 'Bấm để gom toàn bộ dữ liệu khách từ lịch sử đặt phòng', x: 82.8, y: 6.8, w: 14.8, h: 5.2, badgePos: 'bottom' },
      { id: 2, kind: 'input', label: 'Tìm kiếm khách', hint: 'Gõ tên, số điện thoại hoặc ghi chú để tra cứu lịch sử ở', x: 22.8, y: 29.0, w: 34.8, h: 5.5, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Đồng bộ dữ liệu khách hàng', detail: 'Hệ thống tự động lưu hồ sơ khách khi có booking mới, hoặc bạn nhấn "Đồng bộ từ đặt phòng" để cập nhật các đơn cũ.' },
      { heading: 'Bước 2: Tìm kiếm & Ghi chú sở thích', detail: 'Gõ số điện thoại khách để biết số lần đã ở, tổng chi tiêu và ghi chú yêu cầu riêng (ví dụ: thích phòng yên tĩnh tầng cao).' },
    ],
  },

  // 2. Rooms & Services & Policies
  {
    id: 'art-create-rooms',
    categoryId: 'rooms',
    title: 'Thiết lập hạng phòng, số phòng và bảng giá ngày thường / cuối tuần',
    summary: 'Cấu hình chính xác số lượng phòng, ảnh hạng phòng và giá bán hiển thị trên Website và phần mềm lễ tân.',
    readTimeMinutes: 4,
    tags: ['hạng phòng', 'giá phòng', 'cuối tuần', 'phòng', 'room'],
    screenshot: '/guides/step-2.png',
    spots: [
      { id: 1, kind: 'click', label: 'Thêm hạng phòng', hint: 'Bấm để tạo hạng phòng mới (Deluxe, Suite...)', x: 83.6, y: 5.8, w: 14.3, h: 6.2, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Sửa giá & ảnh', hint: 'Bấm Sửa để cập nhật giá cuối tuần và ảnh phòng đẹp', x: 23.0, y: 39.8, w: 6.2, h: 5.5, badgePos: 'bottom' },
      { id: 3, kind: 'click', label: 'Đánh số phòng', hint: 'Vào tab Danh sách phòng để thêm P.101, P.102...', x: 32.0, y: 14.5, w: 11.5, h: 6.2, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Tạo hạng phòng mới', detail: 'Nhấn "+ Thêm hạng phòng", điền tên hạng phòng, sức chứa tối đa và giá niêm yết mỗi đêm.' },
      { heading: 'Bước 2: Đánh số phòng thực tế', detail: 'Chuyển sang tab "Danh sách phòng" để thêm các phòng vật lý (P.101, P.102...) thuộc hạng phòng đó.' },
      { heading: 'Bước 3: Tải ảnh & dùng Định giá AI', detail: 'Tải 3–5 ảnh sắc nét cho từng hạng phòng để hiển thị đẹp mắt trên Website đặt phòng trực tiếp.' },
    ],
  },
  {
    id: 'art-services-amenities',
    categoryId: 'rooms',
    title: 'Quản lý Tiện ích cơ sở & Dịch vụ gia tăng (Minibar, Ăn uống, Đưa đón)',
    summary: 'Bật các tiện ích nổi bật hiển thị lên Website và tạo danh mục dịch vụ tính tiền thêm cho khách.',
    readTimeMinutes: 2,
    tags: ['dịch vụ', 'tiện ích', 'minibar', 'ăn sáng', 'wifi'],
    screenshot: '/guides/services.png',
    spots: [
      { id: 1, kind: 'click', label: 'Thêm tiện ích riêng', hint: 'Bấm để tạo thêm tiện ích/dịch vụ đặc trưng của cơ sở', x: 76.2, y: 20.5, w: 13.2, h: 5.2, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Bật & đánh dấu sao', hint: 'Bấm chọn tiện ích có sẵn và nhấn Lưu ở góc phải', x: 42.2, y: 33.5, w: 17.5, h: 6.8, badgePos: 'bottom' },
      { id: 3, kind: 'click', label: 'Bấm lưu', hint: 'Nhấn Lưu để đồng bộ tiện ích lên Website khách sạn', x: 89.8, y: 20.5, w: 6.0, h: 5.2, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Chọn các tiện ích có sẵn', detail: 'Bấm vào các thẻ tiện ích như Điều hòa, Bể bơi, Ăn sáng, Wifi miễn phí... để kích hoạt.' },
      { heading: 'Bước 2: Đánh dấu sao nổi bật & Lưu', detail: 'Bấm biểu tượng ngôi sao để đưa các tiện ích đắt giá nhất lên đầu trang Website khách sạn, sau đó nhấn Lưu.' },
    ],
  },
  {
    id: 'art-policies-setup',
    categoryId: 'rooms',
    title: 'Cấu hình Chính sách giờ Check-in/out & Phí trả phòng muộn',
    summary: 'Thiết lập quy định giờ nhận/trả phòng tiêu chuẩn và mức phụ thu tự động (30%, 50%, 100%) khi khách ở quá giờ.',
    readTimeMinutes: 2,
    tags: ['chính sách', 'check-in', 'check-out', 'phụ thu', 'hủy phòng'],
    screenshot: '/guides/policies.png',
    spots: [
      { id: 1, kind: 'input', label: 'Cài giờ quy định', hint: 'Chọn giờ nhận phòng (14:00) và trả phòng (12:00)', x: 24.2, y: 29.2, w: 71.0, h: 7.2, badgePos: 'bottom' },
      { id: 2, kind: 'input', label: 'Cài phí trả muộn', hint: 'Thiết lập % phụ thu theo mốc trả trước 15:00 hoặc 18:00', x: 24.2, y: 55.8, w: 26.0, h: 27.5, badgePos: 'top' },
      { id: 3, kind: 'click', label: 'Bấm lưu', hint: 'Nhấn Lưu thay đổi ở góc phải trên để áp dụng', x: 87.0, y: 6.5, w: 10.6, h: 5.2, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Cài đặt giờ Check-in / Check-out', detail: 'Nhập giờ tiêu chuẩn (thường là 02:00 PM nhận phòng và 12:00 PM trả phòng) để hiển thị rõ trên phiếu xác nhận đặt phòng.' },
      { heading: 'Bước 2: Thiết lập phụ thu trả muộn & Lưu', detail: 'Bật tùy chọn tính phí trả muộn theo % giá phòng để lễ tân tính tiền nhanh, chính xác khi khách Check-out.' },
    ],
  },

  // 3. Website & Marketing
  {
    id: 'art-website-builder',
    categoryId: 'website',
    title: 'Thiết kế và xuất bản Website đặt phòng trực tiếp bằng AI',
    summary: 'Sở hữu website mang thương hiệu riêng của khách sạn, cho phép khách đặt phòng trực tiếp không mất phí hoa hồng.',
    readTimeMinutes: 4,
    tags: ['website', 'ai', 'thiết kế', 'xuất bản', 'tên miền'],
    screenshot: '/guides/step-3.png',
    spots: [
      { id: 1, kind: 'input', label: 'Nhập lệnh AI', hint: 'Mô tả phong cách mong muốn hoặc bấm nút Gợi ý nhanh', x: 34.4, y: 83.5, w: 62.8, h: 11.2, badgePos: 'top' },
      { id: 2, kind: 'click', label: 'Bật Xuất bản', hint: 'Bấm để công khai website cho khách hàng truy cập', x: 78.6, y: 4.0, w: 9.0, h: 5.6, badgePos: 'bottom' },
      { id: 3, kind: 'click', label: 'Lưu thay đổi', hint: 'Nhấn Lưu thay đổi sau khi chỉnh sửa xong các khối', x: 87.6, y: 4.0, w: 10.2, h: 5.6, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Nhập yêu cầu AI hoặc chọn Mẫu sẵn', detail: 'Dùng thanh Yêu cầu AI bên dưới để tạo toàn bộ nội dung chuyên nghiệp chỉ trong 5 giây.' },
      { heading: 'Bước 2: Bấm trực tiếp vào khối để sửa', detail: 'Bấm vào bất kỳ phần nào trên bản xem trước để mở bảng chỉnh sửa bên phải (thay ảnh, sửa chữ, đổi màu).' },
      { heading: 'Bước 3: Xuất bản & Lưu thay đổi', detail: 'Chuyển trạng thái sang "Đã xuất bản" và nhấn "Lưu thay đổi".' },
    ],
  },
  {
    id: 'art-coupons-promo',
    categoryId: 'website',
    title: 'Tạo Mã giảm giá (Coupon) kích cầu đặt phòng trực tiếp',
    summary: 'Tạo mã ưu đãi giảm theo % hoặc số tiền cố định (VD: GIAM10, CHAOBANMOI) cho khách đặt qua Website.',
    readTimeMinutes: 2,
    tags: ['mã giảm giá', 'coupon', 'khuyến mãi', 'cro'],
    screenshot: '/guides/coupons.png',
    spots: [
      { id: 1, kind: 'click', label: 'Tạo mã mới', hint: 'Bấm + Tạo mã đầu tiên để nhập mã code, mức giảm và hạn dùng', x: 53.6, y: 50.2, w: 12.5, h: 5.6, badgePos: 'bottom' },
      { id: 2, kind: 'input', label: 'Lọc & tìm mã', hint: 'Tìm kiếm mã hoặc lọc các mã Đang bật / Đang tắt', x: 24.4, y: 18.2, w: 71.2, h: 5.8, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Tạo mã ưu đãi', detail: 'Bấm "+ Tạo mã đầu tiên", đặt tên mã dễ nhớ (VD: TRUCTIEP10), chọn giảm % hoặc giảm tiền mặt.' },
      { heading: 'Bước 2: Chia sẻ mã lên Banner Website / Fanpage', detail: 'Khách hàng nhập mã này ở bước thanh toán trên Website sẽ được trừ tiền trực tiếp.' },
    ],
  },

  // 4. Finance & VietQR
  {
    id: 'art-vietqr-setup',
    categoryId: 'finance',
    title: 'Cài đặt Tài khoản ngân hàng VietQR & Cổng thanh toán tự động',
    summary: 'Khách đặt phòng quét mã VietQR, hệ thống điền sẵn số tiền & nội dung đơn, tiền về thẳng tài khoản của bạn.',
    readTimeMinutes: 3,
    tags: ['vietqr', 'thanh toán', 'ngân hàng', 'payos', 'sepay', 'momo'],
    screenshot: '/guides/bank.png',
    spots: [
      { id: 1, kind: 'click', label: 'Thêm ngân hàng', hint: 'Bấm + Thêm tài khoản để nhập số tài khoản nhận tiền VietQR', x: 85.4, y: 9.2, w: 12.4, h: 5.4, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Cổng tự động', hint: 'Hoặc bấm tab này để kết nối PayOS/SePay tự động gạch nợ', x: 40.2, y: 18.0, w: 31.0, h: 6.0, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Thêm tài khoản ngân hàng VietQR', detail: 'Nhấn "+ Thêm tài khoản", chọn ngân hàng (VCB, TCB, MB, ACB...), nhập Số tài khoản và Tên chủ tài khoản.' },
      { heading: 'Bước 2: (Tùy chọn) Kết nối PayOS / SePay', detail: 'Nếu muốn hệ thống tự động xác nhận "Đã thanh toán" ngay lập tức khi tiền về tài khoản mà không cần lễ tân kiểm tra tay, hãy kết nối ở tab Cổng thanh toán tự động.' },
    ],
  },
  {
    id: 'art-payments-tracking',
    categoryId: 'finance',
    title: 'Theo dõi Giao dịch thanh toán & Xác nhận tiền cọc của khách',
    summary: 'Kiểm tra danh sách các khoản thu tiền cọc/thanh toán, lọc theo phương thức và xuất file Excel đối soát.',
    readTimeMinutes: 2,
    tags: ['giao dịch', 'thanh toán', 'tiền cọc', 'excel'],
    screenshot: '/guides/payments.png',
    spots: [
      { id: 1, kind: 'input', label: 'Lọc giao dịch', hint: 'Tìm theo mã giao dịch, tên khách, trạng thái hoặc ngày', x: 24.0, y: 42.5, w: 71.8, h: 6.2, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Xuất Excel', hint: 'Bấm để tải bảng kê giao dịch phục vụ kế toán cuối tháng', x: 88.0, y: 56.8, w: 8.2, h: 4.2, badgePos: 'top' },
      { id: 3, kind: 'click', label: 'Xem chi tiết', hint: 'Bấm Chi tiết để xem biên lai hoặc xác nhận khoản chuyển khoản', x: 90.2, y: 72.5, w: 5.6, h: 4.5, badgePos: 'top' },
    ],
    steps: [
      { heading: 'Bước 1: Theo dõi bảng tổng hợp phía trên', detail: 'Xem nhanh Tổng tiền đã thanh toán và các khoản đang chờ xác nhận.' },
      { heading: 'Bước 2: Đối soát & Xuất Excel', detail: 'Lọc theo khoảng ngày hoặc phương thức (VietQR, Tiền mặt) và bấm Xuất Excel khi cần chốt sổ.' },
    ],
  },
  {
    id: 'art-revenue-reports',
    categoryId: 'finance',
    title: 'Xem Báo cáo doanh thu theo ngày / tháng & Xuất báo cáo',
    summary: 'Phân tích tiền thu vào, hoàn tiền, thực nhận và biểu đồ doanh thu trực quan giúp chủ khách sạn ra quyết định.',
    readTimeMinutes: 2,
    tags: ['báo cáo', 'doanh thu', 'biểu đồ', 'excel'],
    screenshot: '/guides/reports.png',
    spots: [
      { id: 1, kind: 'input', label: 'Chọn kỳ báo cáo', hint: 'Chọn 30 ngày qua, tháng này và chuyển xem Theo ngày / Theo tháng', x: 22.8, y: 15.0, w: 46.2, h: 5.8, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Xuất Excel', hint: 'Tải file báo cáo doanh thu chi tiết về máy tính', x: 87.6, y: 6.5, w: 10.0, h: 5.2, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Chọn khoảng thời gian & hình thức thanh toán', detail: 'Dùng bộ lọc phía trên để xem doanh thu 7 ngày, 30 ngày hoặc theo từng tháng.' },
      { heading: 'Bước 2: Đọc biểu đồ & Xuất Excel', detail: 'Biểu đồ cột thể hiện xu hướng doanh thu từng ngày. Bấm "Xuất Excel" để tải bảng tổng hợp.' },
    ],
  },

  // 5. Property Profile & Channels
  {
    id: 'art-property-profile',
    categoryId: 'channels',
    title: 'Cập nhật Hồ sơ, Logo, Ảnh bìa & Địa chỉ khách sạn',
    summary: 'Thiết lập thông tin nhận diện thương hiệu chuẩn chỉnh để hiển thị đồng bộ trên Website và phiếu xác nhận gửi khách.',
    readTimeMinutes: 3,
    tags: ['hồ sơ', 'logo', 'ảnh bìa', 'địa chỉ', 'cài đặt'],
    screenshot: '/guides/step-1.png',
    spots: [
      { id: 1, kind: 'click', label: 'Tải Logo & Ảnh bìa', hint: 'Bấm để chọn ảnh logo và ảnh đại diện đẹp nhất của khách sạn', x: 47.2, y: 37.2, w: 11.2, h: 6.2, badgePos: 'top' },
      { id: 2, kind: 'input', label: 'Điền tên & loại hình', hint: 'Nhập tên thương hiệu và chọn loại hình (Resort, Hotel, Homestay)', x: 24.0, y: 81.5, w: 48.0, h: 6.8, badgePos: 'top' },
      { id: 3, kind: 'click', label: 'Bấm lưu', hint: 'Nhấn Lưu thay đổi ở góc trên cùng bên phải', x: 87.3, y: 6.5, w: 10.6, h: 5.6, badgePos: 'bottom' },
    ],
    steps: [
      { heading: 'Bước 1: Tải Logo & Ảnh bìa', detail: 'Tải ảnh logo sắc nét và ảnh bìa toàn cảnh khách sạn.' },
      { heading: 'Bước 2: Điền đầy đủ các tab Liên hệ & Địa chỉ GPS', detail: 'Bấm qua các tab "Liên hệ & Mạng xã hội", "Địa chỉ & Định vị GPS" để nhập SĐT Zalo, Fanpage và tọa độ bản đồ.' },
    ],
  },
  {
    id: 'art-ota-ical',
    categoryId: 'channels',
    title: 'Đồng bộ lịch phòng OTA (Booking.com, Agoda, Airbnb) qua iCal',
    summary: 'Hạn chế tối đa tình trạng trùng phòng khi vừa bán phòng trên các sàn OTA vừa bán phòng trực tiếp.',
    readTimeMinutes: 4,
    tags: ['ota', 'booking.com', 'agoda', 'airbnb', 'ical', 'đồng bộ'],
    steps: [
      { heading: 'Bước 1: Lấy link iCal từ Digistay', detail: 'Vào mục "Kênh bán OTA", chọn từng phòng và sao chép đường dẫn lịch xuất (Export iCal URL) của Digistay.' },
      { heading: 'Bước 2: Dán link vào trang quản trị OTA', detail: 'Mở Extranet của Booking.com / Agoda / Airbnb -> Đồng bộ lịch -> Nhập lịch và dán link từ Digistay.' },
      { heading: 'Bước 3: Nhập link ngược lại từ OTA về Digistay', detail: 'Sao chép link lịch xuất từ sàn OTA và dán vào ô "Nhập lịch iCal" trên Digistay để tự động khóa phòng khi có đơn mới từ sàn.' },
    ],
  },

  // 6. Account & Staff Roles
  {
    id: 'art-staff-roles',
    categoryId: 'account',
    title: 'Mời nhân viên lễ tân và phân quyền bảo mật doanh thu',
    summary: 'Giao quyền thao tác đặt phòng hằng ngày cho lễ tân mà vẫn bảo mật các báo cáo doanh thu, sổ quỹ của chủ khách sạn.',
    readTimeMinutes: 2,
    tags: ['nhân viên', 'lễ tân', 'phân quyền', 'tài khoản', 'bảo mật'],
    screenshot: '/guides/step-5.png',
    spots: [
      { id: 1, kind: 'click', label: 'Mời nhân viên', hint: 'Bấm + Mời nhân viên, nhập email và chọn vai trò Lễ tân / Quản lý', x: 82.2, y: 21.2, w: 12.0, h: 6.0, badgePos: 'bottom' },
      { id: 2, kind: 'click', label: 'Theo dõi lời mời', hint: 'Xem các email đã gửi lời mời và gửi lại nếu nhân viên chưa nhận được', x: 17.8, y: 40.8, w: 8.6, h: 5.8, badgePos: 'bottom' },
      { id: 3, kind: 'click', label: 'Phân quyền chi tiết', hint: 'Bấm Phân quyền để tùy chỉnh từng quyền (ẩn báo cáo, ẩn cài đặt...)', x: 79.2, y: 69.2, w: 10.8, h: 5.8, badgePos: 'top' },
    ],
    steps: [
      { heading: 'Bước 1: Nhấn + Mời nhân viên', detail: 'Nhập email của nhân viên và chọn vai trò phù hợp (Lễ tân hoặc Quản lý).' },
      { heading: 'Bước 2: Tùy chỉnh quyền chi tiết bất cứ lúc nào', detail: 'Bấm nút "Phân quyền" ở từng dòng nhân viên để bật/tắt quyền xem báo cáo tài chính hoặc cài đặt hệ thống.' },
    ],
  },
]
