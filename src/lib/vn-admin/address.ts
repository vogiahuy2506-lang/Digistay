/**
 * A property's address as one line, everywhere it is shown (dashboard,
 * hotel site, map, structured data, emails): street, ward, province, as
 * Vietnamese addresses are written since July 2025. Rows saved before the
 * wards existed show their district (quận / huyện) in the ward's place.
 */
export interface AddressParts {
  address?: string | null
  ward?: string | null
  /** Pre-2025 rows only: shown when there is no ward. */
  district?: string | null
  /** The province's name. */
  city?: string | null
  country?: string | null
}

const text = (value: string | null | undefined) => value?.trim() || undefined

/** The ward, else the old district, of an address. */
export function addressLocality(p: AddressParts): string | undefined {
  return text(p.ward) ?? text(p.district)
}

/** "12 Lý Thái Tổ, Phường Hoàn Kiếm, Hà Nội" (with `country`: "…, Hà Nội, Vietnam", for a map search). */
export function formatAddress(p: AddressParts, { country = false } = {}): string {
  return [text(p.address), addressLocality(p), text(p.city), country ? text(p.country) : undefined].filter(Boolean).join(', ')
}
