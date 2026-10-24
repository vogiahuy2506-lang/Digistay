/**
 * Emailing issued invoices to the buyer, the PDF from Mắt Bão attached.
 *
 * Publishing marks the invoice PENDING when the hotel has invoice emails on;
 * the publish route then sends it right after responding, and the scheduled
 * job (jobs.ts) sends whatever is still due. One conditional update claims
 * the invoice (SENDING, with a lease in emailNextAt), so the two never send
 * it twice. A failure is tried again with backoff, EMAIL_MAX_ATTEMPTS times.
 *
 * Mắt Bão is never asked to email: the hotel's guest hears from the hotel's
 * site, over our SMTP (Founder AI made the same choice).
 */
import { after } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendInvoiceEmail } from '@/lib/email'
import { emailLocale } from '@/lib/email/i18n'
import { invoiceAmendsNote } from '@/lib/email/templates'
import { EinvoiceError, getInvoicePdf } from './matbao'

export const EMAIL_MAX_ATTEMPTS = 5
const EMAIL_LEASE_MS = 3 * 60 * 1000
/** Wait after the 1st, 2nd, 3rd and 4th failure. */
const BACKOFF_MS = [10, 30, 120, 360].map((minutes) => minutes * 60 * 1000)

/** A company's invoice goes to the company's email when it has one. */
export function recipientOf(invoice: { buyerType: string; companyEmail: string | null; customerEmail: string }) {
  const email = (invoice.buyerType === 'company' && invoice.companyEmail) || invoice.customerEmail
  return email?.trim() || null
}

/** What may be claimed now: due, or a claim whose lease ran out. */
export function emailDueWhere(now: Date): Prisma.InvoiceWhereInput {
  return {
    status: 'PUBLISHED',
    OR: [{ emailStatus: 'PENDING' }, { emailStatus: { in: ['FAILED', 'SENDING'] }, emailNextAt: { lte: now } }],
  }
}

export type EmailOutcome = 'sent' | 'failed' | 'skipped' | 'not-due'

/**
 * Sends the invoice's email if it is due (or, with `again`, whatever its
 * state: staff asked for it). Safe to call from anywhere, any number of times.
 */
export async function sendInvoiceEmailFor(
  invoiceId: string,
  now = new Date(),
  { again = false } = {}
): Promise<{ outcome: EmailOutcome; error?: string }> {
  const claimed = await prisma.invoice.updateMany({
    where: {
      id: invoiceId,
      ...(again
        ? {
            status: 'PUBLISHED',
            // Not one being sent right now.
            OR: [{ emailStatus: null }, { emailStatus: { not: 'SENDING' } }, { emailNextAt: { lte: now } }],
          }
        : emailDueWhere(now)),
    },
    data: { emailStatus: 'SENDING', emailNextAt: new Date(now.getTime() + EMAIL_LEASE_MS) },
  })
  if (claimed.count === 0) return { outcome: 'not-due' }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      booking: { select: { bookingCode: true, locale: true, property: { select: { name: true } } } },
      adjustsInvoice: { select: { einvoiceNumber: true } },
      replacesInvoice: { select: { einvoiceNumber: true } },
    },
  })
  const settle = (data: Prisma.InvoiceUpdateManyMutationInput) =>
    prisma.invoice.updateMany({ where: { id: invoiceId, emailStatus: 'SENDING' }, data })

  const to = recipientOf(invoice)
  if (!to) {
    await settle({ emailStatus: 'SKIPPED', emailNextAt: null, emailError: 'Hoá đơn không có email người mua' })
    return { outcome: 'skipped' }
  }

  const attempts = invoice.emailAttempts + 1
  try {
    const { pdf, filename } = await getInvoicePdf(invoiceId)
    // In the language of the booking the invoice is for (the guest's).
    const locale = emailLocale(invoice.booking.locale)
    const note = invoice.adjustsInvoice
      ? invoiceAmendsNote(locale, {
          kind: invoice.totalAmount < 0 ? 'adjustsDown' : 'adjustsUp',
          einvoiceNumber: invoice.adjustsInvoice.einvoiceNumber,
        })
      : invoice.replacesInvoice
        ? invoiceAmendsNote(locale, { kind: 'replaces', einvoiceNumber: invoice.replacesInvoice.einvoiceNumber })
        : undefined
    const result = await sendInvoiceEmail({
      to,
      customerName: invoice.buyerType === 'company' ? invoice.companyName : invoice.customerName,
      einvoiceNumber: invoice.einvoiceNumber ?? invoice.invoiceNumber,
      series: invoice.invoiceSeries ?? '',
      lookupCode: invoice.lookupCode ?? '',
      bookingCode: invoice.booking.bookingCode,
      propertyName: invoice.booking.property.name,
      totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount,
      note,
      locale,
      pdf: { filename, content: pdf },
    })
    if (!result.sent) {
      throw new Error(result.success ? 'Máy chủ chưa cấu hình gửi email (SMTP)' : `Không gửi được email: ${result.error}`)
    }
  } catch (error) {
    const message =
      error instanceof EinvoiceError ? `Không lấy được PDF từ Mắt Bão: ${error.message}` : (error as Error).message
    const next = attempts < EMAIL_MAX_ATTEMPTS ? new Date(now.getTime() + BACKOFF_MS[attempts - 1]) : null
    await settle({ emailStatus: 'FAILED', emailAttempts: attempts, emailNextAt: next, emailError: message.slice(0, 500) })
    console.warn(`[einvoice] email for ${invoice.invoiceNumber} failed (attempt ${attempts}): ${message}`)
    return { outcome: 'failed', error: message }
  }
  await settle({ emailStatus: 'SENT', emailAttempts: attempts, emailNextAt: null, emailedAt: now, emailError: null })
  return { outcome: 'sent' }
}

/**
 * Sends the email once the response has gone out. Outside a request (the
 * scheduled job, tests) there is nothing to wait for: the job sends it.
 */
export function emailAfterResponse(invoiceId: string) {
  try {
    after(() =>
      sendInvoiceEmailFor(invoiceId).catch((error) => console.error('[einvoice] email failed:', error))
    )
  } catch {
    // Not in a request: jobs.ts picks it up.
  }
}
