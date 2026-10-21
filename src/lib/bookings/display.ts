import { formatCurrency } from '@/lib/utils'
import { getPaymentStatusMeta, type StatusTone } from '@/lib/booking-status'
import { escapeHtml } from '@/lib/utils/escape-html'

export { escapeHtml }

/**
 * Display helpers shared by the bookings list, its side panel and the booking
 * page. Dates are shown in Vietnam time (UTC+7, no daylight saving) whatever
 * the browser or server timezone is.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

function vnDate(value: string | Date) {
  const d = new Date(new Date(value).getTime() + VN_OFFSET_MS)
  return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear(), weekday: d.getUTCDay() }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Calendar nights between check-in and check-out days (14:00 → 12:00 two days later = 2). */
export function nightsBetween(checkIn: string | Date, checkOut: string | Date): number {
  const dayIndex = (v: string | Date) => Math.floor((new Date(v).getTime() + VN_OFFSET_MS) / DAY_MS)
  return Math.max(0, dayIndex(checkOut) - dayIndex(checkIn))
}

/** "26/10" */
export function formatDayMonth(value: string | Date): string {
  const d = vnDate(value)
  return `${pad(d.day)}/${pad(d.month)}`
}

/** "Thứ Hai, 26/10/2026" */
export function formatLongDate(value: string | Date): string {
  const d = vnDate(value)
  return `${WEEKDAYS[d.weekday]}, ${pad(d.day)}/${pad(d.month)}/${d.year}`
}

/** "19/10/2026 21:40" */
export function formatDateTime(value: string | Date): string {
  const d = new Date(new Date(value).getTime() + VN_OFFSET_MS)
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/**
 * "4.350.000 ₫" with a non-breaking space, so the ₫ never wraps onto its own
 * line; "₫4,350,000" in English.
 */
export function formatVnd(amount: number, locale: 'vi' | 'en' = 'vi'): string {
  if (locale === 'en') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
  }
  return formatCurrency(amount).replace(/\s/g, ' ')
}

const sourceLabels: Record<string, string> = {
  DIRECT: 'Website',
  WALK_IN: 'Tại quầy',
  PHONE: 'Gọi điện',
  OTA: 'OTA',
  AGENT: 'Đại lý',
}

export function sourceLabel(source: string): string {
  return sourceLabels[source] ?? source
}

export const bookingSources = Object.keys(sourceLabels)

const paymentMethodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Chuyển khoản',
  QR_VIETQR: 'VietQR',
  CARD: 'Thẻ ATM',
  CREDIT_CARD: 'Thẻ tín dụng',
  E_WALLET: 'Ví điện tử',
  CASH: 'Tiền mặt',
}

export function paymentMethodLabel(method: string): string {
  return paymentMethodLabels[method] ?? method
}

/** "2 người lớn · 1 trẻ em" */
export function guestsLabel(adults: number, children: number): string {
  return children > 0 ? `${adults} người lớn · ${children} trẻ em` : `${adults} người lớn`
}

export interface PaymentSummary {
  paymentStatus: string
  totalAmount: number
  depositAmount: number
  status: string
}

export function remainingAmount(b: Pick<PaymentSummary, 'totalAmount' | 'depositAmount'>): number {
  return Math.max(0, b.totalAmount - b.depositAmount)
}

/**
 * The payment line under the amount in the bookings list (redesign 4a). Only
 * states staff must act on get a color, and never on a cancelled booking.
 */
export function paymentLine(b: PaymentSummary): { text: string; tone: StatusTone | null } {
  const meta = getPaymentStatusMeta(b.paymentStatus)
  const texts: Record<string, string> = {
    PENDING: 'Chưa thanh toán',
    PROCESSING: 'Đang xử lý thanh toán',
    PAID: 'Đã thanh toán',
    PARTIAL: `Đã cọc · còn ${formatVnd(remainingAmount(b))}`,
    FAILED: 'Thanh toán thất bại',
    REFUNDED: 'Đã hoàn tiền',
    CANCELLED: 'Thanh toán đã hủy',
    EXPIRED: 'Hết hạn thanh toán',
  }
  const text = texts[b.paymentStatus] ?? meta.label
  if (!meta.needsAction || b.status === 'CANCELLED') return { text, tone: null }
  return { text, tone: meta.tone === 'err' ? 'err' : 'warn' }
}

export interface PrintableBooking {
  bookingCode: string
  guestName: string
  guestPhone: string
  guestEmail: string
  checkInDate: string
  checkOutDate: string
  numAdults: number
  numChildren: number
  totalAmount: number
  depositAmount: number
  roomLabel: string
  property: { name: string; address?: string | null; phone?: string | null }
}

/**
 * The printed booking slip. Every value is escaped: guest name, phone and
 * email come from the public booking form, and this HTML is written into a
 * window that shares the dashboard's origin.
 */
export function buildPrintHtml(b: PrintableBooking): string {
  const row = (label: string, value: string) =>
    `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Phiếu đặt phòng ${escapeHtml(b.bookingCode)}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #1b1c1a; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 20px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 0; vertical-align: top; }
  .label { color: #6b6760; width: 40%; }
  .code { font-family: monospace; font-size: 16px; }
</style>
</head>
<body>
<h1>PHIẾU ĐẶT PHÒNG</h1>
<div class="code">${escapeHtml(b.bookingCode)}</div>
<h2>Thông tin khách</h2>
<table>
${row('Tên khách', b.guestName)}
${row('Điện thoại', b.guestPhone)}
${row('Email', b.guestEmail)}
${row('Số khách', guestsLabel(b.numAdults, b.numChildren))}
</table>
<h2>Thông tin phòng</h2>
<table>
${row('Phòng', b.roomLabel)}
${row('Nhận phòng', formatLongDate(b.checkInDate))}
${row('Trả phòng', formatLongDate(b.checkOutDate))}
${row('Số đêm', `${nightsBetween(b.checkInDate, b.checkOutDate)} đêm`)}
</table>
<h2>Thanh toán</h2>
<table>
${row('Tổng cộng', formatVnd(b.totalAmount))}
${row('Đã thanh toán', formatVnd(b.depositAmount))}
${row('Còn lại', formatVnd(remainingAmount(b)))}
</table>
<h2>${escapeHtml(b.property.name)}</h2>
<table>
${b.property.address ? row('Địa chỉ', b.property.address) : ''}
${b.property.phone ? row('Điện thoại', b.property.phone) : ''}
</table>
</body>
</html>`
}
