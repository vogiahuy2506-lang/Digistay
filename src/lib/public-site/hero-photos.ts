/** The hero's photo strip on a hotel's site (HeroBlock.tsx). */

/**
 * The same photo at another size or crop is one photo: the cover is often a
 * gallery photo with other ?w=…&h=… (Unsplash, imgix), and showed twice.
 */
const SIZE_PARAMS = ['w', 'h', 'width', 'height', 'q', 'quality', 'fit', 'crop', 'auto', 'fm', 'format', 'dpr', 'ixlib', 'ixid', 'cs']
export function photoKey(url: string): string {
  try {
    const u = new URL(url)
    for (const p of SIZE_PARAMS) u.searchParams.delete(p)
    u.searchParams.sort()
    const query = u.searchParams.toString()
    return `${u.origin}${u.pathname}${query ? `?${query}` : ''}`
  } catch {
    return url
  }
}

/**
 * The wide strip's order: the first photo in the middle slot, the next ones
 * alternately beside it. The strip is wider than the screen and centred, so
 * its ends are cut off: the cover used to be first, off-screen on the left.
 */
export function middleOut<T>(items: T[]): T[] {
  const center = (items.length - 1) / 2
  const slots = items.map((_, i) => i).sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b)
  const out = new Array<T>(items.length)
  slots.forEach((slot, i) => {
    out[slot] = items[i]
  })
  return out
}
