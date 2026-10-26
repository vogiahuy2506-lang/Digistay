/**
 * A guest's deposit by plain transfer to the hotel's own account or MoMo
 * wallet (manual-deposit.ts, deposit-mode.ts), against real Postgres: the
 * VietQR names the hotel's account with the deposit and the booking code;
 * "Tôi đã chuyển khoản" extends the hold and tells the front desk once, for
 * its own booking only; staff confirm through the usual payment path, once;
 * the hotel's choice of mode follows its rules.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const store = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
      get: async (k: string) => data.get(k) ?? null,
      set: async (k: string, v: string) => (data.set(k, v), 'OK'),
      del: async (k: string) => (data.delete(k) ? 1 : 0),
      incr: async (k: string) => {
        const n = Number(data.get(k) ?? 0) + 1
        data.set(k, String(n))
        return n
      },
      expire: async () => 1,
      ttl: async () => 600,
    },
  }
})
vi.mock('@/lib/db/redis', () => ({ redis: store.redis }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createRoomType, createTenant, createUser, publishSite, resetDatabase } from '@/test/integration/fixtures'
import { decryptSecret, secretContext } from '@/lib/security/secret-box'
import { POST as guestBooking } from '@/app/api/public/bookings/route'
import { POST as claimRoute } from '@/app/api/public/deposits/[token]/claim/route'
import { GET as depositStatus } from '@/app/api/public/deposits/[token]/route'
import { POST as confirmRoute } from '@/app/api/payments/[id]/confirm/route'
import { GET as listBookings } from '@/app/api/bookings/route'
import { GET as getBooking } from '@/app/api/bookings/[id]/route'
import { GET as getMode, PUT as putMode } from '@/app/api/properties/[id]/deposit-mode/route'
import { POST as addAccount } from '@/app/api/bank-accounts/route'
import { GET as publicProperty } from '@/app/api/properties/public/route'
import { depositToken } from './deposit-link'
import { loadDepositView } from './deposit-view'
import { expireUnpaidDeposits, onlineDepositOf } from './guest-deposit'
import { CLAIM_EXTENSION_MINUTES } from './manual-deposit'

const env = { url: process.env.NEXTAUTH_URL }

/** EMVCo TLV fields of a VietQR payload. */
function tlv(payload: string): Map<string, string> {
  const out = new Map<string, string>()
  let i = 0
  while (i + 4 <= payload.length) {
    const len = Number(payload.slice(i + 2, i + 4))
    out.set(payload.slice(i, i + 2), payload.slice(i + 4, i + 4 + len))
    i += 4 + len
  }
  return out
}
function qrParts(payload: string) {
  const fields = tlv(payload)
  const merchant = tlv(fields.get('38')!)
  const beneficiary = tlv(merchant.get('01')!)
  return { guid: merchant.get('00'), bin: beneficiary.get('00'), account: beneficiary.get('01'), amount: fields.get('54'), content: tlv(fields.get('62')!).get('08') }
}

let ip = 0
async function book(propertyId: string, roomTypeId: string, email = 'khach@example.com') {
  const res = await guestBooking(
    new NextRequest('http://digistay.test/api/public/bookings', {
      method: 'POST',
      headers: { 'x-real-ip': `198.51.100.${++ip}` },
      body: JSON.stringify({
        propertyId,
        roomTypeId,
        guestName: 'Lê Thị Hoa',
        guestEmail: email,
        guestPhone: '0912345678',
        checkInDate: '2026-12-07',
        checkOutDate: '2026-12-09',
        numAdults: 2,
      }),
    })
  )
  const body = await res.json()
  expect(res.status).toBe(200)
  return prisma.booking.findUniqueOrThrow({ where: { bookingCode: body.data.bookingCode }, include: { payments: true } }).then((b) => ({ ...b, response: body.data }))
}

const claim = (token: string, from = `203.0.113.${++ip % 250}`) =>
  claimRoute(new NextRequest('http://digistay.test/api/x', { method: 'POST', headers: { 'x-real-ip': from } }), { params: Promise.resolve({ token }) })

const confirm = (paymentId: string) =>
  confirmRoute(new NextRequest(`http://digistay.test/api/payments/${paymentId}/confirm`, { method: 'POST' }), { params: Promise.resolve({ id: paymentId }) })

