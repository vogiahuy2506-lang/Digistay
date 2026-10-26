import { describe, it, expect } from 'vitest'
import { getClientIp } from './client-ip'

describe('getClientIp', () => {
  it('reads X-Real-IP (set by nginx) from a Headers object', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('reads X-Real-IP from a plain header object (next-auth authorize)', () => {
    expect(getClientIp({ 'x-real-ip': '2001:db8::1' })).toBe('2001:db8::1')
  })

  it('never trusts X-Forwarded-For (client-controlled first entries)', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '1.2.3.4' }))).toBe('unknown')
    expect(
      getClientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7', 'x-real-ip': '203.0.113.7' }))
    ).toBe('203.0.113.7')
  })

  it('never reads CF-Connecting-IP itself: nginx checks it came from Cloudflare first', () => {
    expect(getClientIp(new Headers({ 'cf-connecting-ip': '1.2.3.4' }))).toBe('unknown')
    expect(getClientIp(new Headers({ 'cf-connecting-ip': '1.2.3.4', 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('falls back to "unknown" for missing or malformed values', () => {
    expect(getClientIp(undefined)).toBe('unknown')
    expect(getClientIp(new Headers())).toBe('unknown')
    expect(getClientIp({ 'x-real-ip': 'evil:key; injection' })).toBe('unknown')
  })
})
