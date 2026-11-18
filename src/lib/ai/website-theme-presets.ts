export interface WebsiteThemeConfig {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  buttonColor: string
  headingColor: string
  backgroundColor: string
  fontFamily: string
  headingFont: string
  themePreset: string
  layout: string
}

export interface GeneratedWebsiteBlock {
  type: string
  name: string
  layoutVariant: string
  sortOrder: number
  isEnabled: boolean
  config: Record<string, any>
}

export interface GeneratedWebsiteResult {
  theme: WebsiteThemeConfig
  seo: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string
  }
  blocks: GeneratedWebsiteBlock[]
  translations: {
    en: {
      metaTitle?: string
      metaDescription?: string
      blocks?: Record<string, any>
    }
  }
}

export const THEME_PRESETS: Record<string, WebsiteThemeConfig> = {
  luxury_boutique: {
    primaryColor: '#1A2B49',
    secondaryColor: '#C5A880',
    accentColor: '#D4AF37',
    buttonColor: '#1A2B49',
    headingColor: '#0F172A',
    backgroundColor: '#FAFAF9',
    fontFamily: 'Inter',
    headingFont: 'Playfair Display',
    themePreset: 'luxury_boutique',
    layout: 'modern',
  },
  tropical_eco: {
    primaryColor: '#1E4D3B',
    secondaryColor: '#E8A87C',
    accentColor: '#529471',
    buttonColor: '#1E4D3B',
    headingColor: '#0F2F24',
    backgroundColor: '#F8FAF8',
    fontFamily: 'Plus Jakarta Sans',
    headingFont: 'Playfair Display',
    themePreset: 'tropical_eco',
    layout: 'modern',
  },
  modern_clean: {
    primaryColor: '#2563EB',
    secondaryColor: '#10B981',
    accentColor: '#F59E0B',
    buttonColor: '#2563EB',
    headingColor: '#111827',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    headingFont: 'Plus Jakarta Sans',
    themePreset: 'modern_clean',
    layout: 'modern',
  },
  vintage_boho: {
    primaryColor: '#8B4513',
    secondaryColor: '#D27D2D',
    accentColor: '#CD853F',
    buttonColor: '#8B4513',
    headingColor: '#3E2723',
    backgroundColor: '#FFFDF9',
    fontFamily: 'Be Vietnam Pro',
    headingFont: 'Merriweather',
    themePreset: 'vintage_boho',
    layout: 'classic',
  },
  coastal_breeze: {
    primaryColor: '#0284C7',
    secondaryColor: '#0D9488',
    accentColor: '#F97316',
    buttonColor: '#0284C7',
    headingColor: '#0C4A6E',
    backgroundColor: '#F0F9FF',
    fontFamily: 'Inter',
    headingFont: 'Playfair Display',
    themePreset: 'coastal_breeze',
    layout: 'modern',
  },
}
