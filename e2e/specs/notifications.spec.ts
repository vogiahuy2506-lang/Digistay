/**
 * The dashboard's bell (src/lib/notifications.ts): the unread count, the
 * panel, and opening a notice goes to its booking and marks it read. The
 * notice is written here directly: who receives which is covered by
 * src/lib/notifications.int.test.ts, and the guest bookings of a run are
 * already at the per-IP limit.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { E2E } from '../env'
import { failOnPageErrors, ids, propertyPath } from '../helpers'

test('the bell shows a new booking; opening it goes to the booking and marks it read', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  const prisma = new PrismaClient()
  try {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: E2E.users.admin.email } })
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: ids().invoiceBooking }, include: { property: true } })
    await prisma.notification.deleteMany({ where: { userId: admin.id } })
    await prisma.notification.create({
      data: {
        userId: admin.id,
        workspaceId: booking.property.workspaceId,
        propertyId: booking.propertyId,
        type: 'booking_new',
        data: {
          bookingCode: booking.bookingCode,
          guestName: booking.guestName,
          propertyName: booking.property.name,
          checkIn: booking.checkInDate.toISOString(),
          checkOut: booking.checkOutDate.toISOString(),
          total: booking.totalAmount,
          fromWebsite: true,
        },
        link: propertyPath(`/bookings/${booking.id}`),
      },
    })

    await page.goto(propertyPath('/calendar'))
    const bell = page.getByRole('button', { name: 'Thông báo, 1 chưa đọc' })
    await expect(bell).toBeVisible({ timeout: 15_000 })
    await bell.click()
    const panel = page.getByRole('dialog', { name: 'Thông báo' })
    await expect(panel).toContainText(`Đơn mới từ website: ${booking.bookingCode} · ${booking.guestName}`)
    await panel.getByRole('button', { name: new RegExp(booking.bookingCode) }).click()

    await page.waitForURL(new RegExp(`/bookings/${booking.id}`))
    await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toBeVisible()
    expect((await prisma.notification.findFirstOrThrow({ where: { userId: admin.id } })).readAt).not.toBeNull()
  } finally {
    await prisma.$disconnect()
  }
  noErrors()
})
