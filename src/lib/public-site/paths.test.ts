import { describe, it, expect } from 'vitest'
import { siteBasePath, siteHref } from './paths'

const APP = 'https://digistay.vn'

describe('siteBasePath', () => {
  it('prefixes the subdomain on the app host', () => {
    expect(siteBasePath('may-bien', 'digistay.vn', APP)).toBe('/may-bien')
    expect(siteBasePath('may-bien', 'www.digistay.vn', APP)).toBe('/may-bien')
    expect(siteBasePath('may-bien', 'localhost:3000', APP)).toBe('/may-bien')
    expect(siteBasePath('may-bien', '127.0.0.1:3998', 'http://localhost:3998')).toBe('/may-bien')
    expect(siteBasePath('may-bien', '[::1]:3000', APP)).toBe('/may-bien')
  })

  it('adds nothing on the hotel host, where the middleware adds the prefix', () => {
    expect(siteBasePath('may-bien', 'may-bien.digistay.vn', APP)).toBe('')
    expect(siteBasePath('may-bien', 'May-Bien.digistay.vn:443', APP)).toBe('')
    expect(siteBasePath('may-bien', 'may-bien.localhost:3000', 'http://localhost:3000')).toBe('')
    expect(siteBasePath('may-bien', 'khachsanmaybien.com', APP)).toBe('')
  })

  it('falls back to the prefix when it cannot tell', () => {
    expect(siteBasePath('may-bien', null, APP)).toBe('/may-bien')
    expect(siteBasePath('may-bien', 'khachsanmaybien.com', undefined)).toBe('/may-bien')
    expect(siteBasePath('may-bien', 'khachsanmaybien.com', 'not a url')).toBe('/may-bien')
  })

  it('does not take a lookalike host for the hotel host', () => {
    expect(siteBasePath('may', 'may-bien.digistay.vn', APP)).toBe('')
    expect(siteBasePath('may-bien', 'may.digistay.vn', APP)).toBe('')
    expect(siteBasePath('may-bien', 'digistay.vn.evil.com', APP)).toBe('')
  })
})

describe('siteHref', () => {
  it('joins the base and a path inside the site', () => {
    expect(siteHref('/may-bien', '/')).toBe('/may-bien')
    expect(siteHref('', '/')).toBe('/')
    expect(siteHref('/may-bien', '/rooms/r1')).toBe('/may-bien/rooms/r1')
    expect(siteHref('', '/search?checkIn=2026-11-01')).toBe('/search?checkIn=2026-11-01')
    expect(siteHref('/may-bien', 'search')).toBe('/may-bien/search')
    expect(siteHref('/may-bien', '/#rooms')).toBe('/may-bien#rooms')
    expect(siteHref('', '/#rooms')).toBe('/#rooms')
  })
})
