/**
 * Creating and editing invoices before they are published (Part 6). The
 * server computes the amounts: the invoice total is what the guest pays
 * (VAT included) and the split uses the property's VAT code, copied onto
 * the invoice. The invoices of one booking may not add up to more than the
 * booking, so a stay is never invoiced twice.
 */
import { z } from 'zod'
import type { Invoice, Prisma } from '@prisma/client'
import { lockBooking } from '@/lib/payments/booking-payments'
import { EinvoiceError } from './matbao'
import { isVatCode, splitGross, type VatCode } from './vat'

type Tx = Prisma.TransactionClient

/** INV + yymmdd + 4 random characters; unique column, so a clash fails loudly. */
export function generateInvoiceNumber(date = new Date()): string {
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `INV${year}${month}${day}${random}`
}

const TAX_CODE_RE = /^\d{10}(-\d{3})?$/

export const invoiceInputSchema = z
  .object({
    buyerType: z.enum(['company', 'personal', 'consumer']).default('company'),
    companyName: z.string().trim().optional().default(''),
    companyAddress: z.string().trim().optional().default(''),
    taxCode: z.string().trim().optional().default(''),
    companyEmail: z.string().trim().email('Email công ty không hợp lệ').optional().nullable().or(z.literal('')),
    customerName: z.string().trim().min(2, 'Vui lòng nhập tên người mua'),
    customerEmail: z.string().trim().email('Email người mua không hợp lệ'),
    customerAddress: z.string().trim().optional().nullable(),
    totalAmount: z.number().int('Số tiền phải là số nguyên (đồng)').positive('Số tiền phải lớn hơn 0'),
  })
  .superRefine((v, ctx) => {
    if (v.buyerType !== 'company') return
    if (v.companyName.length < 2) ctx.addIssue({ code: 'custom', message: 'Vui lòng nhập tên công ty', path: ['companyName'] })
    if (!TAX_CODE_RE.test(v.taxCode)) {
      ctx.addIssue({ code: 'custom', message: 'Mã số thuế gồm 10 số (hoặc 10 số-3 số)', path: ['taxCode'] })
    }
    if (v.companyAddress.length < 5) {
      ctx.addIssue({ code: 'custom', message: 'Vui lòng nhập địa chỉ công ty', path: ['companyAddress'] })
    }
  })

export type InvoiceInput = z.infer<typeof invoiceInputSchema>

/** Edits are refused once Mắt Bão may hold the invoice. */
export function assertEditable(invoice: Pick<Invoice, 'status' | 'lookupCode'>) {
  if (invoice.status === 'PUBLISHED') throw new EinvoiceError('Hoá đơn đã phát hành không thể sửa hay xoá', 400)
  if (invoice.status === 'PUBLISHING') throw new EinvoiceError('Hoá đơn đang được phát hành, vui lòng đợi', 409)
  if (invoice.lookupCode) {
    throw new EinvoiceError(
      'Lần phát hành trước chưa rõ kết quả (Mắt Bão có thể đã xuất). Hãy bấm phát hành lại trước khi sửa.',
      409
    )
  }
}

/**
 * The columns to write for this input, after checking the booking's
 * invoices stay within its total. Call inside a transaction.
 */
export async function invoiceData(
  tx: Tx,
  booking: { id: string; totalAmount: number },
  input: InvoiceInput,
  vatCode: VatCode,
  excludeInvoiceId?: string
) {
  if (!isVatCode(vatCode)) throw new EinvoiceError('Thuế suất của khách sạn không hợp lệ')
  await lockBooking(tx, booking.id)
  const others = await tx.invoice.aggregate({
    where: {
      bookingId: booking.id,
      status: { notIn: ['CANCELLED', 'REPLACED'] },
      ...(excludeInvoiceId && { id: { not: excludeInvoiceId } }),
      // An invoice being replaced counts once: through its replacement.
      NOT: { replacements: { some: { status: { notIn: ['CANCELLED'] } } } },
    },
    _sum: { totalAmount: true },
  })
  const invoiced = others._sum.totalAmount ?? 0
  if (invoiced + input.totalAmount > booking.totalAmount) {
    const left = Math.max(0, booking.totalAmount - invoiced)
    throw new EinvoiceError(`Vượt số tiền của đơn: chỉ còn ${left.toLocaleString('vi-VN')} ₫ chưa xuất hoá đơn`)
  }
  const { net, vat, gross, rate } = splitGross(input.totalAmount, vatCode)
  const company = input.buyerType === 'company'
  return {
    buyerType: input.buyerType,
    companyName: company ? input.companyName : '',
    companyAddress: company ? input.companyAddress : '',
    taxCode: company ? input.taxCode : '',
    companyEmail: company ? input.companyEmail || null : null,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerAddress: input.customerAddress || null,
    subtotal: net,
    taxAmount: vat,
    totalAmount: gross,
    taxRate: rate,
    vatCode,
  }
}
