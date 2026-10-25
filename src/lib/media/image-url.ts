/**
 * The size of a photo a page asks for. Photos Digistay stored itself
 * (Cloudinary, folder digistay/, src/lib/cloudinary) are served at the width
 * the page shows, in the best format the browser takes (f_auto: AVIF/WebP)
 * and quality (q_auto), never wider than the original (c_limit). Any other
 * URL (a photo added by link) is returned as it is.
 *
 * Widths come from one short list so each photo has few sizes at Cloudinary
 * (each new size is a transformation the account pays for).
 */

const OWN_UPLOAD = /^https:\/\/res\.cloudinary\.com\/([a-z0-9_-]+)\/image\/upload\/((?:v\d+\/)?digistay\/[^?#]+)$/i

export const IMAGE_WIDTHS = [480, 800, 1200, 1600, 2000] as const

export const isOwnUpload = (url: string | null | undefined): url is string => !!url && OWN_UPLOAD.test(url)

/** The URL of `url` at most `width` px wide (the next width in IMAGE_WIDTHS up). */
export function resizedImage<T extends string | null | undefined>(url: T, width: number): T {
  if (!url) return url
  const match = OWN_UPLOAD.exec(url)
  if (!match) return url
  const w = IMAGE_WIDTHS.find((n) => n >= width) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]
  return `https://res.cloudinary.com/${match[1]}/image/upload/f_auto,q_auto,c_limit,w_${w}/${match[2]}` as T
}

/**
 * Attributes for an <img> that fills `sizes` (CSS, as in the sizes
 * attribute): src at `fallback` px, plus a srcset up to `max` px. For a photo
 * added by link: just its src.
 */
export function responsiveImage(
  url: string,
  sizes: string,
  { fallback = 1200, max = 2000 }: { fallback?: number; max?: number } = {}
): { src: string; srcSet?: string; sizes?: string } {
  if (!isOwnUpload(url)) return { src: url }
  const srcSet = IMAGE_WIDTHS.filter((w) => w <= max)
    .map((w) => `${resizedImage(url, w)} ${w}w`)
    .join(', ')
  return { src: resizedImage(url, Math.min(fallback, max)), srcSet, sizes }
}

/**
 * A photo URL Digistay may store and show (property and room photos): https
 * only, no credentials, not too long. Not data: (whole files in the database
 * and the cached site), javascript: or a relative path.
 */
export function isStoredImageUrl(value: string): boolean {
  if (!value || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
  } catch {
    return false
  }
}
