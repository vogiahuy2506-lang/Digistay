/**
 * Hotel Website AI Studio Engine (Digistay Stitch-like AI Builder)
 * Provides Prompt-to-Website generation, block remixing, real-time in-line copywriting,
 * and 1-click professional English translations for hospitality websites.
 */
import { prisma } from '@/lib/db'
import { loadSiteProps } from '@/lib/public-site/site'
import { getEffectiveSetting, GeminiSettings } from '@/lib/admin/platform-settings'
import { DEFAULT_GEMINI_MODEL } from './content-generator'
import {
  WebsiteThemeConfig,
  GeneratedWebsiteBlock,
  GeneratedWebsiteResult,
  THEME_PRESETS,
} from './website-theme-presets'

export type {
  WebsiteThemeConfig,
  GeneratedWebsiteBlock,
  GeneratedWebsiteResult,
}
export { THEME_PRESETS }

/**
 * Resolves active Gemini API key from database platform settings or environment variables.
 */
async function resolveGeminiKey(): Promise<string> {
  const db = await getEffectiveSetting<GeminiSettings>('gemini')
  return db?.apiKey || process.env.GEMINI_API_KEY || ''
}

/**
 * Generates heuristic website content using property database as high-fidelity ground truth.
 */
function generateHeuristicWebsite(property: any, prompt?: string, stylePreset = 'luxury_boutique'): GeneratedWebsiteResult {
  const theme = THEME_PRESETS[stylePreset] || THEME_PRESETS.luxury_boutique
  const name = property.name || 'Digistay Hotel & Resort'
  const address = property.address || 'Việt Nam'
  const photos = property.media?.map((m: any) => m.url) || []
  const coverPhoto = photos[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=80'
  const roomPhotos = photos.slice(1, 5)

  const heroTitleVi = `Chào Mừng Đến Với ${name}`
  const heroSubtitleVi = `Không gian nghỉ dưỡng thanh lịch tại ${address}. Đặt phòng trực tiếp để nhận ưu đãi giá tốt nhất cùng dịch vụ tận tâm.`
  const heroTitleEn = `Welcome to ${name}`
  const heroSubtitleEn = `An elegant retreat in ${address}. Book direct for exclusive best-rate guarantee and heartfelt hospitality.`

  const aboutTitleVi = `Câu Chuyện Về ${name}`
  const aboutDescVi = `${name} tọa lạc tại ${address}, nơi hòa quyện hoàn hảo giữa phong cách thiết kế tinh tế và thiên nhiên trong lành. Chúng tôi cam kết mang lại kỳ nghỉ trọn vẹn với sự thư thái, ẩm thực tinh hoa và tiện nghi phòng nghỉ chuẩn mực.`
  const aboutTitleEn = `The Story of ${name}`
  const aboutDescEn = `Located at ${address}, ${name} is a serene haven blending contemporary aesthetics with warm hospitality. We are dedicated to crafting memorable stays with revitalizing wellness, exquisite dining, and attentive care.`

  const blocks: GeneratedWebsiteBlock[] = [
    {
      type: 'HERO',
      name: 'Hero Banner',
      layoutVariant: 'fullscreen_search',
      sortOrder: 0,
      isEnabled: true,
      config: {
        heroTitle: heroTitleVi,
        heroSubtitle: heroSubtitleVi,
        heroImage: coverPhoto,
        badgeText: 'Cam kết giá tốt nhất khi đặt trực tiếp',
        ctaPrimaryText: 'Khám phá phòng',
        ctaSecondaryText: 'Liên hệ tư vấn',
        showSearchBar: true,
      },
    },
    {
      type: 'ABOUT',
      name: 'Giới thiệu',
      layoutVariant: 'story_split',
      sortOrder: 1,
      isEnabled: true,
      config: {
        title: aboutTitleVi,
        description: aboutDescVi,
        image: photos[1] || coverPhoto,
        highlights: [
          'Vị trí đắc địa, thuận tiện di chuyển',
          'Thiết kế kiến trúc hài hòa, tinh tế',
          'Dịch vụ lễ tân & hỗ trợ chu đáo 24/7',
          'Ẩm thực phong vị địa phương đặc sắc',
        ],
      },
    },
    {
      type: 'ROOMS',
      name: 'Hạng phòng nghỉ',
      layoutVariant: 'cards_grid',
      sortOrder: 2,
      isEnabled: true,
      config: {
        title: 'Hạng Phòng & Suites',
        subtitle: 'Mỗi căn phòng là một không gian nghỉ ngơi thư thái với tầm nhìn thoáng đãng và nội thất cao cấp',
        showPrice: true,
        showBookingButton: true,
      },
    },
    {
      type: 'AMENITIES',
      name: 'Tiện ích nổi bật',
      layoutVariant: 'icon_grid',
      sortOrder: 3,
      isEnabled: true,
      config: {
        title: 'Tiện Ích & Dịch Vụ',
        subtitle: 'Trải nghiệm những đặc quyền thư giãn tối đa trong suốt kỳ nghỉ của bạn',
        items: [
          { icon: 'wifi', name: 'Wi-Fi tốc độ cao', desc: 'Phủ sóng toàn bộ khuôn viên' },
          { icon: 'coffee', name: 'Bữa sáng & Cafe', desc: 'Thực đơn chọn lọc tươi ngon mỗi ngày' },
          { icon: 'sparkles', name: 'Dọn phòng hàng ngày', desc: 'Không gian luôn sạch sẽ, thơm tho' },
          { icon: 'shield', name: 'An ninh 24/7', desc: 'Bảo vệ & camera an toàn tuyệt đối' },
        ],
      },
    },
    {
      type: 'GALLERY',
      name: 'Thư viện ảnh',
      layoutVariant: 'masonry',
      sortOrder: 4,
      isEnabled: true,
      config: {
        title: 'Khoảnh Khắc Đáng Nhớ',
        subtitle: 'Góc nhìn chân thực về không gian và cảnh quan tại cơ sở',
        images: roomPhotos.length > 0 ? roomPhotos : [coverPhoto],
      },
    },
    {
      type: 'REVIEWS',
      name: 'Đánh giá khách hàng',
      layoutVariant: 'quote_carousel',
      sortOrder: 5,
      isEnabled: true,
      config: {
        title: 'Cảm Nhận Từ Khách Lưu Trú',
        subtitle: 'Những chia sẻ chân thành từ những vị khách đã đồng hành cùng chúng tôi',
        reviews: [
          { author: 'Chị Mai Anh (Hà Nội)', rating: 5, text: 'Phòng ốc sạch sẽ vượt kỳ vọng, nhân viên hỗ trợ nhiệt tình từ lúc check-in đến tận khi ra về.' },
          { author: 'Anh Tuấn Minh (TP.HCM)', rating: 5, text: 'Không gian yên bình, giường nằm êm ái, kỳ nghỉ gia đình rất trọn vẹn và đáng nhớ.' },
        ],
      },
    },
    {
      type: 'CTA',
      name: 'Kêu gọi đặt phòng',
      layoutVariant: 'banner_accent',
      sortOrder: 6,
      isEnabled: true,
      config: {
        title: 'Sẵn Sàng Cho Kỳ Nghỉ Đáng Nhớ?',
        subtitle: 'Đặt phòng trực tiếp ngay hôm nay để nhận ưu đãi tốt nhất và nước uống chào đón miễn phí.',
        buttonText: 'Đặt phòng ngay',
      },
    },
    {
      type: 'CONTACT',
      name: 'Liên hệ & Bản đồ',
      layoutVariant: 'split_map',
      sortOrder: 7,
      isEnabled: true,
      config: {
        title: 'Liên Hệ & Vị Trí',
        address,
        hotline: property.hotline || '0909 000 000',
        email: property.email || 'hotro@digistay.vn',
      },
    },
    {
      type: 'FOOTER',
      name: 'Chân trang',
      layoutVariant: 'simple_dark',
      sortOrder: 8,
      isEnabled: true,
      config: {
        copyright: `© ${new Date().getFullYear()} ${name}. All rights reserved. Powered by Digistay.`,
      },
    },
  ]

  return {
    theme,
    seo: {
      metaTitle: `${name} | Khách Sạn & Resort Nghỉ Dưỡng ${address}`,
      metaDescription: `Đặt phòng trực tiếp tại ${name} để nhận giá tốt nhất. Trải nghiệm dịch vụ chuyên nghiệp, tiện nghi chuẩn mực tại ${address}.`,
      metaKeywords: `${name}, khách sạn ${address}, đặt phòng ${name}, homestay ${name}`,
    },
    blocks,
    translations: {
      en: {
        metaTitle: `${name} | Boutique Stay & Resort in ${address}`,
        metaDescription: `Book direct at ${name} for the best rates. Enjoy peaceful stays, premium amenities, and dedicated service in ${address}.`,
        blocks: {
          HERO: { heroTitle: heroTitleEn, heroSubtitle: heroSubtitleEn, badgeText: 'Best Rate Guaranteed When Booking Direct', ctaPrimaryText: 'Explore Rooms', ctaSecondaryText: 'Contact Us' },
          ABOUT: { title: aboutTitleEn, description: aboutDescEn },
          ROOMS: { title: 'Rooms & Suites', subtitle: 'Each room is a serene sanctuary with scenic views and premium comfort' },
          AMENITIES: { title: 'Amenities & Services', subtitle: 'Crafted experiences for your utmost relaxation throughout your stay' },
          CTA: { title: 'Ready For An Unforgettable Stay?', subtitle: 'Book direct today for exclusive perks and complimentary welcome drinks.', buttonText: 'Book Your Stay' },
          CONTACT: { title: 'Contact & Location' },
        },
      },
    },
  }
}

/**
 * Builds the LLM prompt for full website synthesis adhering to hospitality best practices.
 */
function buildFullSitePrompt(property: any, userPrompt?: string, stylePreset = 'luxury_boutique'): string {
  const rooms = property.roomTypes?.map((r: any) => `${r.name} (${r.price ? `${r.price.toLocaleString('vi-VN')} đ` : 'Liên hệ'})`).join(', ') || 'Nhiều hạng phòng'
  const amenities = property.amenities?.map((a: any) => a.name).join(', ') || 'Wi-Fi, Điều hòa, Bữa sáng'

  return `Bạn là Giám đốc Nghệ thuật & Chuyên gia Copywriting hàng đầu thế giới về Thiết kế Website Khách sạn & Khu nghỉ dưỡng (Hospitality Web Design & Conversion Rate Optimization).

NHIỆM VỤ: Hãy tạo một bản thiết kế website khách sạn hoàn chỉnh, quyến rũ, chuẩn SEO và tối ưu chuyển đổi đặt phòng trực tiếp theo phong cách "${stylePreset}".

THÔNG TIN KHÁCH SẠN HIỆN CÓ:
- Tên khách sạn: "${property.name}"
- Địa chỉ: "${property.address || 'Việt Nam'}"
- Loại hình: "${property.propertyType || 'Khách sạn / Resort'}"
- Hạng phòng: ${rooms}
- Tiện ích: ${amenities}
- Yêu cầu bổ sung của chủ khách sạn: "${userPrompt || 'Tạo website sang trọng, ấm cúng và đầy đủ các khu vực chính.'}"

YÊU CẦU ĐẦU RA JSON TUÂN THỦ:
{
  "theme": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "buttonColor": "#hex",
    "headingColor": "#hex",
    "backgroundColor": "#hex",
    "fontFamily": "Inter | Plus Jakarta Sans | Be Vietnam Pro",
    "headingFont": "Playfair Display | Merriweather | Cinzel",
    "themePreset": "${stylePreset}",
    "layout": "modern"
  },
  "seo": {
    "metaTitle": "Tiêu đề SEO 55-65 ký tự hấp dẫn",
    "metaDescription": "Mô tả SEO 140-160 ký tự cuốn hút",
    "metaKeywords": "từ khóa 1, từ khóa 2, ..."
  },
  "blocks": [
    {
      "type": "HERO",
      "name": "Hero Banner",
      "layoutVariant": "fullscreen_search | split_headline | minimal_center",
      "sortOrder": 0,
      "isEnabled": true,
      "config": {
        "heroTitle": "Tiêu đề Hero giàu cảm xúc",
        "heroSubtitle": "Mô tả ngắn cuốn hút nêu rõ vị trí và lý do nên chọn",
        "badgeText": "Ưu đãi đặt trực tiếp",
        "ctaPrimaryText": "Xem phòng & Giá",
        "ctaSecondaryText": "Khám phá tiện ích",
        "showSearchBar": true
      }
    },
    {
      "type": "ABOUT",
      "name": "Câu chuyện thương hiệu",
      "layoutVariant": "story_split | centered_narrative",
      "sortOrder": 1,
      "isEnabled": true,
      "config": {
        "title": "Tiêu đề phần Giới thiệu",
        "description": "Câu chuyện khách sạn viết chân thực, ấm cúng, 2-3 đoạn văn tinh tế",
        "highlights": ["Điểm nổi bật 1", "Điểm nổi bật 2", "Điểm nổi bật 3", "Điểm nổi bật 4"]
      }
    },
    {
      "type": "ROOMS",
      "name": "Hạng phòng nghỉ",
      "layoutVariant": "cards_grid | horizontal_list",
      "sortOrder": 2,
      "isEnabled": true,
      "config": {
        "title": "Hạng Phòng Nghỉ Dưỡng",
        "subtitle": "Mô tả ngắn về không gian và trải nghiệm phòng",
        "showPrice": true,
        "showBookingButton": true
      }
    },
    {
      "type": "AMENITIES",
      "name": "Tiện ích & Dịch vụ",
      "layoutVariant": "icon_grid | cards_3col",
      "sortOrder": 3,
      "isEnabled": true,
      "config": {
        "title": "Tiện Ích Nổi Bật",
        "subtitle": "Đặc quyền dành riêng cho khách lưu trú",
        "items": [
          {"icon": "wifi", "name": "Tên tiện ích 1", "desc": "Mô tả ngắn"},
          {"icon": "coffee", "name": "Tên tiện ích 2", "desc": "Mô tả ngắn"},
          {"icon": "sparkles", "name": "Tên tiện ích 3", "desc": "Mô tả ngắn"},
          {"icon": "shield", "name": "Tên tiện ích 4", "desc": "Mô tả ngắn"}
        ]
      }
    },
    {
      "type": "REVIEWS",
      "name": "Đánh giá của khách",
      "layoutVariant": "quote_carousel | masonry_cards",
      "sortOrder": 4,
      "isEnabled": true,
      "config": {
        "title": "Khách Hàng Nói Về Chúng Tôi",
        "subtitle": "Cảm nhận chân thực từ những chuyến đi",
        "reviews": [
          {"author": "Khách A", "rating": 5, "text": "Đánh giá cảm xúc thật"},
          {"author": "Khách B", "rating": 5, "text": "Đánh giá cảm xúc thật"}
        ]
      }
    },
    {
      "type": "CTA",
      "name": "Kêu gọi hành động",
      "layoutVariant": "banner_accent | box_framed",
      "sortOrder": 5,
      "isEnabled": true,
      "config": {
        "title": "Tiêu đề kêu gọi đặt phòng",
        "subtitle": "Lý do đặt ngay hôm nay",
        "buttonText": "Đặt phòng ngay"
      }
    },
    {
      "type": "CONTACT",
      "name": "Liên hệ & Bản đồ",
      "layoutVariant": "split_map",
      "sortOrder": 6,
      "isEnabled": true,
      "config": {
        "title": "Liên Hệ & Chỉ Đường"
      }
    },
    {
      "type": "FOOTER",
      "name": "Chân trang",
      "layoutVariant": "simple_dark",
      "sortOrder": 7,
      "isEnabled": true,
      "config": {
        "copyright": "© Bản quyền thuộc về khách sạn. Nền tảng Digistay."
      }
    }
  ],
  "translations": {
    "en": {
      "metaTitle": "English SEO Title",
      "metaDescription": "English SEO Description",
      "blocks": {
        "HERO": {"heroTitle": "English Hero Title", "heroSubtitle": "English Hero Subtitle", "ctaPrimaryText": "Explore Rooms"},
        "ABOUT": {"title": "English About Title", "description": "English About Story"},
        "ROOMS": {"title": "Rooms & Suites", "subtitle": "English subtitle"},
        "AMENITIES": {"title": "Amenities", "subtitle": "English subtitle"},
        "CTA": {"title": "Ready for your getaway?", "buttonText": "Book Direct"}
      }
    }
  }
}
Chỉ trả về JSON thuần túy, không thêm bất kỳ văn bản nào ngoài JSON.`
}

/**
 * Main generator: invokes Gemini API with fallback to heuristic generator.
 */
export async function generateFullWebsiteSiteWithAi(input: {
  propertyId: string
  prompt?: string
  stylePreset?: string
}): Promise<GeneratedWebsiteResult> {
  const site = await loadSiteProps(input.propertyId)
  if (!site) throw new Error('Không tìm thấy cơ sở lưu trú')

  const property = {
    ...site.property,
    roomTypes: site.roomTypes,
    amenities: site.amenities,
    media: site.images,
  }

  const apiKey = await resolveGeminiKey()
  if (!apiKey) {
    return generateHeuristicWebsite(property, input.prompt, input.stylePreset)
  }

  try {
    const fullPrompt = buildFullSitePrompt(property, input.prompt, input.stylePreset)
    const targetModel = DEFAULT_GEMINI_MODEL || 'gemini-2.5-flash'
    const candidateModels = Array.from(new Set([targetModel, 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']))

    for (const m of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      })

      if (!response.ok) {
        if (response.status === 404 && m !== candidateModels[candidateModels.length - 1]) continue
        break
      }

      const json = await response.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        const parsed = JSON.parse(text)
        if (parsed.theme && parsed.blocks) {
          // Merge photos from property if not populated
          const photos = property.media?.map((med: any) => med.url) || []
          if (photos.length > 0) {
            for (const b of parsed.blocks) {
              if (b.type === 'HERO' && !b.config.heroImage) b.config.heroImage = photos[0]
              if (b.type === 'ABOUT' && !b.config.image) b.config.image = photos[1] || photos[0]
              if (b.type === 'GALLERY' && (!b.config.images || b.config.images.length === 0)) b.config.images = photos.slice(1, 6)
            }
          }
          return parsed as GeneratedWebsiteResult
        }
      }
    }
  } catch (err) {
    console.warn('[Website AI Studio] Gemini generation failed, falling back to heuristic:', err)
  }

  return generateHeuristicWebsite(property, input.prompt, input.stylePreset)
}

/**
 * Remixes a single block to provide 3 creative layout and copy variations.
 */
export async function remixWebsiteBlockWithAi(input: {
  blockType: string
  currentConfig: Record<string, any>
  propertyName: string
  prompt?: string
}): Promise<Array<{ layoutVariant: string; title: string; config: Record<string, any> }>> {
  const type = input.blockType.toUpperCase()
  const name = input.propertyName || 'Khách sạn'

  // Pre-configured creative variants for instant responsive UI
  if (type === 'HERO') {
    return [
      {
        layoutVariant: 'fullscreen_search',
        title: 'Toàn Màn Hình + Thanh Tìm Phòng Nổi',
        config: {
          ...input.currentConfig,
          heroTitle: `Kỳ Nghỉ Thư Thái Tại ${name}`,
          heroSubtitle: 'Thưởng ngoạn cảnh sắc thiên nhiên tuyệt mỹ với dịch vụ hiếu khách tận tâm.',
          badgeText: 'Ưu đãi đặt trực tiếp: Tặng đồ uống & Check-in sớm',
          showSearchBar: true,
        },
      },
      {
        layoutVariant: 'split_headline',
        title: 'Bố Cục 2 Cột (Nội Dung Bên Trái, Ảnh Nghệ Thuật Bên Phải)',
        config: {
          ...input.currentConfig,
          heroTitle: `Nơi Tìm Về Sự An Yên & Sang Trọng`,
          heroSubtitle: `Tận hưởng không gian thanh lịch cùng ẩm thực đặc sắc tại ${name}.`,
          badgeText: 'Đảm bảo giá tốt nhất 100%',
          showSearchBar: false,
        },
      },
      {
        layoutVariant: 'minimal_center',
        title: 'Tối Giản Hiện Đại (Căn Giữa Tinh Tế)',
        config: {
          ...input.currentConfig,
          heroTitle: name,
          heroSubtitle: 'Chốn dừng chân lý tưởng cho những tâm hồn yêu sự bình yên và tinh tế.',
          badgeText: 'Trải nghiệm khác biệt',
          showSearchBar: true,
        },
      },
    ]
  }

  if (type === 'ABOUT') {
    return [
      {
        layoutVariant: 'story_split',
        title: 'Kể Chuyện 2 Cột Kèm Điểm Nhấn',
        config: {
          ...input.currentConfig,
          title: `Hành Trình Kiến Tạo ${name}`,
          description: `Chúng tôi tin rằng mỗi chuyến đi không chỉ là việc đổi một nơi ngủ, mà là cơ hội tái tạo năng lượng và trải nghiệm văn hóa bản địa chân thực.`,
          highlights: ['Kiến trúc độc bản', 'Nguyên liệu ẩm thực hữu cơ', 'Chăm sóc chu đáo từng chi tiết'],
        },
      },
      {
        layoutVariant: 'centered_narrative',
        title: 'Tâm Thư Căn Giữa Sâu Lắng',
        config: {
          ...input.currentConfig,
          title: 'Khơi Nguồn Cảm Hứng & Thư Giãn',
          description: `Từng góc nhỏ tại ${name} được bài trí với sự tỉ mỉ, đưa ánh sáng và gió trời tự nhiên vào không gian nghỉ dưỡng của bạn.`,
          highlights: ['Không gian biệt lập', 'Dịch vụ cá nhân hóa', 'Thân thiện môi trường'],
        },
      },
    ]
  }

  // Generic fallback remix
  return [
    {
      layoutVariant: 'cards_grid',
      title: 'Bố Cục Lưới Hiện Đại',
      config: { ...input.currentConfig },
    },
    {
      layoutVariant: 'carousel_slider',
      title: 'Bố Cục Thanh Trượt (Carousel)',
      config: { ...input.currentConfig },
    },
  ]
}

/**
 * Real-time In-line text refiner (Rewrite, Tone change, Shorten, English translate).
 */
export async function refineWebsiteTextWithAi(input: {
  text: string
  action: 'rewrite' | 'luxury' | 'shorten' | 'seo' | 'translate_en'
  context?: string
}): Promise<string> {
  const apiKey = await resolveGeminiKey()
  const text = input.text.trim()
  if (!text) return ''

  const instructions: Record<string, string> = {
    rewrite: 'Hãy viết lại đoạn văn bản này bằng tiếng Việt mượt mà, hấp dẫn và tự nhiên hơn cho website khách sạn/resort.',
    luxury: 'Hãy viết lại đoạn văn này theo văn phong cực kỳ sang trọng, tinh tế, đẳng cấp thượng lưu cho khách sạn boutique.',
    shorten: 'Hãy rút ngắn đoạn văn này thành 1 câu đắt giá, súc tích và dễ nhớ.',
    seo: 'Hãy tối ưu đoạn văn này chứa các từ khóa tự nhiên về du lịch, lưu trú và đặt phòng khách sạn.',
    translate_en: 'Translate this hotel copywriting into natural, compelling, native hospitality English.',
  }

  if (!apiKey) {
    if (input.action === 'shorten') return text.slice(0, 100) + '…'
    if (input.action === 'luxury') return `Đặc quyền tận hưởng không gian nghỉ dưỡng tinh hoa: ${text}`
    if (input.action === 'translate_en') return `Experience unforgettable hospitality: ${text}`
    return text
  }

  try {
    const prompt = `${instructions[input.action] || instructions.rewrite}\n\nĐoạn văn gốc: "${text}"\nChỉ trả về nội dung kết quả sau khi viết lại, không giải thích gì thêm.`
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    if (res.ok) {
      const json = await res.json()
      const result = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (result) return result.replace(/^["']|["']$/g, '')
    }
  } catch (err) {
    console.warn('[Website Text AI] Refine error:', err)
  }

  return text
}
