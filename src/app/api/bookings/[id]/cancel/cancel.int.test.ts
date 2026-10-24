/**
 * Cancelling with the refund the hotel's policy suggests
 * (src/lib/bookings/cancel-refund.ts): GET shows it, POST refunds it by
 * default, and refunding anything else needs a reason, which is logged.
 * Against real Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { GET, POST } from './route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const preview = async (id: string) => {
  const res = await GET(new NextRequest(`http://localhost/api/bookings/${id}/cancel`), params(id))
  return { status: res.status, body: await res.json() }
}
const cancel = async (id: string, body: object = {}) => {
  const res = await POST(
    new NextRequest(`http://localhost/api/bookings/${id}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params(id)
  )
  return { status: res.status, body: await res.json() }
}

const HOUR = 60 * 60 * 1000

/** A hotel with a policy, and a confirmed booking checking in `hoursAhead` from now with `paid` paid. */
async function setup(opts: { hoursAhead: number; paid: number[]; cancellationHours?: number | null; lateCancelRefundPercent?: number }) {
  const { owner, property } = await createTenant()
  await prisma.policy.create({
    data: {
      propertyId: property.id,
      cancellationHours: opts.cancellationHours === undefined ? 48 : opts.cancellationHours,
      lateCancelRefundPercent: opts.lateCancelRefundPercent ?? 0,
    },
  })
  const created = await createBooking(property.id, { status: 'CONFIRMED' })
  const booking = await prisma.booking.update({
    where: { id: created.id },
    data: { checkInDate: new Date(Date.now() + opts.hoursAhead * HOUR), checkOutDate: new Date(Date.now() + (opts.hoursAhead + 48) * HOUR) },
  })
  for (const [i, amount] of opts.paid.entries()) {
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        propertyId: property.id,
        amount,
        netAmount: amount,
        method: 'BANK_TRANSFER',
        status: 'PAID',
        paidAt: new Date(Date.now() - (opts.paid.length - i) * HOUR),
      },
    })
  }
  signInAs(owner)
  return { owner, property, booking }
}

const payments = (bookingId: string) =>
  prisma.payment.findMany({ where: { bookingId }, orderBy: { paidAt: 'asc' }, select: { status: true, amount: true, metadata: true } })

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(auth).mockReset()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/bookings/[id]/cancel', () => {
  it('suggests everything back before the free-cancellation window, the late share inside it', async () => {
    const early = await setup({ hoursAhead: 72, paid: [400_000, 600_000], lateCancelRefundPercent: 30 })
    expect((await preview(early.booking.id)).body.data).toMatchObject({ rule: 'free', totalPaid: 1_000_000, suggested: 1_000_000, freeHours: 48 })

    const late = await setup({ hoursAhead: 10, paid: [1_000_000], lateCancelRefundPercent: 30 })
    expect((await preview(late.booking.id)).body.data).toMatchObject({ rule: 'late', suggested: 300_000, percent: 30 })
  })

  it('an empty window is no free cancellation, as the policy page tells the hotel', async () => {
    const { booking } = await setup({ hoursAhead: 24 * 30, paid: [1_000_000], cancellationHours: null, lateCancelRefundPercent: 20 })
    expect((await preview(booking.id)).body.data).toMatchObject({ rule: 'late', suggested: 200_000, freeHours: null })
  })

  it('is for staff of the hotel only', async () => {
    const { booking, property } = await setup({ hoursAhead: 72, paid: [] })
    const member = await createUser()
    const workspaceId = (await prisma.property.findUniqueOrThrow({ where: { id: property.id } })).workspaceId
    await prisma.workspaceMember.create({ data: { workspaceId, userId: member.id, role: 'USER' } })
    signInAs(member)
    expect((await preview(booking.id)).status).toBe(403)
    signInAs(await createUser())
    expect((await preview(booking.id)).status).toBe(404)
  })
})

describe('POST /api/bookings/[id]/cancel', () => {
  it('refunds the suggestion by default and logs it', async () => {
    const { booking } = await setup({ hoursAhead: 10, paid: [600_000, 400_000], lateCancelRefundPercent: 50 })

    const res = await cancel(booking.id, { reason: 'Khách bận việc' })

    expect(res.status).toBe(200)
    expect(res.body.refundInfo).toEqual({ totalPaid: 1_000_000, refundAmount: 500_000 })
    // Newest payment first: the 400k goes back whole, then 100k of the 600k.
    expect((await payments(booking.id)).map((p) => [p.status, (p.metadata as { refundedAmount?: number } | null)?.refundedAmount])).toEqual([
      ['PROCESSING', 100_000],
      ['REFUNDED', 400_000],
    ])
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect([after.status, after.paymentStatus]).toEqual(['CANCELLED', 'PARTIAL'])
    const log = await prisma.activityLog.findFirstOrThrow({ where: { entityId: booking.id, action: 'CANCEL' } })
    expect(log.changes).toMatchObject({
      reason: 'Khách bận việc',
      totalPaid: 1_000_000,
      refundAmount: 500_000,
      suggestedRefund: 500_000,
      refundRule: 'late',
      refundPercent: 50,
      refundDecision: 'suggested',
    })
  })

  it('another amount, or none, needs a reason; refused requests change nothing', async () => {
    const { booking } = await setup({ hoursAhead: 72, paid: [1_000_000] })

    const noReason = await cancel(booking.id, { refund: { decision: 'custom', amount: 700_000 } })
    expect(noReason.status).toBe(400)
    expect(noReason.body.error).toBe('Ghi lý do khi hoàn khác số gợi ý theo chính sách')
    expect((await cancel(booking.id, { refund: { decision: 'none' } })).status).toBe(400)
    const tooMuch = await cancel(booking.id, { refund: { decision: 'custom', amount: 1_000_001, reason: 'Bồi thường' } })
    expect(tooMuch.status).toBe(400)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
    expect((await payments(booking.id))[0].status).toBe('PAID')

    const kept = await cancel(booking.id, { refund: { decision: 'none', reason: 'Khách đồng ý mất cọc' } })
    expect(kept.status).toBe(200)
    expect(kept.body.refundInfo).toEqual({ totalPaid: 1_000_000, refundAmount: 0 })
    expect((await payments(booking.id))[0].status).toBe('PAID')
    const log = await prisma.activityLog.findFirstOrThrow({ where: { entityId: booking.id, action: 'CANCEL' } })
    expect(log.changes).toMatchObject({ suggestedRefund: 1_000_000, refundAmount: 0, refundDecision: 'none', refundReason: 'Khách đồng ý mất cọc' })
  })

  it('an amount equal to the suggestion needs no reason', async () => {
    const { booking } = await setup({ hoursAhead: 10, paid: [1_000_000], lateCancelRefundPercent: 0 })
    expect((await cancel(booking.id, { refund: { decision: 'custom', amount: 0 } })).status).toBe(200)
  })

  it('suggests nothing once the guest has checked in', async () => {
    const { booking } = await setup({ hoursAhead: -2, paid: [1_000_000] })
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_IN' } })
    expect((await preview(booking.id)).body.data).toMatchObject({ rule: 'checkedIn', suggested: 0 })
    expect((await cancel(booking.id)).body.refundInfo).toEqual({ totalPaid: 1_000_000, refundAmount: 0 })
  })
})
