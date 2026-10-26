import { describe, it, expect } from 'vitest'
import { buildVietQr, crc16CcittFalse, toBankName } from './index'
import { VIETQR_BANKS, bankLabel, findBank } from './banks'

/**
 * Tests for the VietQR builder against the NAPAS VietQR spec (EMVCo MPM):
 * merchant account in ID 38 with GUID A000000727, the bank's 6-digit BIN
 * and the account number, service QRIBFTTA, ASCII names, byte lengths and
 * the CRC-16/CCITT-FALSE trailer. The expected payloads below were built by
 * hand from the spec, with the CRC from Python's binascii.crc_hqx(…, 0xFFFF).
 */

/** Parses EMVCo TLV fields by bytes; throws on a malformed or truncated payload. */
function parseTlv(payload: string): Map<string, string> {
  const bytes = new TextEncoder().encode(payload)
  const map = new Map<string, string>()
  let i = 0
  while (i < bytes.length) {
    const head = new TextDecoder().decode(bytes.slice(i, i + 4))
    if (!/^\d{4}$/.test(head)) throw new Error(`bad field header at byte ${i}: ${head}`)
    const id = head.slice(0, 2)
    const len = Number(head.slice(2))
    if (i + 4 + len > bytes.length) throw new Error(`field ${id} runs past the end`)
    if (map.has(id)) throw new Error(`duplicate field ${id}`)
    map.set(id, new TextDecoder().decode(bytes.slice(i + 4, i + 4 + len)))
    i += 4 + len
  }
  return map
}

/** The merchant account (ID 38) as { guid, bin, account, service }. */
function napasAccount(payload: string) {
  const merchant = parseTlv(parseTlv(payload).get('38')!)
  const beneficiary = parseTlv(merchant.get('01')!)
  return { guid: merchant.get('00'), bin: beneficiary.get('00'), account: beneficiary.get('01'), service: merchant.get('02') }
}

