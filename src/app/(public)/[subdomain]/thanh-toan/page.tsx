import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatVnd } from '@/lib/bookings/display'
import { depositToken } from '@/lib/payments/deposit-link'
import { SiteLink } from '../_components/site-base'
import { WaitForPayment } from './WaitForPayment'

interface PageProps {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ status?: string; cancel?: string; orderCode?: string }>
}

export const dynamic = 'force-dynamic'

/**
 * Where PayOS sends the guest back after paying or cancelling (Part 5),
 * from a staff link or a deposit taken when booking on the site.
 * Display only: it shows the payment as our database has it (the webhook
 * marks it paid), never what the query string claims. The order code is a
 * 16-digit random number, so it only finds the guest's own payment, and
 * the page shows nothing about them beyond the booking code and amount.
 */
export default async function PaymentReturnPage({ params, searchParams }: PageProps) {
  const { subdomain } = await params
  const { status, cancel, orderCode } = await searchParams

  const property = await prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: { id: true, name: true, phone: true },
  })
  if (!property) notFound()

  const payment = /^\d{1,20}$/.test(orderCode ?? '')
    ? await prisma.payment.findFirst({
        where: { propertyId: property.id, gatewayOrderCode: orderCode },
        select: { status: true, amount: true, metadata: true, booking: { select: { id: true, bookingCode: true, status: true } } },
      })
    : null
  const paid = payment?.status === 'PAID'
  // A deposit taken on the site emails the guest once paid (payos.ts).
  const deposit = (payment?.metadata as { guestDeposit?: boolean } | null)?.guestDeposit === true
  const cancelled = !paid && (cancel === 'true' || status === 'CANCELLED')
  // Cancelled at the hotel's deposit deadline (guest-deposit.ts).
  const expired = !paid && payment?.booking.status === 'CANCELLED'
  // Left PayOS without paying a deposit that still holds the room: pay again (dat-coc).
  const payAgain = cancelled && deposit && payment?.booking.status === 'PENDING'

  const title = paid
    ? 'Đã nhận tiền thanh toán'
    : expired
      ? 'Đặt phòng đã bị huỷ'
      : cancelled
      ? 'Bạn đã huỷ thanh toán'
      : payment
        ? 'Đang chờ ngân hàng xác nhận'
        : 'Cảm ơn bạn đã thanh toán'
  const body = expired
    ? `Đặt phòng ${payment!.booking.bookingCode} đã được huỷ vì chưa nhận được tiền cọc trong thời hạn. Nếu bạn đã chuyển khoản, vui lòng liên hệ ${property.name}.`
    : paid
    ? `${property.name} đã nhận ${formatVnd(payment.amount)} cho đặt phòng ${payment.booking.bookingCode}. Đặt phòng của bạn đã được xác nhận${deposit ? '; email xác nhận đang được gửi tới bạn' : ''}.`
    : cancelled
      ? `Chưa có khoản tiền nào được chuyển.${payment ? ` Đặt phòng ${payment.booking.bookingCode} vẫn được giữ chờ khách sạn liên hệ.` : ''} Nếu cần, hãy liên hệ ${property.name} để nhận lại link thanh toán.`
      : payment
        ? `Nếu bạn đã chuyển khoản, ${property.name} sẽ xác nhận đặt phòng ${payment.booking.bookingCode} ngay khi tiền về, thường trong vài giây. Bạn không cần làm gì thêm.`
        : `${property.name} sẽ xác nhận ngay khi nhận được tiền. Bạn không cần làm gì thêm.`

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full border border-line bg-raised p-8 text-center space-y-4 shadow-lift">
        <h1 className="font-site text-2xl font-semibold text-fg">{title}</h1>
        <p className="text-muted">{body}</p>
        {payment && !paid && !cancelled && !expired && <WaitForPayment />}
        {payAgain && (
          <SiteLink
            path={`/dat-coc/${depositToken(payment.booking.id)}`}
            className="inline-flex h-11 items-center rounded-ctl border border-line px-6 text-small font-medium text-fg hover:bg-fg/[0.03]"
          >
            Thanh toán lại
          </SiteLink>
        )}
        {property.phone && <p className="text-small text-muted">Liên hệ khách sạn: {property.phone}</p>}
        <SiteLink
          path="/"
          className="inline-flex h-11 items-center rounded-ctl bg-ink px-6 text-small font-medium text-on-ink hover:bg-ink/90"
        >
          Về trang khách sạn
        </SiteLink>
      </div>
    </main>
  )
}
