import { describe, it, expect } from 'vitest'
import {
  calculateWeekdayPrice,
  isWeekend,
  getDaysBetween,
  slugify,
  generateSlug,
  formatCurrency,
  formatDate,
  formatDateTime,
  truncate,
  getInitials,
  isValidEmail,
  isValidPhone,
  pluralize,
  isImageFile,
  getFileExtension,
  sanitizeFilename,
} from './index'

describe('calculateWeekdayPrice', () => {
  it('returns base price for weekdays', () => {
    expect(calculateWeekdayPrice(1_000_000, false)).toBe(1_000_000)
    expect(calculateWeekdayPrice(1_000_000, false, 20)).toBe(1_000_000)
  })

  it('adds the surcharge percent on weekends', () => {
    // 1,000,000 * 20% = 200,000
    expect(calculateWeekdayPrice(1_000_000, true, 20)).toBe(1_200_000)
  })

  it('treats an absent surcharge as 0', () => {
    expect(calculateWeekdayPrice(500_000, true)).toBe(500_000)
  })
})

describe('isWeekend', () => {
  it('returns true for Saturday and Sunday', () => {
    // 2024-01-06 is a Saturday
    expect(isWeekend(new Date('2024-01-06T00:00:00Z'))).toBe(true)
    // 2024-01-07 is a Sunday
    expect(isWeekend(new Date('2024-01-07T00:00:00Z'))).toBe(true)
  })

  it('returns false for Mon-Fri', () => {
    expect(isWeekend(new Date('2024-01-08T00:00:00Z'))).toBe(false) // Mon
    expect(isWeekend(new Date('2024-01-12T00:00:00Z'))).toBe(false) // Fri
  })
})

describe('getDaysBetween', () => {
  it('returns the absolute day count regardless of order', () => {
    expect(
      getDaysBetween(new Date('2024-01-01'), new Date('2024-01-05'))
    ).toBe(4)
    expect(
      getDaysBetween(new Date('2024-01-05'), new Date('2024-01-01'))
    ).toBe(4)
  })

  it('returns 0 for the same day', () => {
    const d = new Date('2024-01-01T10:00:00Z')
    expect(getDaysBetween(d, d)).toBe(0)
  })
})

describe('slugify', () => {
  it('lowercases and removes diacritics', () => {
    expect(slugify('Nguyễn Văn A')).toBe('nguyen-van-a')
  })

  it('turns spaces and punctuation into single dashes', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })

  it('treats Vietnamese đ/Đ as plain d', () => {
    expect(slugify('Đà Nẵng')).toBe('da-nang')
  })

  it('trims leading/trailing dashes', () => {
    expect(slugify('---hello---')).toBe('hello')
  })
})

describe('generateSlug', () => {
  it('returns the base slug if there is no collision', () => {
    expect(generateSlug('Hotel ABC', ['other-hotel'])).toBe('hotel-abc')
  })

  it('appends a counter until the slug is unique', () => {
    expect(generateSlug('Hotel ABC', ['hotel-abc'])).toBe('hotel-abc-1')
    expect(generateSlug('Hotel ABC', ['hotel-abc', 'hotel-abc-1'])).toBe(
      'hotel-abc-2'
    )
  })
})

describe('formatCurrency', () => {
  it('formats VND with no decimals by default', () => {
    const out = formatCurrency(1_000_000)
    // vi-VN: "1.000.000 ₫"
    expect(out).toContain('1.000.000')
  })

  it('accepts a custom currency code', () => {
    // VND defaults to no decimals, USD with this formatter also
    // rounds to 0 fraction digits — 99.5 becomes 100.
    const out = formatCurrency(99.5, 'USD')
    expect(out).toContain('100')
    expect(out).toContain('US')
  })
})

describe('formatDate / formatDateTime', () => {
  it('renders a Vietnamese-locale date', () => {
    const out = formatDate(new Date('2024-03-15T00:00:00Z'))
    // The exact string depends on the runtime ICU data, but the
    // year and the day always appear.
    expect(out).toContain('2024')
    expect(out).toContain('15')
  })

  it('renders a datetime with time component', () => {
    const out = formatDateTime(new Date('2024-03-15T14:30:00Z'))
    expect(out).toContain('15')
    expect(out).toMatch(/14|30/) // hour or minute should appear
  })
})

describe('truncate', () => {
  it('returns the string as-is when shorter than the limit', () => {
    expect(truncate('hi', 10)).toBe('hi')
  })

  it('truncates and adds an ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...')
  })
})

describe('getInitials', () => {
  it('returns the first letter of each word, up to 2', () => {
    expect(getInitials('Nguyen Van A')).toBe('NV')
    expect(getInitials('alice')).toBe('A')
  })

  it('upper-cases the result', () => {
    expect(getInitials('alice cooper')).toBe('AC')
  })
})

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('foo.bar+tag@example.com')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('@b.c')).toBe(false)
  })
})

describe('isValidPhone', () => {
  it('accepts valid 10-digit Vietnamese numbers starting with 0', () => {
    expect(isValidPhone('0912345678')).toBe(true)
  })

  it('rejects international-format (84-prefixed) numbers', () => {
    // The regex only matches 0-prefixed numbers, so +84 prefixes fail.
    expect(isValidPhone('84912345678')).toBe(false)
  })

  it('rejects too-short or non-numeric input', () => {
    expect(isValidPhone('123')).toBe(false)
    expect(isValidPhone('abcdefghij')).toBe(false)
  })
})

describe('pluralize', () => {
  it('returns singular for count 1', () => {
    expect(pluralize(1, 'booking')).toBe('booking')
  })

  it('returns the explicit plural when provided', () => {
    expect(pluralize(2, 'booking', 'bookings')).toBe('bookings')
  })

  it('falls back to singular + s when no plural is given', () => {
    expect(pluralize(0, 'booking')).toBe('bookings')
  })
})

describe('file extension helpers', () => {
  it('extracts the file extension', () => {
    expect(getFileExtension('photo.jpg')).toBe('jpg')
    expect(getFileExtension('archive.tar.gz')).toBe('gz')
    expect(getFileExtension('no-extension')).toBe('')
  })

  it('recognises common image extensions', () => {
    expect(isImageFile('a.png')).toBe(true)
    expect(isImageFile('b.JPG')).toBe(true) // case-insensitive
    expect(isImageFile('c.txt')).toBe(false)
  })
})

describe('sanitizeFilename', () => {
  it('replaces unsafe characters and lower-cases', () => {
    expect(sanitizeFilename('My File (1).JPG')).toBe('my_file__1_.jpg')
  })
})
