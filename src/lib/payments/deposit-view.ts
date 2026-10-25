/**
 * What the guest's own pages show (/<hotel>/dat-coc/<token> and
 * /<hotel>/xac-nhan/<token>, token from deposit-link.ts): the stay, the
 * amounts, and where the online deposit stands, with the PayOS QR to pay it.
 *
 * Nothing about the guest (name, email, phone): the token is in emails,
 * and mail scanners and forwarded messages open it. Reading changes
 * nothing; a new PayOS link is only made by POST /api/public/deposits/[token].
 */
import { prisma } from '@/lib/db'
import { readDepositToken } from './deposit-link'
import { payosDescription } from './payos'

/**
 * pending: a live QR to pay · expired: the link ended, a new one can be made
 * (the hotel's deadline has not passed) · error: PayOS could not make the
 * link · paid · cancelled: the booking was cancelled (the deadline passed,
 * or the hotel did) · none: no online deposit for this booking.
 */
export type DepositState = 'pending' | 'expired' | 'error' | 'paid' | 'cancelled' | 'none'

export interface DepositView {
  token: string
  bookingCode: string
  bookingStatus: string
  checkIn: Date
  checkOut: Date
  nights: number
  adults: number
  children: number
  room: { name: string; area: number | null; bedType: string | null; image: string | null; translations: unknown } | null
  amounts: {
    room: number
    extraGuests: number
    services: { name: string; quantity: number; amount: number }[]
    total: number
    deposit: number
    /** still to pay at the hotel once the deposit is in */
    remaining: number
  }
  state: DepositState
  payment: {
    amount: number
    /** the VietQR payload PayOS made (render it as a QR code) */
    qr: string | null
    checkoutUrl: string | null
    expiresAt: Date | null
    /** the hotel's deadline: unpaid by then, the booking is cancelled */
    deadline: Date | null
  } | null
  /** where the transfer goes, read from the QR and the hotel's PayOS connection */
  transfer: { accountNumber: string | null; accountName: string | null; note: string } | null
  property: { name: string; phone: string | null; address: string | null; checkInTime: string; checkOutTime: string; cancellationHours: number | null }
}

const DAY = 24 * 60 * 60 * 1000

/** The account number in a VietQR payload (EMV tag 38 → 01 → 01). */
export function accountFromVietQr(payload: string | null | undefined): string | null {
  if (!payload) return null
  const read = (s: string): Map<string, string> => {
    const out = new Map<string, string>()
    let i = 0
    while (i + 4 <= s.length) {
      const id = s.slice(i, i + 2)
      const len = Number(s.slice(i + 2, i + 4))
      if (!Number.isInteger(len) || i + 4 + len > s.length) break
      out.set(id, s.slice(i + 4, i + 4 + len))
      i += 4 + len
    }
    return out
  }
  const merchant = read(payload).get('38')
  const beneficiary = merchant && read(merchant).get('01')
  const account = beneficiary && read(beneficiary).get('01')
  return account && /^[0-9A-Za-z]{4,30}$/.test(account) ? account : null
}

/** subdomain null: any hotel's (the status API, which has only the token). */
export async function loadDepositView(subdomain: string | null, token: string, now = new Date()): Promise<DepositView | null> {
  const bookingId = readDepositToken(token)
  if (!bookingId) return null
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, property: subdomain ? { subdomain, isActive: true } : { isActive: true } },
    select: {
      bookingCode: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      numAdults: true,
      numChildren: true,
      subtotal: true,
      services: true,
      totalAmount: true,
      propertyId: true,
      property: {
        select: {
          name: true,
          phone: true,
          address: true,
          policy: { select: { checkInTime: true, checkOutTime: true, cancellationHours: true } },
          payos: { select: { accountName: true, accountNumber: true } },
        },
      },
      bookingItems: { take: 1, select: { roomTypeId: true, basePrice: true, extraAdultPrice: true, extraChildPrice: true } },
      payments: {
        where: { paymentGateway: 'PAYOS', metadata: { path: ['guestDeposit'], equals: true } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { amount: true, status: true, metadata: true, expiresAt: true, qrCodeUrl: true, checkoutUrl: true },
      },
    },
  })
  if (!booking) return null

  const item = booking.bookingItems[0]
  const roomType = item
    ? await prisma.roomType.findUnique({
        where: { id: item.roomTypeId },
        select: { name: true, area: true, bedType: true, translations: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } },
      })
    : null

  const latest = booking.payments[0]
  const meta = (latest?.metadata ?? null) as { autoCancel?: boolean; deadline?: string; payos?: { createError?: string } } | null
  const deadline = meta?.autoCancel ? (meta.deadline ? new Date(meta.deadline) : latest?.expiresAt ?? null) : null
  const paid = booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT' || latest?.status === 'PAID'
  const linkLive = latest?.status === 'PENDING' && !!latest.qrCodeUrl && (!latest.expiresAt || latest.expiresAt > now)
  const pastDeadline = !!deadline && deadline <= now

  const cancelled = booking.status === 'CANCELLED' || booking.status === 'NO_SHOW'
  const state: DepositState = !latest
    ? cancelled
      ? 'cancelled'
      : 'none'
    : paid
      ? 'paid'
      : cancelled
        ? 'cancelled'
        : pastDeadline
          ? 'cancelled'
          : linkLive
            ? 'pending'
            : latest.status === 'FAILED' && meta?.payos?.createError
              ? 'error'
              : 'expired'

  const services = (Array.isArray(booking.services) ? booking.services : []) as { name?: string; quantity?: number; amount?: number }[]
  const servicesTotal = services.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const room = item?.basePrice ?? booking.subtotal
  const deposit = latest?.amount ?? 0
  const policy = booking.property.policy

  return {
    token,
    bookingCode: booking.bookingCode,
    bookingStatus: booking.status,
    checkIn: booking.checkInDate,
    checkOut: booking.checkOutDate,
    nights: Math.max(1, Math.round((booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / DAY)),
    adults: booking.numAdults,
    children: booking.numChildren,
    room: roomType && { name: roomType.name, area: roomType.area, bedType: roomType.bedType, image: roomType.images[0]?.url ?? null, translations: roomType.translations },
    amounts: {
      room,
      extraGuests: Math.max(0, booking.totalAmount - room - servicesTotal),
      services: services.map((s) => ({ name: String(s.name ?? ''), quantity: Number(s.quantity) || 1, amount: Number(s.amount) || 0 })),
      total: booking.totalAmount,
      deposit,
      remaining: Math.max(0, booking.totalAmount - deposit),
    },
    state,
    payment: latest
      ? { amount: latest.amount, qr: linkLive ? latest.qrCodeUrl : null, checkoutUrl: linkLive ? latest.checkoutUrl : null, expiresAt: latest.expiresAt, deadline }
      : null,
    transfer: latest
      ? {
          accountNumber: accountFromVietQr(latest.qrCodeUrl) ?? booking.property.payos?.accountNumber ?? null,
          accountName: booking.property.payos?.accountName ?? null,
          note: payosDescription(booking.bookingCode),
        }
      : null,
    property: {
      name: booking.property.name,
      phone: booking.property.phone,
      address: booking.property.address,
      checkInTime: policy?.checkInTime ?? '14:00',
      checkOutTime: policy?.checkOutTime ?? '12:00',
      cancellationHours: policy?.cancellationHours ?? null,
    },
  }
}
