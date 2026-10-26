import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { bookingStatusMeta, getPaymentStatusMeta, paymentStatusMeta, type StatusTone } from '@/lib/booking-status'
import { formatVnd, remainingAmount, type PaymentSummary } from '@/lib/bookings/display'
import type { Locale } from '@/i18n/locales'

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key)

const SOURCES = ['DIRECT', 'WALK_IN', 'PHONE', 'OTA', 'AGENT'] as const
const METHODS = ['BANK_TRANSFER', 'QR_VIETQR', 'CARD', 'CREDIT_CARD', 'E_WALLET', 'CASH'] as const
const ROLES = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'] as const

/**
 * The dashboard's shared words in the page's language (messages/dash/<locale>/
 * common.json): roles, booking and payment states, sources, payment methods,
 * guests and nights, money and dates in Vietnam time. Works in server and
 * client components alike. The Vietnamese-only helpers in
 * src/lib/bookings/display.ts stay for emails and the print slip.
 */
export function useDashLabels() {
  const t = useTranslations('dash.common')
  const locale = useLocale() as Locale
  return useMemo(() => {
    const vn = (value: string | Date) => new Date(new Date(value).getTime() + VN_OFFSET_MS)
    const guests = (adults: number, children: number) =>
      children > 0
        ? `${t('guests.adults', { count: adults })} · ${t('guests.children', { count: children })}`
        : t('guests.adults', { count: adults })
    return {
      locale,
      role: (role: string) => (ROLES.includes(role as never) ? t(`roles.${role as (typeof ROLES)[number]}`) : role),
      bookingStatus: (status: string) =>
        has(bookingStatusMeta, status) ? t(`bookingStatus.${status as keyof typeof bookingStatusMeta}`) : t('bookingStatus.unknown'),
      paymentStatus: (status: string) =>
        has(paymentStatusMeta, status) ? t(`paymentStatus.${status as keyof typeof paymentStatusMeta}`) : t('paymentStatus.unknown'),
      source: (source: string) => (SOURCES.includes(source as never) ? t(`source.${source as (typeof SOURCES)[number]}`) : source),
      paymentMethod: (method: string) => (METHODS.includes(method as never) ? t(`paymentMethod.${method as (typeof METHODS)[number]}`) : method),
      guests,
      nights: (count: number) => t('guests.nights', { count }),
      money: (amount: number) => formatVnd(amount, locale),
      /** "26/10" */
      dayMonth: (value: string | Date) => {
        const d = vn(value)
        return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`
      },
      /** "26/10 21:40" */
      dayMonthTime: (value: string | Date) => {
        const d = vn(value)
        return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
      },
      /** "Thứ Hai, 26/10/2026" / "Monday, 26/10/2026" */
      longDate: (value: string | Date) => {
        const d = vn(value)
        return `${t(`weekdays.${String(d.getUTCDay()) as '0'}`)}, ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
      },
      /** "19/10/2026 21:40" */
      dateTime: (value: string | Date) => {
        const d = vn(value)
        return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
      },
      /** The payment line under the amount in the bookings list (display.ts paymentLine, translated). */
      paymentLine: (b: PaymentSummary): { text: string; tone: StatusTone | null } => {
        const meta = getPaymentStatusMeta(b.paymentStatus)
        const text = has(paymentStatusMeta, b.paymentStatus)
          ? t(`paymentLine.${b.paymentStatus as keyof typeof paymentStatusMeta}`, { remaining: formatVnd(remainingAmount(b), locale) })
          : t('paymentStatus.unknown')
        if (!meta.needsAction || b.status === 'CANCELLED') return { text, tone: null }
        return { text, tone: meta.tone === 'err' ? 'err' : 'warn' }
      },
    }
  }, [t, locale])
}
