/**
 * The website builder stores font names ("Nunito Sans", "Merriweather"...).
 * Those names alone did nothing: no font was loaded, so every site fell back
 * to the system font. The fonts are loaded with next/font in
 * src/app/(public)/[subdomain]/fonts.ts under these CSS variables, all with
 * the Vietnamese subset.
 */
const FONT_VARS: Record<string, string> = {
  Inter: '--font-inter',
  'Playfair Display': '--font-playfair',
  Roboto: '--font-roboto',
  'Open Sans': '--font-open-sans',
  'Nunito Sans': '--font-nunito-sans',
  Merriweather: '--font-merriweather',
  'Be Vietnam Pro': '--font-be-vietnam-pro',
  Montserrat: '--font-montserrat',
}

/**
 * Fonts the builder used to offer. Lato and Poppins have no Vietnamese subset
 * on Google Fonts, so letters like "ế" switched to another font mid-word.
 * Sites that saved them get the closest font that has the glyphs.
 */
const LEGACY_FONTS: Record<string, string> = {
  Lato: 'Nunito Sans',
  Poppins: 'Be Vietnam Pro',
}

const SERIF = new Set(['Playfair Display', 'Merriweather'])

const own = (map: Record<string, string>, key: string) => Object.prototype.hasOwnProperty.call(map, key)

/**
 * The loadable font for a saved name: legacy names are mapped to their
 * replacement, unknown ones (or none) give the default for `kind`.
 */
export function normalizeFont(name: string | null | undefined, kind: 'body' | 'heading'): string {
  const mapped = name && own(LEGACY_FONTS, name) ? LEGACY_FONTS[name] : name
  if (mapped && own(FONT_VARS, mapped)) return mapped
  return kind === 'heading' ? 'Playfair Display' : 'Inter'
}

/**
 * A font-family value for the hotel's choice. Inter (loaded by the root
 * layout, with Vietnamese) stays right after it as a safety net before the
 * generic family.
 */
export function fontStack(name: string | null | undefined, kind: 'body' | 'heading'): string {
  const chosen = normalizeFont(name, kind)
  const generic = SERIF.has(chosen) ? 'Georgia, serif' : 'system-ui, sans-serif'
  const variable = `var(${FONT_VARS[chosen]})`
  return chosen === 'Inter' ? `${variable}, ${generic}` : `${variable}, var(--font-inter), ${generic}`
}

/** Every font a site can use; the builder's options must come from this list. */
export const builderFonts = Object.keys(FONT_VARS)