const signInAs = (user: { id: string; email: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

/**
 * A published hotel with a 901,500 ₫ room taking `percent` online, a
 * receptionist, and (unless `account` is null) a receiving account.
 */
async function hotel(opts: { percent?: number; deadlineMinutes?: number; totalRooms?: number; account?: 'bank' | 'momo' | null } = {}) {
  const tenant = await createTenant({ memberRole: 'RECEPTIONIST' })
  await publishSite(tenant.property.id)
  await prisma.policy.create({
    data: { propertyId: tenant.property.id, onlineDepositPercent: opts.percent ?? 30, depositDeadlineMinutes: opts.deadlineMinutes ?? 0 },
  })
  const room = await createRoomType(tenant.property.id, { weekdayPrice: 901_500, totalRooms: opts.totalRooms })
  const kind = opts.account === undefined ? 'bank' : opts.account
  const account = kind
    ? await prisma.bankAccount.create({
        data:
          kind === 'bank'
            ? { propertyId: tenant.property.id, bankName: 'Vietcombank', bankCode: 'VCB', accountNumber: '0123456789', accountHolder: 'KHACH SAN DEMO' }
            : { propertyId: tenant.property.id, bankName: 'MoMo', bankCode: 'MOMO', accountNumber: '0901234567', accountHolder: 'TRAN THI MAI' },
      })
    : null
  return { ...tenant, room, account }
}

const later = (minutes: number, from = Date.now()) => new Date(from + minutes * 60_000)

async function mail(kind: string, bookingId: string) {
  const row = await prisma.emailOutbox.findFirstOrThrow({ where: { kind, refId: bookingId } })
  return JSON.parse(decryptSecret(row.message, secretContext('email_outbox', row.id, 'message'))) as { subject: string; text: string; html: string }
}

beforeAll(() => {
  process.env.NEXTAUTH_SECRET ??= 'manual-deposit-test-secret' // signs the deposit link (deposit-link.ts)
  process.env.NEXTAUTH_URL = 'http://digistay.test'
})
beforeEach(async () => {
  await resetDatabase()
  store.data.clear()
  vi.mocked(auth).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(async () => {
  process.env.NEXTAUTH_URL = env.url
  await prisma.$disconnect()
})

describe('a manual deposit', () => {
  it("is a VietQR to the hotel's own account for its share, with the booking code as the content; nothing is paid", async () => {
    const { property, room } = await hotel({ percent: 30, deadlineMinutes: 60 })
    const booking = await book(property.id, room.id)

    // 30% of 1,803,000 = 540,900, rounded up to the next 1,000 (depositFor).
    expect(booking.response.deposit).toMatchObject({ amount: 541_000, checkoutUrl: null })
    expect(booking.status).toBe('PENDING')
    expect(booking.payments).toHaveLength(1)
    const [payment] = booking.payments
    expect(payment).toMatchObject({
      status: 'PENDING',
      amount: 541_000,
      method: 'QR_VIETQR',
      paymentGateway: null,
      bankCode: 'VCB',
      bankAccount: '0123456789',
      transferContent: booking.bookingCode,
      metadata: { guestDeposit: true, manual: true, percent: 30, autoCancel: true, deadlineMinutes: 60 },
    })
    expect(Math.abs(payment.expiresAt!.getTime() - later(60).getTime())).toBeLessThan(60_000)
    expect(qrParts(payment.qrCodeUrl!)).toEqual({ guid: 'A000000727', bin: '970436', account: '0123456789', amount: '541000', content: booking.bookingCode })

    // The guest's email points to the deposit page, worded for a transfer.
    const confirmation = await mail('booking_confirmation', booking.id)
    expect(confirmation.html).toContain(`/dat-coc/${depositToken(booking.id)}`)
    expect(confirmation.html).toContain('Xem mã QR đặt cọc')
    expect(confirmation.html).not.toContain('PayOS')

    // The deposit page reads the hotel's account, not PayOS.
    const view = await loadDepositView(property.subdomain, depositToken(booking.id))
    expect(view).toMatchObject({
      state: 'pending',
      mode: 'manual',
      claimedAt: null,
      payment: { amount: 541_000, qr: payment.qrCodeUrl, checkoutUrl: null },
      transfer: { bankName: 'Vietcombank', accountNumber: '0123456789', accountName: 'KHACH SAN DEMO', note: booking.bookingCode, wallet: false },
    })
  })

  it('into a MoMo wallet: the QR names BIN 971025 and the phone number', async () => {
    const { property, room } = await hotel({ account: 'momo' })
    const booking = await book(property.id, room.id)
    expect(qrParts(booking.payments[0].qrCodeUrl!)).toMatchObject({ guid: 'A000000727', bin: '971025', account: '0901234567', content: booking.bookingCode })
    const view = await loadDepositView(property.subdomain, depositToken(booking.id))
    expect(view?.transfer).toMatchObject({ bankName: 'MoMo', wallet: true, accountNumber: '0901234567' })
  })

  it('the account the hotel chose is the one the QR names', async () => {
    const { property, room, owner } = await hotel()
    const momo = await prisma.bankAccount.create({
      data: { propertyId: property.id, bankName: 'MoMo', bankCode: 'MOMO', accountNumber: '0987654321', accountHolder: 'NGUYEN VAN B' },
    })
    signInAs(owner)
    const res = await putMode(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ accountId: momo.id }) }), { params: Promise.resolve({ id: property.id }) })
    expect(res.status).toBe(200)
    const booking = await book(property.id, room.id)
    expect(booking.payments[0]).toMatchObject({ bankCode: 'MOMO', bankAccount: '0987654321' })
  })

  it('no receiving account and no PayOS: no deposit, as before', async () => {
    const { property, room } = await hotel({ account: null })
    const booking = await book(property.id, room.id)
    expect(booking.response).toMatchObject({ deposit: null, depositUnavailable: false })
    expect(booking.payments).toHaveLength(0)
  })
})

