/**
 * Guards the redesign tokens (src/styles/tokens.ts) and how tailwind.config.ts
 * exposes them.
 */
import { describe, it, expect } from 'vitest'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../../tailwind.config'
import { contrastRatio, hexToChannels, roles, themes, type Role, type ThemeName } from './tokens'

const themeNames: ThemeName[] = ['light', 'dark']

// [text, background] pairs that carry readable text, per the design's
// contrast notes (system page 1c and dark palette 2a).
const textPairs: [Role, Role][] = [
  ['fg', 'page'],
  ['fg', 'panel'],
  ['fg', 'raised'],
  ['muted', 'page'],
  ['muted', 'panel'],
  ['muted', 'raised'],
  ['on-ink', 'ink'],
  ['on-err', 'err'],
  ['brand', 'page'],
  ['brand', 'raised'],
  ['brand', 'brand-soft'],
  ['acc', 'page'],
  ['acc', 'raised'],
  ['acc', 'acc-soft'],
  // Status colors appear both as chips on their soft background and as plain
  // text in a table cell (e.g. "Chờ thanh toán" under an amount).
  ...(['ok', 'warn', 'err', 'info', 'refund', 'plain'] as const).flatMap(
    (s): [Role, Role][] => [
      [s, `${s}-soft`],
      [s, 'panel'],
      [s, 'raised'],
    ],
  ),
]

function hue(hex: string): number {
  const [r, g, b] = hexToChannels(hex).split(' ').map((c) => Number(c) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

function hueDistance(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b))
  return Math.min(d, 360 - d)
}

describe('design tokens', () => {
  it.each(themeNames)('defines every role as #rrggbb in the %s theme', (theme) => {
    for (const role of roles) expect(themes[theme][role]).toMatch(/^#[0-9A-F]{6}$/)
  })

  describe.each(themeNames)('%s theme', (theme) => {
    it.each(textPairs)('%s on %s reaches 4.5:1', (text, bg) => {
      expect(contrastRatio(themes[theme][text], themes[theme][bg])).toBeGreaterThanOrEqual(4.5)
    })

    it('keeps the error color clearly apart from the brand accent', () => {
      // The old pair (#A93119 vs #BA1A1A) was 10° apart and read as the same red.
      expect(hueDistance(themes[theme].err, themes[theme].brand)).toBeGreaterThanOrEqual(25)
    })
  })

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2)
  })
})

describe('tailwind.config.ts', () => {
  async function build(classes: string): Promise<string> {
    const result = await postcss([
      tailwindcss({ ...tailwindConfig, content: [{ raw: `<div class="${classes}"></div>` }] }),
    ]).process('@tailwind base; @tailwind utilities;', { from: undefined })
    return result.css
  }

  it('emits light variables on :root and dark variables under data-theme="dark"', async () => {
    const css = await build('bg-page')
    expect(css).toMatch(/:root, \[data-theme="light"\] \{[^}]*--ds-page: 251 249 246;[^}]*color-scheme: light/)
    expect(css).toMatch(/\[data-theme="dark"\] \{[^}]*--ds-page: 26 25 23;[^}]*color-scheme: dark/)
  })

  it('maps roles to color utilities that keep opacity modifiers', async () => {
    const css = await build('bg-panel text-muted border-line bg-fg/5')
    expect(css).toContain('background-color: rgb(var(--ds-panel) / var(--tw-bg-opacity, 1))')
    expect(css).toContain('color: rgb(var(--ds-muted) / var(--tw-text-opacity, 1))')
    expect(css).toContain('border-color: rgb(var(--ds-line) / var(--tw-border-opacity, 1))')
    expect(css).toContain('background-color: rgb(var(--ds-fg) / 0.05)')
  })

  it('turns dark: on only inside data-theme="dark", not from the OS setting', async () => {
    const css = await build('dark:bg-raised')
    expect(css).toContain('[data-theme="dark"]')
    expect(css).not.toContain('prefers-color-scheme')
  })

  it('gives a bare border / divide the line color, not gray-200', async () => {
    // Both take their color from preflight's `*, ::before, ::after` rule.
    const css = await build('border divide-y')
    expect(css).toMatch(/::after \{[^}]*border-color: rgb\(var\(--ds-line\) \/ 1\)/)
    expect(css).not.toMatch(/#e5e7eb/i)
  })

  it('switches corner radii with data-surface', async () => {
    const css = await build('rounded-ctl rounded-box')
    expect(css).toMatch(/\[data-surface="site"\] \{[^}]*--ds-r-ctl: 2px/)
    expect(css).toContain('border-radius: var(--ds-r-ctl)')
    expect(css).toContain('border-radius: var(--ds-r-box)')
  })

  it('does not let shadow names collide with role colors', () => {
    const shadows = Object.keys(tailwindConfig.theme?.extend?.boxShadow ?? {})
    expect(shadows.filter((name) => (roles as readonly string[]).includes(name))).toEqual([])
  })
})
