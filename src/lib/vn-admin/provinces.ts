/**
 * Vietnam's 34 provinces and centrally-run cities (since 1 July 2025; data and
 * source in src/data/vn-admin/README.md). Small enough for the browser: the
 * pickers import it. Their wards are server-side (./wards.ts).
 */
import data from '@/data/vn-admin/provinces.json'
import { foldVietnamese } from '@/lib/utils/fold'

export interface Province {
  /** Official two-digit code, e.g. "01". */
  code: string
  /** "Hà Nội": what Property.city stores and the site shows. */
  name: string
  /** "Thành phố Hà Nội". */
  fullName: string
  nameEn: string
  /** city: a centrally-run city (thành phố trực thuộc trung ương). */
  kind: 'city' | 'province'
}

/** In Vietnamese alphabetical order. */
export const PROVINCES = data.provinces as Province[]

/** Where the lists come from, for the record. */
export const VN_ADMIN_SOURCE = { release: data.release, latestDecree: data.latestDecree, fetchedAt: data.fetchedAt }

const byCode = new Map(PROVINCES.map((p) => [p.code, p]))

export function provinceByCode(code: string | null | undefined): Province | undefined {
  return code ? byCode.get(code) : undefined
}

/** "TP. Hồ Chí Minh", "Ho Chi Minh City", "hồ chí minh" → "hochiminh". */
function nameKey(name: string): string {
  return foldVietnamese(name)
    .replace(/^(tinh|thanh pho|tp\.?)\s*/, '')
    .replace(/\s+(city|province)$/, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Names people write that are not the official short, full or English one. */
const ALIASES: Record<string, string> = {
  hcm: '79',
  tphcm: '79',
  saigon: '79',
  // Thừa Thiên Huế became the city of Huế on 1 January 2025.
  thuathienhue: '46',
}

/**
 * The 29 provinces merged into another on 1 July 2025 (Nghị quyết
 * 202/2025/QH15), by name key → the province they are part of now. Only to
 * tell someone where an old address went; never to rewrite it on its own.
 */
const MERGED: Record<string, string> = {
  hagiang: '08',
  yenbai: '15',
  backan: '19',
  vinhphuc: '25',
  hoabinh: '25',
  bacgiang: '24',
  thaibinh: '33',
  haiduong: '31',
  hanam: '37',
  namdinh: '37',
  quangbinh: '44',
  quangnam: '48',
  kontum: '51',
  binhdinh: '52',
  ninhthuan: '56',
  daknong: '68',
  binhthuan: '68',
  phuyen: '66',
  binhduong: '79',
  bariavungtau: '79',
  brvt: '79',
  binhphuoc: '75',
  longan: '80',
  soctrang: '92',
  haugiang: '92',
  bentre: '86',
  travinh: '86',
  tiengiang: '82',
  baclieu: '96',
  kiengiang: '91',
}

const byKey = new Map<string, Province>()
for (const p of PROVINCES) {
  for (const name of [p.name, p.fullName, p.nameEn]) byKey.set(nameKey(name), p)
}
for (const [key, code] of Object.entries(ALIASES)) byKey.set(key, byCode.get(code)!)

/**
 * The current province a stored or typed name means, whatever the spelling:
 * "Hà Nội", "Thành phố Hà Nội", "Hanoi", "Ha Noi", "TP.HCM", "Thanh Hóa" /
 * "Thanh Hoá". undefined for anything else, including the merged provinces
 * (see mergedInto).
 */
export function matchProvince(name: string | null | undefined): Province | undefined {
  return name ? byKey.get(nameKey(name)) : undefined
}

/** The province a pre-2025 one ("Bình Dương") is part of now; undefined when the name is not one of them. */
export function mergedInto(name: string | null | undefined): Province | undefined {
  const code = name ? MERGED[nameKey(name)] : undefined
  return code ? byCode.get(code) : undefined
}

/**
 * The province a property is in for the pickers: its stored code, else its
 * city's name (rows saved before the codes existed).
 */
export function propertyProvince(p: { provinceCode?: string | null; city?: string | null }): Province | undefined {
  return provinceByCode(p.provinceCode) ?? matchProvince(p.city)
}
