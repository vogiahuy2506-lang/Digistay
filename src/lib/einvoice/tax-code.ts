/**
 * Vietnamese tax codes (mã số thuế), shared by the browser and the server:
 * 10 digits for a company, 13 written 10-3 for a branch.
 */

/** A company found by its tax code (src/lib/einvoice/tax-lookup.ts). */
export interface CompanyInfo {
  taxCode: string
  name: string
  address: string
  /** the tax register's own words, e.g. "NNT đang hoạt động" */
  status: string | null
  /** false when the register says it stopped trading */
  active: boolean
}

/** The tax code as the register writes it; spaces, dots and dashes ignored. null when not 10 or 13 digits. */
export function normalizeTaxCode(input: string): string | null {
  const digits = input.replace(/[\s.-]/g, '')
  if (/^\d{10}$/.test(digits)) return digits
  if (/^\d{13}$/.test(digits)) return `${digits.slice(0, 10)}-${digits.slice(10)}`
  return null
}
