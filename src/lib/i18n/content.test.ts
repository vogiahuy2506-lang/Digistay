import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { blockText, localized, localizeRow } from './content'
import { amenityName } from './amenities'
import { mergeTranslations, translationsInput } from './translations-input'

const room = { name: 'Phòng đôi', description: 'Có ban công', translations: { en: { name: 'Double room', description: '  ' } } }

describe('hotel texts in the visitor language', () => {
  it('uses the English text when there is one, the Vietnamese otherwise', () => {
    expect(localized(room, 'name', 'en')).toBe('Double room')
    expect(localized(room, 'description', 'en')).toBe('Có ban công')
    expect(localized(room, 'name', 'vi')).toBe('Phòng đôi')
    expect(localized({ name: 'Phòng', translations: null }, 'name', 'en')).toBe('Phòng')
    expect(localizeRow(room, ['name', 'description'], 'en')).toMatchObject({ name: 'Double room', description: 'Có ban công' })
  })

  it("block texts: config.en, else the Vietnamese unless it is the builder's default", () => {
    expect(blockText({ heroTitle: 'Chào mừng', en: { heroTitle: 'Welcome' } }, 'en', 'heroTitle')).toBe('Welcome')
    expect(blockText({ heroTitle: 'Chào mừng' }, 'en', 'heroTitle')).toBe('Chào mừng')
    expect(blockText({ roomsTitle: 'Các hạng phòng' }, 'en', 'roomsTitle')).toBeUndefined()
    expect(blockText({ roomsTitle: 'Các hạng phòng' }, 'vi', 'roomsTitle')).toBe('Các hạng phòng')
    expect(blockText({ title: 'Cũ' }, 'vi', 'galleryTitle', 'title')).toBe('Cũ')
  })

  it('amenity names follow the language by slug', () => {
    expect(amenityName('wifi', 'Wifi miễn phí', 'en')).toBe('Free Wi-Fi')
    expect(amenityName('wifi', 'Wifi miễn phí', 'vi')).toBe('Wifi miễn phí')
    expect(amenityName('custom', 'Xe đạp', 'en')).toBe('Xe đạp')
  })
})

describe('saving English texts', () => {
  const input = translationsInput(['name', 'description'])

  it('accepts only the listed fields', () => {
    expect(input.safeParse({ en: { name: 'Double' } }).success).toBe(true)
    expect(input.safeParse({ en: { slug: 'x' } }).success).toBe(false)
    expect(input.safeParse(null).success).toBe(true)
    expect(input.safeParse(undefined).success).toBe(true)
  })

  it('sets, trims and removes texts, keeping the ones not sent', () => {
    const stored = { en: { name: 'Double', description: 'Old' } }
    expect(mergeTranslations(stored, { en: { description: '  New  ' } })).toEqual({ en: { name: 'Double', description: 'New' } })
    expect(mergeTranslations(stored, { en: { description: '' } })).toEqual({ en: { name: 'Double' } })
    expect(mergeTranslations(stored, { en: { name: ' ', description: null } })).toBe(Prisma.DbNull)
    expect(mergeTranslations(stored, undefined)).toBeUndefined()
    expect(mergeTranslations(stored, null)).toBeUndefined()
  })
})
