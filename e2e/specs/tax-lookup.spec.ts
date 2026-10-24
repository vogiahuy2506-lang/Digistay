/**
 * A tax code fills the company's name and address in from the tax register
 * (src/lib/einvoice/tax-lookup.ts, faked in e2e/fakes.ts): on the guest
 * booking form and in the staff invoice dialog. An unknown code says so and
 * leaves the fields to type.
 */
import { test, expect } from '@playwright/test'
import { E2E } from '../env'
import { failOnPageErrors, ids, propertyPath } from '../helpers'

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

test.describe('guest', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the booking form fills the company in from its tax code', async ({ page }) => {
    const noErrors = failOnPageErrors(page)
    await page.goto(`/${ids().subdomain}/search?checkIn=${day(50)}&checkOut=${day(51)}&guests=2`)
    await page.locator('article').getByRole('link', { name: 'Đặt phòng', exact: true }).first().click()
    await page.waitForURL(/\/dat-phong\?/)

    await page.getByLabel('Tôi cần xuất hoá đơn điện tử cho công ty').check()
    await page.locator('#bk-tax').fill('0000000000')
    await expect(page.getByText('Không tìm thấy mã số thuế này')).toBeVisible()
    await expect(page.locator('#bk-company')).toHaveValue('')

    await page.locator('#bk-tax').fill(E2E.taxCompany.taxCode)
    await expect(page.locator('#bk-company')).toHaveValue(E2E.taxCompany.name)
    await expect(page.locator('#bk-vat-address')).toHaveValue(E2E.taxCompany.address)
    await expect(page.getByText('Đã điền tên và địa chỉ theo dữ liệu của cơ quan thuế')).toBeVisible()
    noErrors()
  })
})

test('the staff invoice dialog fills the company in from its tax code', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  await page.goto(propertyPath('/invoices'))
  await page.getByRole('button', { name: 'Tạo hóa đơn' }).first().click()
  await page.getByLabel(/^Mã số thuế\*?$/).fill(E2E.taxCompany.taxCode)
  await expect(page.getByLabel(/^Tên công ty\*?$/)).toHaveValue(E2E.taxCompany.name)
  await expect(page.getByLabel(/^Địa chỉ công ty\*?$/)).toHaveValue(E2E.taxCompany.address)
  await expect(page.getByText('Đã điền tên và địa chỉ theo cơ quan thuế (NNT đang hoạt động).')).toBeVisible()
  noErrors()
})
