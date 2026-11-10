import { prisma } from '@/lib/db'
import { DEFAULT_GEMINI_MODEL } from './content-generator'
import { parseStayDatesFromText, searchAvailableRoomsForChat, type ChatRoomCard } from './room-finder'

export type { ChatRoomCard }

export interface ChatbotMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface HotelKnowledgeBase {
  hotelName: string
  address: string
  phone: string
  email: string
  description: string
  checkInTime: string
  checkOutTime: string
  petsAllowed: boolean
  smokingAllowed: boolean
  childrenAllowed: boolean
  cancellationPolicy: string
  additionalRules: string
  rooms: { name: string; area: number | null; bedType: string; maxOccupancy: number; basePrice: number }[]
  amenities: string[]
  services: { name: string; price: number; unit: string; description: string }[]
  menuItems: { name: string; category: string; price: number; description: string }[]
  blogs: { title: string; summary: string }[]
}

/**
 * Loads and grounds hotel data into a structured knowledge base.
 */
export async function loadHotelKnowledgeBase(propertyId: string): Promise<HotelKnowledgeBase | null> {
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        policy: true,
        roomTypes: {
          where: { isActive: true },
          include: {
            pricing: { take: 1 },
          },
        },
        amenities: {
          include: { amenity: true },
        },
        extraServices: {
          where: { isActive: true },
        },
        menuItems: {
          where: { isAvailable: true },
        },
        blogPosts: {
          where: { isPublished: true, deletedAt: null },
          take: 5,
        },
      },
    })

    if (!property) return null

    const policy = property.policy
    const addressParts = [property.address, property.ward, property.district, property.city]
      .filter(Boolean)
      .join(', ')

    return {
      hotelName: property.name,
      address: addressParts || 'Việt Nam',
      phone: property.phone || 'Chưa cập nhật',
      email: property.email || 'Chưa cập nhật',
      description: property.description || '',
      checkInTime: policy?.checkInTime || '14:00',
      checkOutTime: policy?.checkOutTime || '12:00',
      petsAllowed: policy?.petsAllowed ?? false,
      smokingAllowed: policy?.smokingAllowed ?? false,
      childrenAllowed: policy?.childrenAllowed ?? true,
      cancellationPolicy: policy?.cancellationPolicy || (policy?.cancellationHours ? `Miễn phí hủy trước ${policy.cancellationHours} giờ` : 'Liên hệ để biết chi tiết'),
      additionalRules: policy?.additionalRules || '',
      rooms: property.roomTypes.map((rt) => ({
        name: rt.name,
        area: rt.area,
        bedType: rt.bedType,
        maxOccupancy: rt.maxOccupancy,
        basePrice: rt.pricing[0]?.weekdayPrice || 0,
      })),
      amenities: property.amenities.map((a) => a.customName || a.amenity.name),
      services: property.extraServices.map((s) => ({
        name: s.name,
        price: s.price,
        unit: s.perPerson ? 'người' : s.priceType === 'PER_NIGHT' ? 'đêm' : 'lượt',
        description: s.description || '',
      })),
      menuItems: property.menuItems.map((m) => ({
        name: m.name,
        category: m.category || 'Món ăn',
        price: m.price,
        description: m.description || '',
      })),
      blogs: property.blogPosts.map((b) => ({
        title: b.title,
        summary: b.summary || '',
      })),
    }
  } catch (err) {
    console.error('[loadHotelKnowledgeBase error]:', err)
    return null
  }
}

/**
 * Formats knowledge base into a concise grounding document for LLM.
 */
