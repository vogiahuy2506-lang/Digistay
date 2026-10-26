/**
 * Buying a plan (src/lib/billing): from the pricing page to the workspace's
 * plan page, the VietQR of Digistay's PayOS account, the money arriving by
 * webhook (the fake PayOS), the plan in force afterwards. Business, so the
 * other specs keep at least the trial's limits.
 */
import { test, expect, type Page } from '@playwright/test'
import { control, failOnPageErrors, ids } from '../helpers'

async function workspaceId(page: Page): Promise<string> {
  const list = (await (await page.request.get('/api/workspaces')).json()).data as { id: string; slug: string }[]
  return list.find((w) => w.slug === ids().ws)!.id
}

test('the pricing page leads to the plan page, the QR is paid, the plan is active', async ({ page }) => {
  const noErrors = failOnPageErrors(page)

  // "Đăng ký gói này" for Business (monthly): signed in with one workspace → its plan page, the QR open.
  await page.goto('/pricing')
  await page.getByRole('link', { name: 'Đăng ký gói này' }).nth(2).click()
  await page.waitForURL(new RegExp(`/workspace/${ids().ws}/billing\\?plan=business&billing=MONTH`))
  const dialog = page.getByRole('dialog', { name: 'Quét mã để thanh toán' })
  await expect(dialog.getByRole('img', { name: 'Mã VietQR thanh toán gói Digistay' })).toBeVisible()
  await expect(dialog).toContainText('10.000')
  await expect(dialog).toContainText('DIGISTAY BUSINESS THANG')

  // PayOS reports the money: the page notices within a poll.
  const plan = (await (await page.request.get(`/api/workspaces/${await workspaceId(page)}/subscription`)).json()).data
  expect((await control.pay(plan.pending.orderCode)).webhookStatus).toBe(200)
  await expect(dialog.getByRole('heading', { name: 'Đã kích hoạt gói Business' })).toBeVisible({ timeout: 15_000 })
  await dialog.getByRole('button', { name: 'Đóng' }).click()

  await expect(page.getByRole('heading', { name: 'Business', exact: true })).toBeVisible()
  await expect(page.getByText('Đang dùng', { exact: true })).toBeVisible()
  await expect(page.getByText('Đã thanh toán', { exact: true })).toBeVisible()
  noErrors()
})
