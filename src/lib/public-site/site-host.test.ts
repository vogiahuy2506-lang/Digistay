import { describe, it, expect } from 'vitest'
import { appOrigin, canonicalSiteOrigin, hostSite } from './site-host'

const PROD = { ROOT_DOMAIN: 'digistay.vn', NEXTAUTH_URL: 'https://digistay.vn' }
const DEV = { NEXTAUTH_URL: 'http://localhost:3000' }
const none = { customDomain: null, domainVerificationStatus: null, sslEnabled: false }

describe('canonicalSiteOrigin', () => {
  it('is the subdomain of the root domain, over https', () => {
    expect(canonicalSiteOrigin('may-bien', none, PROD)).toBe('https://may-bien.digistay.vn')
    expect(canonicalSiteOrigin('may-bien', null, PROD)).toBe('https://may-bien.digistay.vn')
    expect(canonicalSiteOrigin('may-bien', undefined, { NEXTAUTH_URL: 'https://www.digistay.vn' })).toBe('https://may-bien.digistay.vn')
  })

  it('switches to the custom domain once it is verified and has a certificate', () => {
    const custom = { customDomain: 'khachsanmaybien.vn', domainVerificationStatus: 'verified', sslEnabled: true }
    expect(canonicalSiteOrigin('may-bien', custom, PROD)).toBe('https://khachsanmaybien.vn')
    // Not yet serving: verified without a certificate, or a certificate for a domain not verified.
    expect(canonicalSiteOrigin('may-bien', { ...custom, sslEnabled: false }, PROD)).toBe('https://may-bien.digistay.vn')
    for (const status of ['pending', 'mismatch', 'dns_error', null]) {
      expect(canonicalSiteOrigin('may-bien', { ...custom, domainVerificationStatus: status }, PROD)).toBe('https://may-bien.digistay.vn')
    }
    expect(canonicalSiteOrigin('may-bien', { ...custom, customDomain: '' }, PROD)).toBe('https://may-bien.digistay.vn')
  })

  it('never puts anything but a hostname in the origin', () => {
    const verified = { domainVerificationStatus: 'verified', sslEnabled: true }
    for (const customDomain of ['evil.vn/"><script>', 'evil.vn:8443', 'a b.vn', 'localhost', 'evil.vn\nSitemap: x', '-evil.vn']) {
      expect(canonicalSiteOrigin('may-bien', { ...verified, customDomain }, PROD)).toBe('https://may-bien.digistay.vn')
    }
  })

  it('is http with the app port in development', () => {
    expect(canonicalSiteOrigin('may-bien', none, DEV)).toBe('http://may-bien.localhost:3000')
    expect(canonicalSiteOrigin('may-bien', none, { ROOT_DOMAIN: 'localhost', NEXTAUTH_URL: 'http://localhost:3998' })).toBe(
      'http://may-bien.localhost:3998'
    )
    expect(canonicalSiteOrigin('may-bien', none, {})).toBe('http://may-bien.localhost')
  })
})

describe('appOrigin', () => {
  it("is the app's URL, else the root domain", () => {
    expect(appOrigin(PROD)).toBe('https://digistay.vn')
    expect(appOrigin({ NEXTAUTH_URL: 'https://digistay.vn/some/path' })).toBe('https://digistay.vn')
    expect(appOrigin(DEV)).toBe('http://localhost:3000')
    expect(appOrigin({ NEXT_PUBLIC_SITE_URL: 'https://digistay.vn' })).toBe('https://digistay.vn')
    expect(appOrigin({ ROOT_DOMAIN: 'digistay.vn' })).toBe('https://digistay.vn')
    expect(appOrigin({ NEXTAUTH_URL: 'not a url' })).toBe('http://localhost')
  })
})

describe('hostSite', () => {
  it("knows Digistay's own host", () => {
    for (const host of ['digistay.vn', 'www.digistay.vn', 'DIGISTAY.VN:443', 'digistay.vn.']) {
      expect(hostSite(host, PROD)).toEqual({ kind: 'digistay' })
    }
    expect(hostSite('localhost:3000', DEV)).toEqual({ kind: 'digistay' })
  })

  it("finds a hotel's subdomain", () => {
    expect(hostSite('may-bien.digistay.vn', PROD)).toEqual({ kind: 'subdomain', subdomain: 'may-bien' })
    expect(hostSite('May-Bien.digistay.vn:443', PROD)).toEqual({ kind: 'subdomain', subdomain: 'may-bien' })
    expect(hostSite('may-bien.localhost:3000', DEV)).toEqual({ kind: 'subdomain', subdomain: 'may-bien' })
  })

  it('leaves reserved names, deeper levels and other hosts as "other"', () => {
    expect(hostSite('admin.digistay.vn', PROD)).toEqual({ kind: 'other', hostname: 'admin.digistay.vn' })
    expect(hostSite('a.b.digistay.vn', PROD)).toEqual({ kind: 'other', hostname: 'a.b.digistay.vn' })
    expect(hostSite('khachsanmaybien.vn', PROD)).toEqual({ kind: 'other', hostname: 'khachsanmaybien.vn' })
    expect(hostSite('digistay.vn.evil.com', PROD)).toEqual({ kind: 'other', hostname: 'digistay.vn.evil.com' })
    expect(hostSite(null, PROD)).toEqual({ kind: 'other', hostname: '' })
  })
})
