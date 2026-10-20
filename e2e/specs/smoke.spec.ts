import { test, expect } from '@playwright/test'
import { ids } from '../helpers'

test('health: database with every migration, Redis up', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ status: 'ok', redis: 'ok' })
})

test('the hotel site renders; unknown pages and records are 404, not 500', async ({ page, request }) => {
  const res = await page.goto(`/${ids().subdomain}`)
  expect(res?.status()).toBe(200)
  await expect(page.getByText('Khách sạn Demo', { exact: false }).first()).toBeVisible()
  expect((await page.goto('/khong-ton-tai'))?.status()).toBe(404)
  // These returned 500 on production when its database had no tables.
  expect((await request.get('/api/invitations/khong-ton-tai-0000')).status()).toBe(404)
  expect((await request.get('/api/properties/public?subdomain=khong-ton-tai')).status()).toBe(404)
})