describe('"Tôi đã chuyển khoản"', () => {
  it('extends the hold once by 30 minutes and tells the front desk once', async () => {
    const { property, room } = await hotel({ deadlineMinutes: 30 })
    const booking = await book(property.id, room.id)
    const before = booking.payments[0].expiresAt!
    const token = depositToken(booking.id)

    const first = await claim(token)
    expect(first.status).toBe(200)
    expect((await first.json()).data).toMatchObject({ already: false })
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: booking.payments[0].id } })
    expect(after.expiresAt!.getTime() - before.getTime()).toBe(CLAIM_EXTENSION_MINUTES * 60_000)
    expect(after.metadata).toMatchObject({ deadline: after.expiresAt!.toISOString(), extendedMinutes: 30 })
    expect(after.status).toBe('PENDING') // nothing is paid by saying so
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).transferClaimedAt).not.toBeNull()
    // The owner and the receptionist: the bell and an email each.
    expect(await prisma.notification.count({ where: { type: 'transfer_claimed' } })).toBe(2)
    expect(await prisma.emailOutbox.count({ where: { kind: 'transfer_claimed', refId: booking.id } })).toBe(2)
    const notice = await mail('transfer_claimed', booking.id)
    expect(notice.text).toContain(booking.bookingCode)
    expect(notice.text).toContain('541.000 ₫')

    // Again: the first claim is the answer, nothing moves, nobody is told twice.
    const again = await claim(token)
    expect(again.status).toBe(200)
    expect((await again.json()).data).toMatchObject({ already: true })
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: booking.payments[0].id } })).expiresAt).toEqual(after.expiresAt)
    expect(await prisma.notification.count({ where: { type: 'transfer_claimed' } })).toBe(2)
    expect(await prisma.emailOutbox.count({ where: { kind: 'transfer_claimed' } })).toBe(2)
    expect(await prisma.activityLog.count({ where: { action: 'TRANSFER_CLAIMED', entityId: booking.id } })).toBe(1)

    // The page shows it.
    expect((await loadDepositView(property.subdomain, token))?.claimedAt).not.toBeNull()
  })

  it('pressed many times at once: still one extension and one notice', async () => {
    const { property, room } = await hotel({ deadlineMinutes: 60, totalRooms: 5 })
    for (let round = 0; round < 4; round++) {
      await prisma.notification.deleteMany()
      const booking = await book(property.id, room.id, `k${round}@example.com`)
      const before = booking.payments[0].expiresAt!
      const statuses = (await Promise.all(Array.from({ length: 5 }, () => claim(depositToken(booking.id))))).map((r) => r.status)
      expect(statuses).toEqual([200, 200, 200, 200, 200])
      const after = await prisma.payment.findUniqueOrThrow({ where: { id: booking.payments[0].id } })
      expect(after.expiresAt!.getTime() - before.getTime()).toBe(30 * 60_000)
      expect(await prisma.notification.count({ where: { type: 'transfer_claimed' } })).toBe(2)
      expect(await prisma.emailOutbox.count({ where: { kind: 'transfer_claimed', refId: booking.id } })).toBe(2)
    }
  })

  it("a guest can only claim their own booking: the token names it, a forged one is refused", async () => {
    const { property, room } = await hotel({ totalRooms: 2 })
    const mine = await book(property.id, room.id, 'a@example.com')
    const theirs = await book(property.id, room.id, 'b@example.com')
    const [id, signature] = depositToken(mine.id).split('.')

    for (const forged of [`${theirs.id}.${signature}`, `${id}.${'A'.repeat(signature.length)}`, theirs.id, 'x.y']) {
      expect((await claim(forged)).status).toBe(404)
    }
    expect((await claim(depositToken(mine.id))).status).toBe(200)
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: mine.id } })).transferClaimedAt).not.toBeNull()
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: theirs.id } })).transferClaimedAt).toBeNull()
    expect(await prisma.emailOutbox.count({ where: { kind: 'transfer_claimed', refId: theirs.id } })).toBe(0)
  })

  it('refused after the deadline, once the booking no longer waits, and for a booking without a manual deposit', async () => {
    const { property, room } = await hotel({ deadlineMinutes: 30, totalRooms: 3 })
    const late = await book(property.id, room.id, 'late@example.com')
    await prisma.payment.update({
      where: { id: late.payments[0].id },
      data: { expiresAt: later(-1), metadata: { ...(late.payments[0].metadata as object), deadline: later(-1).toISOString() } },
    })
    expect((await claim(depositToken(late.id))).status).toBe(409)

    const confirmed = await book(property.id, room.id, 'ok@example.com')
    await prisma.booking.update({ where: { id: confirmed.id }, data: { status: 'CONFIRMED' } })
    expect((await claim(depositToken(confirmed.id))).status).toBe(409)

    await prisma.policy.update({ where: { propertyId: property.id }, data: { onlineDepositPercent: 0 } })
    const none = await book(property.id, room.id, 'none@example.com')
    const res = await claim(depositToken(none.id))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Đặt phòng này không đặt cọc bằng chuyển khoản')
    expect(await prisma.notification.count({ where: { type: 'transfer_claimed' } })).toBe(0)
  })

  it('is rate-limited per IP', async () => {
    for (let i = 0; i < 10; i++) expect((await claim('x.y', '203.0.113.250')).status).toBe(404)
    expect((await claim('x.y', '203.0.113.250')).status).toBe(429)
  })
})

