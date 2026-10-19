import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { WorkspaceRoles } from '@/lib/auth/rbac'

const createPaymentSchema = z.object({
  bookingId: z.string(),
  method: z.enum(['BANK_TRANSFER', 'QR_VIETQR', 'CARD', 'CREDIT_CARD', 'E_WALLET', 'CASH']),
  amount: z.number().positive(),
})

// No new payments on bookings that are already closed.
const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'NO_SHOW']

class PaymentRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    
    const bookingId = searchParams.get('bookingId')
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Always restrict to properties in workspaces the user owns or belongs
    // to. Without this, any account could list every property's payments.
    // A propertyId/bookingId from another tenant just yields an empty list.
    const where: Prisma.PaymentWhereInput = {
      property: {
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
    }
    if (propertyId) {
      where.propertyId = propertyId
    }
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
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

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
            city: true,
            bankAccounts: {
              where: { isActive: true, qrEnabled: true },
              take: 1,
            },
            workspace: {
              select: {
                ownerId: true,
                members: {
                  where: { userId: session.user.id },
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
    const isOwner = workspace.ownerId === session.user.id
    const memberRole = workspace.members[0]?.role
    const isMember = isOwner || memberRole != null
    const isStaff =
      isOwner || (memberRole != null && (WorkspaceRoles.STAFF_AND_UP as readonly string[]).includes(memberRole))
    const isGuest = booking.guestEmail === session.user.email

    if (!isMember && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không có quyền tạo thanh toán' }, { status: 403 })
    }

    // CASH is marked PAID on creation, i.e. it confirms money received, so
    // only staff of this property may record it. Otherwise a guest could
    // confirm their own booking without paying.
    if (method === 'CASH' && !isStaff) {
      return NextResponse.json(
        { success: false, error: 'Chỉ nhân viên khách sạn mới được ghi nhận tiền mặt' },
        { status: 403 }
      )
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

    // For QR_VIETQR, build a compliant VietQR string. The frontend can
    // pipe it through any QR library (e.g. qrcode.react) to render.
    let qrString: string | null = null
    if (method === 'QR_VIETQR' && bankAccount) {
      try {
        const { buildVietQr } = await import('@/lib/vietqr')
        qrString = buildVietQr({
          bankCode: bankAccount.bankCode,
          accountNumber: bankAccount.accountNumber,
          accountHolder: bankAccount.accountHolder,
          amount,
          addInfo: transferContent,
          merchantName: booking.property.name,
          merchantCity: booking.property.city,
        })
      } catch (err) {
        console.error('[payment] Failed to build VietQR:', err)
      }
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Lock the booking row so two concurrent requests (e.g. a double
      // click) cannot both pass the amount check below.
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`

      const current = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { status: true, totalAmount: true },
      })
      if (CLOSED_BOOKING_STATUSES.includes(current.status)) {
        throw new PaymentRequestError('Đơn đã huỷ hoặc khách không đến, không thể tạo thanh toán mới', 409)
      }

      // Never charge more than what is still owed on the booking.
      const paid = await tx.payment.aggregate({
        where: { bookingId, status: 'PAID' },
        _sum: { amount: true },
      })
      const remaining = current.totalAmount - (paid._sum.amount ?? 0)
      if (remaining <= 0) {
        throw new PaymentRequestError('Đơn này đã được thanh toán đủ', 400)
      }
      if (amount > remaining) {
        throw new PaymentRequestError(
          `Số tiền vượt quá số còn phải trả (${remaining.toLocaleString('vi-VN')} ₫)`,
          400
        )
      }

      const created = await tx.payment.create({
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
          qrCodeUrl: qrString, // store the QR string; UI can render it
          paidAt: method === 'CASH' ? new Date() : null,
          expiresAt,
        },
      })

      // If cash payment, update booking
      if (method === 'CASH') {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: 'PAID',
            status: current.status === 'PENDING' ? 'CONFIRMED' : current.status,
          },
        })
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          propertyId: booking.propertyId,
          action: 'CREATE',
          entityType: 'PAYMENT',
          entityId: created.id,
          metadata: { bookingCode: booking.bookingCode, method, amount },
        },
      })

      return created
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
    if (error instanceof PaymentRequestError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Create payment error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo thanh toán' }, { status: 500 })
  }
}
