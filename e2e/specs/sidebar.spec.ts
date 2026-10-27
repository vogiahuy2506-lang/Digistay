/**
 * The dashboard sidebar (src/components/layout/workspace-shell.tsx): folds
 * to a rail of icons and stays so after a reload (the ds-sidebar cookie);
 * its edge drags it wider; the website builder folds it on its own, and
 * opening it there is not kept.
 */
import { test, expect, type Page } from '@playwright/test'
import { failOnPageErrors, propertyPath } from '../helpers'

const sidebarWidth = (page: Page) => page.locator('aside').evaluate((el) => Math.round(el.getBoundingClientRect().width))

test('folds, resizes, and gives the website builder the room', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  await page.goto(propertyPath())
  const aside = page.locator('aside')
  await expect(aside.getByRole('link', { name: 'Về trang chủ Digistay' })).toHaveAttribute('href', '/')

  await aside.getByRole('button', { name: 'Thu gọn thanh bên' }).click()
  await expect.poll(() => sidebarWidth(page)).toBe(64)
  // The rail still leads everywhere, by icon.
  await expect(aside.getByRole('link', { name: 'Đặt phòng' })).toBeVisible()
  await page.reload()
  await expect.poll(() => sidebarWidth(page)).toBe(64)

  await aside.getByRole('button', { name: 'Mở rộng thanh bên' }).click()
  await expect.poll(() => sidebarWidth(page)).toBe(256)
  const edge = (await page.getByRole('separator', { name: 'Độ rộng thanh bên' }).boundingBox())!
  await page.mouse.move(edge.x + edge.width / 2, 300)
  await page.mouse.down()
  await page.mouse.move(edge.x + edge.width / 2 + 62, 300, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => sidebarWidth(page)).toBe(318)

  // The builder folds it; opening it there lasts until leaving the page.
  await aside.getByRole('link', { name: 'Website khách sạn' }).click()
  await expect(page.getByRole('heading', { name: 'Thiết kế website' })).toBeVisible()
  await expect.poll(() => sidebarWidth(page)).toBe(64)
  await aside.getByRole('button', { name: 'Mở rộng thanh bên' }).click()
  await expect.poll(() => sidebarWidth(page)).toBe(318)
  await aside.getByRole('link', { name: 'Tổng quan' }).click()
  await expect.poll(() => sidebarWidth(page)).toBe(318)
  await aside.getByRole('link', { name: 'Website khách sạn' }).click()
  await expect.poll(() => sidebarWidth(page)).toBe(64)

  // The editor column folds away too: the site takes the width.
  await page.getByRole('button', { name: 'Ẩn cột chỉnh sửa để xem website rộng hơn' }).click()
  await expect(page.locator('#builder-panel')).toBeHidden()
  await page.getByRole('button', { name: 'Hiện cột chỉnh sửa' }).click()
  await expect(page.locator('#builder-panel').getByRole('tab', { name: 'Khối' })).toBeVisible()
  noErrors()
})
