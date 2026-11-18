import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateFullWebsiteSiteWithAi, remixWebsiteBlockWithAi, refineWebsiteTextWithAi, THEME_PRESETS } from './website-ai'
import { prisma } from '@/lib/db'
import { loadSiteProps } from '@/lib/public-site/site'

vi.mock('@/lib/db', () => ({
  prisma: {
    property: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/public-site/site', () => ({
  loadSiteProps: vi.fn(),
}))

describe('Website AI Studio Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('contains 5 curated luxury and hospitality theme presets', () => {
    expect(THEME_PRESETS.luxury_boutique).toBeDefined()
    expect(THEME_PRESETS.tropical_eco).toBeDefined()
    expect(THEME_PRESETS.modern_clean).toBeDefined()
    expect(THEME_PRESETS.vintage_boho).toBeDefined()
    expect(THEME_PRESETS.coastal_breeze).toBeDefined()
    expect(THEME_PRESETS.luxury_boutique.headingFont).toBe('Playfair Display')
  })

  it('generates a complete website site with heuristic fallback', async () => {
    vi.mocked(loadSiteProps).mockResolvedValueOnce({
      property: {
        id: 'prop_demo',
        name: 'Hoi An Riverside Resort',
        address: 'Cẩm Châu, Hội An, Quảng Nam',
        type: 'RESORT',
        hotline: '0909123456',
        email: 'resort@hoian.vn',
      },
      images: [
        { url: 'https://images.unsplash.com/cover.jpg', sortOrder: 0 },
        { url: 'https://images.unsplash.com/room1.jpg', sortOrder: 1 },
      ],
      roomTypes: [
        { name: 'Deluxe River View', price: 1500000, description: 'View sông' },
      ],
      amenities: [{ name: 'Hồ bơi vô cực' }],
    } as any)

    const result = await generateFullWebsiteSiteWithAi({
      propertyId: 'prop_demo',
      prompt: 'Resort nghỉ dưỡng ven sông phong cách Indochine',
      stylePreset: 'luxury_boutique',
    })

    expect(result).toBeDefined()
    expect(result.theme.themePreset).toBe('luxury_boutique')
    expect(result.seo.metaTitle).toContain('Hoi An Riverside Resort')
    expect(result.blocks.length).toBeGreaterThanOrEqual(7)
    expect(result.blocks.some((b) => b.type === 'HERO')).toBe(true)
    expect(result.blocks.some((b) => b.type === 'ROOMS')).toBe(true)
    expect(result.blocks.some((b) => b.type === 'AMENITIES')).toBe(true)
    expect(result.translations.en.blocks).toBeDefined()
  })

  it('remixes hero block with 3 distinct creative layout variants', async () => {
    const variants = await remixWebsiteBlockWithAi({
      blockType: 'HERO',
      currentConfig: { heroTitle: 'Tiêu đề cũ' },
      propertyName: 'An Bang Beach Villa',
    })

    expect(variants.length).toBe(3)
    expect(variants.some((v) => v.layoutVariant === 'fullscreen_search')).toBe(true)
    expect(variants.some((v) => v.layoutVariant === 'split_headline')).toBe(true)
    expect(variants.some((v) => v.layoutVariant === 'minimal_center')).toBe(true)
  })

  it('refines in-line text with action modifiers', async () => {
    const shortened = await refineWebsiteTextWithAi({
      text: 'Chào mừng quý khách đến với khách sạn của chúng tôi, nơi bạn sẽ tìm thấy sự an tâm và thoải mái nhất trong chuyến du lịch.',
      action: 'shorten',
    })
    expect(shortened.length).toBeLessThanOrEqual(105)

    const luxury = await refineWebsiteTextWithAi({
      text: 'Khách sạn có phòng đẹp và hồ bơi.',
      action: 'luxury',
    })
    expect(luxury).toContain('Đặc quyền tận hưởng')
  })
})