describe('staff confirm the money', () => {
  it('through the usual payment confirmation, once: the booking is confirmed and the guest emailed once', async () => {
    const { property, room, member } = await hotel()
    const booking = await book(property.id, room.id)
    await claim(depositToken(booking.id))
    signInAs(member!)

    const statuses = (await Promise.all([confirm(booking.payments[0].id), confirm(booking.payments[0].id)])).map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409])

    expect(await prisma.payment.findUniqueOrThrow({ where: { id: booking.payments[0].id } })).toMatchObject({ status: 'PAID' })
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PARTIAL',
      depositAmount: 541_000,
    })
    expect(await prisma.activityLog.count({ where: { action: 'CONFIRM_PAYMENT', entityId: booking.payments[0].id } })).toBe(1)
    expect(await prisma.emailOutbox.count({ where: { kind: 'deposit_received', refId: booking.id } })).toBe(1)
    expect((await mail('deposit_received', booking.id)).text).toContain('541.000')
    expect(await prisma.notification.count({ where: { type: 'deposit_paid' } })).toBe(2)

    // The guest's page moves on to the confirmation.
    const status = await depositStatus(new NextRequest('http://x', { headers: { 'x-real-ip': '203.0.113.7' } }), { params: Promise.resolve({ token: depositToken(booking.id) }) })
    expect((await status.json()).data.state).toBe('paid')
    // And the booking is no longer waiting: no claim after that.
    expect((await claim(depositToken(booking.id))).status).toBe(200) // the earlier claim, unchanged
  })

  it('a staff payment that is not a guest deposit sends no deposit email', async () => {
    const { property, room, member } = await hotel({ account: null })
    const booking = await book(property.id, room.id)
    const payment = await prisma.payment.create({
      data: { bookingId: booking.id, propertyId: property.id, amount: 200_000, netAmount: 200_000, method: 'BANK_TRANSFER', status: 'PENDING' },
    })
    signInAs(member!)
    expect((await confirm(payment.id)).status).toBe(200)
    expect(await prisma.emailOutbox.count({ where: { kind: 'deposit_received' } })).toBe(0)
  })

  it('the bookings list and the booking show the claim', async () => {
    const { property, room, member } = await hotel({ totalRooms: 2 })
    const claimed = await book(property.id, room.id, 'a@example.com')
    const quiet = await book(property.id, room.id, 'b@example.com')
    await claim(depositToken(claimed.id))
    signInAs(member!)

    const list = await (await listBookings(new NextRequest(`http://x/api/bookings?propertyId=${property.id}`))).json()
    const rows = new Map(list.data.map((b: { id: string; transferClaimedAt: string | null }) => [b.id, b.transferClaimedAt]))
    expect(rows.get(claimed.id)).toEqual(expect.any(String))
    expect(rows.get(quiet.id)).toBeNull()

    const detail = await (await getBooking(new NextRequest('http://x'), { params: Promise.resolve({ id: claimed.id }) })).json()
    expect(detail.data.transferClaimedAt).toEqual(expect.any(String))
    expect(detail.data.payments[0]).toMatchObject({ status: 'PENDING', paymentGateway: null, metadata: { guestDeposit: true, manual: true } })
  })
})

