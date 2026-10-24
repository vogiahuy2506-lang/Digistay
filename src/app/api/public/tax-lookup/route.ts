import { NextRequest, NextResponse } from 'next/server'
import { normalizeTaxCode } from '@/lib/einvoice/tax-code'
import { lookupTaxCode } from '@/lib/einvoice/tax-lookup'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/public/tax-lookup?taxCode=0123456789 — the company name and
 * address for a tax code (src/lib/einvoice/tax-lookup.ts), for the invoice
 * fields of the guest booking form and of staff invoices. Public register
 * data; nothing is stored. Limited per IP.
 */
export async function GET(request: NextRequest) {
  const byIp = await hit(LIMITS.taxLookupIp, getClientIp(request.headers))
  if (!byIp.allowed) {
    return tooManyRequests('Bạn tra cứu mã số thuế quá nhiều lần. Vui lòng thử lại sau.', byIp.retryAfterSec)
  }

  const taxCode = normalizeTaxCode(new URL(request.url).searchParams.get('taxCode') ?? '')
  if (!taxCode) {
    return NextResponse.json({ success: false, error: 'Mã số thuế gồm 10 hoặc 13 chữ số' }, { status: 400 })
  }

  try {
    const company = await lookupTaxCode(taxCode)
    if (!company) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy mã số thuế này' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: company })
  } catch (error) {
    console.error('Tax code lookup failed:', error)
    return NextResponse.json({ success: false, error: 'Chưa tra cứu được mã số thuế, vui lòng nhập tay' }, { status: 503 })
  }
}
