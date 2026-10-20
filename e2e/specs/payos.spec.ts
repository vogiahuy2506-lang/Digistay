/**
 * PayOS per hotel (Part 5): connect the hotel's account, take a payment by
 * link, the guest pays, the signed webhook updates the booking; cancel.
 */
import { test, expect } from '@playwright/test'
import { E2E } from '../env'
import { control, failOnPageErrors, ids, propertyPath } from '../helpers'

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
