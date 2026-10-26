import { describe, it, expect, beforeAll } from 'vitest'
import { invoiceLookupToken, invoiceLookupUrl, invoicePdfPath, readInvoiceLookupToken } from './lookup-link'
import { depositToken } from '@/lib/payments/deposit-link'

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'invoice-lookup-test-secret'
  process.env.NEXTAUTH_URL = 'https://digistay.test'
})

describe('invoice lookup link', () => {
  it('reads back its invoice; any change to the id or the signature is refused', () => {
    const token = invoiceLookupToken('cminvoice123')
    expect(readInvoiceLookupToken(token)).toBe('cminvoice123')
    const [id, sig] = token.split('.')
    expect(readInvoiceLookupToken(`cminvoice124.${sig}`)).toBeNull() // another invoice, same signature
    expect(readInvoiceLookupToken(`${id}.${sig.slice(0, -2)}AA`)).toBeNull()
    expect(readInvoiceLookupToken(id)).toBeNull()
    expect(readInvoiceLookupToken(`${token}.extra`)).toBeNull()
    expect(readInvoiceLookupToken(`../x.${sig}`)).toBeNull()
    expect(readInvoiceLookupToken('x'.repeat(201))).toBeNull()
    expect(readInvoiceLookupToken(42)).toBeNull()
  })

  it('is not the guessable MaTraCuu, and a deposit link of the same id does not open it', () => {
    const token = invoiceLookupToken('cminvoice123')
    expect(readInvoiceLookupToken('DSINV261027ABCD')).toBeNull()
    // Same id, other purpose: the keys are derived separately.
    expect(readInvoiceLookupToken(depositToken('cminvoice123'))).toBeNull()
    expect(token.split('.')[1]).not.toBe(depositToken('cminvoice123').split('.')[1])
  })

  it('is bound to the server secret', () => {
    const token = invoiceLookupToken('cminvoice123')
    process.env.NEXTAUTH_SECRET = 'another-secret'
    expect(readInvoiceLookupToken(token)).toBeNull()
    process.env.NEXTAUTH_SECRET = 'invoice-lookup-test-secret'
    expect(readInvoiceLookupToken(token)).toBe('cminvoice123')
  })

  it("points at the hotel's page on the app host, in the buyer's language, and at its PDF", () => {
    const token = invoiceLookupToken('cminvoice123')
    expect(invoiceLookupUrl('ks-demo', 'cminvoice123')).toBe(`https://digistay.test/ks-demo/hoa-don/${token}`)
    expect(invoiceLookupUrl('ks-demo', 'cminvoice123', 'en')).toBe(`https://digistay.test/ks-demo/en/hoa-don/${token}`)
    expect(invoicePdfPath(token)).toBe(`/api/public/invoices/${token}/pdf`)
    expect(invoicePdfPath(token, 'en')).toBe(`/api/public/invoices/${token}/pdf?lang=en`)
  })
})
