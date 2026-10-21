import en from '../../../messages/en.json'
import type { Locale } from '@/i18n/locales'

const ENGLISH: Record<string, string> = en.site.amenityNames

/**
 * A shared amenity's name in this language. The amenities table holds the
 * Vietnamese names (prisma/seed.ts); the English ones are in messages
 * (site.amenityNames, by slug). An amenity without one keeps its own name.
 */
export function amenityName(slug: string | null | undefined, name: string, locale: Locale): string {
  return locale === 'en' && slug && ENGLISH[slug] ? ENGLISH[slug] : name
}
