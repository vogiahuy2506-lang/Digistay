export interface LegalSection {
  heading: string
  paragraphs: string[]
}

export interface LegalDoc {
  slug: string
  title: string
  shortTitle: string
  summary: string
  category: 'policy' | 'legal'
  lastUpdated: string
  sections: LegalSection[]
}

export const LEGAL_COMPANY = {
  name: 'Công ty TNHH Giải pháp số DIGISO',
  nameEn: 'DIGISO Digital Solutions Co., Ltd.',
  taxId: '0316725362',
  taxIssuer: 'Sở Kế hoạch và Đầu tư TP. Hồ Chí Minh cấp ngày 19/02/2021',
  address: 'Phòng I.101B, Tòa nhà A, Khu Công nghệ Phần mềm ĐHQG-HCM, Đường Võ Trường Toản, Khu phố 3, Phường Linh Xuân, TP. Hồ Chí Minh',
  hotline: '0877 909 606',
  hotlineHours: '8:30 – 17:00 (Thứ 2 – Thứ 6)',
  email: 'info@digiso.vn',
  website: 'https://digiso.vn',
  platform: 'Digistay (digistay.vn)',
}

export const LEGAL_DOCS: Record<string, { vi: LegalDoc; en: LegalDoc }> = {
  terms: {
    vi: {
      slug: 'terms',
      title: 'Điều khoản sử dụng dịch vụ',
      shortTitle: 'Điều khoản sử dụng',
      summary: 'Các quy định ràng buộc giữa khách hàng sử dụng phần mềm và Công ty TNHH Giải pháp số DIGISO khi khởi tạo, vận hành website và quản trị khách sạn trên nền tảng Digistay.',
      category: 'legal',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Chấp thuận điều khoản',
          paragraphs: [
            'Bằng việc đăng ký tài khoản hoặc sử dụng dịch vụ nền tảng Digistay (bao gồm website digistay.vn và các ứng dụng liên kết), quý khách đồng ý tuân thủ toàn bộ các điều khoản và điều kiện được quy định tại đây bởi Công ty TNHH Giải pháp số DIGISO (sau đây gọi tắt là "DIGISO").',
            'Trường hợp quý khách đại diện cho một tổ chức, doanh nghiệp, homestay hoặc khách sạn, quý khách cam kết có đầy đủ thẩm quyền pháp lý để ràng buộc tổ chức đó với các điều khoản này.',
          ],
        },
        {
          heading: '2. Phạm vi dịch vụ cung cấp',
          paragraphs: [
            'Digistay là giải pháp phần mềm quản trị dạng dịch vụ (SaaS) chuyên sâu cho ngành khách sạn và lưu trú, bao gồm: công cụ tạo website đặt phòng trực tiếp (direct booking), hệ thống quản trị lễ tân (nhận/trả phòng, lịch phòng), kết nối đối soát cổng thanh toán trực tuyến VietQR PayOS, và tích hợp phát hành hóa đơn điện tử GTGT qua Mắt Bão.',
            'DIGISO duy trì hạ tầng đám mây, cập nhật phần mềm định kỳ, bảo mật cơ sở dữ liệu và hỗ trợ kỹ thuật trực tuyến trong suốt thời hạn gói dịch vụ có hiệu lực.',
          ],
        },
        {
          heading: '3. Tài khoản và trách nhiệm bảo mật',
          paragraphs: [
            'Khách hàng có trách nhiệm tự bảo mật thông tin đăng nhập, mật khẩu và mã xác thực 2 bước (TOTP 2FA). Mọi thao tác thực hiện qua tài khoản của quý khách được coi là hành động chính thức của quý khách.',
            'Nghiêm cấm chia sẻ tài khoản cho bên thứ ba trái phép, can thiệp mã nguồn, thử nghiệm xâm nhập bảo mật hoặc sử dụng nền tảng cho mục đích vi phạm pháp luật Việt Nam.',
          ],
        },
        {
          heading: '4. Bản quyền và quyền sở hữu trí tuệ',
          paragraphs: [
            'Toàn bộ mã nguồn phần mềm, giao diện, logo, nhãn hiệu thương mại Digistay và DIGISO thuộc quyền sở hữu trí tuệ độc quyền của Công ty TNHH Giải pháp số DIGISO.',
            'Khách hàng toàn quyền sở hữu đối với nội dung, hình ảnh cơ sở lưu trú, danh sách khách hàng và dữ liệu doanh thu do quý khách nhập vào hệ thống.',
          ],
        },
        {
          heading: '5. Giới hạn trách nhiệm',
          paragraphs: [
            'DIGISO cam kết nỗ lực tối đa để đảm bảo hệ thống vận hành ổn định 24/7 (SLA uptime đạt tối thiểu 99.9%). Tuy nhiên, DIGISO không chịu trách nhiệm đối với các gián đoạn phát sinh từ sự cố mạng viễn thông quốc gia, sự cố bất khả kháng hoặc lỗi phát sinh từ bên thứ ba (như ngân hàng thanh toán hoặc nhà cung cấp tên miền riêng của khách hàng).',
          ],
        },
      ],
    },
    en: {
      slug: 'terms',
      title: 'Terms of Service',
      shortTitle: 'Terms of Service',
      summary: 'Binding agreement between clients and DIGISO Digital Solutions Co., Ltd. governing the access and use of Digistay hotel management platform.',
      category: 'legal',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Acceptance of Terms',
          paragraphs: [
            'By creating an account or accessing the Digistay platform (digistay.vn and affiliated subdomains), you agree to be legally bound by these Terms of Service established by DIGISO Digital Solutions Co., Ltd. ("DIGISO").',
            'If you register on behalf of a hospitality entity, company, or resort, you represent that you possess full legal authority to bind said entity to this agreement.',
          ],
        },
        {
          heading: '2. Scope of Services',
          paragraphs: [
            'Digistay provides a Cloud Software-as-a-Service (SaaS) solution tailored for hotels and accommodations: no-code direct booking website builder, front desk PMS, automated PayOS VietQR payment reconciliation, and Mat Bao VAT e-invoice integration.',
            'DIGISO manages cloud infrastructure, provides regular updates, secures platform data, and delivers customer technical support throughout the active subscription term.',
          ],
        },
        {
          heading: '3. Accounts and Security',
          paragraphs: [
            'Clients are responsible for maintaining confidentiality of credentials, passwords, and two-factor authentication (TOTP 2FA). Actions taken under your account are presumed authorized by you.',
            'Unauthorized account sharing, security probing, reverse engineering, or platform misuse in violation of applicable laws is strictly prohibited.',
          ],
        },
        {
          heading: '4. Intellectual Property Rights',
          paragraphs: [
            'All software source code, UI components, trademarks, and branding of Digistay and DIGISO are the exclusive intellectual property of DIGISO Digital Solutions Co., Ltd.',
            'Clients retain full ownership of their property photos, descriptions, guest records, and business transaction data uploaded onto the platform.',
          ],
        },
        {
          heading: '5. Limitation of Liability',
          paragraphs: [
            'DIGISO endeavors to maintain 99.9% platform availability. However, DIGISO shall not be liable for outages caused by force majeure events, nationwide network failures, or third-party bank gateways.',
          ],
        },
      ],
    },
  },

  privacy: {
    vi: {
      slug: 'privacy',
      title: 'Chính sách bảo mật thông tin',
      shortTitle: 'Chính sách bảo mật',
      summary: 'Cam kết của DIGISO trong việc thu thập, lưu trữ, sử dụng và bảo vệ dữ liệu cá nhân theo quy định của pháp luật Việt Nam và Nghị định 13/2023/NĐ-CP.',
      category: 'legal',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Mục đích thu thập dữ liệu',
          paragraphs: [
            'DIGISO thu thập thông tin người dùng nhằm phục vụ việc tạo tài khoản, xác thực truy cập, hỗ trợ kỹ thuật, xử lý thanh toán gói cước và xuất hóa đơn điện tử hợp pháp.',
            'Thông tin thu thập bao gồm: Họ tên, số điện thoại, địa chỉ email, tên khách sạn/homestay, mã số thuế (nếu yêu cầu xuất hóa đơn), và địa chỉ IP truy cập phục vụ tường lửa bảo mật.',
          ],
        },
        {
          heading: '2. Cam kết bảo mật dữ liệu',
          paragraphs: [
            'Toàn bộ thông tin truyền tải trên hệ thống đều được mã hóa bằng giao thức HTTPS/TLS 1.3 tiêu chuẩn cao cấp.',
            'Cơ sở dữ liệu được lưu trữ trên hạ tầng máy chủ bảo mật, sao lưu dự phòng tự động hằng ngày và kiểm soát truy cập nghiêm ngặt theo vai trò quản trị viên (RBAC).',
            'DIGISO tuyệt đối không bán, cho thuê hoặc chia sẻ dữ liệu của khách hàng cho bất kỳ bên thứ ba nào vì mục đích quảng cáo thương mại.',
          ],
        },
        {
          heading: '3. Quyền của chủ thể dữ liệu',
          paragraphs: [
            'Khách hàng có quyền tra cứu, cập nhật thông tin cá nhân bất cứ lúc nào trong trang Hồ sơ cá nhân (/profile).',
            'Quý khách có quyền yêu cầu xuất bản sao dữ liệu đặt phòng hoặc xóa tài khoản vĩnh viễn theo quy định khi chấm dứt sử dụng dịch vụ.',
          ],
        },
        {
          heading: '4. Thông tin liên hệ phụ trách bảo mật',
          paragraphs: [
            'Bộ phận Bảo vệ Dữ liệu — Công ty TNHH Giải pháp số DIGISO. Email: info@digiso.vn. Hotline: 0877 909 606.',
          ],
        },
      ],
    },
    en: {
      slug: 'privacy',
      title: 'Privacy Policy',
      shortTitle: 'Privacy Policy',
      summary: 'DIGISO commitments regarding the collection, processing, and protection of personal data in compliance with Decree 13/2023/ND-CP.',
      category: 'legal',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Purpose of Data Collection',
          paragraphs: [
            'DIGISO collects information to register workspaces, verify access, provide technical support, process subscription payments, and issue legal VAT e-invoices.',
            'Collected information includes: Full name, phone number, email address, property name, billing details (tax ID if invoice requested), and IP address for security logging.',
          ],
        },
        {
          heading: '2. Data Protection Commitments',
          paragraphs: [
            'All data in transit is encrypted using industry-standard TLS 1.3 protocols.',
            'Databases are hosted in hardened cloud environments with automated daily backups and granular role-based access controls (RBAC).',
            'DIGISO never sells, rents, or leases customer or guest data to third parties for commercial advertising.',
          ],
        },
        {
          heading: '3. Data Subject Rights',
          paragraphs: [
            'Users may review and update their personal profile at any time in Account Settings (/profile).',
            'Users reserve the right to request full data export or permanent deletion upon service termination in accordance with statutory regulations.',
          ],
        },
        {
          heading: '4. Privacy Officer Contact',
          paragraphs: [
            'Data Protection Office — DIGISO Digital Solutions Co., Ltd. Email: info@digiso.vn. Hotline: (+84) 0877 909 606.',
          ],
        },
      ],
    },
  },

  'public-dpa': {
    vi: {
      slug: 'public-dpa',
      title: 'Thỏa thuận xử lý dữ liệu cá nhân (DPA)',
      shortTitle: 'Thỏa thuận xử lý dữ liệu',
      summary: 'Quy chuẩn pháp lý phân định vai trò giữa Khách sạn (Bên kiểm soát dữ liệu) và DIGISO (Bên xử lý dữ liệu) theo Nghị định 13/2023/NĐ-CP.',
      category: 'legal',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Định nghĩa và vai trò',
          paragraphs: [
            'Khách sạn / Cơ sở lưu trú là "Bên kiểm soát dữ liệu cá nhân" đối với thông tin khách đặt phòng (họ tên, CCCD/hộ chiếu, số điện thoại, thời gian lưu trú).',
            'DIGISO đóng vai trò là "Bên xử lý dữ liệu cá nhân", cung cấp hạ tầng kỹ thuật phần mềm lưu trữ và xử lý theo chỉ đạo và ủy quyền hợp pháp của Khách sạn.',
          ],
        },
        {
          heading: '2. Nghĩa vụ bảo mật của DIGISO',
          paragraphs: [
            'DIGISO cam kết chỉ xử lý dữ liệu trong phạm vi cần thiết để cung cấp phần mềm quản lý và website đặt phòng.',
            'Áp dụng các biện pháp kỹ thuật và tổ chức cần thiết (mã hóa đường truyền, tường lửa WAF, cô lập dữ liệu theo từng workspace khách hàng) để ngăn chặn rò rỉ dữ liệu.',
            'Thông báo kịp thời cho khách sạn trong trường hợp phát hiện bất kỳ sự cố vi phạm an ninh dữ liệu nào theo luật định.',
          ],
        },
        {
          heading: '3. Xử lý khi chấm dứt thỏa thuận',
          paragraphs: [
            'Khi khách hàng ngừng sử dụng dịch vụ, dữ liệu được lưu giữ trong vòng 30 ngày để quý khách thực hiện xuất sao lưu, sau đó sẽ được xóa an toàn khỏi hệ thống lưu trữ.',
          ],
        },
      ],
    },
    en: {
      slug: 'public-dpa',
      title: 'Data Processing Agreement (DPA)',
      shortTitle: 'Data Processing Agreement',
      summary: 'Contractual terms establishing roles between the Hotel (Data Controller) and DIGISO (Data Processor) under Decree 13/2023/ND-CP.',
      category: 'legal',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Roles and Scope',
          paragraphs: [
            'The Hotel / Accommodation operator is the "Data Controller" regarding guest reservations and personal data (names, identification, contact, booking dates).',
            'DIGISO acts as the "Data Processor", providing technical software infrastructure to process data solely as authorized by the Controller.',
          ],
        },
        {
          heading: '2. Security Obligations',
          paragraphs: [
            'DIGISO processes data strictly within the boundaries required to operate the booking system and property management features.',
            'Technical measures including tenant workspace data isolation, TLS encryption, and firewall protections are maintained to prevent unauthorized data exposure.',
            'DIGISO will promptly notify the client in the unlikely event of a verified data incident affecting their data.',
          ],
        },
        {
          heading: '3. Data Deletion Upon Termination',
          paragraphs: [
            'Upon subscription cessation, data is retained for 30 calendar days to allow self-export before being permanently removed from operational databases.',
          ],
        },
      ],
    },
  },

  'complaint-policy': {
    vi: {
      slug: 'complaint-policy',
      title: 'Phương thức tiếp nhận và giải quyết khiếu nại',
      shortTitle: 'Giải quyết khiếu nại',
      summary: 'Quy trình tiếp nhận, xử lý minh bạch và giải quyết thỏa đáng mọi phản ánh, yêu cầu hoặc khiếu nại từ khách hàng của DIGISO.',
      category: 'policy',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Kênh tiếp nhận khiếu nại',
          paragraphs: [
            'Khách hàng có thể gửi phản ánh, khiếu nại qua các kênh chính thức sau:',
            '• Hotline hỗ trợ trực tiếp: 0877 909 606 (8:30 – 17:00, Thứ Hai đến Thứ Sáu).',
            '• Email tiếp nhận chính thức: info@digiso.vn.',
            '• Địa chỉ tiếp nhận bằng văn bản: Phòng I.101B, Tòa nhà A, Khu Công nghệ Phần mềm ĐHQG-HCM, Đường Võ Trường Toản, Phường Linh Xuân, TP. Hồ Chí Minh.',
          ],
        },
        {
          heading: '2. Quy trình và thời hạn giải quyết',
          paragraphs: [
            'Bước 1: Tiếp nhận và xác nhận đã nhận khiếu nại trong vòng 24 giờ làm việc.',
            'Bước 2: Bộ phận kỹ thuật/CSKH phối hợp với khách hàng kiểm tra nhật ký hệ thống và xác minh nguyên nhân.',
            'Bước 3: Đưa ra phương án giải quyết và phản hồi bằng văn bản/email trong thời hạn không quá 03 ngày làm việc kể từ khi nhận đủ thông tin.',
          ],
        },
        {
          heading: '3. Nguyên tắc giải quyết',
          paragraphs: [
            'DIGISO đề cao tinh thần thiện chí, tôn trọng quyền lợi chính đáng của khách hàng và giải quyết dựa trên bằng chứng minh bạch từ lịch sử giao dịch và nhật ký kỹ thuật.',
          ],
        },
      ],
    },
    en: {
      slug: 'complaint-policy',
      title: 'Complaints and Dispute Resolution Policy',
      shortTitle: 'Complaint Policy',
      summary: 'Transparent operational procedures for receiving, reviewing, and resolving customer inquiries, grievances, and feedback.',
      category: 'policy',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Official Complaint Channels',
          paragraphs: [
            'Customers may submit complaints or feedback through official channels:',
            '• Dedicated Hotline: (+84) 0877 909 606 (8:30 – 17:00, Monday to Friday).',
            '• Official Email: info@digiso.vn.',
            '• Written correspondence: Room I.101B, Building A, VNU-HCM Software Park, Linh Xuan, Ho Chi Minh City, Vietnam.',
          ],
        },
        {
          heading: '2. Resolution Timeline',
          paragraphs: [
            'Step 1: Acknowledge receipt of the complaint within 24 working hours.',
            'Step 2: Technical and support team analyzes system logs and assesses root cause.',
            'Step 3: Deliver a formal resolution within 3 business days of receiving complete details.',
          ],
        },
        {
          heading: '3. Resolution Principles',
          paragraphs: [
            'DIGISO prioritizes goodwill, fairness, and mutual trust, relying on immutable transaction records and technical logs to guarantee fair outcomes.',
          ],
        },
      ],
    },
  },

  'pricing-policy': {
    vi: {
      slug: 'pricing-policy',
      title: 'Chính sách về giá dịch vụ',
      shortTitle: 'Chính sách về giá',
      summary: 'Quy định công khai, minh bạch về biểu giá gói cước phần mềm, chiết khấu chu kỳ năm và các tùy chọn tiện ích mua thêm.',
      category: 'policy',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Niêm yết giá công khai',
          paragraphs: [
            'Toàn bộ giá gói dịch vụ Digistay (Starter, Growth, Business và Custom Plans) được niêm yết công khai bằng đồng Việt Nam (VND) trên trang Bảng giá (/pricing).',
            'Giá đã được thể hiện rõ ràng theo chu kỳ thanh toán tháng hoặc năm. DIGISO cam kết không thu bất kỳ khoản phụ phí ẩn nào ngoài biểu giá đã công bố.',
          ],
        },
        {
          heading: '2. Ưu đãi thanh toán theo năm',
          paragraphs: [
            'Khách hàng lựa chọn chu kỳ thanh toán theo năm được hưởng chính sách ưu đãi tặng 02 tháng sử dụng (chỉ thanh toán tương đương 10 tháng).',
          ],
        },
        {
          heading: '3. Điều chỉnh biểu giá',
          paragraphs: [
            'Trong trường hợp có sự điều chỉnh giá gói cước, DIGISO sẽ thông báo công khai trước tối thiểu 30 ngày. Khách hàng đang trong thời hạn gói cước đã trả phí sẽ tiếp tục áp dụng mức giá cũ cho đến hết chu kỳ đã thanh toán.',
          ],
        },
      ],
    },
    en: {
      slug: 'pricing-policy',
      title: 'Pricing Policy',
      shortTitle: 'Pricing Policy',
      summary: 'Transparent regulations on software subscription fees, annual billing discounts, and optional platform add-ons.',
      category: 'policy',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Transparent Public Pricing',
          paragraphs: [
            'All Digistay subscription packages (Starter, Growth, Business, and Custom Plans) are publicly listed in Vietnamese Dong (VND) on our Pricing page (/pricing).',
            'Fees are displayed per monthly or annual billing cycle. DIGISO guarantees no hidden fees beyond published rates.',
          ],
        },
        {
          heading: '2. Annual Discount Terms',
          paragraphs: [
            'Clients opting for annual prepayment receive 2 free months of service (pay 10 months for a full 12-month period).',
          ],
        },
        {
          heading: '3. Price Adjustment Notice',
          paragraphs: [
            'Any subscription price updates will be communicated at least 30 days in advance. Active prepaid cycles remain unaffected until renewal.',
          ],
        },
      ],
    },
  },

  'payment-policy': {
    vi: {
      slug: 'payment-policy',
      title: 'Chính sách về thanh toán',
      shortTitle: 'Chính sách thanh toán',
      summary: 'Quy định phương thức thanh toán chuyển khoản VietQR PayOS, quy trình đối soát tự động và phát hành hóa đơn điện tử GTGT.',
      category: 'policy',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Phương thức thanh toán chấp nhận',
          paragraphs: [
            'DIGISO hỗ trợ thanh toán chuyển khoản ngân hàng qua mã VietQR động được tích hợp với cổng trung gian thanh toán PayOS đã đăng ký với Ngân hàng Nhà nước.',
            'Mỗi đơn hàng được cấp một mã thanh toán duy nhất với thời gian hiệu lực 30 phút, đảm bảo tiền về chính xác và bảo mật tuyệt đối.',
          ],
        },
        {
          heading: '2. Kích hoạt dịch vụ tức thì',
          paragraphs: [
            'Ngay khi giao dịch thanh toán thành công qua PayOS, hệ thống tự động ghi nhận và kích hoạt thời hạn gói cước cho workspace trong vòng dưới 5 giây mà không cần thao tác thủ công.',
          ],
        },
        {
          heading: '3. Xuất hóa đơn điện tử GTGT',
          paragraphs: [
            'DIGISO tự động phát hành hóa đơn GTGT điện tử hợp pháp qua nhà cung cấp giải pháp Mắt Bão và gửi vào email của khách hàng sau khi thanh toán thành công.',
          ],
        },
      ],
    },
    en: {
      slug: 'payment-policy',
      title: 'Payment Policy',
      shortTitle: 'Payment Policy',
      summary: 'Guidelines for VietQR PayOS bank transfers, automated real-time reconciliation, and legal electronic VAT invoicing.',
      category: 'policy',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Accepted Payment Methods',
          paragraphs: [
            'DIGISO accepts bank transfer payments via dynamic VietQR QR codes integrated with licensed PayOS payment gateway.',
            'Each checkout session is assigned a unique order code valid for 30 minutes to guarantee accuracy and transaction security.',
          ],
        },
        {
          heading: '2. Instant Automated Activation',
          paragraphs: [
            'Upon payment confirmation, the platform automatically applies the subscription to the customer workspace within seconds.',
          ],
        },
        {
          heading: '3. Official VAT Electronic Invoices',
          paragraphs: [
            'DIGISO automatically issues an official VAT e-invoice via Mat Bao, delivered directly to the buyer email address.',
          ],
        },
      ],
    },
  },

  'service-terms': {
    vi: {
      slug: 'service-terms',
      title: 'Điều kiện và hạn chế cung cấp dịch vụ',
      shortTitle: 'Điều kiện & Hạn chế',
      summary: 'Các điều kiện đối tượng khách hàng, hạn mức tính năng và các hành vi bị giới hạn hoặc nghiêm cấm trên nền tảng Digistay.',
      category: 'policy',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Đối tượng và điều kiện phục vụ',
          paragraphs: [
            'Nền tảng Digistay phục vụ các tổ chức, doanh nghiệp, hộ kinh doanh và cá nhân vận hành cơ sở lưu trú (khách sạn, resort, homestay, villa, căn hộ du lịch) hợp pháp theo pháp luật Việt Nam.',
            'Khách hàng có trách nhiệm tự chịu sự kiểm tra và đảm bảo các giấy phép đủ điều kiện kinh doanh lưu trú, an ninh trật tự và phòng cháy chữa cháy.',
          ],
        },
        {
          heading: '2. Hạn mức tính năng theo gói',
          paragraphs: [
            'Mỗi gói cước có hạn mức giới hạn về số lượng cơ sở lưu trú, số phòng tối đa và số tài khoản nhân viên được cấp phép sử dụng. Khách hàng có nhu cầu vượt hạn mức cần nâng cấp gói cước hoặc mua thêm tiện ích tương ứng.',
          ],
        },
        {
          heading: '3. Các hành vi nghiêm cấm',
          paragraphs: [
            '• Sử dụng website đặt phòng để lừa đảo, chiếm đoạt tài sản hoặc chứa nội dung độc hại, khiêu dâm, vi phạm thuần phong mỹ tục.',
            '• Phát tán thư rác, sử dụng bot cào dữ liệu hoặc tấn công gây nghẽn mạng đối với hạ tầng DIGISO.',
          ],
        },
      ],
    },
    en: {
      slug: 'service-terms',
      title: 'Service Conditions and Limitations',
      shortTitle: 'Service Limitations',
      summary: 'Eligibility criteria, feature quota thresholds, and prohibited conduct on the Digistay hospitality platform.',
      category: 'policy',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Eligibility Criteria',
          paragraphs: [
            'Digistay is designed for legally recognized hospitality operators, hotels, homestays, villas, and serviced apartments in Vietnam.',
            'Clients must comply with local business licensing, fire safety, and lodging registrations.',
          ],
        },
        {
          heading: '2. Package Quotas and Capacity',
          paragraphs: [
            'Each subscription tier defines limits for properties, maximum rooms, and authorized staff accounts. Exceeding capacity requires upgrading or purchasing add-ons.',
          ],
        },
        {
          heading: '3. Prohibited Conduct',
          paragraphs: [
            '• Fraudulent booking activities, hosting illicit, harmful, or defamatory content.',
            '• Bot crawling, distributed denial-of-service (DDoS) attempts, or platform disruption.',
          ],
        },
      ],
    },
  },

  'service-delivery-policy': {
    vi: {
      slug: 'service-delivery-policy',
      title: 'Phương thức cung cấp dịch vụ',
      shortTitle: 'Phương thức cung cấp',
      summary: 'Quy trình bàn giao dịch vụ phần mềm trực tuyến 100%, thời gian khởi tạo và tiêu chuẩn cam kết chất lượng dịch vụ (SLA).',
      category: 'policy',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Hình thức bàn giao dịch vụ',
          paragraphs: [
            'Digistay là giải pháp phần mềm trên nền điện toán đám mây (Cloud SaaS), không yêu cầu cài đặt phần cứng tại cơ sở của khách hàng.',
            'Toàn bộ quy trình bàn giao được thực hiện trực tuyến: Khách hàng đăng ký tài khoản, xác thực email và nhận quyền quản trị workspace ngay lập tức.',
          ],
        },
        {
          heading: '2. Thời gian khởi tạo dịch vụ',
          paragraphs: [
            '• Tạo tài khoản dùng thử và workspace: Dưới 1 phút.',
            '• Kích hoạt gói trả phí sau khi thanh toán PayOS: Dưới 5 giây.',
            '• Kết nối tên miền riêng của khách sạn: Từ 1 đến 24 giờ tùy thuộc thời gian trỏ bản ghi DNS của nhà cung cấp tên miền.',
          ],
        },
        {
          heading: '3. Tiêu chuẩn cam kết chất lượng (SLA)',
          paragraphs: [
            'DIGISO cam kết tỷ lệ sẵn sàng của hệ thống (Uptime SLA) đạt tối thiểu 99.9% hằng tháng. Trong trường hợp bảo trì hạ tầng theo kế hoạch, thông báo sẽ được gửi trước tối thiểu 24 giờ qua email hoặc thông báo trong trang quản trị.',
          ],
        },
      ],
    },
    en: {
      slug: 'service-delivery-policy',
      title: 'Service Delivery and Fulfillment Policy',
      shortTitle: 'Service Delivery',
      summary: 'Electronic SaaS fulfillment terms, instant provisioning timelines, and service level agreements (SLA).',
      category: 'policy',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Electronic Service Delivery',
          paragraphs: [
            'Digistay operates 100% on cloud infrastructure (SaaS) and requires no physical on-premise installation.',
            'Delivery is instantaneous upon online registration, email verification, and workspace initialization.',
          ],
        },
        {
          heading: '2. Provisioning Timelines',
          paragraphs: [
            '• Free trial workspace setup: Under 1 minute.',
            '• Paid plan activation via PayOS: Under 5 seconds.',
            '• Custom domain SSL verification: 1 to 24 hours depending on DNS propagation.',
          ],
        },
        {
          heading: '3. Service Level Agreement (SLA)',
          paragraphs: [
            'DIGISO guarantees minimum 99.9% monthly service uptime. Scheduled maintenance is broadcast at least 24 hours in advance via system banners or email.',
          ],
        },
      ],
    },
  },

  'refund-policy': {
    vi: {
      slug: 'refund-policy',
      title: 'Chính sách chấm dứt dịch vụ và hoàn tiền',
      shortTitle: 'Chấm dứt & Hoàn tiền',
      summary: 'Quy định về thời gian dùng thử 14 ngày miễn phí, quy trình ngừng sử dụng và các trường hợp hoàn trả phí dịch vụ hợp lệ.',
      category: 'policy',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Thời gian dùng thử miễn phí 14 ngày',
          paragraphs: [
            'Mỗi workspace mới được trải nghiệm đầy đủ tính năng của gói Growth trong 14 ngày hoàn toàn miễn phí mà không cần nhập thông tin thẻ thanh toán.',
            'Hết 14 ngày, khách hàng có 07 ngày ân hạn để quyết định đăng ký mua gói cước trả phí hoặc tài khoản chuyển sang chế độ chỉ xem.',
          ],
        },
        {
          heading: '2. Quyền chấm dứt dịch vụ của khách hàng',
          paragraphs: [
            'Khách hàng có quyền ngừng gia hạn gói cước bất kỳ lúc nào. Quyền truy cập gói hiện tại vẫn được duy trì đầy đủ cho đến ngày kết thúc chu kỳ thanh toán đã mua.',
            'Sau khi hết hạn, khách hàng được quyền truy cập để xuất toàn bộ danh sách đặt phòng và sổ quỹ trong vòng 30 ngày trước khi hệ thống lưu trữ xóa dữ liệu.',
          ],
        },
        {
          heading: '3. Điều kiện hoàn tiền',
          paragraphs: [
            'DIGISO thực hiện hoàn tiền trong các trường hợp sau:',
            '• Lỗi kỹ thuật từ hệ thống thanh toán dẫn đến trừ tiền trùng lặp cho cùng một mã đơn hàng.',
            '• Sự cố hệ thống kéo dài do lỗi chủ quan của DIGISO làm gián đoạn dịch vụ liên tục quá 72 giờ mà không được khắc phục.',
            'Số tiền hoàn trả sẽ được chuyển khoản trực tiếp về tài khoản ngân hàng của khách hàng trong vòng 03 đến 05 ngày làm việc.',
          ],
        },
      ],
    },
    en: {
      slug: 'refund-policy',
      title: 'Termination and Refund Policy',
      shortTitle: 'Refund Policy',
      summary: 'Terms governing the 14-day free trial period, service cancellation procedures, and eligible refund scenarios.',
      category: 'policy',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. 14-Day Full Free Trial',
          paragraphs: [
            'Every new workspace receives 14 days of full Growth plan access free of charge with no credit card required.',
            'A subsequent 7-day grace period is provided before the workspace enters read-only status.',
          ],
        },
        {
          heading: '2. Customer Termination Rights',
          paragraphs: [
            'Clients may discontinue subscriptions at any time. Paid features remain active until the end of the billing period.',
            'Data export access is preserved for 30 calendar days post-expiration before permanent data purge.',
          ],
        },
        {
          heading: '3. Refund Eligibility',
          paragraphs: [
            'DIGISO issues refunds under the following circumstances:',
            '• Duplicate payment deductions resulting from gateway communication errors.',
            '• Persistent service downtime exceeding 72 consecutive hours attributable directly to DIGISO infrastructure failure.',
            'Approved refunds are transferred back to the original bank account within 3 to 5 business days.',
          ],
        },
      ],
    },
  },

  'rights-and-duties': {
    vi: {
      slug: 'rights-and-duties',
      title: 'Quyền và nghĩa vụ của các bên',
      shortTitle: 'Quyền và nghĩa vụ',
      summary: 'Quy định chi tiết quyền hạn, trách nhiệm pháp lý và nghĩa vụ của Công ty TNHH Giải pháp số DIGISO và Khách hàng sử dụng nền tảng.',
      category: 'legal',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Quyền và nghĩa vụ của DIGISO',
          paragraphs: [
            '• Quyền: Có quyền tạm ngừng cung cấp dịch vụ đối với tài khoản có hành vi vi phạm pháp luật, gian lận thanh toán hoặc phát tán mã độc. Có quyền điều chỉnh và nâng cấp tính năng phần mềm để hoàn thiện sản phẩm.',
            '• Nghĩa vụ: Đảm bảo phần mềm hoạt động ổn định, bảo mật an toàn thông tin khách hàng, xuất hóa đơn GTGT đầy đủ và cung cấp kênh hỗ trợ kỹ thuật trực tuyến trong giờ làm việc quy định.',
          ],
        },
        {
          heading: '2. Quyền và nghĩa vụ của Khách hàng',
          paragraphs: [
            '• Quyền: Toàn quyền khai thác tính năng theo gói cước đã đăng ký, sở hữu dữ liệu khách sạn và xuất dữ liệu kinh doanh bất kỳ lúc nào.',
            '• Nghĩa vụ: Cung cấp thông tin đăng ký chính xác, thanh toán phí dịch vụ đúng hạn, tự quản lý tài khoản nhân viên và chịu trách nhiệm trước pháp luật về tính hợp pháp của dịch vụ lưu trú do mình kinh doanh.',
          ],
        },
      ],
    },
    en: {
      slug: 'rights-and-duties',
      title: 'Rights and Obligations of the Parties',
      shortTitle: 'Rights and Obligations',
      summary: 'Comprehensive legal division of rights, statutory responsibilities, and operational duties of DIGISO and the Customer.',
      category: 'legal',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Rights and Obligations of DIGISO',
          paragraphs: [
            '• Rights: Reserve the right to suspend accounts engaged in unlawful acts, payment fraud, or system abuse. Reserve the right to deploy updates and improvements.',
            '• Obligations: Maintain platform stability, ensure data security, provide official VAT e-invoices, and maintain technical support during business hours.',
          ],
        },
        {
          heading: '2. Rights and Obligations of the Customer',
          paragraphs: [
            '• Rights: Full utilization of subscribed features, exclusive ownership of lodging business data, and unhindered data export capabilities.',
            '• Obligations: Provide truthful registration data, pay subscription fees on schedule, administer staff accounts responsibly, and ensure lodging legality under Vietnamese law.',
          ],
        },
      ],
    },
  },

  support: {
    vi: {
      slug: 'support',
      title: 'Hình thức hỗ trợ trực tuyến',
      shortTitle: 'Hỗ trợ trực tuyến',
      summary: 'Các kênh liên lạc hỗ trợ kỹ thuật, tư vấn vận hành và thời gian phản hồi chính thức của đội ngũ kỹ sư DIGISO.',
      category: 'policy',
      lastUpdated: '11/11/2026',
      sections: [
        {
          heading: '1. Kênh hỗ trợ chính thức',
          paragraphs: [
            '• Tổng đài Hotline: 0877 909 606 (Khung giờ tiếp nhận: 8:30 – 17:00 từ Thứ Hai đến Thứ Sáu hằng tuần).',
            '• Hộp thư tiếp nhận kỹ thuật & nghiệp vụ: info@digiso.vn.',
            '• Trung tâm hỗ trợ trực tuyến trên phần mềm và tài liệu hướng dẫn sử dụng.',
          ],
        },
        {
          heading: '2. Phân loại mức độ ưu tiên và thời gian phản hồi',
          paragraphs: [
            '• Mức khẩn cấp (Sự cố gián đoạn đặt phòng hoặc lỗi cổng PayOS): Phản hồi và xử lý trong vòng 30 - 60 phút.',
            '• Mức tiêu chuẩn (Hỏi đáp tính năng, cài đặt phòng, hỗ trợ tên miền): Phản hồi trong vòng 2 - 4 giờ làm việc.',
            '• Yêu cầu cấu hình tính năng riêng / Custom Plan: Tiếp nhận và xếp lịch trao đổi trong ngày làm việc.',
          ],
        },
        {
          heading: '3. Cam kết dịch vụ khách hàng',
          paragraphs: [
            'Đội ngũ kỹ sư phần mềm của DIGISO luôn đồng hành trực tiếp, giải thích tận tình và hỗ trợ đến khi cơ sở lưu trú vận hành trơn tru.',
          ],
        },
      ],
    },
    en: {
      slug: 'support',
      title: 'Online Support and Assistance Policy',
      shortTitle: 'Online Support',
      summary: 'Official technical help channels, operational advisory, and resolution response time standards by DIGISO engineering.',
      category: 'policy',
      lastUpdated: 'November 11, 2026',
      sections: [
        {
          heading: '1. Official Support Channels',
          paragraphs: [
            '• Support Hotline: (+84) 0877 909 606 (8:30 – 17:00, Monday through Friday).',
            '• Technical & Account Inquiries: info@digiso.vn.',
            '• In-app documentation and knowledge base guides.',
          ],
        },
        {
          heading: '2. Priority Tiers and Response Times',
          paragraphs: [
            '• Urgent Severity (Booking outage or PayOS reconciliation disruption): Acknowledged and handled within 30 to 60 minutes.',
            '• Standard Severity (Setup, room configuration, custom domain DNS assistance): Responded within 2 to 4 working hours.',
            '• Custom Plan & Enterprise requests: Coordinated within the same business day.',
          ],
        },
        {
          heading: '3. Service Commitment',
          paragraphs: [
            'DIGISO software engineers provide direct, diligent guidance to ensure seamless daily front desk operations.',
          ],
        },
      ],
    },
  },
}
