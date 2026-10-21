import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, middleware } from './middleware'

const run = (url: string) => middleware(new NextRequest(url, { headers: { host: new URL(url).host } }))

beforeEach(() => {
  process.env.NEXTAUTH_URL = 'https://digistay.vn'
  delete process.env.ROOT_DOMAIN
})

describe('middleware (property subdomains)', () => {
  it('serves foo.digistay.vn/... from /foo/...', () => {
    expect(run('https://khach-san-demo.digistay.vn/').headers.get('x-middleware-rewrite')).toBe(
      'https://khach-san-demo.digistay.vn/khach-san-demo'
    )
    expect(run('https://khach-san-demo.digistay.vn/rooms/abc?x=1').headers.get('x-middleware-rewrite')).toBe(
      'https://khach-san-demo.digistay.vn/khach-san-demo/rooms/abc?x=1'
    )
  })

  it('leaves the apex, www and reserved names alone ("/" stays the marketing page)', () => {
    for (const url of ['https://digistay.vn/', 'https://www.digistay.vn/login', 'https://admin.digistay.vn/']) {
      const res = run(url)
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
      expect(res.headers.get('x-middleware-next')).toBe('1')
      expect(res.headers.get('location')).toBeNull()
    }
  })
})

describe('middleware (hotel site language)', () => {
  const lang = (res: Response) => res.headers.get('x-middleware-request-x-site-locale')
  const send = (url: string, headers: Record<string, string> = {}) =>
    middleware(new NextRequest(url, { headers: { host: new URL(url).host, ...headers } }))

  it('serves /en on a hotel subdomain in English from the same pages', () => {
    const home = run('https://khach-san-demo.digistay.vn/en')
    expect(home.headers.get('x-middleware-rewrite')).toBe('https://khach-san-demo.digistay.vn/khach-san-demo')
    expect(lang(home)).toBe('en')
    const room = run('https://khach-san-demo.digistay.vn/en/rooms/abc?x=1')
    expect(room.headers.get('x-middleware-rewrite')).toBe('https://khach-san-demo.digistay.vn/khach-san-demo/rooms/abc?x=1')
    expect(lang(room)).toBe('en')
  })

  it('serves digistay.vn/<hotel>/en/... in English too', () => {
    const res = run('https://digistay.vn/khach-san-demo/en/rooms/abc')
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://digistay.vn/khach-san-demo/rooms/abc')
    expect(lang(res)).toBe('en')
  })

  it('every other hotel page is Vietnamese, whatever the dashboard cookie says', () => {
    for (const url of ['https://khach-san-demo.digistay.vn/rooms/abc', 'https://khach-san-demo.digistay.vn/enfoo', 'https://digistay.vn/khach-san-demo']) {
      expect(lang(send(url, { cookie: 'NEXT_LOCALE=en' })), url).toBe('vi')
    }
    expect(run('https://digistay.vn/khach-san-demo').headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('tells the page its base path: none on the hotel host, /<hotel> on the app host', () => {
    const base = (res: Response) => res.headers.get('x-middleware-request-x-site-base')
    expect(base(run('https://khach-san-demo.digistay.vn/rooms/abc'))).toBe('')
    expect(base(run('https://khach-san-demo.digistay.vn/en'))).toBe('')
    expect(base(run('https://digistay.vn/khach-san-demo/en/rooms/abc'))).toBe('/khach-san-demo')
    // Second run (internal, app host) of a subdomain request: the hotel host's base stays.
    expect(base(send('https://digistay.vn/khach-san-demo/rooms/abc', { 'x-site-base': '' }))).toBe('')
    // Anything else a client sends is replaced.
    expect(base(send('https://digistay.vn/khach-san-demo', { 'x-site-base': '/other' }))).toBe('/khach-san-demo')
    expect(base(send('https://digistay.vn/workspaces', { 'x-site-base': '' }))).toBeNull()
  })

  it('keeps English on the second run Next makes over the rewritten path', () => {
    // First run: /khach-san-demo/en → /khach-san-demo with "en"; Next then runs
    // the middleware again on /khach-san-demo, carrying that header.
    const second = send('https://digistay.vn/khach-san-demo/rooms/abc', { 'x-site-locale': 'en' })
    expect(lang(second)).toBe('en')
    expect(lang(send('https://digistay.vn/khach-san-demo/rooms/abc', { 'x-site-locale': 'xx' }))).toBe('vi')
  })

  it('app pages get no language header, and one sent by the client is dropped', () => {
    for (const url of ['https://digistay.vn/', 'https://digistay.vn/workspaces', 'https://digistay.vn/login']) {
      const res = send(url, { 'x-site-locale': 'en' })
      expect(lang(res), url).toBeNull()
      expect(res.headers.get('x-middleware-rewrite'), url).toBeNull()
    }
  })
})

describe('middleware matcher (as Next applies it)', () => {
  const runsOn = (path: string) => unstable_doesMiddlewareMatch({ config, url: `https://khach-san-demo.digistay.vn${path}` })

  it('skips the API, build assets and root files', () => {
    for (const path of [
      '/api',
      '/api/',
      '/api/health',
      '/api/webhooks/payos/abc',
      '/_next/static/chunks/main.js',
      '/_next/image?url=%2Fx.png&w=64&q=75',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
    ]) {
      expect(runsOn(path), path).toBe(false)
    }
  })

  it('still rewrites site paths that only begin like a skipped one', () => {
    // /api-hotel used to skip the rewrite and render property "api-hotel"
    // on khach-san-demo.digistay.vn.
    for (const path of ['/', '/rooms/abc', '/api-hotel', '/apina', '/robots.txt.bak']) {
      expect(runsOn(path), path).toBe(true)
    }
  })
})
