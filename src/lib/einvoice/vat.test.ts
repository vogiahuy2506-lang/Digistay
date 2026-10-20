import { describe, it, expect } from 'vitest'
import { splitGross, isVatCode } from './vat'
import { vndToWords } from './amount-words'

describe('splitGross (prices include VAT)', () => {
  it('splits so that net + VAT is exactly what the guest paid', () => {
    expect(splitGross(1_100_000, 10)).toEqual({ net: 1_000_000, vat: 100_000, gross: 1_100_000, rate: 0.1 })
    expect(splitGross(1_080_000, 8)).toEqual({ net: 1_000_000, vat: 80_000, gross: 1_080_000, rate: 0.08 })
    for (const gross of [1, 999, 1_234_567, 2_000_001]) {
      for (const code of [10, 8, 5] as const) {
        const { net, vat } = splitGross(gross, code)
        expect(net + vat).toBe(gross)
        expect(Number.isInteger(net) && Number.isInteger(vat)).toBe(true)
      }
    }
  })

  it('no VAT for 0%, KCT and KKKNT', () => {
    for (const code of [0, -1, -2] as const) {
      expect(splitGross(500_000, code)).toMatchObject({ net: 500_000, vat: 0, gross: 500_000 })
    }
  })

  it('knows the Mắt Bão codes', () => {
    expect([10, 8, 5, 0, -1, -2].every(isVatCode)).toBe(true)
    expect([0.1, 7, '10', null].some(isVatCode)).toBe(false)
  })
})

describe('vndToWords', () => {
  it.each([
    [0, 'Không đồng'],
    [5, 'Năm đồng'],
    [15, 'Mười lăm đồng'],
    [21, 'Hai mươi mốt đồng'],
    [105, 'Một trăm lẻ năm đồng'],
    [110_000, 'Một trăm mười nghìn đồng'],
    [548_900, 'Năm trăm bốn mươi tám nghìn chín trăm đồng'],
    [1_080_000, 'Một triệu không trăm tám mươi nghìn đồng'],
    [2_005_000, 'Hai triệu không trăm lẻ năm nghìn đồng'],
    [1_000_000_005, 'Một tỷ không trăm lẻ năm đồng'],
    [25_500_000, 'Hai mươi lăm triệu năm trăm nghìn đồng'],
  ])('%i', (amount, words) => {
    expect(vndToWords(amount)).toBe(words)
  })
})
