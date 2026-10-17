import { emailLayout } from './_layout'
import { formatCurrency } from '@/lib/utils'

interface Props {
  guestName: string
  bookingCode: string
  propertyName: string
  propertyAddress: string
  propertyPhone: string | null
  checkIn: string
  checkOut: string
  numAdults: number
  numChildren: number
  totalAmount: number
  currency?: string
  manageUrl: string
  siteUrl: string
}

export function renderBookingConfirmation(p: Props): string {
  const cur = p.currency ?? 'VND'
  const checkIn = new Date(p.checkIn).toLocaleDateString('vi-VN')
  const checkOut = new Date(p.checkOut).toLocaleDateString('vi-VN')

  const body = `
    <h1 style="margin: 0 0 16px; font-size: 24px;">Cảm ơn bạn đã đặt phòng!</h1>
    <p>Xin chào <strong>${escapeHtml(p.guestName)}</strong>,</p>
    <p>Đơn đặt phòng của bạn tại <strong>${escapeHtml(p.propertyName)}</strong> đã được xác nhận thành công. Dưới đây là thông tin chi tiết:</p>

    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table>
        <tr>
          <td class="label" style="width: 40%;">Mã đặt phòng</td>
          <td class="value">${escapeHtml(p.bookingCode)}</td>
        </tr>
        <tr>
          <td class="label">Cơ sở</td>
          <td class="value">${escapeHtml(p.propertyName)}</td>
        </tr>
        <tr>
          <td class="label">Địa chỉ</td>
          <td class="value">${escapeHtml(p.propertyAddress)}</td>
        </tr>
        ${p.propertyPhone ? `<tr><td class="label">Điện thoại</td><td class="value"><a href="tel:${escapeHtml(p.propertyPhone)}">${escapeHtml(p.propertyPhone)}</a></td></tr>` : ''}
        <tr>
          <td class="label">Nhận phòng</td>
          <td class="value">${checkIn}</td>
        </tr>
        <tr>
          <td class="label">Trả phòng</td>
          <td class="value">${checkOut}</td>
        </tr>
        <tr>
          <td class="label">Số khách</td>
          <td class="value">${p.numAdults} người lớn${p.numChildren > 0 ? `, ${p.numChildren} trẻ em` : ''}</td>
        </tr>
        <tr>
          <td class="label">Tổng tiền</td>
          <td class="value" style="color: #3B82F6; font-size: 18px; font-weight: 700;">${formatCurrency(p.totalAmount, cur)}</td>
        </tr>
      </table>
    </div>

    <p>Vui lòng mang theo giấy tờ tùy thân khi nhận phòng. Nếu có thay đổi, vui lòng liên hệ trực tiếp với cơ sở hoặc truy cập link bên dưới:</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${p.manageUrl}" class="btn">Xem chi tiết đơn đặt phòng</a>
    </div>

    <p style="color: #6b7280; font-size: 13px;">Trân trọng,<br/>Đội ngũ Digistay</p>
  `

  return emailLayout({
    title: `Xác nhận đặt phòng ${p.bookingCode}`,
    preheader: `Đơn đặt phòng tại ${p.propertyName} đã được xác nhận`,
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
