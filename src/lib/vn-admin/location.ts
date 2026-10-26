/**
 * A property's province and ward as the API receives them, checked against
 * the official lists: POST /api/properties and PATCH /api/properties/[id].
 * Property.city keeps the province's name (everything that shows `city`
 * still works) and Property.ward the ward's; the codes let the pickers
 * select them again. Server only (./wards.ts).
 */
import { matchProvince, propertyProvince, provinceByCode } from './provinces'
import { wardOf } from './wards'

export interface LocationInput {
  /** From the province picker. */
  provinceCode?: string
  /** From the ward picker; null or "" for none. Needs the province alongside. */
  wardCode?: string | null
  /** A province by name, for callers without codes ("Hà Nội", "Hue", "TP.HCM"): one of the 34 or refused. */
  city?: string
}

export interface PropertyLocation {
  city: string
  provinceCode: string
  ward: string | null
  wardCode: string | null
}

export type LocationResult = { ok: true; location: PropertyLocation | null } | { ok: false; error: string }

/**
 * The province (by code, else by name) must be one of the 34 and the ward,
 * when given, one of that province's. `location: null` when the request
 * leaves the address's province and ward alone.
 */
export function resolveLocation({ provinceCode, wardCode, city }: LocationInput): LocationResult {
  if (provinceCode === undefined && city === undefined) {
    return wardCode === undefined ? { ok: true, location: null } : { ok: false, error: 'Vui lòng chọn tỉnh/thành phố' }
  }
  const province = provinceCode !== undefined ? provinceByCode(provinceCode) : matchProvince(city)
  if (!province) {
    return { ok: false, error: (provinceCode ?? city)?.trim() ? 'Tỉnh/thành phố không có trong danh sách' : 'Vui lòng chọn tỉnh/thành phố' }
  }
  const base = { city: province.name, provinceCode: province.code }
  if (!wardCode) return { ok: true, location: { ...base, ward: null, wardCode: null } }
  const ward = wardOf(province.code, wardCode)
  if (!ward) return { ok: false, error: 'Phường/xã không thuộc tỉnh/thành phố đã chọn' }
  return { ok: true, location: { ...base, ward: ward.name, wardCode: ward.code } }
}

/**
 * The columns to write. A row saved before July 2025 may have a district
 * (quận / huyện) that the address shows while it has no ward: it goes once
 * a ward replaces it or the province changes (it was the old province's).
 */
export function locationColumns(
  location: PropertyLocation,
  current?: { city: string; provinceCode: string | null } | null
): PropertyLocation & { district?: null } {
  const sameProvince = current != null && propertyProvince(current)?.code === location.provinceCode
  return location.wardCode || !sameProvince ? { ...location, district: null } : location
}
