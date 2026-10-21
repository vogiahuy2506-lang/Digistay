import { describe, it, expect, beforeAll } from 'vitest'
import { depositToken, depositUrl, readDepositToken } from './deposit-link'

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'deposit-link-test-secret'
  process.env.NEXTAUTH_URL = 'https://digistay.test'
})

describe('deposit link', () => {
  it("reads back its booking; any change to the id or the signature is refused", () => {
    const token = depositToken('cmbooking123')
    expect(readDepositToken(token)).toBe('cmbooking123')
    const [id, sig] = token.split('.')
    expect(readDepositToken(`cmbooking124.${sig}`)).toBeNull() // another booking, same signature
    expect(readDepositToken(`${id}.${sig.slice(0, -2)}AA`)).toBeNull()
    expect(readDepositToken(id)).toBeNull()
    expect(readDepositToken(`${token}.extra`)).toBeNull()
    expect(readDepositToken(`../x.${sig}`)).toBeNull()
    expect(readDepositToken(42)).toBeNull()
  })

  it('is bound to the server secret', () => {
    const token = depositToken('cmbooking123')
    process.env.NEXTAUTH_SECRET = 'another-secret'
    expect(readDepositToken(token)).toBeNull()
    process.env.NEXTAUTH_SECRET = 'deposit-link-test-secret'
  })

  it('points at the hotel page on the app host', () => {
    expect(depositUrl('ks-demo', 'cmbooking123')).toBe(`https://digistay.test/ks-demo/dat-coc/${depositToken('cmbooking123')}`)
  })
})
