/**
 * The operator pages (/admin): SUPER_ADMIN only; the system page shows the
 * scheduled jobs and problems once they have run.
 */
import { test, expect } from '@playwright/test'
import { E2E } from '../env'
import { failOnPageErrors, leftLogin, signIn } from '../helpers'

test('a hotel admin does not see it', async ({ page }) => {
  for (const path of ['/admin/system', '/admin/customers']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  }
  await page.goto('/profile')
  await expect(page.getByText('Thông tin cá nhân').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Trang quản trị' })).toHaveCount(0)
})

test.describe('as SUPER_ADMIN', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows health, the jobs after a run, and problems', async ({ page, request }) => {
    const noErrors = failOnPageErrors(page)
    for (const job of ['payos-reconcile', 'einvoice-jobs', 'email-outbox', 'ops-alerts']) {
      const res = await request.post(`/api/internal/${job}`, { headers: { 'x-cron-secret': E2E.cronSecret } })
      expect(res.status(), job).toBe(200)
    }

    await signIn(page, E2E.users.root.username)
    await leftLogin(page)
    await page.goto('/profile')
    await page.getByRole('link', { name: 'Trang quản trị' }).click()
    // /admin opens on the customers; the system page is one of its tabs.
    await expect(page.getByRole('heading', { name: 'Khách hàng', level: 1 })).toBeVisible()
    await page.getByRole('navigation').getByRole('link', { name: 'Hệ thống' }).click()
    await expect(page.getByRole('heading', { name: 'Hệ thống', level: 1 })).toBeVisible()
    await expect(page.getByText('Đủ', { exact: true })).toBeVisible() // migrations
    const jobs = page.locator('section', { has: page.getByRole('heading', { name: 'Job định kỳ' }) })
    await expect(jobs.getByRole('row', { name: /Đối soát PayOS/ })).toContainText('SUCCESS')
    await expect(jobs.getByRole('row', { name: /Backup database/ })).toContainText('Chưa chạy lần nào')
    // No backup ever ran here: that is a current problem.
    await expect(page.getByText('Chưa có bản backup database hằng ngày nào').first()).toBeVisible()
    await expect(page.getByText('ops@digistay.test')).toBeVisible()
    noErrors()
  })
})
