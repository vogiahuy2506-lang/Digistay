import { describe, it, expect } from 'vitest'
import { builderFonts, fontStack } from './font-stack'

describe('fontStack', () => {
  it('uses the loaded font for every option the builder offers', () => {
    for (const name of builderFonts) {
      expect(fontStack(name, 'body')).toMatch(/^var\(--font-[a-z-]+\)/)
    }
    expect(fontStack('Lato', 'body')).toBe('var(--font-lato), var(--font-inter), system-ui, sans-serif')
    expect(fontStack('Merriweather', 'heading')).toBe('var(--font-merriweather), var(--font-inter), Georgia, serif')
  })

  it('falls back to Inter for body text and Playfair Display for headings', () => {
    expect(fontStack(null, 'body')).toBe('var(--font-inter), system-ui, sans-serif')
    expect(fontStack('Comic Sans MS', 'heading')).toBe('var(--font-playfair), var(--font-inter), Georgia, serif')
    expect(fontStack('url(evil)', 'body')).toBe('var(--font-inter), system-ui, sans-serif')
  })

  it('offers exactly the builder choices', () => {
    expect(builderFonts.sort()).toEqual(
      ['Inter', 'Lato', 'Merriweather', 'Montserrat', 'Open Sans', 'Playfair Display', 'Poppins', 'Roboto'].sort()
    )
  })
})
