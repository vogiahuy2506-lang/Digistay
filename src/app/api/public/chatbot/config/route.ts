import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId')
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy thông tin cơ sở' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        isEnabled: true,
        botName: `Lễ tân ảo ${property.name}`,
        welcomeMessageVi: `Xin chào quý khách! Em là Trợ lý AI của ${property.name}. Em có thể giải đáp tự động 24/7 về giờ check-in, thực đơn, quy định thú cưng hoặc thông tin các hạng phòng. Quý khách cần hỗ trợ gì ạ?`,
        welcomeMessageEn: `Welcome to ${property.name}! I am your 24/7 AI Reception Assistant. How can I assist you with your stay today?`,
        suggestedQuestionsVi: [
          'Giờ check-in và check-out?',
          'Khách sạn có cho mang thú cưng không?',
          'Thực đơn ăn uống và ăn sáng?',
          'Khách sạn có những hạng phòng nào?',
        ],
        suggestedQuestionsEn: [
          'Check-in and check-out hours?',
          'Are pets allowed?',
          'Available room types and prices?',
          'Dining and breakfast options?',
        ],
      },
    })
  } catch (error) {
    console.error('[Public Chatbot Config Error]:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tải cấu hình chatbot' }, { status: 500 })
  }
}

