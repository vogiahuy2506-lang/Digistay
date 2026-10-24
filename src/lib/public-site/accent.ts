import { contrastRatio, hexToChannels, themes } from '@/styles/tokens'

/**
 * The hotel's accent on its website (`--ds-acc`, `--ds-acc-soft`), from the
 * color it picked in the builder. Links, eyebrows and prices are drawn in it,
 * so it must read as text: on the light page a color under 4.5:1 is darkened
 * step by step until it does (the old default #3B82F6 is ~3.6:1); on the dark
 * page it is lightened the same way.
 */

const PAGE = themes.light.page
const PANEL = themes.light.panel
const FALLBACK = themes.light.brand
const DARK_SURFACES = [themes.dark.page, themes.dark.panel, themes.dark.raised]

function parseHex(value: string | null | undefined): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((value ?? '').trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return `#${h.toUpperCase()}`
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function rgb(hex: string): [number, number, number] {
  const [r, g, b] = hexToChannels(hex).split(' ').map(Number)
  return [r, g, b]
}

function readable(hex: string): boolean {
  return contrastRatio(hex, PAGE) >= 4.5 && contrastRatio(hex, PANEL) >= 4.5
}

const DARK_SOFT = 0.12

/** Reads on the dark page, panels, menus and on its own soft tint (chips). */
function readableOnDark(hex: string): boolean {
  return [...DARK_SURFACES, mix(hex, themes.dark.page, DARK_SOFT)].every((surface) => contrastRatio(hex, surface) >= 4.5)
}

/** Mixes `hex` toward black until it reads as text on the page and on panels. */
function darkenUntilReadable(hex: string): string {
  let [r, g, b] = rgb(hex)
  for (let i = 0; i < 40 && !readable(toHex(r, g, b)); i++) {
    r *= 0.94
    g *= 0.94
    b *= 0.94
  }
  return toHex(r, g, b)
}

/** Mixes `hex` toward white until it reads as text on the dark page, panels and menus. */
function lightenUntilReadable(hex: string): string {
  let [r, g, b] = rgb(hex)
  for (let i = 0; i < 60 && !readableOnDark(toHex(r, g, b)); i++) {
    r += (255 - r) * 0.08
    g += (255 - g) * 0.08
    b += (255 - b) * 0.08
  }
  return toHex(r, g, b)
}

/** `amount` of `a` over `b`, like color-mix(in srgb, a amount, b). */
function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = rgb(a)
  const [br, bg, bb] = rgb(b)
  return toHex(ar * amount + br * (1 - amount), ag * amount + bg * (1 - amount), ab * amount + bb * (1 - amount))
}

export interface HotelAccent {
  /** #rrggbb, readable on the page. */
  acc: string
  /** 12 % of acc on the page (system page 1c). */
  accSoft: string
}

export function hotelAccent(primaryColor: string | null | undefined): HotelAccent {
  const acc = darkenUntilReadable(parseHex(primaryColor) ?? FALLBACK)
  return { acc, accSoft: mix(acc, PAGE, 0.12) }
}

/** The same accent for the dark theme: readable on the dark page; the soft tint a dark wash of it. */
export function hotelAccentDark(primaryColor: string | null | undefined): HotelAccent {
  const acc = lightenUntilReadable(parseHex(primaryColor) ?? FALLBACK)
  return { acc, accSoft: mix(acc, themes.dark.page, DARK_SOFT) }
}

/**
 * The CSS variables a hotel page sets on its root, for both themes:
 * tailwind.config.ts maps them onto `--ds-acc` / `--ds-acc-soft` for the
 * root's data-theme (an inline `--ds-acc` would win over the dark rule).
 */
export function hotelAccentVariables(primaryColor: string | null | undefined): Record<string, string> {
  const light = hotelAccent(primaryColor)
  const dark = hotelAccentDark(primaryColor)
  return {
    '--site-acc': hexToChannels(light.acc),
    '--site-acc-soft': hexToChannels(light.accSoft),
    '--site-acc-dark': hexToChannels(dark.acc),
    '--site-acc-soft-dark': hexToChannels(dark.accSoft),
  }
}

/** Raises (lighter) or lowers (darker) `hex` until it has `ratio` against `surface`. */
function untilContrast(hex: string, surface: string, ratio: number, toward: 'black' | 'white'): string {
  let [r, g, b] = rgb(hex)
  for (let i = 0; i < 60 && contrastRatio(toHex(r, g, b), surface) < ratio; i++) {
    if (toward === 'black') {
      r *= 0.94
      g *= 0.94
      b *= 0.94
    } else {
      r += (255 - r) * 0.08
      g += (255 - g) * 0.08
      b += (255 - b) * 0.08
    }
  }
  return toHex(r, g, b)
}

/** White or the ink's near-black, whichever reads better on `background`. */
function textOn(background: string): string {
  const dark = themes.light.ink
  return contrastRatio('#FFFFFF', background) >= contrastRatio(dark, background) ? '#FFFFFF' : dark
}

/**
 * The hotel's button color (WebsiteSettings.buttonColor) for the site's ink
 * (`bg-ink` buttons, `border-ink` outlines, the CTA band): it must stand out
 * from the page (3:1, as for any control) in each theme, and its label is
 * white or near-black, whichever reads. None: Digistay's ink.
 */
export function hotelButtonVariables(buttonColor: string | null | undefined): Record<string, string> {
  const color = parseHex(buttonColor)
  if (!color) return {}
  const light = untilContrast(color, PAGE, 3, 'black')
  const dark = untilContrast(color, themes.dark.page, 3, 'white')
  return {
    '--site-ink': hexToChannels(light),
    '--site-on-ink': hexToChannels(textOn(light)),
    '--site-ink-dark': hexToChannels(dark),
    '--site-on-ink-dark': hexToChannels(textOn(dark)),
  }
}

/**
 * The hotel's heading color (WebsiteSettings.headingColor) for the page and
 * section titles: readable as text in each theme (4.5:1, darkened on the light
 * page, lightened on the dark one). None: the text color.
 */
export function hotelHeadingVariables(headingColor: string | null | undefined): Record<string, string> {
  const color = parseHex(headingColor)
  if (!color) return {}
  return {
    '--site-heading-color': hexToChannels(darkenUntilReadable(color)),
    '--site-heading-color-dark': hexToChannels(lightenUntilReadable(color)),
  }
}
