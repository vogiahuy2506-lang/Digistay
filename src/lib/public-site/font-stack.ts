/**
 * The website builder stores font names ("Lato", "Merriweather"...). Those
 * names alone did nothing: no font was loaded, so every site fell back to the
 * system font. The fonts are loaded with next/font in
 * src/app/(public)/[subdomain]/fonts.ts under these CSS variables.
 */
const FONT_VARS: Record<string, string> = {
  Inter: '--font-inter',
  'Playfair Display': '--font-playfair',
  Roboto: '--font-roboto',
  'Open Sans': '--font-open-sans',
  Lato: '--font-lato',
  Merriweather: '--font-merriweather',
  Poppins: '--font-poppins',
  Montserrat: '--font-montserrat',
}

const SERIF = new Set(['Playfair Display', 'Merriweather'])

/**
 * A font-family value for the hotel's choice. Inter comes right after it:
 * Lato and Poppins have no Vietnamese glyphs, and letters like "ế" should
 * fall back to a font that has them rather than to the system font.
 */
export function fontStack(name: string | null | undefined, kind: 'body' | 'heading'): string {
  const chosen = name && FONT_VARS[name] ? name : kind === 'heading' ? 'Playfair Display' : 'Inter'
  const generic = SERIF.has(chosen) ? 'Georgia, serif' : 'system-ui, sans-serif'
  const own = `var(${FONT_VARS[chosen]})`
  return chosen === 'Inter' ? `${own}, ${generic}` : `${own}, var(--font-inter), ${generic}`
}

export const builderFonts = Object.keys(FONT_VARS)
