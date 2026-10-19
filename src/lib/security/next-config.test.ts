/**
 * Guards next.config.js security settings (Part 4d). See the comments there.
 */
import { describe, it, expect } from 'vitest'
import nextConfig from '../../../next.config.js'

describe('next.config.js', () => {
  it('keeps the image optimizer off (no server-side decoding of untrusted images)', () => {
    expect(nextConfig.images?.unoptimized).toBe(true)
  })

  it('never allows optimizing images from any host', () => {
    const patterns: { hostname?: string }[] = nextConfig.images?.remotePatterns ?? []
    expect(patterns.filter((p) => !p.hostname || p.hostname.includes('*'))).toEqual([])
    expect(nextConfig.images?.domains ?? []).toEqual([])
  })

  it('does not send X-Powered-By', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
  })
})