export function formatKnowledgeDocument(kb: HotelKnowledgeBase): string {
  const roomsText = kb.rooms.length > 0
    ? kb.rooms.map((r) => `- **${r.name}**: ${r.area ? `${r.area}m², ` : ''}giường ${r.bedType.toLowerCase()}, tối đa ${r.maxOccupancy} người. Giá từ ${r.basePrice.toLocaleString('vi-VN')} VNĐ/đêm.`).join('\n')
    : 'Đang cập nhật danh sách phòng.'

  const amenitiesText = kb.amenities.length > 0 ? kb.amenities.join(', ') : 'Wi-Fi miễn phí, dọn phòng hàng ngày.'

  const servicesText = kb.services.length > 0
    ? kb.services.map((s) => `- ${s.name}: ${s.price.toLocaleString('vi-VN')} VNĐ/${s.unit} ${s.description ? `(${s.description})` : ''}`).join('\n')
    : 'Có các dịch vụ hỗ trợ tại quầy lễ tân.'

  const menuText = kb.menuItems.length > 0
    ? kb.menuItems.slice(0, 10).map((m) => `- ${m.name} [${m.category}]: ${m.price.toLocaleString('vi-VN')} VNĐ`).join('\n')
    : 'Phục vụ ẩm thực theo yêu cầu.'

  const blogsText = kb.blogs.length > 0
    ? kb.blogs.map((b) => `- ${b.title}: ${b.summary}`).join('\n')
    : 'Nằm tại vị trí thuận tiện di chuyển tới các điểm du lịch nổi tiếng.'

  return `# TÀI LIỆU DỮ LIỆU KHÁCH SẠN: ${kb.hotelName}
- Địa chỉ: ${kb.address}
- Hotline hỗ trợ: ${kb.phone}
- Email: ${kb.email}
- Giới thiệu: ${kb.description || 'Chốn nghỉ dưỡng tiện nghi, ấm cúng.'}

## CHÍNH SÁCH VÀ NỘI QUY CƠ SỞ (RẤT QUAN TRỌNG)
- Giờ nhận phòng (Check-in): Từ ${kb.checkInTime} hàng ngày.
- Giờ trả phòng (Check-out): Trước ${kb.checkOutTime} hàng ngày.
- Quy định thú cưng: ${kb.petsAllowed ? 'ĐƯỢC PHÉP mang theo thú cưng.' : 'KHÔNG ĐƯỢC PHÉP mang theo vật nuôi / thú cưng.'}
- Quy định hút thuốc: ${kb.smokingAllowed ? 'Được phép hút thuốc tại các khu vực thoáng ngoài trời.' : 'CẤM HÚT THUỐC trong phòng ngủ và không gian kín của khách sạn.'}
- Quy định trẻ em: ${kb.childrenAllowed ? 'Chào đón trẻ em.' : 'Không tiếp nhận trẻ nhỏ.'}
- Chính sách hủy phòng: ${kb.cancellationPolicy}
${kb.additionalRules ? `- Lưu ý khác: ${kb.additionalRules}` : ''}

## DANH SÁCH HẠNG PHÒNG
${roomsText}

## TIỆN ÍCH NỔI BẬT
${amenitiesText}

## DỊCH VỤ GIA TĂNG (CÓ PHỤ THU)
${servicesText}

## THỰC ĐƠN ĂN UỐNG NỔI BẬT
${menuText}

## CẨM NĂNG & ĐIỂM THAM QUAN LÂN CẬN
${blogsText}`
}

/**
 * Intelligent Rule-Based Chatbot Response (Heuristic Engine).
 * Runs instantly without internet or when API Key is absent.
 */
