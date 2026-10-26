/**
 * Sign-up with the form, end to end: the 6-digit code arrives by email,
 * the account is verified, signed in and lands on /workspaces. The e2e
 * environment has (placeholder) Google settings, so the Google button shows.
 */
import { test, expect } from '@playwright/test'
import { failOnPageErrors, waitForMail } from '../helpers'

test.use({ storageState: { cookies: [], origins: [] } })

/** The text of every part of a raw MIME message, transfer encodings undone. */
function mailText(raw: string): string {
  return raw
    .split(/\r\n--[^\r\n]+\r\n/)
    .map((part) => {
      const split = part.indexOf('\r\n\r\n')
      if (split === -1) return part
      const head = part.slice(0, split).toLowerCase()
      const body = part.slice(split + 4)
      if (head.includes('content-transfer-encoding: base64')) return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
      if (head.includes('content-transfer-encoding: quoted-printable'))
        return Buffer.from(body.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8')
      return body
    })
    .join('\n')
}

test('sign up with the form, verify the emailed code, land in the app', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  const stamp = Date.now().toString(36)
  const email = `dangky-${stamp}@digistay.test`
  const password = `Dangky-${stamp}-9`

  await page.goto('/register')
  await expect(page.getByRole('button', { name: 'Đăng ký bằng Google' })).toBeVisible()
  await page.getByLabel('Họ và tên').fill('Nguyễn Thử Đăng Ký')
  await page.getByLabel('Tên đăng nhập').fill(`dangky_${stamp}`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  await expect(page.getByRole('heading', { name: 'Xác thực email' })).toBeVisible()
  const code = mailText((await waitForMail((m) => m.to === email)).raw).match(/OTP: (\d{6})/)?.[1]
  expect(code, 'a 6-digit code in the email').toBeTruthy()
  await page.getByLabel('Mã 6 số').fill(code!)
  await page.getByRole('button', { name: 'Xác thực và vào Digistay' }).click()

  await page.waitForURL((u) => new URL(u).pathname === '/workspaces', { timeout: 20_000 })
  expect((await page.context().cookies()).some((c) => c.name.includes('next-auth.session-token'))).toBe(true)
  noErrors()
})
