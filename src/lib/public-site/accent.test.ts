import { describe, it, expect } from 'vitest'
import { contrastRatio, themes } from '@/styles/tokens'
import { hotelAccent, hotelAccentVariables } from './accent'

const PAGE = themes.light.page

describe('hotel accent', () => {
  it('keeps a color that already reads well', () => {
    expect(hotelAccent('#4F6B4A').acc).toBe('#4F6B4A') // rêu, from the design
    expect(hotelAccent('#233a5e').acc).toBe('#233A5E') // navy
  })

  it('darkens a color that is too light to read as text', () => {
    for (const color of ['#3B82F6', '#F59E0B', '#10B981', '#FFFF00', '#FFFFFF']) {
      const { acc } = hotelAccent(color)
      expect(contrastRatio(acc, PAGE)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(acc, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    }
    // Still the same hue family, just darker.
    const blue = hotelAccent('#3B82F6').acc
    expect(parseInt(blue.slice(5, 7), 16)).toBeGreaterThan(parseInt(blue.slice(1, 3), 16))
  })

  it('falls back to the Digistay accent for missing or broken values', () => {
    for (const bad of [null, undefined, '', 'blue', '#12', 'rgb(1,2,3)', '#GGGGGG']) {
      expect(hotelAccent(bad).acc).toBe(themes.light.brand)
    }
    expect(hotelAccent('#abc').acc).toBe(hotelAccent('#AABBCC').acc)
  })

  it('makes a soft tint close to the page for chips and hover backgrounds', () => {
    const { acc, accSoft } = hotelAccent('#4F6B4A')
    expect(contrastRatio(acc, accSoft)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(accSoft, PAGE)).toBeLessThan(1.3)
  })

  it('emits RGB channels for the CSS variables', () => {
    expect(hotelAccentVariables('#4F6B4A')['--ds-acc']).toBe('79 107 74')
    expect(hotelAccentVariables('#4F6B4A')['--ds-acc-soft']).toMatch(/^\d+ \d+ \d+$/)
  })
})
