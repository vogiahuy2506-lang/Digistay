/**
 * The hotel's numbered rooms and the room timeline (tasks 25 / 27,
 * src/lib/bookings/rooms.ts): list rooms, book an empty night of a room
 * from the timeline, drag the stay to another room, open it in the panel.
 * Uses Suite (5 rooms in the seed) and lists 5, so its count stays 5 for
 * the specs after this one.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { failOnPageErrors, propertyPath } from '../helpers'

/** dd/mm and yyyy-mm-dd of a Vietnam day `offset` days from today. */
function day(offset: number) {
  const iso = new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10)
  return { iso, label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}` }
}

test('list rooms, book a room from the timeline, drag the guest to another room', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  page.on('dialog', (d) => d.accept())

  // 1. The room list: Suite gets rooms 501-505.
  await page.goto(propertyPath('/rooms'))
  await page.getByRole('button', { name: 'Danh sách phòng' }).click()
  await page.getByLabel('Thêm phòng cho Suite').fill('501-505')
  await page.getByLabel('Thêm phòng cho Suite').press('Enter')
  await expect(page.getByText('Đã thêm 5 phòng')).toBeVisible()
  await expect(page.getByText('5 phòng đang dùng / 5 phòng')).toBeVisible()

  // 2. The timeline shows them; an empty night of 502 opens a walk-in for that room.
  await page.goto(propertyPath('/calendar'))
  await page.getByRole('tab', { name: 'Sơ đồ phòng' }).click()
  const night = day(3)
  await page.getByRole('button', { name: `Tạo đơn đêm ${night.label} 502` }).click()
  const form = page.getByRole('dialog')
  await expect(form).toContainText('Phòng 502.')
  await form.getByPlaceholder('Ví dụ: Nguyễn Văn An').fill('Khách Sơ Đồ')
  await form.getByPlaceholder('0987 654 321').fill('0912345611')
  await form.getByPlaceholder('an.nguyen@example.com').fill('sodo@example.com')
  await page.getByRole('button', { name: 'Tạo đơn', exact: true }).click()
  await expect(page.getByText('Tạo đơn đặt phòng thành công')).toBeVisible()

  const prisma = new PrismaClient()
  try {
    const item = () => prisma.bookingItem.findFirstOrThrow({ where: { booking: { guestName: 'Khách Sơ Đồ' } }, include: { booking: true } })
    expect((await item()).roomNumber).toBe('502')

    // 3. Drag the stay to 504.
    const bar = page.getByRole('button', { name: /Khách Sơ Đồ/ })
    await expect(bar).toBeVisible()
    await bar.dragTo(page.getByRole('button', { name: `Tạo đơn đêm ${day(5).label} 504` }))
    await expect(page.getByText(/sang phòng 504/).first()).toBeVisible()
    expect((await item()).roomNumber).toBe('504')

    // 4. A click opens the booking in the panel.
    await page.getByRole('button', { name: /Khách Sơ Đồ/ }).click()
    await expect(page.getByRole('dialog')).toContainText((await item()).booking.bookingCode)
  } finally {
    await prisma.$disconnect()
  }
  noErrors()
})
