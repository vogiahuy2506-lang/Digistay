/**
 * Pre-designed Hotel Landing Page Templates.
 * Each template provides a cohesive full-page design:
 * - Color scheme (Primary, Button, Heading, Accent)
 * - Typography pairing (Heading font + Body font with Vietnamese glyph support)
 * - Optimized block layout order for high conversion (CRO)
 * - Initial inspirational copy tailored to the hospitality segment
 */

export interface LandingTemplateBlock {
  type: 'HERO' | 'ROOMS' | 'AMENITIES' | 'ABOUT' | 'GALLERY' | 'REVIEWS' | 'MAP' | 'CONTACT' | 'CTA' | 'SERVICES' | 'RESTAURANT_MENU'
  name: string
  isEnabled: boolean
  config?: Record<string, any>
}

export interface HotelLandingTemplate {
  id: string
  name: string
  tagline: string
  description: string
  badge: string
  badgeColor: string
  category: 'LUXURY' | 'BEACH' | 'NATURE' | 'BOUTIQUE' | 'BUSINESS' | 'HERITAGE'
  previewGradient: string
  recommendedFor: string
  style: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    buttonColor: string
    headingColor: string
    fontFamily: string
    headingFont: string
  }
  blocks: LandingTemplateBlock[]
}

export const HOTEL_LANDING_TEMPLATES: HotelLandingTemplate[] = [
  {
    id: 'grand-luxury',
    name: 'Grand Luxury Resort & Spa',
    tagline: 'Đẳng cấp thượng lưu & Nghỉ dưỡng hoàng gia 5 sao',
    description: 'Thiết kế sang trọng với gam màu vàng ánh kim phối nền đen huyền bí, tôn vinh đẳng cấp không gian và dịch vụ độc quyền.',
    badge: '5 Sao Đẳng Cấp',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    category: 'LUXURY',
    previewGradient: 'from-amber-600 via-stone-800 to-stone-900',
    recommendedFor: 'Khu nghỉ dưỡng cao cấp, Resort 4-5 sao, Biệt thự VIP',
    style: {
      primaryColor: '#C5A880',
      secondaryColor: '#E5D0AC',
      accentColor: '#D4AF37',
      buttonColor: '#1C1B19',
      headingColor: '#1C1B19',
      fontFamily: 'Inter',
      headingFont: 'Playfair Display',
    },
    blocks: [
      {
        type: 'HERO',
        name: 'Banner Hero Hoàng Gia',
        isEnabled: true,
        config: {
          heroTitle: '',
          heroSubtitle: 'Trải nghiệm đỉnh cao của sự sang trọng, riêng tư và hoàn mỹ',
          heroCtaText: 'Đặt phòng thượng lưu ngay',
          heroCtaLink: '#rooms',
          showSearchBar: true,
        },
      },
      {
        type: 'ROOMS',
        name: 'Hạng phòng Tổng thống & Suites',
        isEnabled: true,
        config: {
          roomsTitle: 'Không gian nghỉ dưỡng xa hoa',
          roomsDisplay: 'grid',
          roomsLimit: 6,
        },
      },
      {
        type: 'SERVICES',
        name: 'Dịch vụ Spa & Chăm sóc đặc quyền',
        isEnabled: true,
        config: {
          servicesTitle: 'Đặc quyền chăm sóc sức khỏe & Thư giãn',
        },
      },
      {
        type: 'AMENITIES',
        name: 'Tiện ích đẳng cấp 5 sao',
        isEnabled: true,
        config: {
          amenitiesTitle: 'Tiện nghi hoàn hảo cho kỳ nghỉ',
          amenitiesColumns: 4,
        },
      },
      {
        type: 'ABOUT',
        name: 'Về chúng tôi & Triết lý phục vụ',
        isEnabled: true,
        config: {
          aboutTitle: 'Tuyệt tác kiến trúc giữa lòng thiên nhiên',
          aboutContent: 'Mỗi chi tiết tại khu nghỉ dưỡng đều được trau chuốt tỉ mỉ để mang đến cho quý khách kỳ nghỉ đáng nhớ nhất. Đội ngũ quản gia chuyên nghiệp luôn sẵn sàng phục vụ 24/7 với sự tận tâm cao nhất.',
        },
      },
      {
        type: 'RESTAURANT_MENU',
        name: 'Ẩm thực Fine Dining & Rượu vang',
        isEnabled: true,
        config: {
          menuTitle: 'Hành trình vị giác đỉnh cao',
          menuNote: 'Thực đơn tinh hoa từ các đầu bếp 5 sao quốc tế',
        },
      },
      {
        type: 'REVIEWS',
        name: 'Cảm nhận của khách quý',
        isEnabled: true,
        config: {
          reviewsTitle: 'Đánh giá từ khách hàng thượng lưu',
          reviewsLimit: 6,
        },
      },
      {
        type: 'CTA',
        name: 'Ưu đãi đặt phòng trực tiếp',
        isEnabled: true,
        config: {
          ctaTitle: 'Đặc quyền giữ giá tốt nhất khi đặt trực tiếp',
          ctaSubtitle: 'Tặng kèm suất trà chiều hoàng gia và dịch vụ đưa đón sân bay riêng',
          ctaButtonText: 'Giữ phòng VIP ngay',
          ctaButtonLink: '#rooms',
          ctaBadge: 'Ưu đãi độc quyền',
        },
      },
      {
        type: 'CONTACT',
        name: 'Liên hệ & Đặt phòng riêng',
        isEnabled: true,
        config: {
          contactTitle: 'Dịch vụ chăm sóc & Tiếp đón khách quý',
          contactFormEnabled: true,
        },
      },
    ],
  },
  {
    id: 'tropical-beach',
    name: 'Tropical Beachfront & Ocean Villa',
    tagline: 'Biển xanh cát trắng & Nắng vàng rực rỡ',
    description: 'Phong cách nhiệt đới tràn ngập ánh sáng tự nhiên với gam màu xanh ngọc bích và biển sâu, khơi gợi cảm hứng thư giãn tuyệt đối.',
    badge: 'Bán Chạy Nhất',
    badgeColor: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
    category: 'BEACH',
    previewGradient: 'from-teal-600 via-cyan-800 to-slate-900',
    recommendedFor: 'Khách sạn ven biển, Khu nghỉ dưỡng bãi biển, Ocean Villa',
    style: {
      primaryColor: '#0D9488',
      secondaryColor: '#14B8A6',
      accentColor: '#38BDF8',
      buttonColor: '#0F172A',
      headingColor: '#0F172A',
      fontFamily: 'Be Vietnam Pro',
      headingFont: 'Montserrat',
    },
    blocks: [
      {
        type: 'HERO',
        name: 'Hero Biển Nhiệt Đới',
        isEnabled: true,
        config: {
          heroTitle: '',
          heroSubtitle: 'Đón bình minh rực rỡ và lắng nghe tiếng sóng vỗ ngay trước ban công phòng bạn',
          heroCtaText: 'Khám phá phòng view biển',
          heroCtaLink: '#rooms',
          showSearchBar: true,
        },
      },
      {
        type: 'ROOMS',
        name: 'Các hạng phòng hướng biển',
        isEnabled: true,
        config: {
          roomsTitle: 'Hạng phòng Ocean View thoáng đãng',
          roomsDisplay: 'grid',
          roomsLimit: 6,
        },
      },
      {
        type: 'AMENITIES',
        name: 'Tiện ích biển nhiệt đới',
        isEnabled: true,
        config: {
          amenitiesTitle: 'Tiện ích hồ bơi vô cực & Bãi biển riêng',
          amenitiesColumns: 3,
        },
      },
      {
        type: 'GALLERY',
        name: 'Bộ sưu tập khoảnh khắc biển',
        isEnabled: true,
        config: {
          galleryTitle: 'Khoảnh khắc tuyệt đẹp bên bờ đại dương',
          galleryColumns: 3,
        },
      },
      {
        type: 'RESTAURANT_MENU',
        name: 'Hải sản tươi sống & Cocktail Bar',
        isEnabled: true,
        config: {
          menuTitle: 'Hương vị biển cả tươi ngon mỗi ngày',
          menuNote: 'Thưởng thức BBQ hải sản bên bờ biển lúc hoàng hôn',
        },
      },
      {
        type: 'REVIEWS',
        name: 'Chia sẻ của du khách',
        isEnabled: true,
        config: {
          reviewsTitle: 'Kỳ nghỉ biển đáng nhớ của du khách',
          reviewsLimit: 4,
        },
      },
      {
        type: 'MAP',
        name: 'Bản đồ vị trí ven biển',
        isEnabled: true,
        config: {
          mapAddress: '',
          mapZoom: 15,
        },
      },
      {
        type: 'CTA',
        name: 'Ưu đãi kỳ nghỉ hè',
        isEnabled: true,
        config: {
          ctaTitle: 'Sẵn sàng cho kỳ nghỉ bên bờ biển xanh?',
          ctaSubtitle: 'Đặt sớm hôm nay để giữ trọn phòng hướng biển với mức giá ưu đãi nhất',
          ctaButtonText: 'Đặt phòng ngay',
          ctaButtonLink: '#rooms',
        },
      },
      {
        type: 'CONTACT',
        name: 'Liên hệ đặt phòng biển',
        isEnabled: true,
        config: {
          contactTitle: 'Kết nối trực tiếp cùng lễ tân bãi biển',
        },
      },
    ],
  },
  {
    id: 'cozy-homestay',
    name: 'Cozy Nature & Eco Homestay',
    tagline: 'Mộc mạc, bình yên & Gần gũi thiên nhiên',
    description: 'Tone màu xanh rừng lá và nâu gỗ ấm, đem lại cảm giác bình yên thư thái như đang trở về ngôi nhà thứ hai giữa đại ngàn.',
    badge: 'Gần Gũi Thiên Nhiên',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    category: 'NATURE',
    previewGradient: 'from-emerald-700 via-stone-800 to-amber-950',
    recommendedFor: 'Homestay Đà Lạt, Sa Pa, Nhà sàn sinh thái, Glamping',
    style: {
      primaryColor: '#059669',
      secondaryColor: '#10B981',
      accentColor: '#D97706',
      buttonColor: '#292524',
      headingColor: '#292524',
      fontFamily: 'Inter',
      headingFont: 'Merriweather',
    },
    blocks: [
      {
        type: 'HERO',
        name: 'Hero Bình Yên Đại Ngàn',
        isEnabled: true,
        config: {
          heroTitle: '',
          heroSubtitle: 'Rời xa khói bụi thành thị, tìm về góc bình yên giữa mây trời và tiếng thông reo',
          heroCtaText: 'Chọn góc nghỉ ấm cúng',
          heroCtaLink: '#rooms',
          showSearchBar: true,
        },
      },
      {
        type: 'ABOUT',
        name: 'Câu chuyện ngôi nhà chung',
        isEnabled: true,
        config: {
          aboutTitle: 'Nơi giữ lại những điều mộc mạc nhất',
          aboutContent: 'Chúng tôi xây dựng không gian này từ tình yêu thiên nhiên và mong muốn tạo nên một chốn dừng chân ấm cúng cho những tâm hồn mệt mỏi. Buổi sáng ngắm mây mù, chiều thưởng trà, tối quây quần bên đốm lửa ấm.',
        },
      },
      {
        type: 'ROOMS',
        name: 'Các gian phòng gỗ xinh xắn',
        isEnabled: true,
        config: {
          roomsTitle: 'Những góc phòng ngập tràn ánh nắng',
          roomsDisplay: 'grid',
          roomsLimit: 4,
        },
      },
      {
        type: 'AMENITIES',
        name: 'Tiện nghi BBQ & Lửa trại',
        isEnabled: true,
        config: {
          amenitiesTitle: 'Bếp chung, sân BBQ & Sân vườn xanh mát',
          amenitiesColumns: 3,
        },
      },
      {
        type: 'GALLERY',
        name: 'Góc ảnh bình yên',
        isEnabled: true,
        config: {
          galleryTitle: 'Những góc nhỏ thương nhớ tại Homestay',
          galleryColumns: 3,
        },
      },
      {
        type: 'REVIEWS',
        name: 'Lưu bút khách ghé thăm',
        isEnabled: true,
        config: {
          reviewsTitle: 'Chia sẻ từ những người bạn đường xa',
          reviewsLimit: 4,
        },
      },
      {
        type: 'MAP',
        name: 'Đường về chốn bình yên',
        isEnabled: true,
        config: {
          mapAddress: '',
          mapZoom: 14,
        },
      },
      {
        type: 'CONTACT',
        name: 'Nhắn gửi chủ nhà',
        isEnabled: true,
        config: {
          contactTitle: 'Liên hệ chủ nhà & Giữ phòng ấm',
        },
      },
    ],
  },
  {
    id: 'urban-boutique',
    name: 'Modern Urban Boutique Hotel',
    tagline: 'Phong cách tối giản, trẻ trung & Đô thị hiện đại',
    description: 'Thiết kế đương đại sắc sảo với gam màu xanh Cobalt và xám than, tối ưu hóa trải nghiệm đặt phòng nhanh cho khách trẻ và năng động.',
    badge: 'Phong Cách Đô Thị',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    category: 'BOUTIQUE',
    previewGradient: 'from-blue-600 via-indigo-900 to-zinc-950',
    recommendedFor: 'Khách sạn trung tâm thành phố, Boutique Hotel, Khách du lịch tự túc',
    style: {
      primaryColor: '#2563EB',
      secondaryColor: '#3B82F6',
      accentColor: '#F59E0B',
      buttonColor: '#18181B',
      headingColor: '#18181B',
      fontFamily: 'Inter',
      headingFont: 'Montserrat',
    },
    blocks: [
      {
        type: 'HERO',
        name: 'Hero Đô Thị Năng Động',
        isEnabled: true,
        config: {
          heroTitle: '',
          heroSubtitle: 'Điểm lưu trú phong cách giữa nhịp sống sôi động của trung tâm thành phố',
          heroCtaText: 'Đặt phòng giá tốt ngay',
          heroCtaLink: '#rooms',
          showSearchBar: true,
        },
      },
      {
        type: 'ROOMS',
        name: 'Hạng phòng thiết kế hiện đại',
        isEnabled: true,
        config: {
          roomsTitle: 'Hạng phòng tinh tế & Đầy đủ tiện nghi',
          roomsDisplay: 'grid',
          roomsLimit: 6,
        },
      },
      {
        type: 'AMENITIES',
        name: 'Tiện ích đô thị thông minh',
        isEnabled: true,
        config: {
          amenitiesTitle: 'Wi-Fi 6 tốc độ cao, Coffee Lounge & Co-working',
          amenitiesColumns: 4,
        },
      },
      {
        type: 'RESTAURANT_MENU',
        name: 'Bữa sáng & Quầy Bar',
        isEnabled: true,
        config: {
          menuTitle: 'Cà phê sáng & Thức uống giải khát',
          menuNote: 'Phục vụ bữa sáng tiện lợi và cà phê rang xay nguyên chất',
        },
      },
      {
        type: 'REVIEWS',
        name: 'Đánh giá của khách du lịch',
        isEnabled: true,
        config: {
          reviewsTitle: 'Khách hàng nói gì về vị trí và dịch vụ',
          reviewsLimit: 6,
        },
      },
      {
        type: 'MAP',
        name: 'Vị trí đắc địa trung tâm',
        isEnabled: true,
        config: {
          mapAddress: '',
          mapZoom: 16,
        },
      },
      {
        type: 'CTA',
        name: 'Ưu đãi chớp nhoáng',
        isEnabled: true,
        config: {
          ctaTitle: 'Giữ phòng trung tâm ngay hôm nay',
          ctaSubtitle: 'Hủy phòng miễn phí trước 24 giờ - Thanh toán linh hoạt tại quầy',
          ctaButtonText: 'Đặt phòng ngay',
          ctaButtonLink: '#rooms',
        },
      },
      {
        type: 'CONTACT',
        name: 'Liên hệ lễ tân 24/7',
        isEnabled: true,
        config: {
          contactTitle: 'Hotline lễ tân & Đặt xe đưa đón',
        },
      },
    ],
  },
  {
    id: 'business-executive',
    name: 'Executive Business & Suite Hotel',
    tagline: 'Chuyên nghiệp, thanh lịch & Chuẩn mực công vụ',
    description: 'Tone màu xanh Navy uy tín phối xám bạc sang trọng, tối ưu cho khách đi công tác, chuyên gia quốc tế và các đoàn hội nghị.',
    badge: 'Khách Sạn Công Vụ',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    category: 'BUSINESS',
    previewGradient: 'from-blue-900 via-slate-800 to-slate-950',
    recommendedFor: 'Khách sạn công vụ, Khách sạn gần sân bay, Trung tâm tài chính',
    style: {
      primaryColor: '#1E40AF',
      secondaryColor: '#3B82F6',
      accentColor: '#F59E0B',
      buttonColor: '#1E293B',
      headingColor: '#0F172A',
      fontFamily: 'Be Vietnam Pro',
      headingFont: 'Montserrat',
    },
    blocks: [
      {
        type: 'HERO',
        name: 'Hero Thương Vụ Thanh Lịch',
        isEnabled: true,
        config: {
          heroTitle: '',
          heroSubtitle: 'Chuẩn mực lưu trú công vụ với không gian làm việc tĩnh lặng và dịch vụ nhanh chóng',
          heroCtaText: 'Đặt phòng công tác',
          heroCtaLink: '#rooms',
          showSearchBar: true,
        },
      },
      {
        type: 'ROOMS',
        name: 'Phòng Executive & Business Suite',
        isEnabled: true,
        config: {
          roomsTitle: 'Hạng phòng cao cấp cho chuyên gia',
          roomsDisplay: 'grid',
          roomsLimit: 4,
        },
      },
      {
        type: 'SERVICES',
        name: 'Dịch vụ đưa đón & Giặt ủi nhanh',
        isEnabled: true,
        config: {
          servicesTitle: 'Dịch vụ xe đưa đón sân bay & Giặt ủi cấp tốc',
        },
      },
      {
        type: 'AMENITIES',
        name: 'Phòng họp & Tiện nghi doanh nhân',
        isEnabled: true,
        config: {
          amenitiesTitle: 'Phòng họp, in ấn văn phòng & Bàn làm việc công thái học',
          amenitiesColumns: 4,
        },
      },
      {
        type: 'REVIEWS',
        name: 'Đánh giá từ giới doanh nhân',
        isEnabled: true,
        config: {
          reviewsTitle: 'Được tin chọn bởi các chuyên gia & Doanh nghiệp',
          reviewsLimit: 4,
        },
      },
      {
        type: 'MAP',
        name: 'Bản đồ kết nối giao thông',
        isEnabled: true,
        config: {
          mapAddress: '',
          mapZoom: 15,
        },
      },
      {
        type: 'CTA',
        name: 'Hỗ trợ xuất hóa đơn VAT',
        isEnabled: true,
        config: {
          ctaTitle: 'Đặt phòng công vụ - Hỗ trợ xuất hóa đơn VAT điện tử nhanh chóng',
          ctaSubtitle: 'Chính sách ưu đãi doanh nghiệp và giảm giá cho kỳ lưu trú dài ngày',
          ctaButtonText: 'Đặt phòng công tác ngay',
          ctaButtonLink: '#rooms',
        },
      },
      {
        type: 'CONTACT',
        name: 'Bộ phận tiếp đón doanh nghiệp',
        isEnabled: true,
        config: {
          contactTitle: 'Liên hệ tư vấn phòng đoàn & Khách công ty',
        },
      },
    ],
  },
  {
    id: 'heritage-manor',
    name: 'Ancient Heritage & Classic Manor',
    tagline: 'Hoài niệm di sản, kiến trúc cổ & Nét đẹp Á Đông',
    description: 'Tone màu đỏ chu sa và đồng cổ ấm nồng, hòa quyện kiến trúc di sản văn hóa cổ kính, mang đến chiều sâu cảm xúc cho du khách.',
    badge: 'Nét Đẹp Di Sản',
    badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    category: 'HERITAGE',
    previewGradient: 'from-red-900 via-amber-950 to-stone-950',
    recommendedFor: 'Khách sạn phố cổ Hội An, Huế, Phố cổ Hà Nội, Biệt thự cổ',
    style: {
      primaryColor: '#991B1B',
      secondaryColor: '#B91C1C',
      accentColor: '#D97706',
      buttonColor: '#3F2E23',
      headingColor: '#3F2E23',
      fontFamily: 'Inter',
      headingFont: 'Playfair Display',
    },
    blocks: [
      {
        type: 'HERO',
        name: 'Hero Hoài Niệm Di Sản',
        isEnabled: true,
        config: {
          heroTitle: '',
          heroSubtitle: 'Đắm mình trong không gian kiến trúc truyền thống và bản sắc văn hóa ngàn năm',
          heroCtaText: 'Khám phá chốn dừng chân',
          heroCtaLink: '#rooms',
          showSearchBar: true,
        },
      },
      {
        type: 'ABOUT',
        name: 'Dấu ấn lịch sử & Văn hóa',
        isEnabled: true,
        config: {
          aboutTitle: 'Ngôi nhà mang đậm dấu ấn thời gian',
          aboutContent: 'Từng viên gạch, cột gỗ và họa tiết chạm trổ đều gìn giữ trọn vẹn nét đẹp cổ điển xưa. Chúng tôi trân trọng đón tiếp quý khách bằng sự chân tình và phong vị truyền thống nồng hậu.',
        },
      },
      {
        type: 'ROOMS',
        name: 'Phòng mang phong cách Đông Dương',
        isEnabled: true,
        config: {
          roomsTitle: 'Hạng phòng cổ kính & Tĩnh tại',
          roomsDisplay: 'grid',
          roomsLimit: 4,
        },
      },
      {
        type: 'RESTAURANT_MENU',
        name: 'Ẩm thực truyền thống cung đình',
        isEnabled: true,
        config: {
          menuTitle: 'Hương vị ẩm thực truyền thống',
          menuNote: 'Món ngon mang đậm bản sắc vùng miền từ nghệ nhân xưa',
        },
      },
      {
        type: 'GALLERY',
        name: 'Bộ ảnh nét đẹp hoài cổ',
        isEnabled: true,
        config: {
          galleryTitle: 'Khoảnh khắc thời gian ngưng đọng',
          galleryColumns: 3,
        },
      },
      {
        type: 'REVIEWS',
        name: 'Cảm xúc của du khách văn hóa',
        isEnabled: true,
        config: {
          reviewsTitle: 'Những dòng cảm xúc của lữ khách',
          reviewsLimit: 4,
        },
      },
      {
        type: 'MAP',
        name: 'Bản đồ phố cổ',
        isEnabled: true,
        config: {
          mapAddress: '',
          mapZoom: 16,
        },
      },
      {
        type: 'CONTACT',
        name: 'Liên hệ đón tiếp',
        isEnabled: true,
        config: {
          contactTitle: 'Liên hệ đón tiếp & Đặt phòng hoài cổ',
        },
      },
    ],
  },
]

