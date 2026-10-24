import { describe, it, expect } from 'vitest'
import { bucketOf, bucketsBetween, methodGroup, refundOf, toCsv } from './revenue'

describe('methodGroup', () => {
  it('puts PayOS / VietQR under QR and both card kinds under CARD', () => {
    expect(methodGroup('QR_VIETQR')).toBe('QR')
    expect(methodGroup('CARD')).toBe('CARD')
    expect(methodGroup('CREDIT_CARD')).toBe('CARD')
    expect(methodGroup('CASH')).toBe('CASH')
    expect(methodGroup('BANK_TRANSFER')).toBe('BANK_TRANSFER')
    expect(methodGroup('E_WALLET')).toBe('E_WALLET')
  })
})

describe('bucketOf', () => {
  it('uses the Vietnam day: 17:00 UTC is already the next day', () => {
    expect(bucketOf(new Date('2026-10-20T16:59:59Z'), 'day')).toBe('2026-10-20')
    expect(bucketOf(new Date('2026-10-20T17:00:00Z'), 'day')).toBe('2026-10-21')
    expect(bucketOf(new Date('2026-10-31T17:30:00Z'), 'month')).toBe('2026-11')
  })
})

describe('bucketsBetween', () => {
  it('lists every Vietnam day of the range, ends included', () => {
    const start = new Date('2026-10-29T00:00:00+07:00')
    const end = new Date('2026-11-02T23:59:59.999+07:00')
    expect(bucketsBetween(start, end, 'day')).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(bucketsBetween(start, end, 'month')).toEqual(['2026-10', '2026-11'])
  })

  it('covers a year of days and twelve-plus months without gaps', () => {
    const start = new Date('2025-11-15T00:00:00+07:00')
    const end = new Date('2026-11-14T23:59:59.999+07:00')
    expect(bucketsBetween(start, end, 'day')).toHaveLength(365)
    expect(bucketsBetween(start, end, 'month')).toHaveLength(13)
  })
})

describe('refundOf', () => {
  const updatedAt = new Date('2026-10-22T03:00:00Z')

  it('reads a partial refund the cancel route wrote', () => {
    expect(
      refundOf({ status: 'PROCESSING', amount: 500_000, updatedAt, metadata: { refundedAmount: 200_000, refundedAt: '2026-10-21T10:00:00.000Z' } })
    ).toEqual({ amount: 200_000, at: new Date('2026-10-21T10:00:00.000Z') })
  })

  it('treats a REFUNDED payment without details as returned in full when last updated', () => {
    expect(refundOf({ status: 'REFUNDED', amount: 500_000, updatedAt, metadata: null })).toEqual({ amount: 500_000, at: updatedAt })
  })

  it('is nothing for a payment never refunded', () => {
    expect(refundOf({ status: 'PROCESSING', amount: 500_000, updatedAt, metadata: { bookingCode: 'X' } })).toBeNull()
    expect(refundOf({ status: 'PROCESSING', amount: 500_000, updatedAt, metadata: { refundedAmount: 0, refundedAt: '2026-10-21T10:00:00Z' } })).toBeNull()
  })
})

describe('toCsv', () => {
  it('starts with a BOM, quotes commas and quotes, keeps numbers', () => {
    expect(toCsv([['Khách', 'Số tiền'], ['Nguyễn "Tí", A', 1500000]])).toBe('﻿Khách,Số tiền\r\n"Nguyễn ""Tí"", A",1500000\r\n')
  })

  it('never lets a cell run as a formula', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)']])).toBe(`﻿"'=HYPERLINK(""x"")",'+1,'-2,'@SUM(A1)\r\n`)
  })

  it('writes empty cells for null and undefined', () => {
    expect(toCsv([['a', null, undefined, 'b']])).toBe('﻿a,,,b\r\n')
  })
})