export function generateHeuristicChatReply(kb: HotelKnowledgeBase, question: string, isEn: boolean): { reply: string; suggestions: string[] } {
  const q = question.toLowerCase()

  // 1. Check-in / Check-out
  if (
    q.includes('check-in') ||
    q.includes('checkin') ||
    q.includes('check in') ||
    q.includes('nhận phòng') ||
    q.includes('mấy giờ nhận') ||
    q.includes('check out') ||
    q.includes('checkout') ||
    q.includes('check-out') ||
    q.includes('trả phòng')
  ) {
    if (isEn) {
      return {
        reply: `Our check-in starts at **${kb.checkInTime}**, and check-out is before **${kb.checkOutTime}**. If you need an early check-in or late check-out, please contact our reception via **${kb.phone}**!`,
        suggestions: ['Pet policy?', 'Available room types?', 'Hotel address and location?'],
      }
    }
    return {
      reply: `Thời gian nhận phòng (Check-in) tại **${kb.hotelName}** bắt đầu từ **${kb.checkInTime}**, và giờ trả phòng (Check-out) là trước **${kb.checkOutTime}**. Nếu quý khách có nhu cầu nhận phòng sớm hoặc trả phòng trễ, xin vui lòng liên hệ hotline **${kb.phone}** để được hỗ trợ tốt nhất!`,
      suggestions: ['Khách sạn có cho mang thú cưng không?', 'Giá các hạng phòng?', 'Địa chỉ khách sạn ở đâu?'],
    }
  }

  // 2. Pets
  if (q.includes('thú cưng') || q.includes('chó') || q.includes('mèo') || q.includes('pet') || q.includes('động vật')) {
    if (isEn) {
      return {
        reply: kb.petsAllowed
          ? `Yes, pets are warmly welcomed at **${kb.hotelName}**! Please ensure they are well-behaved during your stay.`
          : `We apologize, but **${kb.hotelName}** has a strict **no-pet policy** to ensure hygiene and a quiet environment for all guests.`,
        suggestions: ['Check-in and check-out hours?', 'Available amenities?'],
      }
    }
    return {
      reply: kb.petsAllowed
        ? `Có ạ! **${kb.hotelName}** rất hoan nghênh quý khách mang theo thú cưng. Quý khách vui lòng giữ vệ sinh chung trong suốt kỳ nghỉ nhé!`
        : `Dạ rất tiếc, **${kb.hotelName}** hiện **chưa cho phép mang thú cưng** nhằm đảm bảo không gian yên tĩnh và tiêu chuẩn vệ sinh chung cho tất cả khách lưu trú ạ.`,
      suggestions: ['Giờ nhận và trả phòng?', 'Khách sạn có tiện ích gì?', 'Có được hút thuốc không?'],
    }
  }

  // 3. Smoking
  if (q.includes('hút thuốc') || q.includes('thuốc lá') || q.includes('smoke') || q.includes('smoking')) {
    if (isEn) {
      return {
        reply: kb.smokingAllowed
          ? `Smoking is permitted in designated outdoor areas only. Smoking inside guest rooms is prohibited.`
          : `**${kb.hotelName}** is a 100% non-smoking property inside all guest rooms and indoor areas to ensure fresh air for everyone.`,
        suggestions: ['Check-in time?', 'Pet policy?'],
      }
    }
    return {
      reply: kb.smokingAllowed
        ? `Quý khách có thể hút thuốc tại các khu vực ngoài trời được chỉ định. Vui lòng không hút thuốc bên trong phòng ngủ để đảm bảo an toàn phòng cháy chữa cháy ạ.`
        : `Dạ, **${kb.hotelName}** áp dụng quy định **nghiêm cấm hút thuốc** bên trong phòng nghỉ và toàn bộ khuôn viên kín nhằm mang lại bầu không khí trong lành nhất cho quý khách.`,
      suggestions: ['Quy định mang thú cưng?', 'Giờ nhận và trả phòng?'],
    }
  }

  // 4. Food / Menu / Breakfast
  if (q.includes('ăn sáng') || q.includes('thực đơn') || q.includes('món ăn') || q.includes('menu') || q.includes('nhà hàng') || q.includes('ăn uống') || q.includes('breakfast') || q.includes('food') || q.includes('dining')) {
    const dishes = kb.menuItems.slice(0, 4).map((m) => `• ${m.name} (${m.price.toLocaleString('vi-VN')} VNĐ)`).join('\n')
    if (isEn) {
      return {
        reply: kb.menuItems.length > 0
          ? `Here are some popular dining options available at **${kb.hotelName}**:\n${dishes}\n\nFeel free to ask our reception or room service upon arrival!`
          : `We offer dining services tailored to your needs. Please dial hotline **${kb.phone}** for the daily specials and breakfast options!`,
        suggestions: ['Room prices?', 'Check-in hours?'],
      }
    }
    return {
      reply: kb.menuItems.length > 0
        ? `Dạ, tại **${kb.hotelName}** có phục vụ các món ăn và đồ uống hấp dẫn như:\n${dishes}\n\nQuý khách có thể gọi món trực tiếp tại quầy hoặc yêu cầu phục vụ tại phòng ạ!`
        : `Dạ, khách sạn có phục vụ ăn uống theo nhu cầu của quý khách. Quý khách vui lòng liên hệ hotline **${kb.phone}** hoặc lễ tân khi nhận phòng để được phục vụ chu đáo nhất ạ!`,
      suggestions: ['Giờ nhận phòng?', 'Giá các hạng phòng?'],
    }
  }

  // 5. Address / Location
  if (q.includes('địa chỉ') || q.includes('ở đâu') || q.includes('vị trí') || q.includes('đường đi') || q.includes('address') || q.includes('location') || q.includes('where')) {
    if (isEn) {
      return {
        reply: `**${kb.hotelName}** is located at:\n📍 **${kb.address}**\nHotline: **${kb.phone}**\nEmail: **${kb.email}**\n\nWe look forward to welcoming you!`,
        suggestions: ['Check-in and check-out hours?', 'Available room types?'],
      }
    }
    return {
      reply: `Dạ, **${kb.hotelName}** tọa lạc tại địa chỉ:\n📍 **${kb.address}**\nHotline liên hệ: **${kb.phone}**\nEmail: **${kb.email}**\n\nKhách sạn rất hân hạnh được đón tiếp quý khách!`,
      suggestions: ['Giờ nhận và trả phòng?', 'Các hạng phòng còn trống?'],
    }
  }

  // 6. Rooms & Pricing
  if (q.includes('phòng') || q.includes('giá') || q.includes('bao nhiêu tiền') || q.includes('room') || q.includes('price') || q.includes('rate')) {
    const roomList = kb.rooms.map((r) => `• **${r.name}**: Tối đa ${r.maxOccupancy} người, giá từ **${r.basePrice.toLocaleString('vi-VN')} VNĐ**/đêm.`).join('\n')
    if (isEn) {
      return {
        reply: `Here are our current room options at **${kb.hotelName}**:\n${roomList}\n\nYou can book directly on our website or contact us at **${kb.phone}** for the best rates!`,
        suggestions: ['Check-in and check-out hours?', 'Pet policy?'],
      }
    }
    return {
      reply: `Dạ, hiện tại **${kb.hotelName}** có các hạng phòng tiêu chuẩn sau:\n${roomList}\n\nQuý khách có thể xem chi tiết và đặt phòng trực tiếp trên website để nhận giá ưu đãi nhất nhé!`,
      suggestions: ['Giờ nhận phòng?', 'Khách sạn có cho mang thú cưng không?'],
    }
  }

  // 7. Amenities / Pool / Wi-Fi
  if (q.includes('tiện ích') || q.includes('hồ bơi') || q.includes('bể bơi') || q.includes('wifi') || q.includes('dịch vụ') || q.includes('amenity') || q.includes('pool')) {
    if (isEn) {
      return {
        reply: `At **${kb.hotelName}**, guests enjoy high-speed Wi-Fi, daily housekeeping, and highlighted amenities including: **${kb.amenities.join(', ') || 'modern conveniences'}**.`,
        suggestions: ['Available room types?', 'Check-in time?'],
      }
    }
    return {
      reply: `Dạ, tại **${kb.hotelName}**, quý khách được sử dụng Wi-Fi tốc độ cao, dọn phòng hàng ngày cùng các tiện ích nổi bật: **${kb.amenities.join(', ') || 'đầy đủ tiện nghi hiện đại'}**.`,
      suggestions: ['Giá các hạng phòng?', 'Khách sạn có cho mang thú cưng không?'],
    }
  }

  // Default fallback
  if (isEn) {
    return {
      reply: `Thank you for reaching out to **${kb.hotelName}**! For detailed assistance or special requests, please contact our 24/7 front desk at **${kb.phone}** or via email **${kb.email}**.`,
      suggestions: ['Check-in & check-out times?', 'Are pets allowed?', 'Room prices?'],
    }
  }

  return {
    reply: `Cảm ơn quý khách đã quan tâm đến **${kb.hotelName}**! Để được tư vấn chi tiết hơn hoặc giải đáp các yêu cầu đặc biệt, quý khách có thể liên hệ trực tiếp với lễ tân trực 24/7 qua hotline **${kb.phone}** hoặc email **${kb.email}** nhé!`,
    suggestions: ['Giờ nhận và trả phòng?', 'Khách sạn có cho mang thú cưng không?', 'Giá các hạng phòng?'],
  }
}

