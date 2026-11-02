import { describe, it, expect, beforeEach } from 'vitest'
import { generateReviewToken, readReviewToken, reviewUrl } from './review-token'

describe('review-token', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'review-token-test-secret'
  })

  it('generates a signed token and reads back bookingId correctly', () => {
    const bookingId = 'clx1234567890abcdef'
    const token = generateReviewToken(bookingId)

    expect(token).toContain(bookingId)
    const parsedId = readReviewToken(token)
    expect(parsedId).toBe(bookingId)
  })

  it('refuses forged or tampered tokens', () => {
    const bookingId = 'booking-1'
    const token = generateReviewToken(bookingId)

    // Tampered payload
    expect(readReviewToken('booking-2.' + token.split('.')[1])).toBeNull()

    // Tampered signature
    expect(readReviewToken(bookingId + '.invalidSig123456')).toBeNull()

    // Malformed token
    expect(readReviewToken('invalid')).toBeNull()
    expect(readReviewToken(null)).toBeNull()
    expect(readReviewToken('')).toBeNull()
  })

  it('generates localized review url', () => {
    const url = reviewUrl('khachsanabc', 'b123', 'vi')
    expect(url).toContain('khachsanabc')
    expect(url).toContain('/danh-gia?token=b123.')
  })
})