describe("the hotel's deposit deadline", () => {
  it('unclaimed: the booking is cancelled at the deadline and its room freed; claimed: 30 minutes later', async () => {
    const { property, room } = await hotel({ deadlineMinutes: 30, totalRooms: 2 })
    const start = Date.now()
    const quiet = await book(property.id, room.id, 'quiet@example.com')
    const claimed = await book(property.id, room.id, 'claimed@example.com')
    expect((await claim(depositToken(claimed.id))).status).toBe(200)

    expect(await expireUnpaidDeposits(later(29, start))).toMatchObject({ cancelled: 0 })
    expect(await expireUnpaidDeposits(later(31, start))).toMatchObject({ checked: 1, cancelled: 1, errors: 0 })
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: quiet.id } })).toMatchObject({ status: 'CANCELLED' })
    // Its payment stays open: money that turns up late can still be recorded (below).
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: quiet.payments[0].id } })).toMatchObject({ status: 'PENDING' })
    expect(await prisma.emailOutbox.count({ where: { kind: 'deposit_expired', refId: quiet.id } })).toBe(1)
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: claimed.id } })).toMatchObject({ status: 'PENDING' })
    const next = await book(property.id, room.id, 'next@example.com') // the room is free again
    expect(next.status).toBe('PENDING')

    // The claimed booking at its extended deadline (and the next one, past its own).
    expect(await expireUnpaidDeposits(later(62, start))).toMatchObject({ cancelled: 2 })
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: claimed.id } })).toMatchObject({ status: 'CANCELLED' })
    // Running again changes nothing.
    await expireUnpaidDeposits(later(62, start))
    expect(await prisma.emailOutbox.count({ where: { kind: 'deposit_expired' } })).toBe(3)
  })

  it('money that turns up after the booking was cancelled is still recorded by staff, the booking stays cancelled', async () => {
    const { property, room, member } = await hotel({ deadlineMinutes: 30 })
    const booking = await book(property.id, room.id)
    expect(await expireUnpaidDeposits(later(31))).toMatchObject({ cancelled: 1 })
    expect((await claim(depositToken(booking.id))).status).toBe(409) // too late to say so

    signInAs(member!)
    const res = await confirm(booking.payments[0].id)
    expect(res.status).toBe(200)
    expect((await res.json()).warning).toContain('Đơn này đã huỷ')
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: booking.payments[0].id } })).toMatchObject({ status: 'PAID' })
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'CANCELLED' })
    expect(await prisma.emailOutbox.count({ where: { kind: 'deposit_received' } })).toBe(0) // not "your booking is confirmed"
  })

  it('confirmed by staff before the deadline: never cancelled', async () => {
    const { property, room, member } = await hotel({ deadlineMinutes: 30 })
    const booking = await book(property.id, room.id)
    signInAs(member!)
    expect((await confirm(booking.payments[0].id)).status).toBe(200)
    expect(await expireUnpaidDeposits(later(31))).toMatchObject({ cancelled: 0 })
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'CONFIRMED' })
  })
})

