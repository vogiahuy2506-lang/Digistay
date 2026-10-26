/**
 * The wards, communes and special zones of each province (3,321; data and
 * source in src/data/vn-admin/README.md).
 *
 * Server only: about 110 kB for the whole country. The browser loads one
 * province at a time from GET /api/vn-admin/provinces/[code]/wards, so never
 * import this from a client component.
 */
import data from '@/data/vn-admin/wards.json'

export interface Ward {
  /** Official five-digit code, e.g. "00004". */
  code: string
  /** With its type: "Phường Ba Đình", "Xã Ba Vì", "Đặc khu Côn Đảo". */
  name: string
}

const lists: Record<string, string[][]> = data
const cache = new Map<string, Ward[]>()

/** A province's wards in Vietnamese alphabetical order; undefined for an unknown code. */
export function wardsOf(provinceCode: string): Ward[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(lists, provinceCode)) return undefined
  let wards = cache.get(provinceCode)
  if (!wards) {
    wards = lists[provinceCode].map(([code, name]) => ({ code, name }))
    cache.set(provinceCode, wards)
  }
  return wards
}

/** The ward with this code in this province; undefined when it is not one of the province's. */
export function wardOf(provinceCode: string, wardCode: string): Ward | undefined {
  return wardsOf(provinceCode)?.find((w) => w.code === wardCode)
}
