/**
 * Replacement invoices (hoá đơn thay thế, TCHDon 1) for an issued invoice
 * with a mistake, e.g. wrong buyer details or one the tax office refused.
 * The draft copies the original; staff correct it and publish it, and the
 * issued invoice states which one it replaces (mẫu số, ký hiệu, số, ngày).
 * The original becomes REPLACED only once the replacement is issued.
 *
 * An invoice is either replaced or adjusted (adjustment.ts), never both.
 */
import { prisma } from '@/lib/db'
import { lockBooking } from '@/lib/payments/booking-payments'
import { EinvoiceError } from './matbao'
import { generateInvoiceNumber } from './invoices'

export async function createReplacementDraft(originalId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.invoice.findUnique({ where: { id: originalId } })
    if (!original) throw new EinvoiceError('Không tìm thấy hoá đơn', 404)
    await lockBooking(tx, original.bookingId)

    if (
      original.status !== 'PUBLISHED' ||
      original.eInvoiceProvider !== 'MATBAO' ||
      !original.invoiceCode ||
      !original.einvoiceNumber ||
      !original.publishedAt
    ) {
      throw new EinvoiceError('Chỉ lập hoá đơn thay thế cho hoá đơn đã phát hành qua Mắt Bão (có số hoá đơn)', 409)
    }
    if (original.adjustsInvoiceId) {
      throw new EinvoiceError('Đây là hoá đơn điều chỉnh: hãy lập điều chỉnh khác cho hoá đơn gốc', 409)
    }
    const adjustment = await tx.invoice.findFirst({
      where: { adjustsInvoiceId: original.id, status: { not: 'CANCELLED' } },
      select: { invoiceNumber: true },
    })
    if (adjustment) {
      throw new EinvoiceError(
        `Hoá đơn này đã có hoá đơn điều chỉnh (${adjustment.invoiceNumber}): hãy lập thêm điều chỉnh thay vì thay thế`,
        409
      )
    }
    const existing = await tx.invoice.findFirst({
      where: { replacesInvoiceId: original.id, status: { not: 'CANCELLED' } },
      select: { invoiceNumber: true },
    })
    if (existing) {
      throw new EinvoiceError(`Hoá đơn này đã có hoá đơn thay thế (${existing.invoiceNumber})`, 409)
    }

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
        subtotal: original.subtotal,
        taxRate: original.taxRate,
        vatCode: original.vatCode,
        taxAmount: original.taxAmount,
        totalAmount: original.totalAmount,
        status: 'PENDING',
        replacesInvoiceId: original.id,
      },
    })
    await tx.activityLog.create({
      data: {
        userId,
        propertyId: original.propertyId,
        action: 'CREATE_REPLACEMENT',
        entityType: 'INVOICE',
        entityId: draft.id,
        metadata: { replaces: original.invoiceNumber, einvoiceNumber: original.einvoiceNumber },
      },
    })
    return draft
  })
}
