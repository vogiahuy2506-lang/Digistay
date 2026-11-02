import { describe, expect, it } from 'vitest'
import {
  cleanFacebookPixelId,
  cleanGoogleTagId,
  isValidFacebookPixelId,
  isValidGoogleTagId,
} from './tracking'

describe('Marketing tracking validations', () => {
  describe('Facebook Pixel ID', () => {
    it('accepts valid 15-16 digit Meta Pixel IDs', () => {
      expect(isValidFacebookPixelId('123456789012345')).toBe(true)
      expect(isValidFacebookPixelId('9876543210987654')).toBe(true)
      expect(isValidFacebookPixelId('  123456789012345  ')).toBe(true)
    })

    it('rejects invalid Pixel IDs', () => {
      expect(isValidFacebookPixelId('')).toBe(false)
      expect(isValidFacebookPixelId(null)).toBe(false)
      expect(isValidFacebookPixelId(undefined)).toBe(false)
      expect(isValidFacebookPixelId('12345')).toBe(false) // too short
      expect(isValidFacebookPixelId('123456789012345abc')).toBe(false) // contains letters
      expect(isValidFacebookPixelId('<script>alert(1)</script>')).toBe(false) // XSS injection
    })

    it('cleans and formats Pixel ID', () => {
      expect(cleanFacebookPixelId('  987654321098765  ')).toBe('987654321098765')
      expect(cleanFacebookPixelId('invalid')).toBe(null)
      expect(cleanFacebookPixelId(123)).toBe(null)
    })
  })

  describe('Google Tag ID (GA4 / GTM / Google Ads)', () => {
    it('accepts valid GA4 IDs', () => {
      expect(isValidGoogleTagId('G-ABC1234567')).toBe(true)
      expect(isValidGoogleTagId('g-abc1234567')).toBe(true)
      expect(isValidGoogleTagId('G-1234567890')).toBe(true)
    })

    it('accepts valid GTM and Google Ads IDs', () => {
      expect(isValidGoogleTagId('GTM-ABCDEF1')).toBe(true)
      expect(isValidGoogleTagId('GT-12345678')).toBe(true)
      expect(isValidGoogleTagId('AW-987654321')).toBe(true)
      expect(isValidGoogleTagId('UA-12345678-1')).toBe(true)
    })

    it('rejects invalid Google Tag IDs', () => {
      expect(isValidGoogleTagId('')).toBe(false)
      expect(isValidGoogleTagId(null)).toBe(false)
      expect(isValidGoogleTagId('G-')).toBe(false)
      expect(isValidGoogleTagId('FACEBOOK-123')).toBe(false)
      expect(isValidGoogleTagId('G-123<script>')).toBe(false)
    })

    it('cleans and normalizes Google Tag ID to uppercase', () => {
      expect(cleanGoogleTagId('  g-xyz98765  ')).toBe('G-XYZ98765')
      expect(cleanGoogleTagId('gtm-12345ab')).toBe('GTM-12345AB')
      expect(cleanGoogleTagId('invalid')).toBe(null)
    })
  })
})
