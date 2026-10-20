/**
 * Adjustment invoices (hoá đơn điều chỉnh) for an issued invoice whose
 * amount was wrong or changed: TCHDon 2 raises it, TCHDon 3 lowers it. The
 * adjustment carries only the difference, signed: NĐ 123/2020 Điều 19 says
 * a decrease is written with a minus sign. It names the original (mẫu số,
 * ký hiệu, số, ngày) like a replacement, and the original stays PUBLISHED.
 *
 * Mắt Bão's API documents TCHDon 2/3 but not the sign of the amounts. We
 * send them signed (TCHDon 5, "tăng và giảm", has no other way to tell a
 * line's direction); the fake Mắt Bão follows that. Issue one on DEMO
 * before using it in PRODUCTION.
 *
 * Wrong buyer details: use a replacement (replacement.ts) — information
 * adjustments (TCHDon 4) are not supported.
 */
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { lockBooking } from '@/lib/payments/booking-payments'
import { EinvoiceError } from './matbao'
import { generateInvoiceNumber, invoicedTotal, overBookingError } from './invoices'
import { isVatCode, splitGross } from './vat'

export const adjustmentInputSchema = z.object({
  direction: z.enum(['increase', 'decrease'], { message: 'Chọn điều chỉnh tăng hoặc giảm' }),
  amount: z.number().int('Số tiền phải là số nguyên (đồng)').positive('Số tiền điều chỉnh phải lớn hơn 0'),
  // GChu holds 255 characters, about 100 of them naming the original.
  reason: z.string().trim().min(5, 'Vui lòng ghi lý do điều chỉnh').max(150, 'Lý do tối đa 150 ký tự'),
})

export type AdjustmentInput = z.infer<typeof adjustmentInputSchema>

export async function createAdjustmentDraft(originalId: string, userId: string, input: AdjustmentInput) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.invoice.findUnique({ where: { id: originalId }, select: { bookingId: true } })
    if (!found) throw new EinvoiceError('Không tìm thấy hoá đơn', 404)
    await lockBooking(tx, found.bookingId)
    const original = await tx.invoice.findUniqueOrThrow({
      where: { id: originalId },
      include: { booking: { select: { totalAmount: true } } },
    })

    if (
      original.status !== 'PUBLISHED' ||
      original.eInvoiceProvider !== 'MATBAO' ||
      !original.invoiceCode ||
      !original.einvoiceNumber ||
      !original.publishedAt ||
      !isVatCode(original.vatCode)
    ) {
      throw new EinvoiceError('Chỉ lập hoá đơn điều chỉnh cho hoá đơn đã phát hành qua Mắt Bão (có số hoá đơn)', 409)
    }
    if (original.adjustsInvoiceId) {
      throw new EinvoiceError('Đây là hoá đơn điều chỉnh: hãy lập điều chỉnh cho hoá đơn gốc', 409)
    }
    const replacement = await tx.invoice.findFirst({
      where: { replacesInvoiceId: original.id, status: { not: 'CANCELLED' } },
      select: { invoiceNumber: true },
    })
    if (replacement) {
      throw new EinvoiceError(`Hoá đơn này đang có hoá đơn thay thế (${replacement.invoiceNumber})`, 409)
    }
    const adjustments = await tx.invoice.findMany({
      where: { adjustsInvoiceId: original.id, status: { not: 'CANCELLED' } },
      select: { invoiceNumber: true, status: true, totalAmount: true },
    })
    // One at a time: each is checked against what has been issued.
    const unissued = adjustments.find((a) => a.status !== 'PUBLISHED')
    if (unissued) {
      throw new EinvoiceError(`Hoá đơn này đang có hoá đơn điều chỉnh chưa phát hành (${unissued.invoiceNumber})`, 409)
    }

    if (input.direction === 'decrease') {
      const current = adjustments.reduce((sum, a) => sum + a.totalAmount, original.totalAmount)
      if (input.amount > current) {
        throw new EinvoiceError(
          `Chỉ giảm được tối đa ${current.toLocaleString('vi-VN')} ₫ (giá trị hiện tại của hoá đơn sau các lần điều chỉnh)`
        )
      }
    } else {
      const invoiced = await invoicedTotal(tx, original.bookingId)
      if (invoiced + input.amount > original.booking.totalAmount) {
        throw overBookingError(original.booking.totalAmount, invoiced)
      }
    }

    const delta = input.direction === 'increase' ? input.amount : -input.amount
    const { net, vat, gross, rate } = splitGross(delta, original.vatCode)
    const draft = await tx.invoice.create({
      data: {
        bookingId: original.bookingId,
        propertyId: original.propertyId,
        invoiceNumber: generateInvoiceNumber(),
        buyerType: original.buyerType,
        companyName: original.companyName,
        companyAddress: original.companyAddress,
        taxCode: original.taxCode,
        companyEmail: original.companyEmail,
        customerName: original.customerName,
        customerEmail: original.customerEmail,
        customerAddress: original.customerAddress,
        subtotal: net,
        taxAmount: vat,
        totalAmount: gross,
        taxRate: rate,
        vatCode: original.vatCode,
        status: 'PENDING',
        adjustsInvoiceId: original.id,
        metadata: { adjustmentReason: input.reason },
      },
    })
    await tx.activityLog.create({
      data: {
        userId,
        propertyId: original.propertyId,
        action: 'CREATE_ADJUSTMENT',
        entityType: 'INVOICE',
        entityId: draft.id,
        metadata: { adjusts: original.invoiceNumber, einvoiceNumber: original.einvoiceNumber, amount: delta },
      },
    })
    return draft
  })
}
