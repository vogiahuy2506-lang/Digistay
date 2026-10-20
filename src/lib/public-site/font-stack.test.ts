import { describe, it, expect } from 'vitest'
import { builderFonts, fontStack, normalizeFont } from './font-stack'

describe('fontStack', () => {
  it('uses the loaded font for every option the builder offers', () => {
    for (const name of builderFonts) {
      expect(fontStack(name, 'body')).toMatch(/^var\(--font-[a-z-]+\)/)
    }
    expect(fontStack('Nunito Sans', 'body')).toBe('var(--font-nunito-sans), var(--font-inter), system-ui, sans-serif')
    expect(fontStack('Be Vietnam Pro', 'heading')).toBe('var(--font-be-vietnam-pro), var(--font-inter), system-ui, sans-serif')
    expect(fontStack('Merriweather', 'heading')).toBe('var(--font-merriweather), var(--font-inter), Georgia, serif')
  })

  it('draws sites that saved Lato or Poppins with their Vietnamese-ready replacements', () => {
    expect(fontStack('Lato', 'body')).toBe(fontStack('Nunito Sans', 'body'))
    expect(fontStack('Poppins', 'heading')).toBe(fontStack('Be Vietnam Pro', 'heading'))
  })

  it('falls back to Inter for body text and Playfair Display for headings', () => {
    expect(fontStack(null, 'body')).toBe('var(--font-inter), system-ui, sans-serif')
    expect(fontStack('', 'heading')).toBe('var(--font-playfair), var(--font-inter), Georgia, serif')
    expect(fontStack('Comic Sans MS', 'heading')).toBe('var(--font-playfair), var(--font-inter), Georgia, serif')
    expect(fontStack('url(evil)', 'body')).toBe('var(--font-inter), system-ui, sans-serif')
    // Object prototype keys are not fonts.
    expect(fontStack('constructor', 'body')).toBe('var(--font-inter), system-ui, sans-serif')
  })

  it('offers exactly the loadable fonts, all with Vietnamese glyphs', () => {
    expect([...builderFonts].sort()).toEqual(
      ['Be Vietnam Pro', 'Inter', 'Merriweather', 'Montserrat', 'Nunito Sans', 'Open Sans', 'Playfair Display', 'Roboto'].sort()
    )
    expect(builderFonts).not.toContain('Lato')
    expect(builderFonts).not.toContain('Poppins')
  })
})

describe('normalizeFont', () => {
  it('keeps a loadable font as it is', () => {
    for (const name of builderFonts) {
      expect(normalizeFont(name, 'body')).toBe(name)
      expect(normalizeFont(name, 'heading')).toBe(name)
    }
  })

  it('maps the legacy names the builder used to save', () => {
    expect(normalizeFont('Lato', 'body')).toBe('Nunito Sans')
    expect(normalizeFont('Poppins', 'heading')).toBe('Be Vietnam Pro')
    // Whichever select they were saved from.
    expect(normalizeFont('Poppins', 'body')).toBe('Be Vietnam Pro')
  })

  it('gives the default for a missing or unknown name', () => {
    expect(normalizeFont(undefined, 'body')).toBe('Inter')
    expect(normalizeFont(null, 'heading')).toBe('Playfair Display')
    expect(normalizeFont('Comic Sans MS', 'body')).toBe('Inter')
    expect(normalizeFont('lato', 'body')).toBe('Inter')
    expect(normalizeFont('__proto__', 'heading')).toBe('Playfair Display')
  })
})
