/**
 * Company name and address from a tax code, for the invoice forms: a guest
 * booking on a hotel site, and staff writing an invoice, type the tax code
 * and the rest fills in.
 *
 * Source: VietQR's free lookup (GET api.vietqr.io/v2/business/<code>),
 * which mirrors the General Department of Taxation's public register a day
 * behind: { code: "00", data: { id, name, address, status } } when found,
 * code "51" when the code does not exist. It is a convenience: the fields
 * stay editable, and a failed lookup never blocks a booking or an invoice.
 *
 * Answers are kept in memory (found: a day, not found: an hour), so many
 * guests of one company or a form asking twice cost one call.
 * TAX_LOOKUP_BASE_URL is for tests only.
 */
import type { CompanyInfo } from './tax-code'

const TIMEOUT_MS = 5_000
const FOUND_TTL_MS = 24 * 60 * 60 * 1000
const MISSING_TTL_MS = 60 * 60 * 1000
const MAX_CACHED = 2_000

export class TaxLookupError extends Error {}

const cache = new Map<string, { at: number; company: CompanyInfo | null }>()

/** For tests. */
export const clearTaxLookupCache = () => cache.clear()

const clean = (text: unknown) => (typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '')

/** The register's statuses for a company that no longer trades ("NNT ngừng hoạt động...", "Tạm ngừng kinh doanh..."). */
const STOPPED = /ngừng|không hoạt động|giải thể|phá sản|đóng mã/i

/**
 * The company behind a normalized tax code (normalizeTaxCode), null when
 * the register has no such code. Throws TaxLookupError when the service
 * cannot answer.
 */
export async function lookupTaxCode(taxCode: string, fetchImpl: typeof fetch = fetch): Promise<CompanyInfo | null> {
  const cached = cache.get(taxCode)
  if (cached && Date.now() - cached.at < (cached.company ? FOUND_TTL_MS : MISSING_TTL_MS)) return cached.company

  let body: { code?: string; data?: { id?: string; name?: string; address?: string; status?: string } | null }
  try {
    const base = process.env.TAX_LOOKUP_BASE_URL || 'https://api.vietqr.io'
    const res = await fetchImpl(`${base}/v2/business/${encodeURIComponent(taxCode)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) throw new TaxLookupError(`tax lookup: HTTP ${res.status}`)
    body = await res.json()
  } catch (error) {
    throw error instanceof TaxLookupError ? error : new TaxLookupError(`tax lookup: ${(error as Error).message}`)
  }

  let company: CompanyInfo | null
  if (body?.code === '00' && clean(body.data?.name)) {
    const status = clean(body.data?.status) || null
    company = {
      taxCode: clean(body.data?.id) || taxCode,
      name: clean(body.data?.name),
      address: clean(body.data?.address),
      status,
      active: !STOPPED.test(status ?? ''),
    }
  } else if (body?.code === '51') {
    company = null
  } else {
    throw new TaxLookupError(`tax lookup: code ${body?.code}`)
  }

  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!)
  cache.set(taxCode, { at: Date.now(), company })
  return company
}
