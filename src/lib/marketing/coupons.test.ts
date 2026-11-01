import { describe, it, expect } from 'vitest'
import { couponInputSchema, couponUsability, discountFor, normalizeCouponCode } from './coupons'

describe('normalizeCouponCode', () => {
  it('uppercases and strips spaces and punctuation', () => {
    expect(normalizeCouponCode('hello 2026')).toBe('HELLO2026')
    expect(normalizeCouponCode('giảm-10%')).toBe('GIAM10')
  })

  it('strips Vietnamese diacritics, including đ', () => {
    expect(normalizeCouponCode('đợt Tết')).toBe('DOTTET')
    expect(normalizeCouponCode('ƯU ĐÃI')).toBe('UUDAI')
  })
})

describe('discountFor', () => {
  const percent = { discountType: 'PERCENT' as const, discountValue: 10, maxDiscount: null, minOrderAmount: null }
  const fixed = { discountType: 'FIXED_AMOUNT' as const, discountValue: 100000, maxDiscount: null, minOrderAmount: null }

  it('takes a percent off the subtotal', () => {
    expect(discountFor(percent, 1000000)).toEqual({ ok: true, discount: 100000 })
  })

  it('caps a percent discount at maxDiscount', () => {
    expect(discountFor({ ...percent, maxDiscount: 50000 }, 1000000)).toEqual({ ok: true, discount: 50000 })
  })

  it('never discounts more than the subtotal', () => {
    expect(discountFor(fixed, 50000)).toEqual({ ok: true, discount: 50000 })
  })

  it('refuses below the minimum order amount', () => {
    const r = discountFor({ ...fixed, minOrderAmount: 500000 }, 499999)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('500.000')
  })

  it('accepts exactly the minimum order amount', () => {
    expect(discountFor({ ...fixed, minOrderAmount: 500000 }, 500000)).toEqual({ ok: true, discount: 100000 })
  })

  it('refuses an empty subtotal', () => {
    expect(discountFor(percent, 0).ok).toBe(false)
  })
})

describe('couponUsability', () => {
  const live = {
    isActive: true,
    startDate: new Date('2026-01-01T00:00:00+07:00'),
    endDate: new Date('2026-12-31T23:59:59+07:00'),
    usageLimit: 10,
    usageCount: 3,
  }
  const now = new Date('2026-06-01T12:00:00+07:00')

  it('accepts a live coupon', () => {
    expect(couponUsability(live, now)).toEqual({ ok: true })
  })

  it('refuses a switched-off coupon', () => {
    expect(couponUsability({ ...live, isActive: false }, now)).toMatchObject({ ok: false, error: 'Mã ưu đãi đang tắt' })
  })

  it('refuses before the start date', () => {
    expect(couponUsability(live, new Date('2025-12-31T12:00:00+07:00'))).toMatchObject({ ok: false })
  })

  it('refuses after the end date', () => {
    expect(couponUsability(live, new Date('2027-01-01T12:00:00+07:00'))).toMatchObject({
      ok: false,
      error: 'Mã ưu đãi đã hết hạn',
    })
  })

  it('refuses when no uses are left', () => {
    expect(couponUsability({ ...live, usageCount: 10 }, now)).toMatchObject({
      ok: false,
      error: 'Mã ưu đãi đã hết lượt sử dụng',
    })
  })

  it('treats a null limit as unlimited', () => {
    expect(couponUsability({ ...live, usageLimit: null, usageCount: 9999 }, now)).toEqual({ ok: true })
  })
})

describe('couponInputSchema', () => {
  const base = {
    code: 'HELLO2026',
    name: 'Chào năm mới',
    discountType: 'PERCENT' as const,
    discountValue: 10,
    startDate: '2026-01-01T00:00:00+07:00',
    endDate: '2026-12-31T23:59:59+07:00',
  }

  it('accepts a valid coupon', () => {
    expect(couponInputSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a percent over 100 (a tampered value must not pass)', () => {
    const r = couponInputSchema.safeParse({ ...base, discountValue: 150 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toBe('Phần trăm giảm từ 1 đến 100')
  })

  it('rejects a non-positive fixed amount', () => {
    expect(couponInputSchema.safeParse({ ...base, discountType: 'FIXED_AMOUNT', discountValue: 0 }).success).toBe(false)
  })

  it('rejects an end date before the start date', () => {
    const r = couponInputSchema.safeParse({ ...base, startDate: '2026-12-31T00:00:00+07:00', endDate: '2026-01-01T00:00:00+07:00' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0].message).toBe('Ngày bắt đầu phải trước ngày kết thúc')
  })
})
