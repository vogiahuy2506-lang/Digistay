/**
 * The hotel's restaurant menu (src/lib/menu/menu.ts): add dishes in the
 * dashboard (an upload says plainly that no photo storage is set up; a
 * pasted link works), reorder the groups, and see them on the website's
 * menu block, hidden ones left out. The block is put on the site straight
 * in the database (the website builder adds it), and removed again, so the
 * specs after this one keep the default layout.
 */
import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { failOnPageErrors, ids, propertyPath } from '../helpers'

// A 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

async function fillDish(page: Page, dish: { name: string; category: string; price: string; description?: string }) {
  // The Vietnamese fields come first; the same labels sit in the closed English fold.
  const field = (name: string) => page.getByRole('dialog').getByRole('textbox', { name, exact: true }).first()
  await field('Tên món').fill(dish.name)
  // With its suggestions the group field is a combobox.
  await page.getByRole('dialog').getByRole('combobox', { name: 'Nhóm', exact: true }).first().fill(dish.category)
  await page.getByRole('dialog').getByRole('spinbutton', { name: 'Giá (VND)' }).fill(dish.price)
  if (dish.description) await field('Mô tả').fill(dish.description)
}

const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('dishes added in the dashboard show on the website, grouped and in order', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  page.on('dialog', (d) => d.accept())
  const { prop, subdomain } = ids()
  const prisma = new PrismaClient()
  try {
    await page.goto(propertyPath('/menu'))
    await expect(page.getByText('Chưa có món nào')).toBeVisible()

    // 1. A dish with a photo: no storage is set up, so the upload says so; a link works.
    await page.getByRole('button', { name: 'Thêm món đầu tiên' }).click()
    await fillDish(page, { name: 'Phở bò', category: 'Món chính', price: '65000', description: 'Bánh phở tươi, bò tái' })
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[type=file]').setInputFiles({ name: 'pho.png', mimeType: 'image/png', buffer: PNG })
    await expect(dialog.getByText('Chưa cấu hình nơi lưu ảnh')).toBeVisible()
    await dialog.getByLabel('Hoặc dán liên kết ảnh').fill('https://pho.invalid/pho.jpg')
    await dialog.getByRole('button', { name: 'Thêm món', exact: true }).click()
    await expect(page.getByText('Đã thêm món')).toBeVisible()

    await page.getByRole('button', { name: 'Thêm món', exact: true }).click()
    await fillDish(page, { name: 'Trà đá', category: 'Đồ uống', price: '15000' })
    await page.getByRole('dialog').getByRole('button', { name: 'Thêm món', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Đồ uống' })).toBeVisible()

    // 2. The site gets a menu block; moving a group (through the API) drops the site's cache.
    await prisma.websiteBlock.create({
      data: { propertyId: prop, type: 'RESTAURANT_MENU', name: 'Thực đơn', config: { menuNote: 'Đặt bàn: 0900 000 000' } },
    })
    await page.getByRole('button', { name: 'Đưa nhóm Đồ uống lên' }).click()
    await expect
      .poll(async () => (await prisma.menuItem.findMany({ where: { propertyId: prop }, orderBy: { sortOrder: 'asc' } })).map((i) => i.name))
      .toEqual(['Trà đá', 'Phở bò'])

    // 3. Guests see both groups in that order, with prices and the photo.
    await page.goto(`/${subdomain}`)
    const menu = page.locator('#menu')
    await expect(menu.getByRole('heading', { name: 'Thực đơn nhà hàng' })).toBeVisible()
    await expect(menu).toContainText('Đặt bàn: 0900 000 000')
    await expect(menu.getByRole('heading', { level: 3 })).toHaveText(['Đồ uống', 'Món chính'])
    await expect(menu.getByRole('listitem').filter({ hasText: 'Phở bò' })).toContainText('65.000')
    await expect(menu.getByRole('img', { name: 'Phở bò' })).toHaveAttribute('src', 'https://pho.invalid/pho.jpg')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await noSideways(page)).toBe(true)

    // 4. A dish taken off sale leaves the site, and stays in the dashboard.
    await page.goto(propertyPath('/menu'))
    expect(await noSideways(page)).toBe(true)
    await page.getByRole('button', { name: 'Sửa Phở bò' }).click()
    await page.getByRole('dialog').getByRole('checkbox').uncheck()
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByText('Đã lưu món')).toBeVisible()
    await expect(page.getByText('Đang ẩn')).toBeVisible()

    await page.goto(`/${subdomain}`)
    await expect(page.locator('#menu')).toContainText('Trà đá')
    await expect(page.locator('#menu')).not.toContainText('Phở bò')
  } finally {
    await prisma.websiteBlock.deleteMany({ where: { propertyId: prop, type: 'RESTAURANT_MENU' } })
    // Deleting through the API drops the site's cache too.
    for (const item of await prisma.menuItem.findMany({ where: { propertyId: prop } })) {
      await page.request.delete(`/api/properties/${prop}/menu/${item.id}`)
    }
    await prisma.$disconnect()
  }
  noErrors()
})
