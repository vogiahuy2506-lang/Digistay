/**
 * Cancelling a paid booking: the dialog shows the refund the hotel's policy
 * suggests (src/lib/bookings/cancel-refund.ts), and refunding another amount
 * needs a reason that is logged. The booking checks in tomorrow, inside the
 * hotel's 48-hour free cancellation, where the policy refunds 50%.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { failOnPageErrors, ids, propertyPath } from '../helpers'

test('the suggested refund is shown, and refunding another amount needs a reason that is logged', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  const prisma = new PrismaClient()
  try {
    const propertyId = ids().prop
    await prisma.policy.update({ where: { propertyId }, data: { cancellationHours: 48, lateCancelRefundPercent: 50 } })
    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'DSE2ECANCEL',
        propertyId,
        guestName: 'Đỗ Thị Hủy',
        guestEmail: 'huy@example.com',
        guestPhone: '0900000010',
        checkInDate: new Date(Date.now() + 24 * 3_600_000),
        checkOutDate: new Date(Date.now() + 48 * 3_600_000),
        subtotal: 1_000_000,
        totalAmount: 1_000_000,
        depositAmount: 1_000_000,
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      },
    })
    await prisma.payment.create({
      data: { bookingId: booking.id, propertyId, amount: 1_000_000, netAmount: 1_000_000, method: 'BANK_TRANSFER', status: 'PAID', paidAt: new Date() },
    })

    await page.goto(propertyPath(`/bookings/${booking.id}`))
    await page.getByRole('button', { name: 'Thao tác khác' }).first().click()
    await page.getByText('Hủy đặt phòng', { exact: true }).last().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Khách đã thanh toán 1.000.000')
    await expect(dialog).toContainText('đã qua hạn hủy miễn phí (48 giờ): chính sách hoàn 50%')
    await expect(dialog).toContainText('Gợi ý hoàn: 500.000')

    await dialog.getByLabel('Hoàn số khác').check()
    await dialog.getByLabel('Số tiền hoàn (đ)').fill('800000')
    await dialog.getByRole('button', { name: /Hủy đơn và hoàn 800\.000/ }).click()
    await expect(dialog).toContainText('Ghi lý do khi hoàn khác số gợi ý') // refused without one
    await dialog.getByLabel('Lý do hoàn khác gợi ý (bắt buộc, lưu vào nhật ký)').fill('Khách quen, hoàn thêm')
    await dialog.getByRole('button', { name: /Hủy đơn và hoàn 800\.000/ }).click()
    await expect(page.getByText('Đã hủy. Hoàn 800.000').first()).toBeVisible()

    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { payments: true } })
    expect([after.status, after.paymentStatus]).toEqual(['CANCELLED', 'PARTIAL'])
    expect(after.payments[0]).toMatchObject({ status: 'PROCESSING', metadata: expect.objectContaining({ refundedAmount: 800_000 }) })
    const log = await prisma.activityLog.findFirstOrThrow({ where: { entityId: booking.id, action: 'CANCEL' } })
    expect(log.changes).toMatchObject({ suggestedRefund: 500_000, refundAmount: 800_000, refundDecision: 'custom', refundReason: 'Khách quen, hoàn thêm' })
  } finally {
    await prisma.$disconnect()
  }
  noErrors()
})
