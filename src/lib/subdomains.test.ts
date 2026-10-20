import { describe, it, expect } from 'vitest'
import { isAllowedSubdomain, rootDomain, subdomainOf } from './subdomains'
import { createPropertySchema } from '@/lib/validations'

describe('subdomains', () => {
  it('finds the property subdomain of a host', () => {
    expect(subdomainOf('khach-san-demo.digistay.vn', 'digistay.vn')).toBe('khach-san-demo')
    expect(subdomainOf('Hotel-1.DigiStay.vn:443', 'digistay.vn')).toBe('hotel-1')
    expect(subdomainOf('bar.localhost:3000', 'localhost')).toBe('bar')
  })

  it('ignores the apex, www, reserved names, deeper levels and other domains', () => {
    for (const host of ['digistay.vn', 'www.digistay.vn', 'api.digistay.vn', 'login.digistay.vn', 'a.b.digistay.vn', 'evil.vn', 'digistay.vn.evil.vn', '-x.digistay.vn']) {
      expect(subdomainOf(host, 'digistay.vn')).toBeNull()
    }
  })

  it('takes the root domain from ROOT_DOMAIN, else NEXTAUTH_URL without www', () => {
    expect(rootDomain({ ROOT_DOMAIN: 'Digistay.vn' })).toBe('digistay.vn')
    expect(rootDomain({ NEXTAUTH_URL: 'https://www.digistay.vn' })).toBe('digistay.vn')
    expect(rootDomain({ NEXTAUTH_URL: 'not a url' })).toBe('localhost')
    expect(rootDomain({})).toBe('localhost')
  })

  it('new properties cannot take a reserved name', () => {
    expect(isAllowedSubdomain('khach-san-sen')).toBe(true)
    for (const name of ['login', 'api', 'www', 'workspace', 'admin', '-sen', 'sen-']) {
      expect(isAllowedSubdomain(name)).toBe(false)
    }
    const base = { name: 'Khách sạn Sen', type: 'HOTEL', address: '12 Lê Lợi', city: 'Đà Lạt' }
    expect(createPropertySchema.safeParse({ ...base, subdomain: 'khach-san-sen' }).success).toBe(true)
    const reserved = createPropertySchema.safeParse({ ...base, subdomain: 'login' })
    expect(reserved.success).toBe(false)
    expect(reserved.error?.errors[0].message).toContain('dành riêng')
  })
})
