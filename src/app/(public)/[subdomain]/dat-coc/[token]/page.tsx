import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatVnd } from '@/lib/bookings/display'
import { readDepositToken } from '@/lib/payments/deposit-link'
import { onlineDepositOf } from '@/lib/payments/guest-deposit'
import { depositFor } from '@/lib/pricing/quote'
import { SiteLink } from '../../_components/site-base'
import { PayDepositButton } from './PayDepositButton'

interface PageProps {
  params: Promise<{ subdomain: string; token: string }>
}

export const dynamic = 'force-dynamic'
// A guest's own link: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } }

const vnTime = (d: Date) =>
  d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
const vnDay = (d: Date) => d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

/**
 * Where a guest pays their deposit later (src/lib/payments/deposit-link.ts):
 * the link in the booking email, or after leaving PayOS without paying.
 * Showing it changes nothing (mail scanners open links); the button asks
 * POST /api/public/deposits/[token] for a PayOS link.
 */
export default async function DepositPage({ params }: PageProps) {
  const { subdomain, token } = await params
  const bookingId = readDepositToken(token)
  if (!bookingId) notFound()

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, property: { subdomain, isActive: true } },
    select: {
      status: true,
      bookingCode: true,
      checkInDate: true,
      checkOutDate: true,
      totalAmount: true,
      propertyId: true,
      property: { select: { name: true, phone: true } },
      payments: {
        where: { paymentGateway: 'PAYOS', metadata: { path: ['guestDeposit'], equals: true } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { amount: true, status: true, metadata: true, expiresAt: true },
      },
    },
  })
  if (!booking) notFound()

  const latest = booking.payments[0]
  const policy = await onlineDepositOf(booking.propertyId)
  const amount = latest?.amount ?? (policy ? depositFor(booking.totalAmount, policy.percent) : 0)
  const meta = latest?.metadata as { autoCancel?: boolean; deadline?: string } | null
  const deadline = meta?.autoCancel ? (meta.deadline ? new Date(meta.deadline) : latest?.expiresAt ?? null) : null
  const paid = booking.status === 'CONFIRMED' || latest?.status === 'PAID'
  const expired = !!deadline && deadline.getTime() <= Date.now()
  const payable = booking.status === 'PENDING' && !paid && !expired && !!policy && amount > 0

  const title = paid
    ? 'Đã nhận tiền cọc'
    : booking.status === 'CANCELLED'
      ? 'Đặt phòng đã bị huỷ'
      : payable
        ? 'Đặt cọc để giữ phòng'
        : 'Khách sạn sẽ liên hệ với bạn'
  const body = paid
    ? `${booking.property.name} đã nhận tiền cọc. Đặt phòng của bạn đã được xác nhận.`
    : booking.status === 'CANCELLED'
      ? `Đặt phòng này đã được huỷ${expired ? ' vì chưa nhận được tiền cọc trong thời hạn' : ''}. Nếu bạn đã chuyển khoản, vui lòng liên hệ khách sạn.`
      : payable
        ? `Chuyển khoản hoặc quét mã QR qua PayOS; tiền vào thẳng tài khoản của ${booking.property.name}. Khi tiền về, đặt phòng được xác nhận và bạn nhận email.`
        : expired
          ? 'Đã quá hạn đặt cọc online cho đặt phòng này.'
          : `${booking.property.name} hiện không nhận đặt cọc online.`

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full border border-line bg-raised p-8 space-y-4 shadow-lift">
        <h1 className="font-site text-2xl font-semibold text-fg text-center">{title}</h1>
        <dl className="text-small space-y-1.5">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Mã đặt phòng</dt>
            <dd className="font-mono text-fg">{booking.bookingCode}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Ngày ở</dt>
            <dd className="text-fg">
              {vnDay(booking.checkInDate)} – {vnDay(booking.checkOutDate)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Tổng tiền</dt>
            <dd className="tabular-nums text-fg">{formatVnd(booking.totalAmount)}</dd>
          </div>
          {amount > 0 && (
            <div className="flex justify-between gap-3 font-semibold">
              <dt className="text-fg">Tiền cọc</dt>
              <dd className="tabular-nums text-fg">{formatVnd(amount)}</dd>
            </div>
          )}
        </dl>
        <p className="text-muted">{body}</p>
        {payable && deadline && <p className="text-small text-warn">Hạn đặt cọc: {vnTime(deadline)}. Quá hạn, đặt phòng tự huỷ.</p>}
        {payable && <PayDepositButton token={token} amount={formatVnd(amount)} />}
        {booking.property.phone && <p className="text-small text-muted text-center">Liên hệ khách sạn: {booking.property.phone}</p>}
        <div className="text-center">
          <SiteLink path="/" className="text-small text-muted underline">
            Về trang khách sạn
          </SiteLink>
        </div>
      </div>
    </main>
  )
}
