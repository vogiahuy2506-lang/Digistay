import { describe, it, expect } from 'vitest'
import { generateHeuristicChatReply, formatKnowledgeDocument, type HotelKnowledgeBase } from './chatbot'

const MOCK_KB: HotelKnowledgeBase = {
  hotelName: 'Digistay Seaside Resort',
  address: '123 Đường Trần Phú, Phường Lộc Thọ, Thành phố Nha Trang',
  phone: '0901234567',
  email: 'stay@digistay.vn',
  description: 'Khu nghỉ dưỡng sát biển với bãi cát trắng và hồ bơi vô cực.',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  petsAllowed: false,
  smokingAllowed: false,
  childrenAllowed: true,
  cancellationPolicy: 'Miễn phí hủy trước 48 giờ',
  additionalRules: 'Giữ yên lặng sau 22:00',
  rooms: [
    { name: 'Deluxe Ocean View', area: 35, bedType: 'KING', maxOccupancy: 2, basePrice: 1200000 },
    { name: 'Family Suite', area: 55, bedType: 'DOUBLE', maxOccupancy: 4, basePrice: 2200000 },
  ],
  amenities: ['Hồ bơi vô cực', 'Wi-Fi miễn phí', 'Buffet sáng'],
  services: [
    { name: 'Đưa đón sân bay', price: 300000, unit: 'lượt', description: 'Xe 7 chỗ đời mới' },
  ],
  menuItems: [
    { name: 'Phở bò Wagyu', category: 'Ăn sáng', price: 150000, description: 'Bò Wagyu thượng hạng' },
  ],
  blogs: [
    { title: 'Top 5 điểm ngắm hoàng hôn đẹp nhất Nha Trang', summary: 'Gợi ý các bãi biển và quán cafe lãng mạn' },
  ],
}

describe('Hotel AI Chatbot Grounding & Logic', () => {
  it('formats knowledge base into structured markdown text', () => {
    const doc = formatKnowledgeDocument(MOCK_KB)
    expect(doc).toContain('# TÀI LIỆU DỮ LIỆU KHÁCH SẠN: Digistay Seaside Resort')
    expect(doc).toContain('14:00')
    expect(doc).toContain('12:00')
    expect(doc).toContain('KHÔNG ĐƯỢC PHÉP mang theo vật nuôi')
    expect(doc).toContain('Deluxe Ocean View')
    expect(doc).toContain('Phở bò Wagyu')
  })

  it('accurately answers check-in and check-out questions', () => {
    const resVi = generateHeuristicChatReply(MOCK_KB, 'Khách sạn mấy giờ nhận phòng và trả phòng vậy?', false)
    expect(resVi.reply).toContain('14:00')
    expect(resVi.reply).toContain('12:00')
    expect(resVi.suggestions.length).toBeGreaterThan(0)

    const resEn = generateHeuristicChatReply(MOCK_KB, 'What is the check in time?', true)
    expect(resEn.reply).toContain('14:00')
    expect(resEn.reply).toContain('12:00')
  })

  it('accurately answers pet policy questions based on property settings', () => {
    const resForbidden = generateHeuristicChatReply(MOCK_KB, 'Có được mang chó mèo vào phòng không?', false)
    expect(resForbidden.reply).toContain('chưa cho phép mang thú cưng')

    const allowedKb: HotelKnowledgeBase = { ...MOCK_KB, petsAllowed: true }
    const resAllowed = generateHeuristicChatReply(allowedKb, 'Can I bring my pet dog?', true)
    expect(resAllowed.reply).toContain('pets are warmly welcomed')
  })

  it('accurately provides dining and menu information', () => {
    const res = generateHeuristicChatReply(MOCK_KB, 'Khách sạn có phục vụ món ăn hay ăn sáng gì không?', false)
    expect(res.reply).toContain('Phở bò Wagyu')
    expect(res.reply).toContain('150.000 VNĐ')
  })

  it('accurately provides hotel address and contact details', () => {
    const res = generateHeuristicChatReply(MOCK_KB, 'Địa chỉ khách sạn ở đâu vậy bạn?', false)
    expect(res.reply).toContain('123 Đường Trần Phú')
    expect(res.reply).toContain('0901234567')
  })

  it('accurately lists room types and prices', () => {
    const res = generateHeuristicChatReply(MOCK_KB, 'Khách sạn có những loại phòng nào và giá bao nhiêu?', false)
    expect(res.reply).toContain('Deluxe Ocean View')
    expect(res.reply).toContain('Family Suite')
  })

  it('provides polite fallback when online booking is not available or paused', () => {
    const pausedReply = `Dạ hiện khách sạn chưa mở nhận đặt trực tuyến qua website, quý khách vui lòng liên hệ hotline: **${MOCK_KB.phone}** để được phục vụ chu đáo nhất ạ!`
    expect(pausedReply).toContain('chưa mở nhận đặt trực tuyến qua website')
    expect(pausedReply).toContain(MOCK_KB.phone)
  })
})

