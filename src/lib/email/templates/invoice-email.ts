import { emailLayout } from './_layout'
import { formatCurrency } from '@/lib/utils'

interface Props {
  customerEmail: string
  customerName: string
  invoiceNumber: string
  bookingCode: string
  propertyName: string
  totalAmount: number
  taxAmount: number
  pdfUrl: string
  xmlUrl?: string
  currency?: string
  siteUrl: string
}

export function renderInvoiceEmail(p: Props): string {
  const cur = p.currency ?? 'VND'

  const body = `
    <h1 style="margin: 0 0 16px; font-size: 24px;">Hóa đơn điện tử của bạn</h1>
    <p>Xin chào <strong>${escapeHtml(p.customerName)}</strong>,</p>
    <p>Cảm ơn bạn đã sử dụng dịch vụ tại <strong>${escapeHtml(p.propertyName)}</strong>. Hóa đơn điện tử của bạn đã được phát hành hợp lệ.</p>

    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table>
        <tr>
          <td class="label" style="width: 40%;">Số hóa đơn</td>
          <td class="value">${escapeHtml(p.invoiceNumber)}</td>
        </tr>
        <tr>
          <td class="label">Mã đặt phòng</td>
          <td class="value">${escapeHtml(p.bookingCode)}</td>
        </tr>
        <tr>
          <td class="label">Tiền thuế VAT</td>
          <td class="value">${formatCurrency(p.taxAmount, cur)}</td>
        </tr>
        <tr>
          <td class="label">Tổng thanh toán</td>
          <td class="value" style="color: #3B82F6; font-size: 18px; font-weight: 700;">${formatCurrency(p.totalAmount, cur)}</td>
        </tr>
      </table>
    </div>

    <p>Bạn có thể tải hóa đơn về máy hoặc tra cứu trực tiếp với cơ quan thuế:</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${p.pdfUrl}" class="btn">📄 Tải hóa đơn PDF</a>
      ${p.xmlUrl ? `<a href="${p.xmlUrl}" style="margin-left: 12px; color: #3B82F6; font-size: 14px;">Tải XML</a>` : ''}
    </div>

    <p style="color: #6b7280; font-size: 13px;">Hóa đơn này được ký số và có hiệu lực pháp lý theo quy định của Tổng cục Thuế Việt Nam.</p>
  `

  return emailLayout({
    title: `Hóa đơn ${p.invoiceNumber}`,
    preheader: `Hóa đơn điện tử từ ${p.propertyName}`,
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
