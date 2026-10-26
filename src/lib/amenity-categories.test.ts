import { describe, it, expect } from 'vitest'
import en from '../../messages/dash/en/property.json'
import vi from '../../messages/dash/vi/property.json'
import { AMENITY_CATEGORIES, amenityCategory, groupAmenities } from './amenity-categories'

const amenity = (name: string, category: string | null) => ({ name, category })

describe('groupAmenities', () => {
  it('keeps every seeded group apart, transport and view included, in reading order', () => {
    const groups = groupAmenities([
      amenity('View biển', 'view'),
      amenity('Tivi', 'entertainment'),
      amenity('Hồ bơi', 'leisure'),
      amenity('Đưa đón sân bay', 'transport'),
      amenity('Wifi miễn phí', 'internet'),
    ])
    expect(groups.map((g) => g.category)).toEqual(['internet', 'leisure', 'entertainment', 'transport', 'view'])
  })

  it('puts an unknown or missing category in "other", last', () => {
    const groups = groupAmenities([amenity('Bể cá', 'aquarium'), amenity('Không nhóm', null), amenity('Wifi', 'internet')])
    expect(groups).toEqual([
      { category: 'internet', items: [amenity('Wifi', 'internet')] },
      { category: 'other', items: [amenity('Bể cá', 'aquarium'), amenity('Không nhóm', null)] },
    ])
    expect(amenityCategory(undefined)).toBe('other')
  })
})

describe('the group labels', () => {
  it('has a label for every group in both languages, and no two groups share one', () => {
    for (const messages of [vi, en]) {
      const labels = messages.detail.amenities.categories as Record<string, string>
      const keys = [...AMENITY_CATEGORIES, 'other']
      expect(keys.filter((key) => !labels[key])).toEqual([])
      expect(new Set(keys.map((key) => labels[key])).size).toBe(keys.length)
    }
  })
})
