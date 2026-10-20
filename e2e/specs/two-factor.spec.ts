/**
 * Optional two-factor sign-in (4f), with its own user so the other specs'
 * admin never gets a second factor.
 */
import { test, expect, type BrowserContext } from '@playwright/test'
import { totpForStep } from '../../src/lib/auth/totp'
import { E2E } from '../env'
import { failOnPageErrors, leftLogin, signIn } from '../helpers'

test.use({ storageState: { cookies: [], origins: [] } })

const stepNow = () => Math.floor(Date.now() / 30_000)
let lastStep = 0
/** A code for a step not used yet (each code works once). */
async function nextCode(secret: string) {
  const step = Math.max(stepNow(), lastStep + 1)
  while (step > stepNow() + 1) await new Promise((r) => setTimeout(r, 1000))
  lastStep = step
  return totpForStep(secret, step)
}
const hasSession = async (context: BrowserContext) => (await context.cookies()).some((c) => c.name.includes('next-auth.session-token'))

test('turn on, sign in with a code or a recovery code, turn off', async ({ page, context }) => {
  test.setTimeout(120_000)
  const noErrors = failOnPageErrors(page)
  const user = E2E.users.twoFactor.username

  // 1. Without it, the password alone signs in.
  await signIn(page, user)
  await leftLogin(page)

  // 2. Turn it on from the profile.
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Bảo mật' }).click()
  await page.getByRole('button', { name: 'Bật xác thực hai lớp' }).click()
  await expect(page.getByAltText('Mã QR xác thực hai lớp')).toBeVisible()
  const secret = (await page.locator('code').first().innerText()).replace(/\s/g, '')
  expect(secret).toMatch(/^[A-Z2-7]{32}$/)
  await page.getByPlaceholder('6 số').fill('000000')
  await page.getByRole('button', { name: 'Bật', exact: true }).click()
  await expect(page.getByText('Mã xác thực không đúng')).toBeVisible()
  lastStep = stepNow()
  await page.getByPlaceholder('6 số').fill(totpForStep(secret, lastStep))
  await page.getByRole('button', { name: 'Bật', exact: true }).click()
  await expect(page.getByText('Lưu các mã khôi phục này ở nơi an toàn')).toBeVisible()
  const recovery = await page.locator('.font-mono span').allInnerTexts()
  expect(recovery).toHaveLength(8)
  const done = page.getByRole('button', { name: 'Xong, đăng nhập lại' })
  await expect(done).toBeDisabled()
  // Turning it on signed out every session, this one included.
  expect((await page.request.get('/api/users/me')).status()).toBe(401)
  await page.getByLabel('Tôi đã lưu các mã khôi phục').check()
  await done.click()
  await page.waitForURL(/\/login/)

  // 3. The password gives a code step, not a session.
  await signIn(page, user)
  await expect(page.getByRole('heading', { name: 'Nhập mã xác thực' })).toBeVisible()
  expect(await hasSession(context)).toBe(false)
  await page.getByPlaceholder('6 số').fill('000000')
  await page.getByRole('button', { name: 'Xác nhận' }).click()
  await expect(page.getByText('Mã xác thực không đúng')).toBeVisible()
  await page.getByPlaceholder('6 số').fill(await nextCode(secret))
  await page.getByRole('button', { name: 'Xác nhận' }).click()
  await leftLogin(page)
  expect(await hasSession(context)).toBe(true)

  // 4. A recovery code instead of the app.
  await context.clearCookies()
  await signIn(page, user)
  await page.getByRole('button', { name: 'Dùng mã khôi phục' }).click()
  await page.getByPlaceholder('XXXX-XXXX-XXXX').fill(recovery[0].toLowerCase())
  await page.getByRole('button', { name: 'Xác nhận' }).click()
  await leftLogin(page)

  // 5. Turn it off with the password and a code.
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Bảo mật' }).click()
  await expect(page.getByText('Còn', { exact: false }).filter({ hasText: '7 mã khôi phục' })).toBeVisible()
  await page.getByRole('button', { name: 'Tắt xác thực hai lớp' }).click()
  await page.getByPlaceholder('Mật khẩu hiện tại').last().fill(E2E.password)
  await page.getByPlaceholder('Mã 6 số trong ứng dụng, hoặc một mã khôi phục').fill(await nextCode(secret))
  await page.getByRole('button', { name: 'Tắt xác thực hai lớp' }).last().click()
  await expect(page.getByText('Đã tắt xác thực hai lớp.')).toBeVisible()

  // 6. The password alone again.
  await context.clearCookies()
  await signIn(page, user)
  await leftLogin(page)
  noErrors()
})