describe('how the hotel takes deposits (deposit mode)', () => {
  const put = (propertyId: string, body: object) =>
    putMode(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({ id: propertyId }) })
  const connectPayos = (propertyId: string) =>
    prisma.propertyPayos.create({ data: { propertyId, clientId: 'c', apiKey: 'k', checksumKey: 's', webhookConfirmedAt: new Date() } })

  it('PAYOS is refused without a connected PayOS; with it, it applies', async () => {
    const { property, owner } = await hotel()
    signInAs(owner)
    const refused = await put(property.id, { mode: 'PAYOS' })
    expect(refused.status).toBe(400)
    expect((await refused.json()).error).toContain('Chưa kết nối PayOS')
    expect((await prisma.property.findUniqueOrThrow({ where: { id: property.id } })).depositMode).toBeNull()

    await connectPayos(property.id)
    expect((await put(property.id, { mode: 'PAYOS' })).status).toBe(200)
    expect(await onlineDepositOf(property.id)).toEqual({ percent: 30, deadlineMinutes: 0, mode: 'PAYOS' })
    expect((await put(property.id, { mode: 'MANUAL' })).status).toBe(200)
    expect(await onlineDepositOf(property.id)).toMatchObject({ mode: 'MANUAL' })
    expect(await prisma.activityLog.count({ where: { action: 'DEPOSIT_MODE_CHANGED', entityId: property.id } })).toBe(2)
  })

  it('by default: PayOS when connected, else manual; PayOS chosen then disconnected falls back to manual; nothing to pay into: none', async () => {
    const { property } = await hotel()
    expect(await onlineDepositOf(property.id)).toMatchObject({ mode: 'MANUAL' })
    await connectPayos(property.id)
    expect(await onlineDepositOf(property.id)).toMatchObject({ mode: 'PAYOS' })
    await prisma.property.update({ where: { id: property.id }, data: { depositMode: 'PAYOS' } })
    await prisma.propertyPayos.delete({ where: { propertyId: property.id } })
    expect(await onlineDepositOf(property.id)).toMatchObject({ mode: 'MANUAL' })
    await prisma.bankAccount.updateMany({ where: { propertyId: property.id }, data: { isActive: false } })
    expect(await onlineDepositOf(property.id)).toBeNull()

    // The site learns the mode, nothing about the account.
    await prisma.bankAccount.updateMany({ where: { propertyId: property.id }, data: { isActive: true } })
    const { data } = await (await publicProperty(new NextRequest(`http://digistay.test/api/properties/public?subdomain=${property.subdomain}`))).json()
    expect(data.onlineDeposit).toEqual({ percent: 30, deadlineMinutes: 0, mode: 'MANUAL' })
    expect(data).not.toHaveProperty('bankAccounts')
    expect(data).not.toHaveProperty('depositAccountId')
  })

  it("owner and admins only; the account must be one of this hotel's, active with QR", async () => {
    const { property, owner, member } = await hotel()
    const other = await hotel()
    signInAs(member!)
    expect((await put(property.id, { mode: 'MANUAL' })).status).toBe(403)
    const read = await getMode(new NextRequest('http://x'), { params: Promise.resolve({ id: property.id }) })
    expect((await read.json()).data).toMatchObject({ mode: null, effectiveMode: 'MANUAL', payosConnected: false, percent: 30 })

    signInAs(owner)
    expect((await put(property.id, { accountId: other.account!.id })).status).toBe(400)
    const off = await prisma.bankAccount.create({
      data: { propertyId: property.id, bankName: 'ACB', bankCode: 'ACB', accountNumber: '99887766', accountHolder: 'X', qrEnabled: false },
    })
    expect((await put(property.id, { accountId: off.id })).status).toBe(400)
    expect((await put(property.id, { mode: 'CARD' })).status).toBe(400)
    expect((await put(property.id, {})).status).toBe(400)

    const stranger = await createUser()
    signInAs(stranger)
    expect((await put(property.id, { mode: 'MANUAL' })).status).toBe(403)
  })
})

describe('a MoMo wallet as a receiving account', () => {
  const add = (body: object) => addAccount(new NextRequest('http://x', { method: 'POST', body: JSON.stringify(body) }))

  it('is saved with its phone number as "0…", and refused with anything else', async () => {
    const { property, owner } = await hotel({ account: null })
    signInAs(owner)
    const base = { propertyId: property.id, bankName: 'MoMo', bankCode: 'MOMO', accountHolder: 'Trần Thị Mai' }
    expect((await add({ ...base, accountNumber: '12345678' })).status).toBe(400)
    const res = await add({ ...base, accountNumber: '+84 90 123 4567' })
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ bankCode: 'MOMO', accountNumber: '0901234567', accountHolder: 'TRAN THI MAI' })
    // A bank account number is left as it is.
    expect((await (await add({ ...base, bankName: 'ACB', bankCode: 'ACB', accountNumber: '12345678' })).json()).data.accountNumber).toBe('12345678')
  })
})
