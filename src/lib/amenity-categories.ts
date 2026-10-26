/**
 * The groups of the shared amenities (Amenity.category, prisma/seed.ts), in
 * the order a hotel reads them. Each one has a label of its own in the
 * messages (dash.property.detail.amenities.categories.*): "leisure" and
 * "entertainment" are two groups, and "transport" / "view" are not shown as
 * raw keys. A category not listed here goes to "other", at the end.
 */
export const AMENITY_CATEGORIES = [
  'internet',
  'comfort',
  'food',
  'service',
  'leisure',
  'entertainment',
  'facility',
  'parking',
  'transport',
  'view',
  'security',
] as const

export type AmenityCategory = (typeof AMENITY_CATEGORIES)[number] | 'other'

export function amenityCategory(category: string | null | undefined): AmenityCategory {
  return AMENITY_CATEGORIES.includes(category as (typeof AMENITY_CATEGORIES)[number])
    ? (category as AmenityCategory)
    : 'other'
}

/** The amenities by group, groups in the order above; empty groups are left out. */
export function groupAmenities<T extends { category?: string | null }>(
  amenities: T[]
): { category: AmenityCategory; items: T[] }[] {
  const order: AmenityCategory[] = [...AMENITY_CATEGORIES, 'other']
  return order
    .map((category) => ({ category, items: amenities.filter((a) => amenityCategory(a.category) === category) }))
    .filter((group) => group.items.length > 0)
}
