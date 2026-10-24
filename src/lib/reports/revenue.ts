/**
 * The revenue report (GET /api/reports/revenue, built in revenue-report.ts;
 * this file is safe for the browser): money received and given
 * back over a period, by day or by month in Vietnam time, by payment method,
 * plus the bookings made and the invoices issued in it.
 *
 * Money is counted when it moves (cash basis), which is what a hotel
 * reconciles against its bank statement and cash drawer:
 * - received: every payment whose paidAt falls in the period, whatever
 *   happened to it later (a refund is its own movement, on its own day);
 * - refunded: what the cancel route gave back (metadata.refundedAmount at
 *   metadata.refundedAt), on the day it was given back.
 */
import type { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client'

export const METHOD_GROUPS = ['CASH', 'BANK_TRANSFER', 'QR', 'CARD', 'E_WALLET'] as const
export type MethodGroup = (typeof METHOD_GROUPS)[number]
export type GroupBy = 'day' | 'month'

/** QR_VIETQR covers PayOS and static VietQR; ATM and credit cards are one group. */
export function methodGroup(method: PaymentMethod): MethodGroup {
  if (method === 'QR_VIETQR') return 'QR'
  if (method === 'CARD' || method === 'CREDIT_CARD') return 'CARD'
  return method
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** The Vietnam-time day (yyyy-mm-dd) or month (yyyy-mm) an instant falls in. */
export function bucketOf(date: Date, groupBy: GroupBy) {
  const vn = new Date(date.getTime() + VN_OFFSET_MS).toISOString()
  return groupBy === 'day' ? vn.slice(0, 10) : vn.slice(0, 7)
}

/** Every day or month from start to end (Vietnam time), in order. */
export function bucketsBetween(start: Date, end: Date, groupBy: GroupBy) {
  const keys: string[] = []
  const last = bucketOf(end, 'day')
  for (let day = new Date(`${bucketOf(start, 'day')}T00:00:00Z`); ; day = new Date(day.getTime() + DAY_MS)) {
    const iso = day.toISOString().slice(0, 10)
    if (iso > last) break
    const key = groupBy === 'day' ? iso : iso.slice(0, 7)
    if (keys[keys.length - 1] !== key) keys.push(key)
  }
  return keys
}

/**
 * What was given back of a payment, and when. The cancel route writes
 * metadata.refundedAmount and metadata.refundedAt (a partial refund leaves
 * the payment PROCESSING); a REFUNDED payment without them was returned
 * in full when it was last updated.
 */
export function refundOf(payment: {
  status: PaymentStatus
  amount: number
  metadata: Prisma.JsonValue
  updatedAt: Date
}): { amount: number; at: Date } | null {
  const m = (payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
    ? payment.metadata
    : {}) as Record<string, unknown>
  const full = payment.status === 'REFUNDED'
  const at = typeof m.refundedAt === 'string' ? new Date(m.refundedAt) : full ? payment.updatedAt : null
  if (!at || Number.isNaN(at.getTime())) return null
  const amount = typeof m.refundedAmount === 'number' ? m.refundedAmount : full ? payment.amount : 0
  return amount > 0 ? { amount, at } : null
}

/**
 * A CSV file Excel opens as UTF-8 (the BOM) with Vietnamese intact. Cells
 * starting with = + - @ are prefixed with ' so a guest name never runs as a
 * formula; numbers stay numbers.
 */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'number') return String(value)
    const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
