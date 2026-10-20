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
