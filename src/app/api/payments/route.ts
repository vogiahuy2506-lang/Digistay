import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const createPaymentSchema = z.object({
  bookingId: z.string(),
  method: z.enum(['BANK_TRANSFER', 'QR_VIETQR', 'CARD', 'CREDIT_CARD', 'E_WALLET', 'CASH']),
  amount: z.number().positive(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    
    const bookingId = searchParams.get('bookingId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const where: any = {}
    if (bookingId) {
      where.bookingId = bookingId
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            bookingCode: true,
            guestName: true,
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: payments })
  } catch (error) {
    console.error('Get payments error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách thanh toán' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()

    const validation = createPaymentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const { bookingId, method, amount } = validation.data

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            bankAccounts: {
              where: { isActive: true, qrEnabled: true },
              take: 1,
            },
            workspace: {
              select: {
                ownerId: true,
                members: {
                  where: { userId: session?.user?.id || '' },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session?.user?.id
    const isStaff = workspace.members.length > 0
    const isGuest = booking.guestEmail === session?.user?.email

    if (!isOwner && !isStaff && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không có quyền tạo thanh toán' }, { status: 403 })
    }

    // For QR payment, get bank info
    const bankAccount = booking.property.bankAccounts[0]
    const transferContent = `DS${booking.bookingCode}`

    // Calculate fees (for card payments)
    let fee = 0
    let netAmount = amount
    if (['CARD', 'CREDIT_CARD'].includes(method)) {
      fee = Math.round(amount * 0.029) // 2.9% fee
      netAmount = amount - fee
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        propertyId: booking.propertyId,
        amount,
        fee,
        netAmount,
        method,
        status: method === 'CASH' ? 'PAID' : 'PENDING',
        bankCode: bankAccount?.bankCode,
        bankAccount: bankAccount?.accountNumber,
        accountHolder: bankAccount?.accountHolder,
        transferContent,
        paidAt: method === 'CASH' ? new Date() : null,
        expiresAt,
      },
    })

    // If cash payment, update booking
    if (method === 'CASH') {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'PAID',
          status: booking.status === 'PENDING' ? 'CONFIRMED' : booking.status,
        },
      })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session?.user?.id,
        propertyId: booking.propertyId,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: payment.id,
        metadata: { bookingCode: booking.bookingCode, method },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...payment,
        bankAccount,
      },
      message: 'Tạo thanh toán thành công',
    })
  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo thanh toán' }, { status: 500 })
  }
}
