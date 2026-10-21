import { describe, it, expect } from 'vitest'
import { accountFromVietQr } from './deposit-view'

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

describe('accountFromVietQr', () => {
  it('reads the account number of a VietQR payload', () => {
    const beneficiary = tlv('00', '970422') + tlv('01', '0901234567')
    const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA')
    const payload = tlv('00', '01') + tlv('01', '12') + tlv('38', merchant) + tlv('53', '704') + tlv('54', '1638000') + tlv('58', 'VN') + '6304ABCD'
    expect(accountFromVietQr(payload)).toBe('0901234567')
  })

  it.each([null, '', 'not a qr', '0002010102123899'])('gives null for %s', (payload) => {
    expect(accountFromVietQr(payload)).toBeNull()
  })
})
