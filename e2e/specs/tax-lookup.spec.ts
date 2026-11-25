/**
 * Staff invoice dialog fills the company in from its tax code
 * (src/lib/einvoice/tax-lookup.ts, faked in e2e/fakes.ts).
 * Guest booking form no longer includes invoice request (only for Digistay plans).
 */
import { test, expect } from '@playwright/test'
import { E2E } from '../env'
import { failOnPageErrors, propertyPath } from '../helpers'

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
