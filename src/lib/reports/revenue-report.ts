/**
 * Builds the revenue report from the database; the rules are in revenue.ts.
 */
import type { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { METHOD_GROUPS, bucketOf, bucketsBetween, methodGroup, refundOf, type GroupBy, type MethodGroup } from './revenue'

export interface ReportRow {
  at: string
  kind: 'IN' | 'REFUND'
  bookingCode: string
  guestName: string
  method: PaymentMethod
  amount: number
  transactionId: string | null
}

export interface RevenueReportInput {
  propertyId: string
  start: Date
  end: Date
  groupBy: GroupBy
  method?: MethodGroup
  /** every movement, for the export */
  withRows?: boolean
}

/** Shown in the page; the export has them all through the invoices list. */
export const MAX_INVOICES = 500

const RECEIVED_STATUSES: PaymentStatus[] = ['PAID', 'REFUNDED', 'PROCESSING']

export async function revenueReport({ propertyId, start, end, groupBy, method, withRows }: RevenueReportInput) {
  const paymentSelect = {
    amount: true,
    method: true,
    status: true,
    paidAt: true,
    metadata: true,
    updatedAt: true,
    transactionId: true,
    booking: { select: { bookingCode: true, guestName: true } },
  } satisfies Prisma.PaymentSelect

  const [received, refundCandidates, bookings, invoices] = await Promise.all([
    prisma.payment.findMany({
      where: { propertyId, status: { in: RECEIVED_STATUSES }, paidAt: { gte: start, lte: end } },
      select: paymentSelect,
      orderBy: { paidAt: 'asc' },
    }),
    // refundedAt is written in the same UPDATE that bumps updatedAt, so a
    // refund in the period belongs to a payment updated since its start.
    prisma.payment.findMany({
      where: { propertyId, status: { in: ['REFUNDED', 'PROCESSING'] }, updatedAt: { gte: start } },
      select: paymentSelect,
    }),
    prisma.booking.findMany({
      where: { propertyId, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] }, createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.invoice.findMany({
      where: { propertyId, status: { in: ['PUBLISHED', 'REPLACED'] }, publishedAt: { gte: start, lte: end } },
      select: {
        id: true,
        invoiceNumber: true,
        einvoiceNumber: true,
        publishedAt: true,
        companyName: true,
        customerName: true,
        taxCode: true,
        totalAmount: true,
        status: true,
        cqtStatus: true,
        booking: { select: { bookingCode: true } },
      },
      orderBy: { publishedAt: 'desc' },
    }),
  ])

  const refunds = refundCandidates
    .map((p) => ({ payment: p, refund: refundOf(p) }))
    .filter((r): r is { payment: (typeof refundCandidates)[number]; refund: { amount: number; at: Date } } =>
      Boolean(r.refund && r.refund.at >= start && r.refund.at <= end)
    )
    .sort((a, b) => a.refund.at.getTime() - b.refund.at.getTime())

  // Every method's share, whatever the filter; the rest of the report is filtered.
  const byMethod = METHOD_GROUPS.map((group) => ({ method: group, received: 0, count: 0, refunded: 0 }))
  const groupRow = (m: PaymentMethod) => byMethod[METHOD_GROUPS.indexOf(methodGroup(m))]
  for (const p of received) {
    groupRow(p.method).received += p.amount
    groupRow(p.method).count += 1
  }
  for (const { payment, refund } of refunds) groupRow(payment.method).refunded += refund.amount

  const keep = (m: PaymentMethod) => !method || methodGroup(m) === method
  const inPeriod = received.filter((p) => keep(p.method))
  const outPeriod = refunds.filter((r) => keep(r.payment.method))

  const series = new Map(
    bucketsBetween(start, end, groupBy).map((key) => [
      key,
      { key, received: 0, refunded: 0, net: 0, payments: 0, bookings: 0, bookingValue: 0 },
    ])
  )
  const at = (date: Date) => series.get(bucketOf(date, groupBy))
  for (const p of inPeriod) {
    const row = at(p.paidAt!)
    if (row) {
      row.received += p.amount
      row.payments += 1
    }
  }
  for (const { refund } of outPeriod) {
    const row = at(refund.at)
    if (row) row.refunded += refund.amount
  }
  for (const b of bookings) {
    const row = at(b.createdAt)
    if (row) {
      row.bookings += 1
      row.bookingValue += b.totalAmount
    }
  }
  for (const row of series.values()) row.net = row.received - row.refunded

  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
  const receivedTotal = sum(inPeriod.map((p) => p.amount))
  const refundedTotal = sum(outPeriod.map((r) => r.refund.amount))
  // A replaced invoice was issued, but its replacement carries the amount now.
  const valid = invoices.filter((i) => i.status === 'PUBLISHED')

  const rows: ReportRow[] | undefined = withRows
    ? [
        ...inPeriod.map((p) => ({
          at: p.paidAt!.toISOString(),
          kind: 'IN' as const,
          bookingCode: p.booking.bookingCode,
          guestName: p.booking.guestName,
          method: p.method,
          amount: p.amount,
          transactionId: p.transactionId,
        })),
        ...outPeriod.map(({ payment, refund }) => ({
          at: refund.at.toISOString(),
          kind: 'REFUND' as const,
          bookingCode: payment.booking.bookingCode,
          guestName: payment.booking.guestName,
          method: payment.method,
          amount: refund.amount,
          transactionId: payment.transactionId,
        })),
      ].sort((a, b) => a.at.localeCompare(b.at))
    : undefined

  return {
    period: { from: bucketOf(start, 'day'), to: bucketOf(end, 'day'), groupBy, method: method ?? null },
    summary: {
      received: receivedTotal,
      receivedCount: inPeriod.length,
      refunded: refundedTotal,
      refundedCount: outPeriod.length,
      net: receivedTotal - refundedTotal,
      bookings: bookings.length,
      bookingValue: sum(bookings.map((b) => b.totalAmount)),
      invoiced: sum(valid.map((i) => i.totalAmount)),
      invoiceCount: valid.length,
    },
    byMethod,
    series: [...series.values()],
    invoices: (withRows ? invoices : invoices.slice(0, MAX_INVOICES)).map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      einvoiceNumber: i.einvoiceNumber,
      publishedAt: i.publishedAt!.toISOString(),
      buyer: i.companyName || i.customerName,
      taxCode: i.taxCode,
      totalAmount: i.totalAmount,
      status: i.status,
      cqtStatus: i.cqtStatus,
      bookingCode: i.booking.bookingCode,
    })),
    invoicesTruncated: !withRows && invoices.length > MAX_INVOICES,
    ...(rows && { rows }),
  }
}

export type RevenueReport = Awaited<ReturnType<typeof revenueReport>>
