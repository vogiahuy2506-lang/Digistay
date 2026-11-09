import { describe, it, expect } from 'vitest'
import { sepayWebhookUrlFor, SepayError } from './sepay'
import { momoWebhookUrlFor, MomoError } from './momo'
import { vnpayWebhookUrlFor, VnpayError } from './vnpay'
import { effectiveDepositMode, type DepositModeRows } from './deposit-mode'

describe('Multi-gateway payment helpers', () => {
  it('webhook URLs are correctly generated for each property', () => {
    process.env.NEXTAUTH_URL = 'https://digistay.vn'
    expect(sepayWebhookUrlFor('prop_abc')).toBe('https://digistay.vn/api/webhooks/sepay/prop_abc')
    expect(momoWebhookUrlFor('prop_abc')).toBe('https://digistay.vn/api/webhooks/momo/prop_abc')
    expect(vnpayWebhookUrlFor('prop_abc')).toBe('https://digistay.vn/api/webhooks/vnpay/prop_abc')
  })

  it('custom error classes have proper error names and status codes', () => {
    const sepayErr = new SepayError('Lỗi SePay', 400)
    expect(sepayErr.name).toBe('SepayError')
    expect(sepayErr.status).toBe(400)

    const momoErr = new MomoError('Lỗi MoMo', 400)
    expect(momoErr.name).toBe('MomoError')
    expect(momoErr.status).toBe(400)

    const vnpayErr = new VnpayError('Lỗi VNPay', 400)
    expect(vnpayErr.name).toBe('VnpayError')
    expect(vnpayErr.status).toBe(400)
  })

  it('effectiveDepositMode resolves correct mode based on priority and active connections', () => {
    const base: DepositModeRows = {
      depositMode: null,
      depositAccountId: 'acc_1',
      payos: null,
      sepay: null,
      momo: null,
      vnpay: null,
      bankAccounts: [{ id: 'acc_1' }],
    }

    // Default with only bank account -> MANUAL
    expect(effectiveDepositMode(base)).toBe('MANUAL')

    // With PayOS connected -> PAYOS
    expect(effectiveDepositMode({ ...base, payos: { webhookConfirmedAt: new Date() } })).toBe('PAYOS')

    // Explicitly chosen SEPAY when connected -> SEPAY
    expect(effectiveDepositMode({
      ...base,
      depositMode: 'SEPAY',
      sepay: { propertyId: 'prop_abc' },
    })).toBe('SEPAY')

    // Explicitly chosen MOMO when connected -> MOMO
    expect(effectiveDepositMode({
      ...base,
      depositMode: 'MOMO',
      momo: { propertyId: 'prop_abc' },
    })).toBe('MOMO')

    // Explicitly chosen VNPAY when connected -> VNPAY
    expect(effectiveDepositMode({
      ...base,
      depositMode: 'VNPAY',
      vnpay: { propertyId: 'prop_abc' },
    })).toBe('VNPAY')

    // Chosen SEPAY but not connected -> falls back to MANUAL if account exists
    expect(effectiveDepositMode({
      ...base,
      depositMode: 'SEPAY',
      sepay: null,
    })).toBe('MANUAL')

    // Chosen SEPAY, not connected, and no active bank accounts -> null
    expect(effectiveDepositMode({
      ...base,
      depositMode: 'SEPAY',
      sepay: null,
      bankAccounts: [],
    })).toBeNull()
  })
})

