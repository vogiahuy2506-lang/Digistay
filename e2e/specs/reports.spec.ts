/**
 * The revenue report (src/lib/reports/revenue.ts): one past Vietnam day's
 * money by method, the method filter, and the CSV export. The day is in
 * January so the other specs' payments (made today) never land in it.
 */
import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { failOnPageErrors, ids, propertyPath } from '../helpers'

test('a custom day shows its money by method, filters by method, and exports the payments', async ({ page }) => {
  const noErrors = failOnPageErrors(page)
  const prisma = new PrismaClient()
  try {
    const propertyId = ids().prop
    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'DSE2EREPORT',
        propertyId,
        guestName: 'Lê Văn Báo Cáo',
        guestEmail: 'baocao@example.com',
        guestPhone: '0900000009',
        checkInDate: new Date('2026-01-20T07:00:00Z'),
        checkOutDate: new Date('2026-01-21T05:00:00Z'),
        subtotal: 1_200_000,
        totalAmount: 1_200_000,
        status: 'CONFIRMED',
        createdAt: new Date('2026-01-15T02:00:00Z'),
      },
    })
    const pay = (amount: number, method: 'CASH' | 'QR_VIETQR' | 'CREDIT_CARD', paidAt: string) =>
      prisma.payment.create({
        data: { bookingId: booking.id, propertyId, amount, netAmount: amount, method, status: 'PAID', paidAt: new Date(paidAt) },
      })
    await pay(300_000, 'CASH', '2026-01-15T03:00:00Z')
    await pay(500_000, 'QR_VIETQR', '2026-01-15T16:30:00Z') // 23:30 on the 15th in Vietnam
    await pay(400_000, 'CREDIT_CARD', '2026-01-15T17:30:00Z') // 00:30 on the 16th: another day

    await page.goto(propertyPath('/reports'))
    // Wait for the client render (the period line comes with the report's data): an
    // intermittent hydration error (#418, also seen on the hotel site) briefly leaves
    // the server copy of the page next to the client one.
    await expect(page.getByText(/\(giờ Việt Nam\)$/)).toBeVisible()
    await expect(page.getByLabel('Khoảng thời gian')).toHaveCount(1)
    await page.getByLabel('Khoảng thời gian').selectOption('custom')
    await page.getByLabel('Từ ngày').fill('2026-01-15')
    await page.getByLabel('Đến ngày').fill('2026-01-15')
    await expect(page.getByText('Từ 15/01/2026 đến 15/01/2026')).toBeVisible()

    const received = page.locator('div', { has: page.getByText('Tiền thu vào', { exact: true }) }).last()
    await expect(received).toContainText('800.000')
    await expect(received).toContainText('2 giao dịch')
    await expect(page.getByText('Đơn đặt mới', { exact: true })).toBeVisible()

    await page.getByLabel('Hình thức thanh toán').selectOption('CASH')
    await expect(page.getByText('· Tiền mặt')).toBeVisible()
    await expect(received).toContainText('300.000')

    await page.getByRole('button', { name: 'Xuất Excel' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('Giao dịch (CSV, mở bằng Excel)').click(),
    ])
    expect(download.suggestedFilename()).toBe('giao-dich_2026-01-15_2026-01-15.csv')
    const csv = readFileSync((await download.path())!, 'utf8')
    expect(csv.startsWith('﻿Thời gian,Loại,Mã đơn,Khách,Hình thức,Số tiền (VND),Mã giao dịch')).toBe(true)
    expect(csv).toContain('Thu,DSE2EREPORT,Lê Văn Báo Cáo,Tiền mặt,300000')
    expect(csv).not.toContain('500000') // filtered out: QR
  } finally {
    await prisma.$disconnect()
  }
  noErrors()
})
