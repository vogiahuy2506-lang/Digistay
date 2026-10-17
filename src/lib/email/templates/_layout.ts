/**
 * Base HTML wrapper for all transactional emails.
 * Provides consistent Digistay branding and Vietnamese-friendly typography.
 */
export function emailLayout({
  title,
  body,
  preheader,
  siteUrl = 'http://localhost:3000',
}: {
  title: string
  body: string
  preheader?: string
  siteUrl?: string
}): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</span>` : ''}
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f6f7f9; color: #1f2937; }
    a { color: #3B82F6; text-decoration: none; }
    .btn { display: inline-block; background: #3B82F6; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: 600; text-decoration: none; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .content { padding: 32px 24px; }
    .footer { background: #f3f4f6; padding: 20px 24px; text-align: center; font-size: 12px; color: #6b7280; }
    h1, h2, h3 { color: #111827; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; }
    .label { color: #6b7280; font-size: 13px; }
    .value { color: #111827; font-weight: 500; }
  </style>
</head>
<body>
  <div style="padding: 20px 0;">
    <div class="container">
      <div style="background: linear-gradient(135deg, #3B82F6 0%, #10B981 100%); padding: 24px; text-align: center;">
        <a href="${siteUrl}" style="color: #fff; font-size: 24px; font-weight: 800; text-decoration: none; letter-spacing: -0.5px;">Digistay</a>
        <p style="color: #fff; opacity: 0.9; margin: 4px 0 0; font-size: 13px;">Quản lý Khách sạn & Nhà hàng</p>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">
        <p style="margin: 0 0 8px;">Email này được gửi tự động từ <a href="${siteUrl}">Digistay</a></p>
        <p style="margin: 0;">© ${new Date().getFullYear()} Digistay. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  </div>
</body>
</html>`
}
