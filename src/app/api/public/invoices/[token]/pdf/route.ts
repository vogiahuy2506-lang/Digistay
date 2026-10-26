import { NextRequest, NextResponse } from 'next/server'
import { isLocale } from '@/i18n/locales'
import { EinvoiceError, getInvoicePdf } from '@/lib/einvoice/matbao'
import { loadInvoiceLookup } from '@/lib/einvoice/lookup-view'
import { appSiteUrl } from '@/lib/public-site/paths'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

/**
 * GET /api/public/invoices/[token]/pdf — "Tải PDF" on the public invoice
 * page (task 39): the issued invoice's PDF, fetched from Mắt Bão with the
 * hotel's account. Public: the HMAC token is the credential
 * (src/lib/einvoice/lookup-link.ts), never the guessable MaTraCuu. Limited
 * per IP, as each download calls Mắt Bão with the hotel's account.
 *
 * The guest gets here by following a link, so when Mắt Bão cannot serve the
 * PDF they are sent back to the page, which says so (?pdf=failed), instead
 * of seeing a JSON error.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const byIp = await hit(LIMITS.invoiceLookupIp, getClientIp(request.headers))
  if (!byIp.allowed) return tooManyRequests('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)

  const { token } = await props.params
  const invoice = await loadInvoiceLookup(null, token)
  // A replaced invoice's page links to its replacement instead.
  if (!invoice || invoice.status !== 'PUBLISHED') {
    return NextResponse.json({ success: false, error: 'Không tìm thấy hoá đơn' }, { status: 404 })
  }

  try {
    const { pdf, filename } = await getInvoicePdf(invoice.id)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (error) {
    if (!(error instanceof EinvoiceError)) console.error('Public invoice PDF error:', error)
    else console.warn(`[einvoice] public PDF of ${invoice.id} failed: ${error.message}`)
    const lang = request.nextUrl.searchParams.get('lang')
    const page = appSiteUrl(process.env.NEXTAUTH_URL, invoice.subdomain, isLocale(lang) ? lang : 'vi', `/hoa-don/${token}?pdf=failed`)
    return NextResponse.redirect(page, 303)
  }
}
