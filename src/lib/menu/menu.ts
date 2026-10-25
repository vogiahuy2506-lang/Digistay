/**
 * The hotel's restaurant menu (menu_items): its order, its groups and its
 * photos, shared by the dashboard page (properties/[id]/menu), the menu API
 * and the website's RESTAURANT_MENU block.
 *
 * Groups are the hotel's own `category` text ("Món chính", "Đồ uống"):
 * items with the same text, ignoring case and spaces, form one group. Items
 * are ordered by `sortOrder`, then name; groups by their first item, so
 * moving a group moves its items (PUT /api/properties/[id]/menu stores the
 * whole order as sortOrder 0, 1, 2...).
 */
import type { Locale } from '@/i18n/locales'
import { englishOf, localizeRow } from '@/lib/i18n/content'

export interface MenuRow {
  id: string
  name: string
  category: string | null
  sortOrder: number
}

export interface MenuGroup<T extends MenuRow> {
  /** categoryKey of the group's items; '' for items without a category */
  key: string
  /** the text its first item has; null for items without a category */
  category: string | null
  items: T[]
}

const squash = (text: string) => text.trim().replace(/\s+/g, ' ')

/** What a group is known by: "Đồ uống", " đồ  uống " and "ĐỒ UỐNG" are one group. */
export function categoryKey(category: string | null | undefined): string {
  return squash(category ?? '').toLocaleLowerCase('vi')
}

/** sortOrder, then name in Vietnamese order, then id (so equal rows never swap between renders). */
export function sortMenuItems<T extends MenuRow>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/** The items in groups, each group where its first item is. */
export function groupMenuItems<T extends MenuRow>(items: readonly T[]): MenuGroup<T>[] {
  const groups = new Map<string, MenuGroup<T>>()
  for (const item of sortMenuItems(items)) {
    const key = categoryKey(item.category)
    const group = groups.get(key)
    if (group) group.items.push(item)
    else groups.set(key, { key, category: key ? squash(item.category!) : null, items: [item] })
  }
  return [...groups.values()]
}

/** The ids in the order the groups show them. */
export function menuOrder<T extends MenuRow>(groups: readonly MenuGroup<T>[]): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.id))
}

/** The order after moving an item one place up (-1) or down (1) in its group; null at the group's edge. */
export function moveMenuItem<T extends MenuRow>(groups: readonly MenuGroup<T>[], itemId: string, step: -1 | 1): string[] | null {
  for (const group of groups) {
    const at = group.items.findIndex((i) => i.id === itemId)
    if (at < 0) continue
    const to = at + step
    if (to < 0 || to >= group.items.length) return null
    const items = [...group.items]
    ;[items[at], items[to]] = [items[to], items[at]]
    return menuOrder(groups.map((g) => (g === group ? { ...g, items } : g)))
  }
  return null
}

/** The order after moving a whole group one place up (-1) or down (1); null at the edge. */
export function moveMenuGroup<T extends MenuRow>(groups: readonly MenuGroup<T>[], key: string, step: -1 | 1): string[] | null {
  const at = groups.findIndex((g) => g.key === key)
  const to = at + step
  if (at < 0 || to < 0 || to >= groups.length) return null
  const moved = [...groups]
  ;[moved[at], moved[to]] = [moved[to], moved[at]]
  return menuOrder(moved)
}

/**
 * The items in the visitor's language: names and descriptions in English
 * where the hotel wrote them, and each group under the first English name
 * one of its items has, so a group never splits because only some of its
 * items have one.
 */
export function localizeMenuItems<T extends MenuRow & { description: string | null; translations?: unknown }>(
  items: readonly T[],
  locale: Locale
): T[] {
  if (locale !== 'en') return [...items]
  const english = new Map<string, string>()
  for (const item of sortMenuItems(items)) {
    const key = categoryKey(item.category)
    const name = englishOf(item.translations, 'category')
    if (key && name && !english.has(key)) english.set(key, name)
  }
  return items.map((item) => ({
    ...localizeRow(item, ['name', 'description'], locale),
    category: english.get(categoryKey(item.category)) ?? item.category,
  }))
}

/** A file served by our own upload route (POST /api/upload), should it serve files itself. */
const UPLOAD_PATH = /^\/api\/upload\/[A-Za-z0-9._~/-]+$/

/**
 * A dish photo the site may show: an http(s) URL, or a file of our own
 * upload route (`/api/upload/...`; the middleware leaves /api alone, so the
 * path works on the hotel's subdomain too). Never data:, javascript: or a
 * protocol-relative `//host` URL. Not data: in particular: that would put
 * whole photos into the database, the cached site and its HTML (uploads are
 * stored at Cloudinary and come back as https URLs, src/lib/cloudinary).
 */
export function isMenuImageUrl(value: string): boolean {
  if (!value || value.length > 2048) return false
  if (value.startsWith('/')) return UPLOAD_PATH.test(value) && !value.split('/').includes('..')
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname && !url.username && !url.password
  } catch {
    return false
  }
}
