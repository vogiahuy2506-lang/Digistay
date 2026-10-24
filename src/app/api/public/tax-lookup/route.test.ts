/**
 * GET /api/public/tax-lookup: refuses a malformed code, says when a code
 * is unknown or the register cannot answer, and limits each IP. The lookup
 * itself is mocked (tax-lookup.test.ts covers it); Redis is an in-memory fake.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
      async get(key: string) {
        return data.get(key) ?? null
      },
      async incr(key: string) {
        const n = Number(data.get(key) ?? 0) + 1
        data.set(key, String(n))
        return n
      },
      async expire() {
        return 1
      },
      async ttl() {
        return 300
      },
    },
  }
})

vi.mock('@/lib/db/redis', () => ({ redis: h.redis }))
vi.mock('@/lib/einvoice/tax-lookup', () => ({ lookupTaxCode: vi.fn() }))

import { lookupTaxCode } from '@/lib/einvoice/tax-lookup'
import { GET } from './route'

const lookup = vi.mocked(lookupTaxCode)
const ask = (taxCode: string, ip = '198.51.100.7') =>
  GET(new NextRequest(`http://localhost/api/public/tax-lookup?taxCode=${encodeURIComponent(taxCode)}`, { headers: { 'x-real-ip': ip } }))

beforeEach(() => {
  h.data.clear()
  lookup.mockReset()
})

describe('GET /api/public/tax-lookup', () => {
  it('returns the company for a 10- or 13-digit code, written as the register writes it', async () => {
    lookup.mockResolvedValue({ taxCode: '0100109106-001', name: 'Chi nhánh', address: 'Hà Nội', status: null, active: true })
    const res = await ask('0100109106 001')
    expect(res.status).toBe(200)
    expect((await res.json()).data.name).toBe('Chi nhánh')
    expect(lookup).toHaveBeenCalledWith('0100109106-001')
  })

  it('refuses a malformed code without asking anyone', async () => {
    expect((await ask('12345')).status).toBe(400)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('answers 404 for an unknown code and 503 when the register cannot answer', async () => {
    lookup.mockResolvedValueOnce(null)
    expect((await ask('0000000000')).status).toBe(404)
    lookup.mockRejectedValueOnce(new Error('down'))
    expect((await ask('0100109106')).status).toBe(503)
  })

  it('the 61st lookup from one IP within 10 minutes gets 429; another IP is unaffected', async () => {
    lookup.mockResolvedValue(null)
    for (let i = 0; i < 60; i++) expect((await ask('0000000000')).status).toBe(404)
    expect((await ask('0000000000')).status).toBe(429)
    expect((await ask('0000000000', '198.51.100.8')).status).toBe(404)
    expect(lookup).toHaveBeenCalledTimes(61)
  })
})
