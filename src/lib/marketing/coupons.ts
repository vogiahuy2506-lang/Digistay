import { z } from 'zod'

/**
 * Coupon (mã giảm giá) rules shared by the staff API and the guest checkout
 * (tasks 41-42). Pure, so unit tests and pages can import it too.
 *
 * A coupon belongs to one property, discounts one booking's room+service
 * subtotal, and keeps its own counter: checkout re-checks everything under
 * a row lock and bumps `usageCount` in the same transaction, so a coupon
 * with one use left cannot be spent twice (coupons.test.ts races it).
 */

export type CouponDiscountType = 'PERCENT' | 'FIXED_AMOUNT'

/**
 * A code as the guest or staff typed it, normalized for storage and lookup:
 * uppercase, no diacritics, letters and digits only (VD: "giảm 10%" → "GIAM10").
 */
export function normalizeCouponCode(raw: string): string {
  return raw
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v)

const optionalAmount = (message: string) =>
  z.preprocess(emptyToUndefined, z.coerce.number({ invalid_type_error: message }).nonnegative(message).optional())

/** The full shape of a coupon, for create and (merged with the stored row) for update. */
export const couponInputSchema = z
  .object({
    code: z.string().min(1, 'Vui lòng nhập mã ưu đãi').max(30, 'Mã ưu đãi tối đa 30 ký tự'),
    name: z.string().min(2, 'Tên chương trình phải có ít nhất 2 ký tự').max(100, 'Tên chương trình tối đa 100 ký tự'),
    discountType: z.enum(['PERCENT', 'FIXED_AMOUNT']),
    discountValue: z.coerce.number({ invalid_type_error: 'Dữ liệu không hợp lệ' }),
    maxDiscount: optionalAmount('Mức giảm tối đa phải từ 0 trở lên'),
    minOrderAmount: optionalAmount('Đơn tối thiểu phải từ 0 trở lên'),
    startDate: z.coerce.date({ invalid_type_error: 'Ngày bắt đầu không hợp lệ' }),
    endDate: z.coerce.date({ invalid_type_error: 'Ngày kết thúc không hợp lệ' }),
    usageLimit: z.preprocess(emptyToUndefined, z.coerce.number({ invalid_type_error: 'Giới hạn lượt dùng là số nguyên' }).int('Giới hạn lượt dùng là số nguyên').positive('Giới hạn lượt dùng phải lớn hơn 0').optional()),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === 'PERCENT' && !(v.discountValue >= 1 && v.discountValue <= 100)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Phần trăm giảm từ 1 đến 100' })
    }
    if (v.discountType === 'FIXED_AMOUNT' && !(v.discountValue > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Số tiền giảm phải lớn hơn 0' })
    }
    if (!(v.endDate > v.startDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Ngày bắt đầu phải trước ngày kết thúc' })
    }
  })

export type CouponInput = z.infer<typeof couponInputSchema>

export interface CouponRule {
  discountType: CouponDiscountType
  discountValue: number
  maxDiscount: number | null | undefined
  minOrderAmount: number | null | undefined
}

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} ₫`

/**
 * How much a coupon takes off `subtotal` (whole dong, never more than the
 * subtotal), or why it cannot apply. The checkout calls this twice: once to
 * preview, once under the row lock before creating the booking.
 */
export function discountFor(
  rule: CouponRule,
  subtotal: number
): { ok: true; discount: number } | { ok: false; error: string } {
  if (!(subtotal > 0)) return { ok: false, error: 'Đơn hàng chưa có giá trị để áp dụng mã' }
  if (rule.minOrderAmount != null && rule.minOrderAmount > 0 && subtotal < rule.minOrderAmount) {
    return { ok: false, error: `Đơn tối thiểu ${vnd(rule.minOrderAmount)} mới dùng được mã này` }
  }
  const raw =
    rule.discountType === 'PERCENT' ? (subtotal * Math.min(Math.max(rule.discountValue, 0), 100)) / 100 : rule.discountValue
  const capped = rule.discountType === 'PERCENT' && rule.maxDiscount != null ? Math.min(raw, rule.maxDiscount) : raw
  return { ok: true, discount: Math.max(0, Math.min(Math.round(capped), Math.round(subtotal))) }
}

export interface CouponState {
  isActive: boolean
  startDate: Date
  endDate: Date
  usageLimit: number | null | undefined
  usageCount: number
}

/** Whether a coupon may be used right now (active, within its dates, uses left). */
export function couponUsability(c: CouponState, now = new Date()): { ok: true } | { ok: false; error: string } {
  if (!c.isActive) return { ok: false, error: 'Mã ưu đãi đang tắt' }
  if (now < c.startDate) return { ok: false, error: 'Mã ưu đãi chưa bắt đầu' }
  if (now > c.endDate) return { ok: false, error: 'Mã ưu đãi đã hết hạn' }
  if (c.usageLimit != null && c.usageCount >= c.usageLimit) return { ok: false, error: 'Mã ưu đãi đã hết lượt sử dụng' }
  return { ok: true }
}
