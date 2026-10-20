/**
 * The scheduled e-invoice job (every 10 minutes with the PayOS reconcile:
 * docker/systemd/digistay-reconcile.service → /api/internal/einvoice-jobs).
 *
 * 1. Auto-issue, for hotels that turned it on: a booking fully paid since
 *    then, with no invoice at all, gets one for its total, issued at once.
 *    The law dates the invoice at payment when the money comes before the
 *    service (a deposit does not count), hence "fully paid". The buyer is
 *    the company the guest entered when booking (vatCompany...), otherwise
 *    the guest. Details that would be refused (a malformed tax code) leave
 *    the invoice PENDING with the reason, for staff.
 *    Once per booking: a booking staff already invoiced, or whose automatic
 *    invoice they cancelled, is theirs.
 * 2. Automatic invoices whose publish ended uncertain are published again
 *    (Mắt Bão answers 304, never a second invoice). Refused ones wait for
 *    staff.
 * 3. Invoice emails that are due (delivery.ts).
 */
import { prisma } from '@/lib/db'
import { lockBooking } from '@/lib/payments/booking-payments'
import { EinvoiceError, PUBLISH_LEASE_MS, publishInvoice } from './matbao'
import { generateInvoiceNumber, invoiceData, invoiceInputSchema } from './invoices'
import { emailDueWhere, sendInvoiceEmailFor } from './delivery'
import type { VatCode } from './vat'

/** Per run, so a run stays well inside the 10 minutes (Mắt Bão calls take up to 30 s). */
const BATCH = 10

type BookingForInvoice = {
  id: string
  totalAmount: number
  guestName: string
  guestEmail: string
  vatCompany: string | null
  vatTaxCode: string | null
  vatAddress: string | null
  vatEmail: string | null
}

/** The buyer as the guest gave it when booking. */
export function buyerFromBooking(booking: BookingForInvoice) {
  const company = Boolean(booking.vatCompany?.trim() || booking.vatTaxCode?.trim())
  return {
    buyerType: company ? 'company' : 'personal',
    companyName: company ? (booking.vatCompany ?? '').trim() : '',
    companyAddress: company ? (booking.vatAddress ?? '').trim() : '',
    taxCode: company ? (booking.vatTaxCode ?? '').trim() : '',
    companyEmail: company ? booking.vatEmail?.trim() || null : null,
    customerName: booking.guestName.trim(),
    customerEmail: booking.guestEmail.trim(),
    customerAddress: null,
    totalAmount: Math.round(booking.totalAmount),
  }
}

/** Creates the booking's automatic invoice, or null if it no longer qualifies. */
async function createAutoInvoice(bookingId: string, propertyId: string, vatCode: VatCode) {
  return prisma.$transaction(async (tx) => {
    await lockBooking(tx, bookingId)
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } })
    if (booking.paymentStatus !== 'PAID' || (await tx.invoice.count({ where: { bookingId } })) > 0) return null

    const raw = buyerFromBooking(booking)
    const parsed = invoiceInputSchema.safeParse(raw)
    const data = await invoiceData(tx, booking, parsed.success ? parsed.data : (raw as never), vatCode)
    const invoice = await tx.invoice.create({
      data: {
        bookingId,
        propertyId,
        invoiceNumber: generateInvoiceNumber(),
        ...data,
        status: 'PENDING',
        autoIssued: true,
        ...(!parsed.success && {
          publishError: `Thông tin xuất hoá đơn khách nhập khi đặt phòng chưa hợp lệ (${parsed.error.errors[0].message}). Sửa rồi phát hành.`,
        }),
      },
    })
    await tx.activityLog.create({
      data: {
        propertyId,
        action: 'CREATE',
        entityType: 'INVOICE',
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber, autoIssued: true },
      },
    })
    return { invoice, publishable: parsed.success }
  })
}

async function publishQuietly(invoiceId: string, now: Date) {
  try {
    await publishInvoice(invoiceId, null, now)
    return true
  } catch (error) {
    // The reason is on the invoice (publishError) for staff.
    if (!(error instanceof EinvoiceError)) console.error('[einvoice] auto publish failed:', error)
    return false
  }
}

export async function autoIssuePaidBookings(now = new Date()) {
  const summary = { created: 0, published: 0, needsStaff: 0 }
  const configs = await prisma.propertyEinvoice.findMany({
    where: { autoIssue: true, autoIssueSince: { not: null }, verifiedAt: { not: null } },
    select: { propertyId: true, autoIssueSince: true, vatCode: true },
  })
  for (const config of configs) {
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId: config.propertyId,
        paymentStatus: 'PAID',
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        invoices: { none: {} },
        // Fully paid since auto-issue was turned on.
        payments: { some: { status: 'PAID', paidAt: { gte: config.autoIssueSince! } } },
      },
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
      select: { id: true },
    })
    for (const { id } of bookings) {
      const created = await createAutoInvoice(id, config.propertyId, config.vatCode as VatCode)
      if (!created) continue
      summary.created++
      if (!created.publishable) summary.needsStaff++
      else if (await publishQuietly(created.invoice.id, now)) summary.published++
    }
  }
  return summary
}

/** Automatic invoices left uncertain (or never tried, after a crash). */
export async function retryAutoIssued(now = new Date()) {
  const stuck = await prisma.invoice.findMany({
    where: {
      autoIssued: true,
      property: { einvoice: { is: { autoIssue: true } } },
      OR: [
        { status: 'PENDING', lookupCode: { not: null } },
        { status: 'PENDING', publishError: null },
        { status: 'PUBLISHING', updatedAt: { lt: new Date(now.getTime() - PUBLISH_LEASE_MS) } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: { id: true },
  })
  let published = 0
  for (const { id } of stuck) if (await publishQuietly(id, now)) published++
  return { retried: stuck.length, published }
}

export async function sendDueInvoiceEmails(now = new Date()) {
  const due = await prisma.invoice.findMany({
    where: emailDueWhere(now),
    orderBy: { publishedAt: 'asc' },
    take: BATCH * 2,
    select: { id: true },
  })
  const summary = { sent: 0, failed: 0, skipped: 0 }
  for (const { id } of due) {
    const { outcome } = await sendInvoiceEmailFor(id, now)
    if (outcome !== 'not-due') summary[outcome]++
  }
  return summary
}

export async function runEinvoiceJobs(now = new Date()) {
  const issued = await autoIssuePaidBookings(now)
  const retried = await retryAutoIssued(now)
  const emails = await sendDueInvoiceEmails(now)
  return { issued, retried, emails }
}
