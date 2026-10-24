import { describe, it, expect } from 'vitest'
import { digistayPageMetadata, hotelPageMetadata } from './page-metadata'
import { absoluteImageUrl, roomPath, sitePageLanguages, sitePageUrl } from './urls'

const ORIGIN = 'https://may-bien.digistay.vn'

describe('site page URLs', () => {
  it('puts Vietnamese at the root and English under /en', () => {
    expect(sitePageUrl(ORIGIN, 'vi', '/')).toBe(`${ORIGIN}/`)
    expect(sitePageUrl(ORIGIN, 'en', '/')).toBe(`${ORIGIN}/en`)
    expect(sitePageUrl(ORIGIN, 'vi', '/rooms/r1')).toBe(`${ORIGIN}/rooms/r1`)
    expect(sitePageUrl(ORIGIN, 'en', 'rooms/r1')).toBe(`${ORIGIN}/en/rooms/r1`)
    expect(sitePageLanguages(ORIGIN, roomPath('r 1'))).toEqual({
      vi: `${ORIGIN}/rooms/r%201`,
      en: `${ORIGIN}/en/rooms/r%201`,
      'x-default': `${ORIGIN}/rooms/r%201`,
    })
  })

  it('only takes absolute http(s) images', () => {
    expect(absoluteImageUrl(' https://img.example/a.jpg ')).toBe('https://img.example/a.jpg')
    expect(absoluteImageUrl('http://img.example/a.jpg')).toBe('http://img.example/a.jpg')
    for (const url of ['data:image/png;base64,AAAA', '/uploads/a.jpg', 'javascript:alert(1)', '', null, undefined]) {
      expect(absoluteImageUrl(url)).toBeNull()
    }
  })
})

describe('hotelPageMetadata', () => {
  it('gives the canonical URL, both languages and the share card', () => {
    const meta = hotelPageMetadata({
      origin: ORIGIN,
      locale: 'en',
      path: '/rooms/r1',
      siteName: 'Mây Biển',
      title: 'Deluxe · Mây Biển',
      description: 'A room facing the sea.',
      images: ['data:image/png;base64,AAAA', 'https://img.example/r1.jpg', 'https://img.example/cover.jpg'],
    })
    expect(meta.alternates).toEqual({
      canonical: `${ORIGIN}/en/rooms/r1`,
      languages: { vi: `${ORIGIN}/rooms/r1`, en: `${ORIGIN}/en/rooms/r1`, 'x-default': `${ORIGIN}/rooms/r1` },
    })
    expect(meta.openGraph).toEqual({
      type: 'website',
      url: `${ORIGIN}/en/rooms/r1`,
      siteName: 'Mây Biển',
      title: 'Deluxe · Mây Biển',
      description: 'A room facing the sea.',
      locale: 'en_US',
      alternateLocale: 'vi_VN',
      images: [{ url: 'https://img.example/r1.jpg', alt: 'Deluxe · Mây Biển' }],
    })
    expect(meta.twitter).toEqual({ card: 'summary_large_image' })
  })

  it('has no image when the hotel has no usable photo', () => {
    const meta = hotelPageMetadata({ origin: ORIGIN, locale: 'vi', path: '/', siteName: 'Mây Biển', title: 'Mây Biển', images: [null] })
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/`)
    expect(meta.openGraph).not.toHaveProperty('images')
    expect(meta.openGraph).not.toHaveProperty('description')
    expect((meta.openGraph as { locale?: string }).locale).toBe('vi_VN')
    expect(meta.twitter).toEqual({ card: 'summary' })
  })
})

describe('digistayPageMetadata', () => {
  it("is canonical on Digistay's origin, with the brand image", () => {
    const meta = digistayPageMetadata({ origin: 'https://digistay.vn', locale: 'vi', path: '/pricing', title: 'Bảng giá', description: 'Gói' })
    expect(meta.alternates).toEqual({ canonical: 'https://digistay.vn/pricing' })
    expect(meta.openGraph).toMatchObject({
      url: 'https://digistay.vn/pricing',
      siteName: 'Digistay',
      locale: 'vi_VN',
      images: [{ url: 'https://digistay.vn/logo_full_digistay.png', width: 800, height: 447 }],
    })
    expect(digistayPageMetadata({ origin: 'https://digistay.vn', locale: 'en', path: '/', title: 'Digistay' }).alternates).toEqual({
      canonical: 'https://digistay.vn/',
    })
  })
})
