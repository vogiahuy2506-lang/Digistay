import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

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
