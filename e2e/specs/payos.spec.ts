/**
 * PayOS per hotel (Part 5): connect the hotel's account, take a payment by
 * link, the guest pays, the signed webhook updates the booking; cancel.
 * Then a guest's deposit when booking on the hotel's site. In this order:
 * the second test needs the connection the first one makes.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { E2E } from '../env'
import { control, failOnPageErrors, ids, propertyPath } from '../helpers'

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
const digits = (text: string) => Number(text.replace(/\D/g, ''))

test('connect, pay by link, webhook updates the booking, cancel a link', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  page.on('dialog', (d) => d.accept())

  // 1. Connect: a wrong key is refused with PayOS's reason, then the right ones.
  await page.goto(propertyPath('/bank-accounts'))
  await expect(page.getByText('Thanh toán online (PayOS)')).toBeVisible()
  await expect(page.getByText('Chưa kết nối')).toBeVisible()
  await page.getByRole('button', { name: 'Kết nối', exact: true }).click()
  await page.getByLabel('Client ID').fill(E2E.payosAccount.clientId)
  await page.getByLabel('API Key').fill('wrong-key')
  await page.getByLabel('Checksum Key').fill(E2E.payosAccount.checksumKey)
  await page.getByRole('button', { name: 'Lưu và kết nối' }).click()
  await expect(page.getByText('PayOS từ chối kết nối')).toBeVisible()
  await page.getByLabel('API Key').fill(E2E.payosAccount.apiKey)
  await page.getByRole('button', { name: 'Lưu và kết nối' }).click()
  await expect(page.getByText('Đã kết nối', { exact: true })).toBeVisible()
  await expect(page.getByText('Tiền về:')).toContainText('KHACH SAN DEMO')

  // 2. A 500,000 ₫ link for the 1,000,000 ₫ booking.
  const booking = ids().payosBooking
  await page.goto(propertyPath('/payments'))
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Tạo thanh toán' }).first().click()
  await page.waitForFunction((id) => !!document.querySelector(`option[value="${id}"]`), booking)
  await page.getByLabel('Đơn đặt phòng').selectOption(booking)
  await expect(page.getByLabel('Phương thức thanh toán')).toHaveValue('PAYOS')
  await page.getByLabel('Số tiền (VNĐ)').fill('500000')
  await page.getByRole('button', { name: 'Tạo thanh toán' }).last().click()
  await expect(page.getByAltText('Mã QR thanh toán')).toBeVisible()
  await expect(page.locator('code').filter({ hasText: 'pay.payos.vn' })).toBeVisible()

  // 3. The guest pays; PayOS sends the signed webhook.
  const list = await (await page.request.get(`/api/payments?propertyId=${ids().prop}`)).json()
  const link = list.data.find((p: { paymentGateway: string; status: string }) => p.paymentGateway === 'PAYOS' && p.status === 'PENDING')
  expect(await control.pay(link.gatewayOrderCode)).toEqual({ webhookStatus: 200 })
  await page.getByRole('button', { name: 'Đóng' }).click()
  await page.goto(propertyPath('/payments'))
  await expect(page.getByText('Đã thanh toán').first()).toBeVisible()
  const after = (await (await page.request.get(`/api/bookings/${booking}`)).json()).data
  expect([after.depositAmount, after.paymentStatus]).toEqual([500_000, 'PARTIAL'])

  // 4. Cancel an unpaid link from the modal.
  await page.getByRole('button', { name: 'Tạo thanh toán' }).first().click()
  await page.waitForFunction((id) => !!document.querySelector(`option[value="${id}"]`), booking)
  await page.getByLabel('Đơn đặt phòng').selectOption(booking)
  await page.getByLabel('Số tiền (VNĐ)').fill('100000')
  await page.getByRole('button', { name: 'Tạo thanh toán' }).last().click()
  await page.getByRole('button', { name: 'Huỷ link' }).click()
  await expect(page.locator('span:visible', { hasText: 'Đã huỷ' }).first()).toBeVisible()

  noErrors()
})

test("a guest books on the hotel's site and pays the hotel's 30% deposit through PayOS", async ({ page, browser }) => {
  // The hotel takes 30% online, to be paid within an hour (Chính sách).
  await page.goto(propertyPath('/policies'))
  await page.getByLabel('Đặt cọc khi khách đặt trên website (%)').fill('30')
  await page.getByLabel('Tự huỷ đơn nếu khách chưa đặt cọc sau').selectOption({ label: '1 giờ' })
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByText('Đã lưu chính sách')).toBeVisible()

  // A guest, signed out. PayOS's own checkout page is outside: stand in for it.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const guest = await context.newPage()
  const noErrors = failOnPageErrors(guest)
  let orderCode = ''
  await guest.route('https://pay.payos.vn/**', (route) => {
    orderCode = route.request().url().match(/pl(\d+)/)?.[1] ?? ''
    return route.fulfill({ contentType: 'text/html', body: '<h1>PayOS checkout</h1>' })
  })
  const email = `coc-${Date.now()}@example.com`
  await guest.goto(`/${ids().subdomain}/search?checkIn=${day(60)}&checkOut=${day(62)}&guests=2`)
  await guest.locator('article').getByRole('link', { name: 'Đặt phòng', exact: true }).first().click()
  await guest.locator('#bk-name').fill('Đỗ Văn Cọc')
  await guest.locator('#bk-phone').fill('0912345678')
  await guest.locator('#bk-email').fill(email)
  await expect(guest.getByText('Cọc 30% tổng tiền')).toBeVisible()
  await expect(guest.getByText('Thanh toán trong 60 phút')).toBeVisible()
  const submit = guest.getByRole('button', { name: /Tiếp tục đặt cọc/ })
  const deposit = digits((await submit.innerText()).replace('Tiếp tục đặt cọc', ''))
  expect(deposit).toBeGreaterThan(0)
  await submit.click()

  // The QR is on the hotel's own page now; PayOS's page is the fallback link.
  await guest.waitForURL(/\/dat-coc\//)
  await expect(guest.getByRole('heading', { name: 'Chuyển khoản tiền cọc để giữ phòng' })).toBeVisible()
  await expect(guest.getByAltText('Mã QR chuyển khoản tiền cọc, do PayOS tạo')).toBeVisible()
  await expect(guest.getByText('0011223344')).toBeVisible()
  orderCode = (await guest.getByRole('link', { name: 'Mở trang thanh toán PayOS' }).getAttribute('href'))?.match(/pl(\d+)/)?.[1] ?? ''
  expect(orderCode).not.toBe('')

  // The guest pays: PayOS sends the signed webhook; the page moves on by itself.
  expect(await control.pay(orderCode)).toEqual({ webhookStatus: 200 })
  await guest.waitForURL(/\/xac-nhan\//, { timeout: 15_000 })
  await expect(guest.getByText('Đã cọc · Đã giữ phòng')).toBeVisible()

  const prisma = new PrismaClient()
  try {
    const payment = await prisma.payment.findFirstOrThrow({ where: { gatewayOrderCode: orderCode }, include: { booking: true } })
    expect(payment).toMatchObject({ status: 'PAID', amount: deposit })
    expect(payment.booking).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PARTIAL', depositAmount: deposit, guestEmail: email })
  } finally {
    await prisma.$disconnect()
  }
  // The booking request, then "deposit received".
  await expect.poll(async () => (await control.mails()).filter((m) => m.to === email).length, { timeout: 15_000 }).toBe(2)
  noErrors()
  await context.close()
})

test('a guest whose payment code ran out makes a new one, and PayOS sends them back to the deposit page', async ({ browser }) => {
  // The hotel still takes 30% within an hour (set by the test above).
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const guest = await context.newPage()
  const noErrors = failOnPageErrors(guest)
  await guest.route('https://pay.payos.vn/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>PayOS checkout</h1>' }))
  const email = `lai-${Date.now()}@example.com`
  await guest.goto(`/${ids().subdomain}/search?checkIn=${day(80)}&checkOut=${day(82)}&guests=2`)
  await guest.locator('article').getByRole('link', { name: 'Đặt phòng', exact: true }).first().click()
  await guest.locator('#bk-name').fill('Vũ Thị Lại')
  await guest.locator('#bk-phone').fill('0912345678')
  await guest.locator('#bk-email').fill(email)
  await guest.getByRole('button', { name: /Tiếp tục đặt cọc/ }).click()
  await guest.waitForURL(/\/dat-coc\//)
  const depositPage = guest.url()
  const first = (await guest.getByRole('link', { name: 'Mở trang thanh toán PayOS' }).getAttribute('href'))?.match(/pl(\d+)/)?.[1] ?? ''

  // PayOS's own page sends the guest back here (no longer /thanh-toan).
  const prisma = new PrismaClient()
  try {
    const payment = await prisma.payment.findFirstOrThrow({ where: { gatewayOrderCode: first } })
    // The link ran out before the deadline: the page offers a new code.
    await prisma.payment.update({ where: { id: payment.id }, data: { expiresAt: new Date(Date.now() - 60_000) } })
  } finally {
    await prisma.$disconnect()
  }
  await guest.reload()
  await expect(guest.getByRole('heading', { name: 'Mã thanh toán đã hết hạn' })).toBeVisible()
  await guest.getByRole('button', { name: 'Tạo mã mới' }).click()
  await expect(guest.getByRole('heading', { name: 'Chuyển khoản tiền cọc để giữ phòng' })).toBeVisible()
  const second = (await guest.getByRole('link', { name: 'Mở trang thanh toán PayOS' }).getAttribute('href'))?.match(/pl(\d+)/)?.[1] ?? ''
  expect(second).not.toBe('')
  expect(second).not.toBe(first)
  expect(guest.url()).toBe(depositPage)

  expect(await control.pay(second)).toEqual({ webhookStatus: 200 })
  await guest.waitForURL(/\/xac-nhan\//, { timeout: 15_000 })
  await expect(guest.getByText('Đã cọc · Đã giữ phòng')).toBeVisible()
  noErrors()
  await context.close()
})
