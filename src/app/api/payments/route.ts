import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { PaymentMethod, PaymentStatus, type Prisma } from '@prisma/client'
import { badParam, dayParam, enumParam, pageParams, paginationOf, searchParam } from '@/lib/api/list-params'
import { accessibleProperties, checkAccess } from '@/lib/auth/access'
import { lockBooking, syncBookingPayments, CLOSED_BOOKING_STATUSES } from '@/lib/payments/booking-payments'
import { PayosError, createPayosLink, newOrderCode } from '@/lib/payments/payos'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { seesMoneyTotals } from './money-access'

// PAYOS: a VietQR link from the property's own PayOS account, confirmed
// automatically by webhook (src/lib/payments/payos.ts).
const createPaymentSchema = z.object({
  bookingId: z.string(),
  method: z.enum(['BANK_TRANSFER', 'QR_VIETQR', 'CARD', 'CREDIT_CARD', 'E_WALLET', 'CASH', 'PAYOS']),
  amount: z.number().positive(),
})

class PaymentRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/**
 * GET /api/payments — one page of the caller's payments, newest first.
 * Filters (propertyId, bookingId, status, method, q, startDate/endDate as
 * yyyy-mm-dd) run in the database. Only properties where the caller may
 * work payments (payments_manage). `stats` sums the property's (or the
 * booking's) payments by status whatever the other filters; it is null
 * unless the caller may see money totals (revenue_view: money-access.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const bookingId = searchParams.get('bookingId')
    const propertyId = searchParams.get('propertyId')
    const status = enumParam(searchParams.get('status'), Object.values(PaymentStatus))
    const method = enumParam(searchParams.get('method'), Object.values(PaymentMethod))
    const from = dayParam(searchParams.get('startDate'), 'from')
    const to = dayParam(searchParams.get('endDate'), 'to')
    if (status === null) return badParam('Trạng thái không hợp lệ')
    if (method === null) return badParam('Phương thức thanh toán không hợp lệ')
    if (from === null || to === null) return badParam('Ngày không hợp lệ (yyyy-mm-dd)')
    const q = searchParam(searchParams)
    const { page, limit, skip } = pageParams(searchParams)

    // Always restrict to the properties where the caller works payments.
    // Without this, any account could list every property's payments. A
    // propertyId/bookingId they do not reach just yields an empty list.
    const narrow = { ...(propertyId && { propertyId }), ...(bookingId && { bookingId }) }
    const scope: Prisma.PaymentWhereInput = {
      property: accessibleProperties(session.user.id, 'payments_manage'),
      ...narrow,
    }
    // Totals only over the properties whose revenue the caller sees.
    const totalsScope: Prisma.PaymentWhereInput = {
      property: accessibleProperties(session.user.id, 'revenue_view'),
      ...narrow,
    }
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const })
    const where: Prisma.PaymentWhereInput = {
      ...scope,
      ...(status && { status }),
      ...(method && { method }),
      ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
      ...(q && {
        OR: [
          { booking: { bookingCode: contains(q) } },
          { booking: { guestName: contains(q) } },
          { transferContent: contains(q) },
          { gatewayOrderCode: contains(q) },
          { id: q },
        ],
      }),
    }

    const [payments, total, byStatus, withTotals] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
      }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({ by: ['status'], where: totalsScope, _count: { _all: true }, _sum: { amount: true } }),
      seesMoneyTotals(session.user.id, propertyId),
    ])

    const of = (...statuses: string[]) => {
      const rows = byStatus.filter((r) => statuses.includes(r.status))
      return { amount: rows.reduce((n, r) => n + (r._sum.amount ?? 0), 0), count: rows.reduce((n, r) => n + r._count._all, 0) }
    }
    const [pending, paid, failed] = [of('PENDING'), of('PAID'), of('FAILED', 'EXPIRED')]
    return NextResponse.json({
      success: true,
      data: payments,
      pagination: paginationOf(page, limit, total),
      stats: withTotals
        ? {
            total: byStatus.reduce((n, r) => n + (r._sum.amount ?? 0), 0),
            count: byStatus.reduce((n, r) => n + r._count._all, 0),
            pending: pending.amount,
            paid: paid.amount,
            failed: failed.amount,
            pendingCount: pending.count,
            paidCount: paid.count,
            failedCount: failed.count,
          }
        : null,
    })
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
            subdomain: true,
            payos: { select: { webhookConfirmedAt: true } },
            workspaceId: true,
            bankAccounts: {
              where: { isActive: true, qrEnabled: true },
              take: 1,
            },
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access: staff who work payments at this property, or the
    // booking's own guest.
    const staffAccess = await checkAccess(session.user.id, booking.property.workspaceId, 'payments_manage', {
      propertyId: booking.propertyId,
    })
    const isStaff = staffAccess.ok
    const isGuest = booking.guestEmail === session.user.email

    if (!isStaff && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không có quyền tạo thanh toán' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    // CASH is marked PAID on creation, i.e. it confirms money received, so
    // only staff of this property may record it. Otherwise a guest could
    // confirm their own booking without paying.
    if (method === 'CASH' && !isStaff) {
      return NextResponse.json(
        { success: false, error: 'Chỉ nhân viên khách sạn mới được ghi nhận tiền mặt' },
        { status: 403 }
      )
    }

    const viaPayos = method === 'PAYOS'
    if (viaPayos) {
      if (!booking.property.payos?.webhookConfirmedAt) {
        return NextResponse.json(
          { success: false, error: 'Khách sạn chưa kết nối PayOS (Tài khoản ngân hàng → Thanh toán online)' },
          { status: 400 }
        )
      }
      if (!Number.isInteger(amount)) {
        return NextResponse.json({ success: false, error: 'Số tiền phải là số nguyên (đồng)' }, { status: 400 })
      }
    }

    // For QR payment, get bank info (PayOS uses the account linked in PayOS)
    const bankAccount = viaPayos ? undefined : booking.property.bankAccounts[0]
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
      // Two concurrent requests (e.g. a double click) cannot both pass the
      // amount check below.
      await lockBooking(tx, bookingId)

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
          method: viaPayos ? 'QR_VIETQR' : method,
          status: method === 'CASH' ? 'PAID' : 'PENDING',
          bankCode: bankAccount?.bankCode,
          bankAccount: bankAccount?.accountNumber,
          accountHolder: bankAccount?.accountHolder,
          transferContent: viaPayos ? null : transferContent,
          qrCodeUrl: qrString, // store the QR string; UI can render it
          paidAt: method === 'CASH' ? new Date() : null,
          expiresAt: viaPayos ? null : expiresAt,
          ...(viaPayos && { paymentGateway: 'PAYOS' as const, gatewayOrderCode: String(newOrderCode()) }),
        },
      })

      // Cash is money in hand: deposit and payment status follow the
      // amount (it used to mark the booking PAID whatever the amount).
      if (method === 'CASH') {
        await syncBookingPayments(tx, bookingId)
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

    // The payment (with its order code) is recorded before PayOS hears of
    // it, so a webhook can always find it.
    const data = viaPayos
      ? await createPayosLink(
          payment.id,
          `${process.env.NEXTAUTH_URL}/${booking.property.subdomain}/thanh-toan`
        )
      : payment

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        bankAccount,
      },
      message: 'Tạo thanh toán thành công',
    })
  } catch (error) {
    if (error instanceof PaymentRequestError || error instanceof PayosError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Create payment error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo thanh toán' }, { status: 500 })
  }
}
