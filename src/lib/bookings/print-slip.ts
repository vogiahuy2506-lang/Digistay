import { escapeHtml } from '@/lib/utils/escape-html'

export interface PrintSlipBooking {
  bookingCode: string
  guestName: string
  guestPhone: string
  guestEmail: string
  checkInDate: string
  checkOutDate: string
  numAdults: number
  numChildren: number
  totalAmount: number
  depositAmount: number
  property: { name: string; address?: string | null; phone?: string | null }
}

/**
 * The printed booking slip ("In phiếu" on the booking page). It is written
 * into a window that shares the dashboard's origin, so every value is
 * escaped: a guest name like `<img src=x onerror=...>` must print as text,
 * not run as script with the staff member's session.
 */
export function buildPrintSlipHtml(
  b: PrintSlipBooking,
  roomNumber: string,
  format: { date: (value: string) => string; money: (amount: number) => string }
): string {
  const e = escapeHtml
  return `
      <html>
        <head>
          <title>Phieu dat phong - ${e(b.bookingCode)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; }
            .section { margin: 20px 0; }
            .label { color: #666; font-size: 12px; }
            .value { font-size: 16px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 8px 0; }
          </style>
        </head>
        <body>
          <h1>PHIẾU ĐẶT PHÒNG</h1>
          <div class="section">
            <div class="label">Mã đặt phòng</div>
            <div class="value">${e(b.bookingCode)}</div>
          </div>
          <div class="section">
            <h2>Thông tin khách</h2>
            <table>
              <tr><td class="label">Tên</td><td>${e(b.guestName)}</td></tr>
              <tr><td class="label">Điện thoại</td><td>${e(b.guestPhone)}</td></tr>
              <tr><td class="label">Email</td><td>${e(b.guestEmail)}</td></tr>
            </table>
          </div>
          <div class="section">
            <h2>Thông tin phòng</h2>
            <table>
              <tr><td class="label">Nhận phòng</td><td>${e(format.date(b.checkInDate))}</td></tr>
              <tr><td class="label">Trả phòng</td><td>${e(format.date(b.checkOutDate))}</td></tr>
              <tr><td class="label">Số khách</td><td>${b.numAdults} NL${b.numChildren > 0 ? ` + ${b.numChildren} TE` : ''}</td></tr>
              <tr><td class="label">Số phòng</td><td>${e(roomNumber || 'Chưa gán')}</td></tr>
            </table>
          </div>
          <div class="section">
            <h2>Thông tin thanh toán</h2>
            <table>
              <tr><td class="label">Tổng tiền</td><td style="font-size: 20px;">${e(format.money(b.totalAmount))}</td></tr>
              <tr><td class="label">Đã thanh toán</td><td>${e(format.money(b.depositAmount))}</td></tr>
            </table>
          </div>
          <div class="section">
            <p><strong>Cơ sở:</strong> ${e(b.property.name)}</p>
            <p><strong>Địa chỉ:</strong> ${e(b.property.address)}</p>
            <p><strong>Điện thoại:</strong> ${e(b.property.phone)}</p>
          </div>
        </body>
      </html>
    `
}
