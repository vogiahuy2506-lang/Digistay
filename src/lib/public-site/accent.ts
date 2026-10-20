import { contrastRatio, hexToChannels, themes } from '@/styles/tokens'

/**
 * The hotel's accent on its website (`--ds-acc`, `--ds-acc-soft`), from the
 * color it picked in the builder. Links, eyebrows and prices are drawn in it
 * on the light page, so it must read as text there: a color under 4.5:1 is
 * darkened step by step until it does (the old default #3B82F6 is ~3.6:1).
 */

const PAGE = themes.light.page
const PANEL = themes.light.panel
const FALLBACK = themes.light.brand

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

/** The CSS variables a hotel page sets on its root. */
export function hotelAccentVariables(primaryColor: string | null | undefined): Record<string, string> {
  const { acc, accSoft } = hotelAccent(primaryColor)
  return { '--ds-acc': hexToChannels(acc), '--ds-acc-soft': hexToChannels(accSoft) }
}
