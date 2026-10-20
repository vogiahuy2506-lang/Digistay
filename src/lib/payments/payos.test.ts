import { describe, it, expect } from 'vitest'
import { newOrderCode, payosDescription, webhookUrlFor } from './payos'

describe('payos helpers', () => {
  it('order codes are 16 digits and safe as JavaScript numbers (PayOS limit)', () => {
    for (let i = 0; i < 1000; i++) {
      const code = newOrderCode()
      expect(String(code)).toMatch(/^\d{16}$/)
      expect(Number.isSafeInteger(code)).toBe(true)
    }
  })

  it('descriptions are ASCII letters and digits, at most 25 characters', () => {
    expect(payosDescription('DSMG3XK2ABCD')).toBe('DSMG3XK2ABCD')
    expect(payosDescription('Đặt phòng #DS-12/ab')).toBe('t phng DS12ab')
    expect(payosDescription('X'.repeat(40))).toHaveLength(25)
  })

  it('each property has its own webhook URL', () => {
    process.env.NEXTAUTH_URL = 'https://digistay.vn'
    expect(webhookUrlFor('prop_1')).toBe('https://digistay.vn/api/webhooks/payos/prop_1')
  })
})
