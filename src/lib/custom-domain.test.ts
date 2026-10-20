import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkOwnership,
  checkRouting,
  normalizeHostname,
  ownershipRecord,
  ownershipToken,
  resolver,
} from './custom-domain'

const ROOT = 'digistay.vn'
const dnsError = (code: string) => Object.assign(new Error(code), { code })

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-for-custom-domains'
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('normalizeHostname', () => {
  it('lowercases, trims a final dot and converts Vietnamese names to punycode', () => {
    expect(normalizeHostname('  WWW.KhachSan.VN. ', ROOT)).toBe('www.khachsan.vn')
    expect(normalizeHostname('khách-sạn.vn', ROOT)).toBe('xn--khch-sn-iwa2669d.vn')
  })

  it("refuses what cannot be a hotel's own domain", () => {
    for (const value of [
      '',
      'khachsan',
      'http://khachsan.vn',
      'khachsan.vn/path',
      'khachsan.vn:8443',
      'user@khachsan.vn',
      'khachsan.vn?x=1',
      'khach san.vn',
      '*.khachsan.vn',
      '1.2.3.4',
      '::1',
      'localhost',
      'app.localhost',
      'digistay.vn',
      'khach-san-demo.digistay.vn',
      'a.b.digistay.vn',
      `${'a'.repeat(64)}.vn`,
      42,
      null,
    ]) {
      expect(normalizeHostname(value, ROOT), String(value)).toBeNull()
    }
  })
})

describe('ownership token', () => {
  it('is fixed for one workspace and hostname, different otherwise', () => {
    const token = ownershipToken('ws-a', 'www.khachsan.vn')
    expect(token).toMatch(/^[0-9a-f]{32}$/)
    expect(ownershipToken('ws-a', 'www.khachsan.vn')).toBe(token)
    expect(ownershipToken('ws-b', 'www.khachsan.vn')).not.toBe(token)
    expect(ownershipToken('ws-a', 'khachsan.vn')).not.toBe(token)
  })

  it('changes with the server secret', () => {
    const before = ownershipToken('ws-a', 'www.khachsan.vn')
    process.env.NEXTAUTH_SECRET = 'another-secret'
    expect(ownershipToken('ws-a', 'www.khachsan.vn')).not.toBe(before)
  })

  it('names the TXT record under the hostname', () => {
    expect(ownershipRecord('ws-a', 'www.khachsan.vn')).toEqual({
      name: '_digistay-verify.www.khachsan.vn',
      value: `digistay-verify=${ownershipToken('ws-a', 'www.khachsan.vn')}`,
    })
  })
})

describe('checkRouting', () => {
  const target = 'khach-san-a.digistay.vn'

  function dns(records: { cname?: string[] | string; a?: Record<string, string[] | string> }) {
    vi.spyOn(resolver, 'resolveCname').mockImplementation(async () => {
      if (typeof records.cname === 'string') throw dnsError(records.cname)
      return records.cname ?? Promise.reject(dnsError('ENODATA'))
    })
    vi.spyOn(resolver, 'resolve4').mockImplementation(async (host: string) => {
      const value = records.a?.[host]
      if (value === undefined) throw dnsError('ENOTFOUND')
      if (typeof value === 'string') throw dnsError(value)
      return value
    })
  }

  it("accepts a CNAME to exactly this property's subdomain", async () => {
    dns({ cname: ['Khach-San-A.digistay.vn.'] })
    expect(await checkRouting('www.khachsan.vn', target, ROOT)).toEqual({ ok: true, via: 'cname' })
  })

  it("refuses a CNAME to another hotel's subdomain or to the root", async () => {
    for (const cname of ['khach-san-b.digistay.vn', 'digistay.vn', 'x.khach-san-a.digistay.vn']) {
      dns({ cname: [cname] })
      expect(await checkRouting('www.khachsan.vn', target, ROOT), cname).toMatchObject({ ok: false, reason: 'wrong_target' })
    }
  })

  it("accepts A records only when every address is Digistay's", async () => {
    dns({ a: { 'khachsan.vn': ['203.0.113.10'], [ROOT]: ['203.0.113.10'] } })
    expect(await checkRouting('khachsan.vn', target, ROOT)).toEqual({ ok: true, via: 'a' })

    dns({ a: { 'khachsan.vn': ['203.0.113.10', '198.51.100.7'], [ROOT]: ['203.0.113.10'] } })
    expect(await checkRouting('khachsan.vn', target, ROOT)).toMatchObject({ ok: false, reason: 'wrong_target' })
  })

  it('tells a missing record from a DNS failure', async () => {
    dns({ cname: 'ENOTFOUND' })
    expect(await checkRouting('khachsan.vn', target, ROOT)).toMatchObject({ ok: false, reason: 'not_found' })

    dns({ cname: 'ETIMEOUT' })
    expect(await checkRouting('khachsan.vn', target, ROOT)).toMatchObject({ ok: false, reason: 'transient' })

    dns({ a: { 'khachsan.vn': ['203.0.113.10'], [ROOT]: 'ESERVFAIL' } })
    expect(await checkRouting('khachsan.vn', target, ROOT)).toMatchObject({ ok: false, reason: 'transient' })
  })
})

describe('checkOwnership', () => {
  const host = 'www.khachsan.vn'
  const txt = (records: string[][] | string) =>
    vi.spyOn(resolver, 'resolveTxt').mockImplementation(async () => {
      if (typeof records === 'string') throw dnsError(records)
      return records
    })

  it('accepts the TXT for this workspace among other records, split in chunks or quoted', async () => {
    const { name, value } = ownershipRecord('ws-a', host)
    const lookup = txt([['v=spf1 -all'], [value.slice(0, 20), value.slice(20)]])
    expect(await checkOwnership(host, 'ws-a')).toEqual({ ok: true })
    expect(lookup).toHaveBeenCalledWith(name)

    txt([[`"${value.toUpperCase()}"`]])
    expect(await checkOwnership(host, 'ws-a')).toEqual({ ok: true })
  })

  it("refuses another workspace's TXT: the domain still pointing here is not enough", async () => {
    txt([[ownershipRecord('ws-a', host).value]])
    expect(await checkOwnership(host, 'ws-b')).toMatchObject({ ok: false, reason: 'txt_wrong' })
  })

  it('tells a missing TXT from a DNS failure', async () => {
    txt('ENODATA')
    expect(await checkOwnership(host, 'ws-a')).toMatchObject({ ok: false, reason: 'txt_missing' })
    txt('ETIMEOUT')
    expect(await checkOwnership(host, 'ws-a')).toMatchObject({ ok: false, reason: 'transient' })
  })
})
