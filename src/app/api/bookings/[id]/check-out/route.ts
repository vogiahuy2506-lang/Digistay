import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lateCheckoutFee } from '@/lib/bookings/late-checkout'
import { lockBooking, syncBookingPayments } from '@/lib/payments/booking-payments'
import { lockedResponseForProperty } from '@/lib/billing/guard'

/**
 * Check-out. The late fee is a suggestion (src/lib/bookings/late-checkout.ts):
 * GET shows it, POST takes the front desk's decision. Applying it is the
 * default; another amount or waiving it needs a reason, and all of it is
 * logged (suggested, charged, decision, reason, who) for the manager.
 */
const checkOutSchema = z.object({
  lateFee: z
    .object({
      decision: z.enum(['apply', 'edit', 'waive']),
      amount: z.number().int('Số tiền là số nguyên (đồng)').min(0).max(1_000_000_000).optional(),
      reason: z.string().trim().max(300).optional(),
    })
    .superRefine((v, ctx) => {
      if (v.decision === 'edit' && v.amount === undefined) {
        ctx.addIssue({ code: 'custom', message: 'Nhập số tiền phụ thu' })
      }
      if (v.decision !== 'apply' && !(v.reason && v.reason.length >= 3)) {
        ctx.addIssue({ code: 'custom', message: 'Ghi lý do khi sửa hoặc miễn phí trả muộn' })
      }
    })
    .optional(),
})

type Session = { user: { id: string } }

/** The booking if the caller may check it out; otherwise the error response. */
async function bookingForStaff(id: string, session: Session) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: {
        select: {
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

  // Outside the workspace: 404, so booking ids cannot be probed.
  const workspace = booking?.property.workspace
  const isOwner = workspace?.ownerId === session.user.id
  if (!booking || !workspace || (!isOwner && workspace.members.length === 0)) {
    return { error: NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 }) }
  }

  // Check reception access
  const isStaff = workspace.members.some(m =>
    ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(m.role)
  )

  if (!isOwner && !isStaff) {
    return { error: NextResponse.json({ success: false, error: 'Không có quyền check-out' }, { status: 403 }) }
  }
  return { booking }
}

const policyOf = (propertyId: string) =>
  prisma.policy.findUnique({ where: { propertyId }, select: { checkOutTime: true, lateCheckoutTiers: true } })

/** GET: the late fee the hotel's policy suggests if the guest leaves now. */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const found = await bookingForStaff(id, session)
    if (found.error) return found.error
    const { booking } = found

    const policy = await policyOf(booking.propertyId)
    const quote = lateCheckoutFee({
      now: new Date(),
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      checkOutTime: policy?.checkOutTime,
      tiers: policy?.lateCheckoutTiers,
      subtotal: booking.subtotal,
    })
    return NextResponse.json({
      success: true,
      data: {
        status: booking.status,
        deadline: quote.deadline,
        hoursLate: quote.hoursLate,
        percent: quote.percent,
        suggestedFee: quote.fee,
        checkOutTime: policy?.checkOutTime ?? '12:00',
      },
    })
  } catch (error) {
    console.error('Check-out preview error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tính phí trả phòng' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params
    const body = await request.json().catch(() => ({}))

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const found = await bookingForStaff(id, session)
    if (found.error) return found.error
    const { booking } = found
    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    const parsed = checkOutSchema.safeParse(body ?? {})
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
    }
    const decision = parsed.data.lateFee ?? { decision: 'apply' as const }

    const policy = await policyOf(booking.propertyId)

    // Changes what is owed: under the booking's row lock, status re-read,
    // payment status recomputed (CLAUDE.md, "Thanh toán"). Two clicks used
    // to both pass the status check.
    const now = new Date()
    const result = await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id)
      const current = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: { status: true, subtotal: true, extraCharges: true, totalAmount: true, checkInDate: true, checkOutDate: true },
      })
      if (current.status !== 'CHECKED_IN') return null

      // Recomputed here, at the moment of check-out: never the client's number.
      const { fee: suggestedFee, hoursLate, percent } = lateCheckoutFee({
        now,
        checkInDate: current.checkInDate,
        checkOutDate: current.checkOutDate,
        checkOutTime: policy?.checkOutTime,
        tiers: policy?.lateCheckoutTiers,
        subtotal: current.subtotal,
      })
      const lateFee =
        decision.decision === 'apply' ? suggestedFee : decision.decision === 'waive' ? 0 : (decision.amount ?? 0)

      await tx.booking.update({
        where: { id },
        data: {
          status: 'CHECKED_OUT',
          actualCheckOut: now,
          checkedOutBy: session.user.id,
          // Added to the total as it stands: rebuilding it from subtotal +
          // extraCharges dropped the booking's discount.
          extraCharges: current.extraCharges + lateFee,
          totalAmount: current.totalAmount + lateFee,
        },
      })
      // A booking paid in full owes the late fee: PAID becomes PARTIAL.
      await syncBookingPayments(tx, id)

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          propertyId: booking.propertyId,
          action: 'UPDATE',
          entityType: 'BOOKING',
          entityId: id,
          changes: {
            status: 'CHECKED_OUT',
            actualCheckOut: now,
            lateFee,
            hoursLate,
            // What the policy suggested and what the front desk did with it.
            suggestedLateFee: suggestedFee,
            lateFeePercent: percent,
            lateFeeDecision: decision.decision,
            ...(decision.decision !== 'apply' && { lateFeeReason: decision.reason ?? null }),
          },
          metadata: {
            bookingCode: booking.bookingCode,
            checkedOutBy: session.user.id,
          },
        },
      })

      const updatedBooking = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: {
          bookingItems: true,
          property: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
      return { updatedBooking, lateFee, suggestedFee }
    })

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Đơn đặt phòng chưa được check-in'
      }, { status: 400 })
    }
    const { updatedBooking, lateFee, suggestedFee } = result

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: lateFee > 0
        ? `Check-out thành công. Phí trả phòng muộn: ${lateFee.toLocaleString('vi-VN')} VNĐ`
        : 'Check-out thành công',
      lateFee,
      suggestedLateFee: suggestedFee,
    })
  } catch (error) {
    console.error('Check-out error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi check-out' }, { status: 500 })
  }
}
