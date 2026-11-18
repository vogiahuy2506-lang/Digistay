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

export interface HelpArticle {
  id: string
  categoryId: string
  title: string
  summary: string
  readTimeMinutes: number
  tags: string[]
  steps: {
    heading: string
    detail: string
  }[]
  tip?: string
}

export const QUICKSTART_VIDEO_META = {
  title: '5 Bước Bắt Đầu Dành Cho Chủ Khách Sạn Trên Digistay',
  durationLabel: '12 phút',
  subtitle:
    'Hướng dẫn từng bước từ lúc khởi tạo hồ sơ khách sạn, tạo hạng phòng, xuất bản website đặt phòng trực tiếp đến khi nhận đơn & thanh toán VietQR.',
  // Placeholder embed URL; replace with official Digistay YouTube/Vimeo ID when published
  embedUrl: '',
}

export const VIDEO_CHAPTERS: VideoChapter[] = [
  {
    id: 'chap-1',
    stepNumber: 1,
    timestamp: '00:00',
    seconds: 0,
    title: 'Hoàn tất hồ sơ & hình ảnh khách sạn',
    summary: 'Cập nhật tên thương hiệu, logo, địa chỉ Google Maps và 5 ảnh không gian đẹp nhất để tạo niềm tin cho khách.',
  },
  {
    id: 'chap-2',
    stepNumber: 2,
    timestamp: '02:30',
    seconds: 150,
    title: 'Tạo hạng phòng & bảng giá linh hoạt',
    summary: 'Thiết lập hạng phòng (Deluxe, Suite...), đánh số phòng cụ thể (101, 102) và cài đặt giá ngày thường / cuối tuần.',
  },
  {
    id: 'chap-3',
    stepNumber: 3,
    timestamp: '05:45',
    seconds: 345,
    title: 'Xuất bản Website đặt phòng trực tiếp',
    summary: 'Chọn giao diện chuẩn 5 sao, dùng AI tinh chỉnh nội dung và bấm Xuất bản để nhận đơn không tốn phí hoa hồng OTA.',
  },
  {
    id: 'chap-4',
    stepNumber: 4,
    timestamp: '09:15',
    seconds: 555,
    title: 'Nhận đơn đặt phòng & thanh toán VietQR',
    summary: 'Cách khách đặt phòng trên web, tự động sinh mã VietQR tiền cọc và lễ tân xác nhận giữ phòng chỉ với 1 chạm.',
  },
  {
    id: 'chap-5',
    stepNumber: 5,
    timestamp: '11:00',
    seconds: 660,
    title: 'Mời nhân viên lễ tân & phân quyền',
    summary: 'Thêm tài khoản lễ tân vào hệ thống và giới hạn quyền xem báo cáo tài chính nhạy cảm.',
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
    description: 'Dùng AI Studio hoặc kéo thả các khối giao diện để hoàn thiện trang web bán phòng riêng mang thương hiệu của bạn.',
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
    description: 'Check-in, check-out, sơ đồ phòng, đổi phòng và xử lý khách đến sớm / trả muộn.',
    iconName: 'concierge',
  },
  {
    id: 'rooms',
    title: 'Quản lý phòng & Bảng giá',
    description: 'Tạo hạng phòng, thiết lập giá cuối tuần, ngày lễ và trạng thái dọn phòng.',
    iconName: 'bed',
  },
  {
    id: 'website',
    title: 'Website & Bán phòng trực tiếp',
    description: 'Tùy chỉnh giao diện, dùng AI viết nội dung, gắn tên miền riêng và tạo mã giảm giá.',
    iconName: 'globe',
  },
  {
    id: 'finance',
    title: 'Thanh toán VietQR & Thu chi',
    description: 'Cài đặt tài khoản ngân hàng nhận cọc VietQR tự động, sổ quỹ thu chi và hóa đơn.',
    iconName: 'wallet',
  },
  {
    id: 'channels',
    title: 'Kênh phân phối OTA',
    description: 'Đồng bộ lịch phòng iCal với Booking.com, Agoda, Airbnb để tránh trùng lịch (Overbooking).',
    iconName: 'share',
  },
  {
    id: 'account',
    title: 'Tài khoản & Phân quyền nhân sự',
    description: 'Thêm nhân viên lễ tân, quản lý, cấu hình quyền truy cập và bảo mật tài khoản.',
    iconName: 'shield',
  },
]

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'art-checkin-checkout',
    categoryId: 'operations',
    title: 'Quy trình Check-in & Check-out chuẩn cho lễ tân',
    summary: 'Hướng dẫn thao tác nhận phòng, thu tiền cọc và trả phòng xuất hóa đơn trên Digistay chỉ trong 30 giây.',
    readTimeMinutes: 3,
    tags: ['lễ tân', 'check-in', 'check-out', 'đặt phòng', 'booking'],
    steps: [
      {
        heading: 'Bước 1: Tìm đơn đặt phòng của khách',
        detail: 'Vào mục "Đặt phòng & Lịch", tìm theo tên khách, số điện thoại hoặc mã booking (ví dụ: BK-1024).',
      },
      {
        heading: 'Bước 2: Kiểm tra phòng trống & xác nhận nhận phòng',
        detail: 'Bấm vào chi tiết đơn, chọn số phòng cụ thể (nếu chưa gán) và nhấn nút "Nhận phòng (Check-in)". Hệ thống tự động cập nhật trạng thái phòng sang Đang có khách.',
      },
      {
        heading: 'Bước 3: Thêm dịch vụ phát sinh trong thời gian lưu trú',
        detail: 'Nếu khách dùng thêm nước uống, giặt ủi hoặc thuê xe, bấm "+ Thêm dịch vụ" ngay trong chi tiết booking để cộng dồn vào hóa đơn.',
      },
      {
        heading: 'Bước 4: Thu tiền còn lại & Trả phòng (Check-out)',
        detail: 'Khi khách trả phòng, kiểm tra tổng tiền còn thiếu, chọn hình thức thanh toán (Tiền mặt / Chuyển khoản VietQR) rồi bấm "Trả phòng". Phòng tự động chuyển sang trạng thái Cần dọn.',
      },
    ],
    tip: 'Dùng chế độ xem Sơ đồ phòng (Calendar) để nhìn trực quan toàn bộ phòng trống và khách sắp đến trong tuần.',
  },
  {
    id: 'art-walkin-booking',
    categoryId: 'operations',
    title: 'Tạo đơn đặt phòng nhanh cho khách vãng lai (Walk-in)',
    summary: 'Cách tạo booking trực tiếp tại quầy lễ tân khi khách đến hỏi thuê phòng ngay.',
    readTimeMinutes: 2,
    tags: ['walk-in', 'tạo đơn', 'khách lẻ', 'đặt phòng'],
    steps: [
      {
        heading: 'Bước 1: Mở form tạo đơn mới',
        detail: 'Tại màn hình Tổng quan hoặc Đặt phòng & Lịch, nhấn nút "+ Tạo đặt phòng".',
      },
      {
        heading: 'Bước 2: Chọn ngày lưu trú & hạng phòng',
        detail: 'Chọn ngày nhận/trả phòng, hệ thống sẽ lọc ra các hạng phòng và số phòng còn trống tương ứng.',
      },
      {
        heading: 'Bước 3: Nhập thông tin khách và lưu đơn',
        detail: 'Điền tên khách, số điện thoại (hệ thống tự gợi ý nếu là khách cũ) và nhấn "Tạo đơn". Bạn có thể chọn "Nhận phòng ngay" nếu khách vào ở liền.',
      },
    ],
  },
  {
    id: 'art-create-rooms',
    categoryId: 'rooms',
    title: 'Thiết lập hạng phòng, số phòng và bảng giá ngày thường / cuối tuần',
    summary: 'Cấu hình chính xác số lượng phòng và giá bán để hiển thị trên Website và phần mềm lễ tân.',
    readTimeMinutes: 4,
    tags: ['hạng phòng', 'giá phòng', 'cuối tuần', 'phòng', 'room'],
    steps: [
      {
        heading: 'Bước 1: Tạo hạng phòng mới',
        detail: 'Vào "Hạng phòng & Phòng", nhấn "+ Thêm hạng phòng". Nhập tên (ví dụ: Deluxe Hướng Biển), diện tích, số khách tiêu chuẩn và giá cơ bản mỗi đêm.',
      },
      {
        heading: 'Bước 2: Cài đặt giá cuối tuần (Thứ 6, Thứ 7)',
        detail: 'Trong mục cấu hình giá, bạn có thể nhập mức giá riêng cho ngày cuối tuần để tự động tăng giá vào dịp cao điểm.',
      },
      {
        heading: 'Bước 3: Đánh số phòng thực tế',
        detail: 'Sau khi tạo hạng phòng, thêm các phòng cụ thể (ví dụ: P.201, P.202, P.203) để lễ tân dễ dàng xếp phòng khi khách đến.',
      },
      {
        heading: 'Bước 4: Tải ảnh hạng phòng đẹp mắt',
        detail: 'Thêm 3–5 ảnh rõ nét về giường ngủ, view cửa sổ và phòng tắm. Những ảnh này sẽ hiển thị trực tiếp lên Website đặt phòng của bạn.',
      },
    ],
  },
  {
    id: 'art-website-builder',
    categoryId: 'website',
    title: 'Thiết kế và xuất bản Website đặt phòng trực tiếp trong 5 phút',
    summary: 'Sở hữu website mang thương hiệu riêng của khách sạn, cho phép khách tìm phòng trống và đặt trực tiếp không tốn phí hoa hồng.',
    readTimeMinutes: 4,
    tags: ['website', 'ai', 'thiết kế', 'xuất bản', 'tên miền'],
    steps: [
      {
        heading: 'Bước 1: Mở trình thiết kế Website',
        detail: 'Trong thanh menu bên trái, chọn mục "Website khách sạn" dưới nhóm Kinh doanh & Tiếp thị.',
      },
      {
        heading: 'Bước 2: Dùng AI hoặc chọn Mẫu có sẵn',
        detail: 'Bạn có thể nhập yêu cầu vào thanh AI bên dưới (ví dụ: "Khách sạn nghỉ dưỡng ven biển phong cách sang trọng") hoặc chọn từ 4 bộ giao diện mẫu có sẵn.',
      },
      {
        heading: 'Bước 3: Sửa trực tiếp từng khối trên màn hình',
        detail: 'Bấm trực tiếp vào bất kỳ khu vực nào trên bản xem trước (Banner, Giới thiệu, Hạng phòng, Đánh giá...). Bảng chỉnh sửa bên phải sẽ mở ra để bạn thay chữ và ảnh ngay lập tức.',
      },
      {
        heading: 'Bước 4: Lưu thay đổi và Xuất bản',
        detail: 'Nhấn "Lưu thay đổi" và chuyển trạng thái ở góc trên bên phải sang "Đã xuất bản" để website hoạt động công khai.',
      },
    ],
    tip: 'Bạn có thể bật/tắt nút xem trước Máy tính và Điện thoại ở thanh công cụ phía trên để đảm bảo khách xem trên điện thoại thật đẹp mắt.',
  },
  {
    id: 'art-custom-domain',
    categoryId: 'website',
    title: 'Gắn tên miền riêng (ví dụ: khachsancuaban.vn) vào Website',
    summary: 'Hướng dẫn trỏ tên miền riêng về Digistay để tăng độ chuyên nghiệp và uy tín thương hiệu.',
    readTimeMinutes: 3,
    tags: ['tên miền', 'domain', 'ssl', 'dns', 'website'],
    steps: [
      {
        heading: 'Bước 1: Nhập tên miền vào Cài đặt Website',
        detail: 'Trong trình thiết kế Website, chọn tab "Cài đặt" -> mở mục "Tên miền riêng" và nhập tên miền của bạn.',
      },
      {
        heading: 'Bước 2: Trỏ bản ghi DNS tại nhà cung cấp tên miền',
        detail: 'Đăng nhập trang quản trị tên miền (Mắt Bão, Nhân Hòa, Cloudflare...) và tạo bản ghi CNAME hoặc A Record theo đúng thông số hiển thị trên Digistay.',
      },
      {
        heading: 'Bước 3: Xác minh & kích hoạt SSL miễn phí',
        detail: 'Sau khi trỏ DNS từ 5–15 phút, nhấn "Kiểm tra kết nối". Digistay sẽ tự động cấp chứng chỉ bảo mật HTTPS (SSL) miễn phí cho website của bạn.',
      },
    ],
  },
  {
    id: 'art-vietqr-setup',
    categoryId: 'finance',
    title: 'Cài đặt tài khoản ngân hàng để nhận tiền cọc VietQR tự động',
    summary: 'Khách đặt phòng quét mã QR, hệ thống tự điền sẵn số tiền cọc và mã đơn hàng, tiền về thẳng tài khoản chủ khách sạn.',
    readTimeMinutes: 2,
    tags: ['vietqr', 'thanh toán', 'ngân hàng', 'chuyển khoản', 'tiền cọc'],
    steps: [
      {
        heading: 'Bước 1: Mở mục Cổng thanh toán & Bank',
        detail: 'Chọn mục "Cổng thanh toán & Bank" trong nhóm Cài đặt khách sạn trên thanh menu.',
      },
      {
        heading: 'Bước 2: Nhập thông tin tài khoản ngân hàng nhận tiền',
        detail: 'Chọn ngân hàng (Vietcombank, Techcombank, MB, BIDV, ACB...), nhập chính xác Số tài khoản và Tên chủ tài khoản.',
      },
      {
        heading: 'Bước 3: Lưu và kiểm tra mã QR thử nghiệm',
        detail: 'Nhấn Lưu. Từ nay mỗi khi khách đặt phòng online hoặc lễ tân tạo mã thu tiền, mã VietQR chuẩn NAPAS sẽ được tạo tự động với nội dung chuyển khoản khớp theo mã đơn.',
      },
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
      {
        heading: 'Bước 1: Lấy link iCal từ Digistay',
        detail: 'Vào mục "Kênh bán OTA", chọn từng phòng và sao chép đường dẫn lịch xuất (Export iCal URL) của Digistay.',
      },
      {
        heading: 'Bước 2: Dán link vào trang quản trị OTA',
        detail: 'Mở trang Extranet của Booking.com / Agoda / Airbnb -> vào mục Đồng bộ lịch (Calendar Sync) -> chọn Nhập lịch (Import Calendar) và dán link từ Digistay.',
      },
      {
        heading: 'Bước 3: Nhập link ngược lại từ OTA về Digistay',
        detail: 'Sao chép link lịch xuất từ Booking.com/Airbnb và dán vào ô "Nhập lịch iCal" trên Digistay để tự động khóa phòng trống khi có đơn mới từ sàn.',
      },
    ],
  },
  {
    id: 'art-staff-roles',
    categoryId: 'account',
    title: 'Mời nhân viên lễ tân và phân quyền bảo mật doanh thu',
    summary: 'Giao quyền thao tác đặt phòng hằng ngày cho lễ tân mà vẫn bảo mật các báo cáo doanh thu, sổ quỹ của chủ khách sạn.',
    readTimeMinutes: 2,
    tags: ['nhân viên', 'lễ tân', 'phân quyền', 'tài khoản', 'bảo mật'],
    steps: [
      {
        heading: 'Bước 1: Truy cập mục Thành viên & Phân quyền',
        detail: 'Ở thanh menu dưới nhóm Hệ thống, chọn "Thành viên & Phân quyền".',
      },
      {
        heading: 'Bước 2: Nhấn Mời thành viên',
        detail: 'Nhập địa chỉ email của nhân viên và chọn vai trò phù hợp: "Lễ tân" (chỉ thao tác đặt phòng, nhận/trả phòng) hoặc "Quản lý" (quản lý phòng, giá và xem báo cáo).',
      },
      {
        heading: 'Bước 3: Nhân viên xác nhận lời mời',
        detail: 'Nhân viên sẽ nhận được email lời mời tham gia Workspace khách sạn và có thể đăng nhập làm việc ngay.',
      },
    ],
  },
]