describe('buildVietQr', () => {
  const base = {
    bankCode: 'VCB',
    accountNumber: '1234567890',
    accountHolder: 'NGUYEN VAN A',
    amount: 100000,
    addInfo: 'BK-001',
  }

  it('builds the exact NAPAS payload of a dynamic transfer (Vietcombank, amount, content)', () => {
    const out = buildVietQr({
      bankCode: 'VCB',
      accountNumber: '0123456789',
      accountHolder: 'cong ty khach san demo',
      amount: 9_240_000,
      addInfo: 'DSMB-10220',
      merchantName: 'Khách sạn Demo Hà Nội',
      merchantCity: 'Hà Nội',
    })
    expect(out).toBe(
      '000201' +
        '010212' +
        '3854' + '0010A000000727' + '0124' + '0006970436' + '01100123456789' + '0208QRIBFTTA' +
        '52045999' +
        '5303704' +
        '54079240000' +
        '5802VN' +
        '5921KHACH SAN DEMO HA NOI' +
        '6006HA NOI' +
        '6214' + '0810DSMB-10220' +
        '6304C907'
    )
  })

  it('builds a static QR (ID 01 = 11, no ID 54) when there is no amount', () => {
    const out = buildVietQr({ bankCode: 'VTB', accountNumber: '1234 5678 90', accountHolder: 'Nguyễn Văn Dũng', amount: 0, addInfo: '', merchantCity: 'Đà Lạt' })
    expect(out).toBe(
      '00020101021138540010A00000072701240006970415011012345678900208QRIBFTTA5204599953037045802VN5915NGUYEN VAN DUNG6006DA LAT630416AA'
    )
    const fields = parseTlv(out)
    expect(fields.get('01')).toBe('11')
    expect(fields.has('54')).toBe(false)
    expect(fields.has('62')).toBe(false)
  })

  it('names the bank by its BIN under the NAPAS GUID in ID 38, not ID 26', () => {
    const out = buildVietQr(base)
    expect(parseTlv(out).has('26')).toBe(false)
    expect(napasAccount(out)).toEqual({ guid: 'A000000727', bin: '970436', account: '1234567890', service: 'QRIBFTTA' })
  })

  it.each([
    ['MB', '970422'],
    ['VTB', '970415'],
    ['CTG', '970415'],
    ['ICB', '970415'],
    ['TCB', '970407'],
    ['BIDV', '970418'],
    ['vcb', '970436'],
    ['970403', '970403'],
  ])('maps bank code %s to BIN %s', (bankCode, bin) => {
    expect(napasAccount(buildVietQr({ ...base, bankCode })).bin).toBe(bin)
  })

  it('refuses a bank it has no BIN for, and an empty account number', () => {
    expect(() => buildVietQr({ ...base, bankCode: 'XYZ' })).toThrow(/Unknown bank code/)
    expect(() => buildVietQr({ ...base, accountNumber: ' - ' })).toThrow(/account number/)
  })

  it('keeps the payload format, currency, country, amount and transfer content', () => {
    const fields = parseTlv(buildVietQr(base))
    expect(fields.get('00')).toBe('01')
    expect(fields.get('01')).toBe('12')
    expect(fields.get('53')).toBe('704')
    expect(fields.get('58')).toBe('VN')
    expect(fields.get('54')).toBe('100000')
    expect(parseTlv(fields.get('62')!).get('08')).toBe('BK-001')
  })

  it('rounds fractional amounts to whole VND', () => {
    expect(parseTlv(buildVietQr({ ...base, amount: 12345.67 })).get('54')).toBe('12346')
  })

  it('writes names and city as upper-case ASCII, so byte and character lengths agree', () => {
    const out = buildVietQr({ ...base, merchantName: 'Khách sạn Đà Lạt Xinh', merchantCity: 'Đà Lạt' })
    const fields = parseTlv(out)
    expect(fields.get('59')).toBe('KHACH SAN DA LAT XINH')
    expect(fields.get('60')).toBe('DA LAT')
    expect(/^[\x20-\x7E]+$/.test(out)).toBe(true)
  })

  it('uses the account holder as the name when there is no merchant name', () => {
    expect(parseTlv(buildVietQr({ ...base, accountHolder: 'Nguyễn Văn Á' })).get('59')).toBe('NGUYEN VAN A')
    expect(parseTlv(buildVietQr({ ...base, accountHolder: '' })).get('59')).toBe('MERCHANT')
  })

  it('strips disallowed characters and diacritics from the transfer content', () => {
    const add = (addInfo: string) => parseTlv(parseTlv(buildVietQr({ ...base, addInfo })).get('62')!).get('08')
    expect(add('BK/001 (paid)!')).toBe('BK/001 paid')
    expect(add('Đặt phòng 12')).toBe('Dat phong 12')
  })

  it('truncates the name to 25 and the transfer content to 50 characters', () => {
    const out = buildVietQr({ ...base, merchantName: 'A'.repeat(40), addInfo: 'X'.repeat(80) })
    expect(parseTlv(out).get('59')).toHaveLength(25)
    expect(parseTlv(parseTlv(out).get('62')!).get('08')).toHaveLength(50)
  })

  it('ends with the CRC of everything before it, "6304" included', () => {
    const out = buildVietQr(base)
    expect(out.slice(-8, -4)).toBe('6304')
    expect(out.slice(-4)).toBe(crc16CcittFalse(out.slice(0, -4)))
    expect(parseTlv(out).get('63')).toBe(out.slice(-4))
  })
})

describe('crc16CcittFalse', () => {
  it('gives the standard check value 29B1 for "123456789"', () => {
    expect(crc16CcittFalse('123456789')).toBe('29B1')
  })
})

describe('toBankName', () => {
  it('writes a name as banks print it', () => {
    expect(toBankName('cong ty khach san demo')).toBe('CONG TY KHACH SAN DEMO')
    expect(toBankName('  Công ty  Đà Lạt ')).toBe('CONG TY DA LAT')
    expect(toBankName('Trần Thị Ánh Nguyệt')).toBe('TRAN THI ANH NGUYET')
  })
})

describe('VietQR bank list', () => {
  it('covers the main banks with 6-digit BINs and unique codes', () => {
    expect(VIETQR_BANKS.length).toBeGreaterThanOrEqual(40)
    for (const bank of VIETQR_BANKS) expect(bank.bin).toMatch(/^\d{6}$/)
    expect(new Set(VIETQR_BANKS.map((b) => b.code)).size).toBe(VIETQR_BANKS.length)
    expect(new Set(VIETQR_BANKS.map((b) => b.bin)).size).toBe(VIETQR_BANKS.length)
    for (const code of ['VCB', 'ICB', 'BIDV', 'VBA', 'TCB', 'MB', 'ACB', 'VPB', 'TPB', 'STB', 'HDB', 'VIB', 'SHB', 'MSB', 'OCB', 'LPB']) {
      expect(findBank(code)?.code).toBe(code)
    }
  })

  it('labels a code with the bank name, and an unknown code as itself', () => {
    expect(bankLabel('VCB')).toBe('Vietcombank (VCB)')
    expect(bankLabel('CTG')).toBe('VietinBank (ICB)')
    expect(bankLabel('XYZ')).toBe('XYZ')
  })
})
