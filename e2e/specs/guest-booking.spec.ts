/**
 * A guest books on the hotel's site, without an account — which never
 * worked before (POST /api/bookings only took staff). The total the page
 * shows is what the booking is charged, the guest's hold is released by
 * their booking, and the confirmation email goes out.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { ids, failOnPageErrors, waitForMail } from '../helpers'
import { quoteStay, ratesFrom } from '../../src/lib/pricing/quote'

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
  await page.locator('article').getByRole('link', { name: 'Đặt phòng', exact: true }).first().click()
  await page.waitForURL(/\/dat-phong\?/)

  await page.locator('#bk-name').fill('Phạm Minh Khách')
  await page.locator('#bk-phone').fill('0912345678')
  await page.locator('#bk-email').fill(email)

  // The hotel's real services (no more hard-coded "Ăn sáng"/"Đưa đón").
  await page.getByRole('button', { name: 'Thêm Ăn sáng buffet' }).click()
  const summary = page.locator('aside').last()
  await expect(summary).toContainText('Ăn sáng buffet × 1')
  const total = digits(await summary.locator('div', { hasText: 'Tổng' }).last().locator('span').last().innerText())
  expect(total).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Gửi yêu cầu đặt phòng' }).click()
  await page.waitForURL(/\/xac-nhan\//)
  await expect(page.getByText('Chờ khách sạn xác nhận')).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
  const code = (await page.locator('p.font-mono').first().innerText()).trim()
  await expect(page.locator('aside')).toContainText(total.toLocaleString('vi-VN'))

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

test("a room page quotes that room type's own price, as the booking charges it", async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  const { subdomain, prop } = ids()
  const checkIn = day(50)
  const checkOut = day(53)

  const prisma = new PrismaClient()
  let roomType, config
  try {
    // Deluxe: its own price differs from the property's "Bảng giá" (Standard's),
    // which this page used to show for every room type.
    roomType = await prisma.roomType.findFirstOrThrow({
      where: { propertyId: prop, slug: 'deluxe' },
      include: { pricing: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    config = await prisma.pricingConfig.findFirstOrThrow({ where: { propertyId: prop, isActive: true } })
  } finally {
    await prisma.$disconnect()
  }
  const rates = ratesFrom(roomType.pricing[0], config)!
  expect(rates.weekdayPrice).not.toBe(config.weekdayPrice)
  const adults = Math.min(2, roomType.maxAdults)
  const quote = quoteStay({
    rates,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    numAdults: adults,
    numChildren: 0,
    baseOccupancy: roomType.baseOccupancy,
  })

  await page.goto(`/${subdomain}/rooms/${roomType.id}?checkIn=${checkIn}&checkOut=${checkOut}`)
  const box = page.locator('#dat-phong')
  await expect(box.locator('p').first()).toContainText(rates.weekdayPrice.toLocaleString('vi-VN'))
  const estimate = digits(await box.locator('div', { hasText: 'Tạm tính' }).last().locator('dd').innerText())
  expect(estimate).toBe(quote.total)
  noErrors()
})

test('a family picks a child on the room page; the search page keeps it, and the child is priced and charged', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  const { subdomain, prop } = ids()
  const prisma = new PrismaClient()
  try {
    const deluxe = await prisma.roomType.findFirstOrThrow({ where: { propertyId: prop, slug: 'deluxe' } })
    await page.goto(`/${subdomain}/rooms/${deluxe.id}?checkIn=${day(90)}&checkOut=${day(92)}`)
    await page.getByRole('button', { name: 'Tăng trẻ em' }).click()
    await page.locator('#dat-phong').getByRole('button', { name: 'Đặt phòng' }).click()

    await expect(page.getByText('2 người lớn, 1 trẻ em')).toBeVisible()
    await page.locator('article').getByRole('link', { name: 'Đặt phòng', exact: true }).first().click()
    await page.waitForURL(/\/dat-phong\?/)
    await page.locator('#bk-name').fill('Gia Đình Nhỏ')
    await page.locator('#bk-phone').fill('0912345678')
    await page.locator('#bk-email').fill(`giadinh-${Date.now()}@example.com`)
    await page.getByRole('button', { name: 'Gửi yêu cầu đặt phòng' }).click()
    await page.waitForURL(/\/xac-nhan\//)
    const code = (await page.locator('p.font-mono').first().innerText()).trim()

    // The child is a child: the property's 150,000 a night, two nights, no adult surcharge.
    expect(await prisma.booking.findUniqueOrThrow({ where: { bookingCode: code } })).toMatchObject({
      numAdults: 2,
      numChildren: 1,
      extraCharges: 300_000,
    })
  } finally {
    await prisma.$disconnect()
  }
  noErrors()
})
