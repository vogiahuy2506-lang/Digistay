/**
 * Card deposits through the hotel's SePay account (task 34): the hotel
 * connects SePay, a guest booking on the site pays the deposit by card,
 * SePay (faked in e2e/fakes.ts: it charges at once, sends the IPN, sends the
 * browser back) confirms it, and the guest lands on the confirmation.
 * Runs after payos.spec.ts, which connects PayOS and sets the 30% deposit.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { E2E } from '../env'
import { failOnPageErrors, ids, propertyPath } from '../helpers'

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
const digits = (text: string) => Number(text.replace(/\D/g, ''))

test('the hotel connects SePay; a guest pays the deposit by card and the booking is confirmed', async ({ page, browser }) => {
  const noErrors = failOnPageErrors(page)
  await page.goto(propertyPath('/bank-accounts'))
  // PayOS (connected by payos.spec.ts) shows "Đổi khoá": this is SePay's.
  await page.getByRole('button', { name: 'Kết nối', exact: true }).click()
  await page.getByLabel('Merchant ID').fill(E2E.sepayAccount.merchantId)
  await page.getByLabel('Secret key').fill('sai-khoa')
  await page.getByRole('button', { name: 'Lưu và kết nối' }).click()
  await expect(page.getByText('SePay từ chối Merchant ID hoặc Secret key')).toBeVisible()
  await page.getByLabel('Secret key').fill(E2E.sepayAccount.secretKey)
  await page.getByRole('button', { name: 'Lưu và kết nối' }).click()
  await expect(page.getByText('Đã kết nối SePay').first()).toBeVisible()
  await expect(page.getByText(`/api/webhooks/sepay/${ids().prop}`)).toBeVisible()
  noErrors()

  // A guest, signed out, books with the 30% deposit.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const guest = await context.newPage()
  const guestErrors = failOnPageErrors(guest)
  await guest.goto(`/${ids().subdomain}/search?checkIn=${day(70)}&checkOut=${day(71)}&guests=2`)
  await guest.locator('article').getByRole('link', { name: 'Đặt phòng', exact: true }).first().click()
  await guest.locator('#bk-name').fill('Phan Thị Thẻ')
  await guest.locator('#bk-phone').fill('0912345679')
  await guest.locator('#bk-email').fill(`the-${Date.now()}@example.com`)
  const submit = guest.getByRole('button', { name: /Tiếp tục đặt cọc/ })
  const deposit = digits((await submit.innerText()).replace('Tiếp tục đặt cọc', ''))
  await submit.click()
  await guest.waitForURL(/\/dat-coc\//)

  // By card instead of the QR: SePay's page (the fake) charges it and sends the guest back.
  await expect(guest.getByText('Hoặc trả bằng thẻ')).toBeVisible()
  await guest.getByRole('button', { name: /bằng thẻ$/ }).click()
  await guest.waitForURL(/\/xac-nhan\//, { timeout: 15_000 })
  await expect(guest.getByText('Đã cọc · Đã giữ phòng')).toBeVisible()
  guestErrors()

  const prisma = new PrismaClient()
  try {
    const payment = await prisma.payment.findFirstOrThrow({ where: { paymentGateway: 'SEPAY', status: 'PAID' }, include: { booking: true } })
    expect(payment).toMatchObject({ method: 'CREDIT_CARD', amount: deposit })
    expect(payment.booking).toMatchObject({ status: 'CONFIRMED', depositAmount: deposit })
    expect(payment.metadata).toMatchObject({ sepay: { confirmedBy: 'ipn', cardBrand: 'VISA' } })
  } finally {
    await prisma.$disconnect()
  }
  await context.close()
})
