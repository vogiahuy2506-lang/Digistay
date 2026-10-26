/**
 * Password sign-in after a failed Google attempt. next-auth sent the visitor
 * back to /login?error=OAuthSignin; the password sign-in then succeeded but
 * the page showed "OAuthSignin" and stayed, because next-auth reads `error`
 * back from its callback URL, which defaulted to that address.
 */
import { test, expect } from '@playwright/test'
import { E2E } from '../env'
import { failOnPageErrors, leftLogin } from '../helpers'

test.use({ storageState: { cookies: [], origins: [] } })

test('a failed Google attempt shows a plain message and does not break password sign-in', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  await page.goto('/login?error=OAuthSignin')
  await expect(page.getByText('Không đăng nhập được bằng Google')).toBeVisible()
  await expect(page.getByText('OAuthSignin')).toHaveCount(0)
  expect(new URL(page.url()).search).toBe('')

  // The error is still in history the way a visitor arrives; sign in from that exact address.
  await page.goto('/login?error=OAuthSignin')
  await page.fill('input[autocomplete=username]', E2E.users.admin.username)
  await page.fill('input[autocomplete=current-password]', E2E.password)
  await page.click('main button[type=submit]')
  await leftLogin(page)
  noErrors()
})
