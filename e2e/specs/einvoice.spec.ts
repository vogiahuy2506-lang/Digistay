/**
 * E-invoices through Mắt Bão (Part 6 and after): connect, issue and email
 * an invoice with its PDF, adjust it down, and auto-issue when a booking is
 * fully paid — the timer's job doing the work.
 */
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { E2E } from '../env'
import { control, failOnPageErrors, ids, propertyPath, waitForMail } from '../helpers'

test('connect, issue + email, adjust down, auto-issue on full payment', async ({ page, request }) => {
  const noErrors = failOnPageErrors(page)
  page.on('dialog', (d) => d.accept())

  // 1. Connect the hotel's Mắt Bão account: a wrong password is refused.
  await page.goto(propertyPath('/invoices'))
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Kết nối', exact: true }).click()
  await page.getByLabel('Mã số thuế khách sạn').fill(E2E.matbaoAccount.taxCode)
  await page.getByLabel('Tên đăng nhập Mắt Bão').fill(E2E.matbaoAccount.username)
  await page.getByLabel('Mật khẩu Mắt Bão').fill('sai-mat-khau')
  await page.getByLabel('Ký hiệu').fill(E2E.matbaoSeries)
  await page.getByLabel('Thuế suất GTGT').selectOption('8')
  await page.getByRole('button', { name: 'Lưu và kiểm tra' }).click()
  await expect(page.getByText('Mắt Bão từ chối đăng nhập')).toBeVisible()
  await page.getByLabel('Mật khẩu Mắt Bão').fill(E2E.matbaoAccount.password)
  await page.getByRole('button', { name: 'Lưu và kiểm tra' }).click()
  await expect(page.getByText('còn 100 số')).toBeVisible()

  // 2. Options: emails on by default, manual issuing; switch to automatic.
  const auto = page.getByLabel(/Tự động: phát hành ngay khi đơn được thanh toán đủ/)
  await expect(page.getByLabel(/Gửi hoá đơn \(PDF\) qua email/)).toBeChecked()
  await expect(page.getByLabel(/Thủ công: lễ tân\/kế toán bấm Phát hành/)).toBeChecked()
  await expect(auto).not.toBeChecked()
  await auto.click() // controlled: flips once the PATCH answers
  await expect(auto).toBeChecked()

  // 3. An invoice for the 2,160,000 ₫ stay, published: emailed with its PDF.
  await page.getByRole('button', { name: 'Tạo hóa đơn' }).first().click()
  await page.waitForFunction((id) => !!document.querySelector(`option[value="${id}"]`), ids().invoiceBooking)
  await page.getByLabel('Đơn đặt phòng').selectOption(ids().invoiceBooking)
  await page.getByLabel('Tên công ty').fill('Công ty TNHH Du Lịch Sen')
  await page.getByLabel(/^Mã số thuế\*?$/).fill('0309876543')
  await page.getByLabel('Địa chỉ công ty').fill('12 Lê Lợi, Quận 1, TP.HCM')
  await page.getByLabel('Họ tên').fill('Nguyễn Văn An')
  await page.getByLabel(/^Email\*?$/).fill('an@sen.vn')
  await expect(page.getByText('Chưa thuế')).toContainText('2.000.000')
  await page.getByRole('button', { name: 'Tạo hóa đơn' }).last().click()
  await expect(page.getByText('Tạo hóa đơn thành công!')).toBeVisible()
  await expect(page.getByText('Tạo hóa đơn thành công!')).toBeHidden()
  await page.locator('tbody tr').first().getByRole('button').nth(1).click() // the eye (0 copies)
  await page.getByRole('button', { name: 'Phát hành', exact: true }).click()
  await expect(page.getByText('Số hoá đơn: 1')).toBeVisible()
  const invoiceMail = await waitForMail((m) => m.to === 'an@sen.vn')
  expect(invoiceMail.raw).toMatch(/text\/html/)
  expect(invoiceMail.raw).toMatch(/application\/pdf/)
  expect(invoiceMail.raw).toMatch(/filename="?hoa-don-1\.pdf/)
  // The dialog has a close button in its header too; this is the footer's.
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).last().click()
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.locator('tbody tr').first().getByRole('button').nth(1).click()
  await expect(page.getByText(/Đã gửi email hoá đơn lúc/)).toBeVisible()

  // 4. Adjust it down by 1,080,000 ₫: TCHDon 3, negative difference.
  await page.getByRole('button', { name: 'Lập hoá đơn điều chỉnh' }).click()
  await page.getByLabel(/^Loại điều chỉnh/).selectOption('decrease')
  await page.getByLabel(/^Số tiền chênh lệch/).fill('1080000')
  await page.getByLabel(/^Lý do điều chỉnh/).fill('Giảm giá cho khách đoàn')
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click()
  await expect(page.getByText(/Điều chỉnh giảm cho hoá đơn số 1/)).toBeVisible()
  await page.getByRole('button', { name: 'Phát hành', exact: true }).click()
  await expect(page.getByText('Số hoá đơn: 2')).toBeVisible()
  const adjustment = (await control.matbaoCalls()).at(-1)!
  expect(adjustment).toMatchObject({ TCHDon: 3, TgTTTBSo: -1_080_000, SHDCLQuan: '1' })
  expect(adjustment.GChu).toContain('Lý do: Giảm giá cho khách đoàn')
  // The dialog has a close button in its header too; this is the footer's.
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).last().click()
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Điều chỉnh giảm HĐ số 1')).toBeVisible()

  // 5. The other booking is paid in full; the timer's job issues and emails its invoice.
  const prisma = new PrismaClient()
  try {
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: ids().autoBooking } })
    await prisma.payment.create({
      data: { bookingId: booking.id, propertyId: booking.propertyId, amount: booking.totalAmount, netAmount: booking.totalAmount, method: 'CASH', status: 'PAID', paidAt: new Date() },
    })
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'PAID', depositAmount: booking.totalAmount } })
  } finally {
    await prisma.$disconnect()
  }
  const job = await request.post('/api/internal/einvoice-jobs', { headers: { 'x-cron-secret': E2E.cronSecret } })
  expect(job.status()).toBe(200)
  expect((await job.json()).data.issued).toMatchObject({ created: 1, published: 1 })
  await waitForMail((m) => m.to === 'hoadon@mai.vn')
  await page.reload()
  await page.waitForLoadState('networkidle')
  const autoRow = page.locator('tbody tr', { hasText: 'Tự động' })
  await expect(autoRow).toHaveCount(1)
  await expect(autoRow.getByText('Công ty CP Lữ Hành Mai')).toBeVisible()

  // 6. Resend by hand.
  const before = (await control.mails()).length
  await autoRow.getByRole('button').nth(1).click()
  await page.getByRole('button', { name: 'Gửi lại email' }).click()
  await expect.poll(async () => (await control.mails()).length).toBe(before + 1)

  noErrors()
})
