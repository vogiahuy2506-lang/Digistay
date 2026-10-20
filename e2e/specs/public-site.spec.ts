/**
 * The hotel's public site is cached per property (src/lib/public-site/site.ts)
 * and every edit drops that cache. Proved both ways on the production
 * build: a change made behind the app's back stays hidden (cached); the
 * same kind of change through the API shows at once (invalidated).
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { ids } from '../helpers'

test('cached, and an edit through the app shows at once', async ({ page }) => {
  const { subdomain, prop } = ids()
  const prisma = new PrismaClient()
  const original = (await prisma.property.findUniqueOrThrow({ where: { id: prop } })).name
  try {
    await page.goto(`/${subdomain}`)
    await expect(page.getByText(original).first()).toBeVisible()

    // Behind the app's back: the cached site does not see it.
    await prisma.property.update({ where: { id: prop }, data: { name: 'Tên đổi thẳng trong DB' } })
    await page.goto(`/${subdomain}`)
    await expect(page.getByText(original).first()).toBeVisible()
    await expect(page.getByText('Tên đổi thẳng trong DB')).toHaveCount(0)

    // Through the app: shown on the next visit.
    const res = await page.request.patch(`/api/properties/${prop}`, { data: { name: 'Khách sạn Demo Đổi Tên' } })
    expect(res.status()).toBe(200)
    await page.goto(`/${subdomain}`)
    await expect(page.getByText('Khách sạn Demo Đổi Tên').first()).toBeVisible()

    await page.request.patch(`/api/properties/${prop}`, { data: { name: original } })
    await page.goto(`/${subdomain}`)
    await expect(page.getByText(original).first()).toBeVisible()
  } finally {
    await prisma.property.update({ where: { id: prop }, data: { name: original } })
    await page.request.patch(`/api/properties/${prop}`, { data: { name: original } })
    await prisma.$disconnect()
  }
})

test('a deactivated hotel disappears at once (the subdomain lookup is not cached)', async ({ page }) => {
  const { subdomain, prop } = ids()
  const prisma = new PrismaClient()
  try {
    expect((await page.goto(`/${subdomain}`))?.status()).toBe(200)
    await prisma.property.update({ where: { id: prop }, data: { isActive: false } })
    expect((await page.goto(`/${subdomain}`))?.status()).toBe(404)
  } finally {
    await prisma.property.update({ where: { id: prop }, data: { isActive: true } })
    await prisma.$disconnect()
  }
})
