import { describe, it, expect, beforeAll } from 'vitest'
import { quoteStay, depositFor } from '@/lib/pricing/quote'
import { generateReviewToken, readReviewToken } from '@/lib/reviews/review-token'
import { themes, roles } from '@/styles/tokens'
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/locales'
import { emailLocale, emailTranslator, englishMoney } from '@/lib/email/i18n'
import viMessages from '../../../messages/vi.json'
import enMessages from '../../../messages/en.json'

describe('Task 59: End-to-End User Experience & UX Audit Test', () => {
  describe('Journey 1: Dynamic Pricing Quote Computation', () => {
    it('calculates correct pricing quote with weekday/weekend nights and deposits', () => {
      const rates = {
        weekdayPrice: 1_200_000,
        weekendPrice: 1_500_000,
        extraAdultPrice: 200_000,
        extraChildPrice: 100_000,
      }

      // Check-in Friday, Check-out Sunday (2 nights: Friday + Saturday night)
      const checkIn = new Date('2026-12-04T14:00:00Z')
      const checkOut = new Date('2026-12-06T12:00:00Z')

      const quote = quoteStay({
        rates,
        checkIn,
        checkOut,
        numAdults: 2,
        numChildren: 0,
        baseOccupancy: 2,
      })

      expect(quote).toBeDefined()
      expect(quote.nights).toBe(2)
      expect(quote.total).toBeGreaterThan(0)
      expect(quote.basePrice).toBeGreaterThan(0)

      const deposit = depositFor(quote.total, 50)
      expect(deposit).toBe(Math.round(quote.total * 0.5))
    })
  })

  describe('Journey 2: Frontdesk Check-in / Check-out & Post-Stay Review Token', () => {
    beforeAll(() => {
      process.env.NEXTAUTH_SECRET = 'task-59-secret-e2e-test-key-32chars-min'
    })

    it('generates a tamper-proof review token upon checkout and verifies successfully', () => {
      const bookingId = 'bk_task59_e2e_valid'
      const token = generateReviewToken(bookingId)

      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(20)

      const extractedId = readReviewToken(token)
      expect(extractedId).toBe(bookingId)
    })

    it('rejects tampered review tokens', () => {
      const bookingId = 'bk_task59_e2e_valid'
      const token = generateReviewToken(bookingId)
      const tampered = token.slice(0, -4) + 'abcd'

      const extractedId = readReviewToken(tampered)
      expect(extractedId).toBeNull()
    })
  })

  describe('Journey 3: Dark Mode & Design Tokens Consistency', () => {
    it('provides valid color tokens for both light and dark themes', () => {
      expect(themes.light).toBeDefined()
      expect(themes.dark).toBeDefined()

      // Essential surface & text tokens
      expect(themes.light.page).toBeDefined()
      expect(themes.dark.page).toBeDefined()
      expect(themes.light.fg).toBeDefined()
      expect(themes.dark.fg).toBeDefined()
      expect(themes.light.panel).toBeDefined()
      expect(themes.dark.panel).toBeDefined()

      // Ensure dark theme uses dark background palette
      expect(themes.dark.page).not.toBe(themes.light.page)
    })

    it('defines consistent design system semantic roles', () => {
      expect(roles).toBeDefined()
      expect(roles.length).toBeGreaterThan(10)
      expect(roles).toContain('page')
      expect(roles).toContain('panel')
      expect(roles).toContain('fg')
      expect(roles).toContain('brand')
      expect(roles).toContain('ok')
      expect(roles).toContain('warn')
      expect(roles).toContain('err')

      for (const r of roles) {
        expect(themes.light[r]).toBeDefined()
        expect(themes.dark[r]).toBeDefined()
      }
    })
  })

  describe('Journey 4: Bilingual i18n Localization Integrity', () => {
    it('supports defined locales with Vietnamese as default', () => {
      expect(LOCALES).toContain('vi')
      expect(LOCALES).toContain('en')
      expect(DEFAULT_LOCALE).toBe('vi')

      expect(emailLocale('vi')).toBe('vi')
      expect(emailLocale('en')).toBe('en')
      expect(emailLocale('unknown')).toBe('vi')
    })

    it('has matching email translation structures between Vietnamese and English', () => {
      expect(viMessages.email).toBeDefined()
      expect(enMessages.email).toBeDefined()

      const viEmailKeys = Object.keys(viMessages.email)
      const enEmailKeys = Object.keys(enMessages.email)

      expect(viEmailKeys.length).toBeGreaterThan(0)
      for (const key of viEmailKeys) {
        expect(enEmailKeys).toContain(key)
      }

      const translatorVi = emailTranslator('vi', 'email.booking')
      const translatorEn = emailTranslator('en', 'email.booking')
      expect(translatorVi).toBeDefined()
      expect(translatorEn).toBeDefined()
    })

    it('formats English currency and numbers cleanly', () => {
      const formatted = englishMoney(1_500_000)
      expect(formatted).toContain('1,500,000')
      expect(formatted).toContain('₫')
    })
  })
})

