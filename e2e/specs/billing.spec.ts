/**
 * Buying a plan (src/lib/billing): from the pricing page to the workspace's
 * plan page, what the purchase does and who the e-invoice is for (a company
 * filled in from its tax code), the VietQR of Digistay's PayOS account, the
 * money arriving by webhook (the fake PayOS), the plan in force afterwards
 * and its invoice issued on Digistay's Mắt Bão account (the fake Mắt Bão).
 * Business, so the other specs keep at least the trial's limits.
 */
import { test, expect, type Page } from '@playwright/test'
import { E2E } from '../env'
import { control, failOnPageErrors, ids } from '../helpers'

async function workspaceId(page: Page): Promise<string> {
  const list = (await (await page.request.get('/api/workspaces')).json()).data as { id: string; slug: string }[]
  return list.find((w) => w.slug === ids().ws)!.id
}

test('the pricing page leads to the plan page, the QR is paid, the plan is active with its invoice', async ({ page }) => {
  const noErrors = failOnPageErrors(page)

  // "Đăng ký gói này" for Business (monthly): signed in with one workspace → its plan page, the purchase open.
  await page.goto('/pricing')
  await page.getByRole('link', { name: 'Đăng ký gói này' }).nth(2).click()
  await page.waitForURL(new RegExp(`/workspace/${ids().ws}/billing\\?plan=business&billing=MONTH`))
  const review = page.getByRole('dialog', { name: 'Mua gói Business' })
  await expect(review).toContainText('10.000')
  // On the trial: the days left do not carry over.
  await expect(review).toContainText('ngày dùng thử')

  // A company invoice: the tax code fills the name and address in.
  await review.getByRole('radio', { name: 'Công ty' }).click()
  await review.getByLabel('Mã số thuế').fill(E2E.taxCompany.taxCode)
  await expect(review.getByLabel('Tên công ty')).toHaveValue(E2E.taxCompany.name)
  await expect(review.getByLabel('Địa chỉ công ty')).toHaveValue(E2E.taxCompany.address)
  await review.getByRole('button', { name: 'Tiếp tục thanh toán' }).click()

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

  // The invoice went out on Digistay's account right after the payment, to the company.
  await expect
    .poll(async () => (await control.matbaoCalls()).find((c) => c.MaTraCuu === `DSG${plan.pending.orderCode}`)?.NMua_MST, { timeout: 15_000 })
    .toBe(E2E.taxCompany.taxCode)
  await page.reload()
  await expect(page.getByRole('link', { name: /^Số \d+$/ })).toBeVisible()
  noErrors()
})
