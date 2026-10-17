import { emailLayout } from './_layout'
import { formatCurrency } from '@/lib/utils'

interface Props {
  ownerEmail: string
  ownerName?: string
  bookingCode: string
  guestName: string
  guestPhone: string
  guestEmail: string
  propertyName: string
  checkIn: string
  checkOut: string
  totalAmount: number
  currency?: string
  manageUrl: string
  siteUrl: string
}

export function renderOwnerNewBooking(p: Props): string {
  const cur = p.currency ?? 'VND'
  const checkIn = new Date(p.checkIn).toLocaleDateString('vi-VN')
  const checkOut = new Date(p.checkOut).toLocaleDateString('vi-VN')

  const body = `
    <h1 style="margin: 0 0 16px; font-size: 24px;">🔔 Đơn đặt phòng mới</h1>
    <p>Xin chào ${p.ownerName ? escapeHtml(p.ownerName) : 'Quản trị viên'},</p>
    <p>Bạn vừa nhận được một đơn đặt phòng mới tại <strong>${escapeHtml(p.propertyName)}</strong>:</p>

    <div style="background: #ecfdf5; border-left: 4px solid #10B981; border-radius: 4px; padding: 16px 20px; margin: 24px 0;">
      <table>
        <tr>
          <td class="label" style="width: 40%;">Mã đơn</td>
          <td class="value" style="font-weight: 700;">${escapeHtml(p.bookingCode)}</td>
        </tr>
        <tr>
          <td class="label">Khách hàng</td>
          <td class="value">${escapeHtml(p.guestName)}</td>
        </tr>
        <tr>
          <td class="label">Số điện thoại</td>
          <td class="value"><a href="tel:${escapeHtml(p.guestPhone)}">${escapeHtml(p.guestPhone)}</a></td>
        </tr>
        <tr>
          <td class="label">Email</td>
          <td class="value"><a href="mailto:${escapeHtml(p.guestEmail)}">${escapeHtml(p.guestEmail)}</a></td>
        </tr>
        <tr>
          <td class="label">Nhận phòng</td>
          <td class="value">${checkIn}</td>
        </tr>
        <tr>
          <td class="label">Trả phòng</td>
          <td class="value">${checkOut}</td>
        </tr>
        <tr>
          <td class="label">Tổng tiền</td>
          <td class="value" style="color: #10B981; font-size: 18px; font-weight: 700;">${formatCurrency(p.totalAmount, cur)}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${p.manageUrl}" class="btn">Xem & xác nhận đơn</a>
    </div>

    <p style="color: #6b7280; font-size: 13px;">Hãy kiểm tra đơn và sắp xếp phòng cho khách trong thời gian sớm nhất.</p>
  `

  return emailLayout({
    title: `Đơn đặt phòng mới #${p.bookingCode}`,
    preheader: `${p.guestName} đặt phòng tại ${p.propertyName}`,
    body,
    siteUrl: p.siteUrl,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
