import { describe, it, expect } from 'vitest'
import { buildVietQr } from './index'

/**
 * Tests for the VietQR builder.
 *
 * The output is an EMVCo-compliant string. The most important thing
 * we verify here is the CRC-16/CCITT trailer, because a single
 * bad nibble will make every Vietnamese banking app reject the QR.
 * We also assert the structural fields (bank BIN, account, amount,
 * reference) are present in the right place.
 */

// Parse a flat EMVCo TLV payload: returns a Map of id -> value for
// the **top-level** fields only. Sub-templates (e.g. the merchant
// account information in ID 26, or the additional data in ID 62) are
// returned as their raw value string — callers can recurse on them
// if they need to pick out sub-tags.
function parseTlv(payload: string): Map<string, string> {
  const map = new Map<string, string>()
  let i = 0
  while (i < payload.length) {
    const id = payload.slice(i, i + 2)
    const len = parseInt(payload.slice(i + 2, i + 4), 10)
    if (Number.isNaN(len)) break
    const value = payload.slice(i + 4, i + 4 + len)
    // EMVCo forbids duplicate top-level IDs; we honour first-write
    // so the first occurrence wins.
    if (!map.has(id)) map.set(id, value)
    i += 4 + len
  }
  return map
}

function subTag(payload: string, id: string): string {
  const idx = payload.indexOf(id)
  if (idx < 0) throw new Error(`sub-tag ${id} not found`)
  const len = parseInt(payload.slice(idx + 2, idx + 4), 10)
  return payload.slice(idx + 4, idx + 4 + len)
}

// Kept around because some tests below still want the simpler "first
// occurrence" lookup.

describe('buildVietQr', () => {
  const base = {
    bankCode: 'VCB',
    accountNumber: '1234567890',
    accountHolder: 'NGUYEN VAN A',
    amount: 100000,
    addInfo: 'BK-001',
  }

  it('returns a string that ends with the CRC-16/CCITT trailer', () => {
    const out = buildVietQr(base)
    // The last 4 chars of a well-formed VietQR string are the CRC.
    const crc = out.slice(-4)
    expect(crc).toMatch(/^[0-9A-F]{4}$/)
  })

  it('embeds the payload format indicator (ID 00 = 01)', () => {
    const out = buildVietQr(base)
    expect(parseTlv(out).get('00')).toBe('01')
  })

  it('uses dynamic QR (ID 01 = 12) so amount is honoured', () => {
    const out = buildVietQr(base)
    expect(parseTlv(out).get('01')).toBe('12')
  })

  it('uses VND (ID 53 = 704)', () => {
    const out = buildVietQr(base)
    expect(parseTlv(out).get('53')).toBe('704')
  })

  it('uses VN as the country code (ID 58)', () => {
    const out = buildVietQr(base)
    expect(parseTlv(out).get('58')).toBe('VN')
  })

  it('includes the bank BIN and account number in the merchant template (ID 26)', () => {
    const out = buildVietQr(base)
    const merchant = parseTlv(out).get('26')!
    // The merchant template is a TLV sequence: 00, 01, 02, 03, 05.
    // Each sub-tag is `id<len><value>`, so a full parse gives us the
    // whole picture.
    const parsed = parseTlv(merchant)
    expect(parsed.get('00')).toBe('') // GUID — empty for non-Napas-direct
    expect(parsed.get('01')).toBe('VCB')
    expect(parsed.get('02')).toBe('1234567890')
    expect(parsed.get('03')).toBe('QRIBFTTA')
    expect(parsed.get('05')).toBe('NGUYEN VAN A') // normalised accountHolder
  })

  it('includes the amount (ID 54) when amount > 0', () => {
    const out = buildVietQr(base)
    expect(parseTlv(out).get('54')).toBe('100000')
  })

  it('omits ID 54 when amount is 0', () => {
    const out = buildVietQr({ ...base, amount: 0 })
    // Amount of 0 is rendered as the empty string, so the length is
    // "00" but no value. We assert there's no `54<len><value>`
    // sequence with a non-zero length.
    const map = parseTlv(out)
    const v = map.get('54')
    expect(v == null || v === '').toBe(true)
  })

  it('rounds fractional amounts to whole VND', () => {
    const out = buildVietQr({ ...base, amount: 12345.67 })
    expect(parseTlv(out).get('54')).toBe('12346')
  })

  it('puts the transfer reference in the additional-data template (ID 62 sub-tag 08)', () => {
    const out = buildVietQr(base)
    const add = parseTlv(out).get('62')!
    expect(parseTlv(add).get('08')).toBe('BK-001')
  })

  it('strips diacritics and upper-cases the *accountHolder* (used in ID 26 sub-tag 05)', () => {
    // The merchant name (ID 59) is taken as-is, but the account
    // holder is normalised — this is the one the bank actually
    // displays next to the account number.
    const out = buildVietQr({ ...base, accountHolder: 'Nguyễn Văn Á' })
    const merchant = parseTlv(out).get('26')!
    expect(parseTlv(merchant).get('05')).toBe('NGUYEN VAN A')
  })

  it('keeps the merchant name (ID 59) verbatim', () => {
    // merchantName is for the QR's own branding; banks ignore it.
    // It is only truncated to 25 chars.
    const out = buildVietQr({ ...base, merchantName: 'Hotel ABC' })
    expect(parseTlv(out).get('59')).toBe('Hotel ABC')
  })

  it('strips disallowed characters from addInfo', () => {
    // The actual sanitiser keeps `[A-Za-z0-9 \-_./]`. So `/` and
    // spaces survive; only `()` and `!` are stripped.
    const out = buildVietQr({ ...base, addInfo: 'BK/001 (paid)!' })
    const add = parseTlv(out).get('62')!
    expect(parseTlv(add).get('08')).toBe('BK/001 paid')
  })

  it('produces a CRC that matches an independent CRC-16/CCITT computation', () => {
    // Independent reference implementation of CRC-16/CCITT-FALSE
    // (poly 0x1021, init 0xFFFF, no reflection, no xorout). This is
    // the exact spec EMVCo / Napas require.
    function crc(input: string): string {
      let crc = 0xffff
      for (let i = 0; i < input.length; i++) {
        crc ^= input.charCodeAt(i) << 8
        for (let j = 0; j < 8; j++) {
          if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff
          else crc = (crc << 1) & 0xffff
        }
      }
      return crc.toString(16).toUpperCase().padStart(4, '0')
    }

    const out = buildVietQr(base)
    const withoutCrc = out.slice(0, -4)
    expect(out.slice(-4)).toBe(crc(withoutCrc))
  })

  it('truncates the merchant name to 25 characters', () => {
    const long = 'A'.repeat(40)
    const out = buildVietQr({ ...base, merchantName: long })
    expect(parseTlv(out).get('59')!.length).toBe(25)
  })

  it('truncates the addInfo reference to 50 characters', () => {
    const long = 'X'.repeat(80)
    const out = buildVietQr({ ...base, addInfo: long })
    const add = parseTlv(out).get('62')!
    expect(parseTlv(add).get('08')!.length).toBe(50)
  })

  it('falls back to MERCHANT when both accountHolder and merchantName are empty', () => {
    const out = buildVietQr({ ...base, accountHolder: '', merchantName: undefined })
    const merchant = parseTlv(out).get('26')!
    expect(parseTlv(merchant).get('05')).toBe('MERCHANT')
  })
})
