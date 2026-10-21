/**
 * The hotel's own texts in the visitor's language. Hotels write them in
 * Vietnamese; the English ones live in `translations.en` on the row
 * (properties, room_types, extra_services, policies, website_settings) and
 * in `config.en` of a website block. Without an English text, the
 * Vietnamese one shows: a hotel that never wrote English still has a
 * complete site.
 */
import type { Locale } from '@/i18n/locales'

type Fields = Record<string, unknown>

/** `translations.en[field]` when it is a non-empty string. */
export function englishOf(translations: unknown, field: string): string | undefined {
  const en = (translations as { en?: Fields } | null | undefined)?.en
  const value = en?.[field]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** A row's field in this language: the English text when there is one, else the Vietnamese. */
export function localized<T extends { translations?: unknown }, K extends keyof T & string>(row: T, field: K, locale: Locale): T[K] {
  if (locale !== 'en') return row[field]
  return (englishOf(row.translations, field) ?? row[field]) as T[K]
}

/** The same row with `fields` in this language (for passing rows on to components). */
export function localizeRow<T extends { translations?: unknown }>(row: T, fields: (keyof T & string)[], locale: Locale): T {
  if (locale !== 'en') return row
  const out = { ...row }
  for (const f of fields) out[f] = localized(row, f, locale)
  return out
}

/**
 * The website builder's default block texts (BLOCK_TYPES in
 * properties/[id]/website/page.tsx). A block still showing one of them
 * shows the site's own English default instead of this Vietnamese.
 */
export const BUILDER_DEFAULTS = new Set([
  'Chào mừng đến với',
  'Trải nghiệm lưu trú tuyệt vời',
  'Đặt phòng ngay',
  'Các hạng phòng',
  'Tiện ích nổi bật',
  'Về chúng tôi',
  'Nơi mang đến cho bạn trải nghiệm lưu trú tuyệt vời với dịch vụ chuyên nghiệp và không gian thoải mái.',
  'Thư viện hình ảnh',
  'Đánh giá từ khách hàng',
  'Liên hệ với chúng tôi',
  'Sẵn sàng trải nghiệm?',
  'Đặt phòng ngay hôm nay để nhận ưu đãi đặc biệt',
])

function text(cfg: Fields | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = cfg?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

/**
 * A website block's text in this language. The builder saves `heroTitle`,
 * `roomsTitle`...; older defaults used `title`. In English: `config.en.<key>`,
 * else the Vietnamese unless it is a builder default (then undefined, and
 * the block uses its translated default).
 */
export function blockText(cfg: Fields | undefined, locale: Locale, ...keys: string[]): string | undefined {
  const vi = text(cfg, keys)
  if (locale !== 'en') return vi
  return text(cfg?.en as Fields | undefined, keys) ?? (vi && BUILDER_DEFAULTS.has(vi) ? undefined : vi)
}
