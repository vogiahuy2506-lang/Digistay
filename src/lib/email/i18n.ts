/**
 * Emails in the reader's language, Vietnamese or English.
 *
 * - The texts are in messages/<locale>.json under `email`. They never reach
 *   the browser: src/app/layout.tsx hands the client provider its own
 *   namespaces only.
 * - A guest's email follows their booking (Booking.locale, the language of
 *   the page they booked on). An account email follows the page that
 *   triggered it (the NEXT_LOCALE cookie, src/lib/i18n/request-locale.ts).
 * - Emails to the hotel's owner and to the Digistay team stay Vietnamese.
 *
 * Vietnamese keeps each email's own date and money format. English writes
 * 23 Dec 2026 and 1,700,000 ₫. Dates and times are always Vietnam's.
 */
import { createTranslator, type NamespaceKeys, type NestedKeyOf } from 'next-intl'
import vi from '../../../messages/vi.json'
import en from '../../../messages/en.json'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locales'

export type EmailLocale = Locale

type EmailMessages = { email: typeof vi.email }
const MESSAGES: Record<EmailLocale, EmailMessages> = { vi: { email: vi.email }, en: { email: en.email } }

export const EMAIL_TIME_ZONE = 'Asia/Ho_Chi_Minh'

/** A booking's stored language, or one a client sent: anything but 'vi' | 'en' is Vietnamese. */
export function emailLocale(value: unknown): EmailLocale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** `t` for one email's texts: emailTranslator(locale, 'email.booking'). */
export function emailTranslator<const N extends NamespaceKeys<EmailMessages, NestedKeyOf<EmailMessages>>>(
  locale: EmailLocale,
  namespace: N
) {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace, timeZone: EMAIL_TIME_ZONE })
}

/** 1,700,000 ₫ */
export function englishMoney(amount: number, currency = 'VND'): string {
  if (currency !== 'VND') {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  }
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(amount)} ₫`
}

/** 23 Dec 2026, or Wed, 23 Dec 2026 with the weekday. */
export function englishDate(date: Date, { weekday = false } = {}): string {
  return date.toLocaleDateString('en-GB', {
    ...(weekday && { weekday: 'short' }),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: EMAIL_TIME_ZONE,
  })
}

/** 23 Dec 2026, 14:30 GMT+7, or 23 Dec, 14:30 GMT+7 without the year: Vietnam time, said so for guests abroad. */
export function englishDateTime(date: Date, { year = true } = {}): string {
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(year && { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: EMAIL_TIME_ZONE,
  })
}
