/**
 * Check-out with a late fee: the dialog shows what the hotel's policy
 * suggests, and the front desk waives it with a reason (src/lib/bookings/
 * late-checkout.ts). The booking was due out yesterday, so it is late
 * whatever time the run starts.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { failOnPageErrors, ids, propertyPath } from '../helpers'

test('the suggested late fee is shown, and waiving it needs a reason that is logged', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  const booking = ids().lateBooking
  await page.goto(propertyPath(`/bookings/${booking}`))
  await page.getByRole('button', { name: 'Trả phòng' }).first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Trả muộn')
  await expect(dialog).toContainText('% giá một đêm')
  await dialog.getByLabel('Miễn phí trả muộn').check()
  await dialog.getByRole('button', { name: 'Trả phòng' }).click()
  await expect(dialog).toContainText('Ghi lý do') // refused without one
  await dialog.getByLabel('Lý do (bắt buộc, lưu vào nhật ký)').fill('Khách chờ chuyến bay đêm')
  await dialog.getByRole('button', { name: 'Trả phòng' }).click()
  await expect(page.getByText('Check-out thành công').first()).toBeVisible()

  const prisma = new PrismaClient()
  try {
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking } })).toMatchObject({
      status: 'CHECKED_OUT',
      totalAmount: 2_400_000,
      paymentStatus: 'PAID',
    })
    const log = await prisma.activityLog.findFirstOrThrow({ where: { entityId: booking, action: 'UPDATE' } })
    expect(log.changes).toMatchObject({ lateFee: 0, lateFeeDecision: 'waive', lateFeeReason: 'Khách chờ chuyến bay đêm' })
    expect((log.changes as { suggestedLateFee: number }).suggestedLateFee).toBeGreaterThan(0)
  } finally {
    await prisma.$disconnect()
  }
  noErrors()
})
