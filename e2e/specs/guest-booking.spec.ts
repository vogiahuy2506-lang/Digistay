/**
 * A guest books on the hotel's site, without an account — which never
 * worked before (POST /api/bookings only took staff). The total the page
 * shows is what the booking is charged, the guest's hold is released by
 * their booking, and the confirmation email goes out.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { ids, failOnPageErrors, waitForMail } from '../helpers'

test.use({ storageState: { cookies: [], origins: [] } })

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
const digits = (text: string) => Number(text.replace(/\D/g, ''))

test('a guest books a room with a service; the quoted total is charged', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  const { subdomain } = ids()
  const checkIn = day(40)
  const checkOut = day(42)
  const email = `khach-${Date.now()}@example.com`

  await page.goto(`/${subdomain}/search?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`)
  // The page used to never load the hotel (it expected an array): rooms must show.
  await page.getByRole('button', { name: 'Đặt phòng này' }).first().click()

  await page.getByPlaceholder('Nguyễn Văn A').fill('Phạm Minh Khách')
  await page.getByPlaceholder('0912345678').fill('0912345678')
  await page.getByPlaceholder('email@example.com').fill(email)
  await page.getByRole('button', { name: 'Tiếp tục', exact: false }).first().click()

  // The hotel's real services (no more hard-coded "Ăn sáng"/"Đưa đón").
  await page.getByText('Ăn sáng buffet').click()
  const summary = page.locator('div', { has: page.getByRole('heading', { name: 'Tóm tắt đặt phòng' }) }).last()
  await expect(summary).toContainText('Ăn sáng buffet')
  const total = digits(await summary.locator('div', { hasText: 'Tổng cộng' }).last().innerText())
  expect(total).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Tiếp tục thanh toán' }).click()
  await page.getByRole('button', { name: 'Xác nhận đặt phòng' }).click()
  await expect(page.getByRole('heading', { name: 'Đã gửi yêu cầu đặt phòng' })).toBeVisible()
  const code = (await page.locator('p.font-mono').first().innerText()).trim()
  await expect(page.getByText(/Tổng tiền:/)).toContainText(total.toLocaleString('vi-VN'))

  const prisma = new PrismaClient()
  try {
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingCode: code }, include: { payments: true, bookingItems: true } })
    expect(booking).toMatchObject({ status: 'PENDING', totalAmount: total, guestEmail: email, createdById: null })
    expect(booking.payments).toEqual([])
    // The guest's hold was used up by the booking.
    expect(await prisma.roomLock.count({ where: { roomTypeId: booking.bookingItems[0].roomTypeId, type: 'HOLD' } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
  await waitForMail((m) => m.to === email)
  noErrors()
})
