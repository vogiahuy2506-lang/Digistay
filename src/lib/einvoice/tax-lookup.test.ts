import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeTaxCode } from './tax-code'
import { TaxLookupError, clearTaxLookupCache, lookupTaxCode } from './tax-lookup'

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch

beforeEach(() => clearTaxLookupCache())

describe('normalizeTaxCode', () => {
  it('accepts 10 digits and writes 13 as 10-3, ignoring spaces, dots and dashes', () => {
    expect(normalizeTaxCode(' 0100109106 ')).toBe('0100109106')
    expect(normalizeTaxCode('0100.109.106')).toBe('0100109106')
    expect(normalizeTaxCode('0100109106001')).toBe('0100109106-001')
    expect(normalizeTaxCode('0100109106-001')).toBe('0100109106-001')
  })

  it('refuses anything else', () => {
    expect(normalizeTaxCode('')).toBeNull()
    expect(normalizeTaxCode('010010910')).toBeNull()
    expect(normalizeTaxCode('01001091061')).toBeNull()
    expect(normalizeTaxCode('01001O9106')).toBeNull()
  })
})

describe('lookupTaxCode', () => {
  it('returns the company, its tidied name and address, and whether it still trades', async () => {
    const fetchImpl = answer({
      code: '00',
      data: { id: '0100109106', name: ' TẬP ĐOÀN  VIỄN THÔNG ', address: 'Số 5, Phố Nguyễn Hữu An,  Hà Nội', status: 'NNT đang hoạt động' },
    })
    expect(await lookupTaxCode('0100109106', fetchImpl)).toEqual({
      taxCode: '0100109106',
      name: 'TẬP ĐOÀN VIỄN THÔNG',
      address: 'Số 5, Phố Nguyễn Hữu An, Hà Nội',
      status: 'NNT đang hoạt động',
      active: true,
    })
    expect(vi.mocked(fetchImpl).mock.calls[0][0]).toBe('https://api.vietqr.io/v2/business/0100109106')
  })

  it('flags a company that stopped trading', async () => {
    const fetchImpl = answer({ code: '00', data: { id: '0100109106-001', name: 'Chi nhánh', address: 'x', status: 'NNT ngừng HĐ nhưng chưa hoàn thành thủ tục đóng MST' } })
    expect((await lookupTaxCode('0100109106-001', fetchImpl))?.active).toBe(false)
  })

  it('is null for a code the register does not have', async () => {
    expect(await lookupTaxCode('0000000000', answer({ code: '51', desc: 'Tax not found', data: null }))).toBeNull()
  })

  it('throws when the service cannot answer', async () => {
    await expect(lookupTaxCode('0100109106', answer({ code: '99', desc: 'error' }))).rejects.toBeInstanceOf(TaxLookupError)
    await expect(lookupTaxCode('0100109106', answer({}, 502))).rejects.toBeInstanceOf(TaxLookupError)
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(lookupTaxCode('0100109106', down)).rejects.toBeInstanceOf(TaxLookupError)
  })

  it('asks once for the same code, found or not', async () => {
    const found = answer({ code: '00', data: { id: '0100109106', name: 'A', address: 'B', status: null } })
    await lookupTaxCode('0100109106', found)
    await lookupTaxCode('0100109106', found)
    expect(found).toHaveBeenCalledTimes(1)

    const missing = answer({ code: '51', data: null })
    await lookupTaxCode('0000000000', missing)
    await lookupTaxCode('0000000000', missing)
    expect(missing).toHaveBeenCalledTimes(1)
  })

  it('does not keep a failure', async () => {
    await expect(lookupTaxCode('0100109106', answer({}, 500))).rejects.toThrow()
    const ok = answer({ code: '00', data: { id: '0100109106', name: 'A', address: 'B', status: null } })
    expect((await lookupTaxCode('0100109106', ok))?.name).toBe('A')
  })
})