/**
 * Main Hotel Chatbot Q&A Function.
 * Uses Google Gemini (gemini-3.1-flash-lite) grounded with the hotel's live database,
 * falling back gracefully to the heuristic knowledge engine.
 */
export async function answerHotelChatbotQuestion(params: {
  propertyId: string
  message: string
  history?: ChatbotMessage[]
  apiKey?: string
  model?: string
}): Promise<{ reply: string; suggestions?: string[]; roomCards?: ChatRoomCard[]; modelUsed: string }> {
  const kb = await loadHotelKnowledgeBase(params.propertyId)
  if (!kb) {
    return {
      reply: 'Xin lỗi quý khách, hệ thống chưa thể tải thông tin cơ sở lúc này. Vui lòng thử lại sau ít phút!',
      modelUsed: 'system-fallback',
    }
  }

  // Detect English question
  const isEn = /^[a-zA-Z0-9\s.,?!'"-]*$/.test(params.message) && (
    /\b(what|when|where|how|who|can|is|are|do|does|pet|check|room|price|cost|hotel)\b/i.test(params.message)
  )

  // Check if visitor is asking to find or book a room
  const parsedStay = parseStayDatesFromText(params.message)
  if (parsedStay.isRoomInquiry) {
    const { cards, isOnlineBookingPaused } = await searchAvailableRoomsForChat(params.propertyId, {
      checkIn: parsedStay.checkIn,
      checkOut: parsedStay.checkOut,
      adults: parsedStay.adults,
      children: parsedStay.children,
      locale: isEn ? 'en' : 'vi',
    })

    if (isOnlineBookingPaused) {
      const phone = kb.phone || 'hotline'
      const reply = isEn
        ? `Our hotel has not opened online booking on the website yet. Please contact our hotline at **${phone}** for the best assistance and room reservations!`
        : `Dạ hiện khách sạn chưa mở nhận đặt trực tuyến qua website, quý khách vui lòng liên hệ hotline: **${phone}** để được phục vụ chu đáo nhất ạ!`

      const suggestions = isEn
        ? ['What is the check-in time?', 'Are pets allowed?', 'Breakfast options?']
        : ['Giờ nhận và trả phòng?', 'Khách sạn có cho mang thú cưng không?', 'Thực đơn ăn uống?']

      return {
        reply,
        suggestions,
        modelUsed: 'live-inventory-assistant',
      }
    }

    if (cards.length > 0) {
      const checkInFormatted = parsedStay.checkIn.split('-').reverse().join('/')
      const checkOutFormatted = parsedStay.checkOut.split('-').reverse().join('/')

      const reply = isEn
        ? `I checked our live room inventory from **${checkInFormatted}** to **${checkOutFormatted}** for **${parsedStay.adults} adult(s)**${parsedStay.children > 0 ? ` and ${parsedStay.children} child(ren)` : ''}. We have **${cards.length} available room option(s)**:\n\nPlease tap **"Book this room"** below to reserve your room with instant confirmation!`
        : `Dạ em đã kiểm tra kho phòng trống theo thời gian thực từ ngày **${checkInFormatted}** đến **${checkOutFormatted}** cho **${parsedStay.adults} người lớn**${parsedStay.children > 0 ? ` và ${parsedStay.children} trẻ em` : ''}.\n\nKhách sạn hiện đang có **${cards.length} hạng phòng phù hợp** sẵn sàng phục vụ quý khách. Quý khách bấm **"Đặt phòng này"** ngay bên dưới để giữ phòng với giá tốt nhất nhé ạ!`

      const suggestions = isEn
        ? ['What is the check-in time?', 'Are pets allowed?', 'Breakfast options?']
        : ['Giờ nhận và trả phòng?', 'Khách sạn có cho mang thú cưng không?', 'Thực đơn ăn uống?']

      return {
        reply,
        suggestions,
        roomCards: cards,
        modelUsed: 'live-inventory-assistant',
      }
    } else if (parsedStay.hasExplicitDates) {
      const checkInFormatted = parsedStay.checkIn.split('-').reverse().join('/')
      const checkOutFormatted = parsedStay.checkOut.split('-').reverse().join('/')

      const reply = isEn
        ? `We are sorry! All rooms are fully booked from **${checkInFormatted}** to **${checkOutFormatted}** for ${parsedStay.adults} guest(s). Please try selecting different dates or contact our reception at **${kb.phone}** for priority waitlist assistance!`
        : `Dạ rất tiếc, trong khoảng thời gian từ ngày **${checkInFormatted}** đến **${checkOutFormatted}**, khách sạn hiện **đã hết phòng trống** phù hợp cho ${parsedStay.adults} người. Quý khách vui lòng thử chọn ngày lưu trú khác hoặc liên hệ hotline **${kb.phone}** để lễ tân kiểm tra hỗ trợ sắp xếp phòng nhé ạ!`

      const suggestions = isEn
        ? ['Hỏi ngày khác', 'Liên hệ lễ tân']
        : ['Giờ nhận và trả phòng?', 'Khách sạn có cho mang thú cưng không?']

      return {
        reply,
        suggestions,
        modelUsed: 'live-inventory-assistant',
      }
    }
  }

  const geminiKey = params.apiKey || process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const doc = formatKnowledgeDocument(kb)
      const systemInstruction = `Bạn là Trợ lý AI lễ tân ảo 24/7 của khách sạn "${kb.hotelName}".
Nhiệm vụ: Trả lời thân thiện, lịch thiệp, ngắn gọn (dưới 150 từ), chính xác các câu hỏi của khách hàng dựa HOÀN TOÀN vào tài liệu dữ liệu khách sạn được cung cấp dưới đây.

DỮ LIỆU KHÁCH SẠN:
${doc}

QUY TẮC BẮT BUỘC (ANTI-HALLUCINATION GUARDRAILS):
1. CHỈ trả lời dựa trên dữ liệu có trong tài liệu trên. Tuyệt đối KHÔNG bịa đặt thông tin không có trong tài liệu.
2. Nếu khách hỏi thông tin không có trong dữ liệu (ví dụ giá dịch vụ ngoài danh mục, thông tin ngoài khách sạn), hãy lịch sự trả lời rằng bạn chưa có thông tin này và gợi ý khách liên hệ lễ tân trực tiếp qua hotline ${kb.phone}.
3. Tự động nhận diện ngôn ngữ của khách và trả lời bằng ngôn ngữ tương ứng (${isEn ? 'Tiếng Anh' : 'Tiếng Việt'}).
4. Dùng xưng hô lịch thiệp: "Dạ, em chào quý khách...", "Dạ, tại ${kb.hotelName}..." (hoặc tiếng Anh "Hello! At ${kb.hotelName}...").`

      const promptMessages = (params.history || []).slice(-4).map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      }))

      promptMessages.push({
        role: 'user',
        parts: [{ text: params.message }],
      })

      const targetModel = params.model || DEFAULT_GEMINI_MODEL
      const candidateModels = Array.from(new Set([targetModel, 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-1.5-flash']))

      for (const m of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: promptMessages,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 500,
            },
          }),
        })

        if (!response.ok) {
          if (response.status === 404 && m !== candidateModels[candidateModels.length - 1]) {
            continue
          }
          break
        }

        const data = await response.json()
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (replyText) {
          const suggestions = isEn
            ? ['Check-in and check-out hours?', 'Pet policy?', 'Explore room types?']
            : ['Giờ nhận và trả phòng?', 'Quy định mang thú cưng?', 'Xem các hạng phòng?']

          return {
            reply: replyText.trim(),
            suggestions,
            modelUsed: m,
          }
        }
      }
    } catch (err) {
      console.warn('[AI Chatbot] Gemini call failed, falling back to heuristic engine:', err)
    }
  }

  // Fallback to Heuristic Engine
  const heuristic = generateHeuristicChatReply(kb, params.message, isEn)
  return {
    reply: heuristic.reply,
    suggestions: heuristic.suggestions,
    modelUsed: 'heuristic-engine-v1',
  }
}
