/**
 * Design tokens for the redesign (Claude Design file "Digistay hotel booking
 * platform", system page 1c + dark palette 2a).
 *
 * Colors are named by role, never by hue, so a component written once works in
 * both themes. tailwind.config.ts turns every role into a CSS variable
 * (`--ds-<role>`) and a color utility (`bg-<role>`, `text-<role>`, ...), and
 * tokens.test.ts checks the contrast pairs the design promises.
 *
 * The old Material-style names in tailwind.config.ts (`primary`, `surface`,
 * ...) stay until every page has moved to these roles.
 */

export const roles = [
  'page', // outermost background of every screen
  'panel', // cards, tables, content blocks
  'raised', // menus, popovers, side panel, sticky booking box
  'fg', // main text: headings, body, amounts
  'muted', // secondary text: labels, descriptions, dates
  'line', // dividers, table rules, input borders (decoration, not text)
  'ink', // primary button background
  'on-ink', // text on a primary button
  'brand', // Digistay terracotta: logo, "Vận hành bởi Digistay"
  'brand-soft',
  'acc', // accent in context: brand in the dashboard, the hotel's color on its website
  'acc-soft',
  'ok', // paid, saved, checked in
  'ok-soft',
  'warn', // awaiting payment, almost sold out
  'warn-soft',
  'err', // cancel, delete, invalid data
  'err-soft',
  'on-err', // text on a solid err button
  'info', // deposit paid, confirmed, hints
  'info-soft',
  'refund', // refunded
  'refund-soft',
  'plain', // checked out, cancelled, expired: states that need no action
  'plain-soft',
] as const

export type Role = (typeof roles)[number]
export type ThemeName = 'light' | 'dark'

export const themes: Record<ThemeName, Record<Role, string>> = {
  light: {
    page: '#FBF9F6',
    panel: '#FFFFFF',
    raised: '#FFFFFF',
    fg: '#1B1C1A',
    muted: '#6B6760',
    line: '#E7E2DA',
    ink: '#1C1B19',
    'on-ink': '#FBF9F6',
    brand: '#A93119',
    'brand-soft': '#F6E6E0',
    acc: '#A93119',
    'acc-soft': '#F6E6E0',
    ok: '#2B6B45',
    'ok-soft': '#E3F1E8',
    warn: '#8A5600',
    'warn-soft': '#FBF0D6',
    err: '#B0124F',
    'err-soft': '#FCE7EF',
    'on-err': '#FFFFFF',
    info: '#284E92',
    'info-soft': '#E6EDF8',
    refund: '#544590',
    'refund-soft': '#EDEAF6',
    plain: '#5C5852',
    'plain-soft': '#EFEBE5',
  },
  dark: {
    page: '#1A1917',
    panel: '#22201D',
    raised: '#2C2925',
    fg: '#F2EEE8',
    muted: '#ADA69B',
    line: '#3A3631',
    ink: '#F2EEE8',
    'on-ink': '#1C1B19',
    brand: '#EE8B6F',
    'brand-soft': '#3A2620',
    acc: '#EE8B6F',
    'acc-soft': '#3A2620',
    ok: '#7FD1A0',
    'ok-soft': '#1E3127',
    warn: '#EBBE64',
    'warn-soft': '#352A16',
    err: '#F58BB0',
    'err-soft': '#3A1D29',
    'on-err': '#1C1B19',
    info: '#9DBDF5',
    'info-soft': '#1E2A3F',
    refund: '#BCAEF0',
    'refund-soft': '#2A2540',
    plain: '#C9C2B7',
    'plain-soft': '#33302B',
  },
}

/** Depth in the dark theme comes from lighter surfaces, so the shadow goes away. */
export const raisedShadow: Record<ThemeName, string> = {
  light: '0 28px 48px -32px rgb(28 27 25 / 0.35)',
  dark: 'none',
}

/**
 * Corner radii differ by surface: the dashboard is softer, the hotel website
 * (direction A) is almost square. `[data-surface="site"]` switches to the
 * website values.
 */
export const radii = {
  admin: { ctl: '6px', box: '10px' },
  site: { ctl: '2px', box: '2px' },
} as const

/** "#A93119" -> "169 49 25", the form Tailwind needs for opacity modifiers. */
export function hexToChannels(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`Expected #rrggbb, got ${hex}`)
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

export function cssVar(role: Role): string {
  return `--ds-${role}`
}

/** CSS custom properties for one theme, ready for a Tailwind `addBase` rule. */
export function themeVariables(theme: ThemeName): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const role of roles) vars[cssVar(role)] = hexToChannels(themes[theme][role])
  vars['--ds-shadow-raised'] = raisedShadow[theme]
  vars['color-scheme'] = theme
  return vars
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToChannels(hex)
    .split(' ')
    .map((c) => {
      const s = Number(c) / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio between two opaque colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
