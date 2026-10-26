import { slugify } from '@/lib/utils'

/**
 * The short name (workspace) or subdomain (property) a name suggests:
 * "Khách sạn Đồi Thông" → "khach-san-doi-thong". Cut to `max` characters
 * without leaving a dash at the end.
 */
export function slugFromName(name: string, max: number): string {
  return slugify(name).slice(0, max).replace(/-+$/, '')
}

/**
 * What the user types in a short name / subdomain field, kept to a-z, 0-9 and
 * "-" as they type: accents dropped, "đ" read as "d". A dash at the end stays
 * (the next letter follows it); `finishSlugInput` removes it on submit.
 */
export function cleanSlugInput(value: string, max: number): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, max)
}

/** The value to send: no dash at either end. */
export function finishSlugInput(value: string): string {
  return value.replace(/^-+|-+$/g, '')
}

/** A form's slug and whether the user has typed it themselves. */
export interface SlugState {
  slug: string
  slugEdited: boolean
}

/** The name field changed: the slug follows the name until the user edits the slug field. */
export function onNameTyped(name: string, state: SlugState, max: number): SlugState {
  // Only these two keys: callers spread the result over their whole form.
  return state.slugEdited ? { slug: state.slug, slugEdited: true } : { slug: slugFromName(name, max), slugEdited: false }
}

/** The slug field changed: from now on it is the user's, unless they empty it (then it follows the name again). */
export function onSlugTyped(value: string, max: number): SlugState {
  const slug = cleanSlugInput(value, max)
  return { slug, slugEdited: slug !== '' }
}
