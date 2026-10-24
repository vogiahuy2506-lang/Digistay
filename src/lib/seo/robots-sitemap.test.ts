import { describe, it, expect } from 'vitest'
import { closedRobots, digistayRobots, digistaySitemap, hotelRobots, hotelSitemap, type HotelSeoSite } from './robots-sitemap'

const APP = 'https://digistay.vn'
const ORIGIN = 'https://may-bien.digistay.vn'
const d = (s: string) => new Date(s)

const published: HotelSeoSite = {
  origin: ORIGIN,
  updatedAt: d('2026-10-01T00:00:00Z'),
  rooms: [
    { id: 'r1', updatedAt: d('2026-10-20T00:00:00Z') },
    { id: 'r2', updatedAt: d('2026-09-01T00:00:00Z') },
  ],
}

const rulesOf = (robots: ReturnType<typeof digistayRobots>) => (Array.isArray(robots.rules) ? robots.rules[0] : robots.rules)

describe("Digistay's host", () => {
  it('opens the marketing pages and closes the app behind the login', () => {
    const robots = digistayRobots(APP)
    const rules = rulesOf(robots)
    expect(rules.userAgent).toBe('*')
    expect(rules.allow).toBe('/')
    const disallow = rules.disallow as string[]
    expect(disallow).toContain('/api/')
    for (const route of ['workspace', 'workspaces', 'workspace-picker', 'profile', 'admin', 'invitations']) {
      expect(disallow).toContain(`/${route}$`)
      expect(disallow).toContain(`/${route}/`)
    }
    // Whole segments: a hotel at digistay.vn/<name> is not caught by a prefix.
    expect(disallow).not.toContain('/workspace')
    expect(disallow).not.toContain('/profile')
    for (const open of ['/', '/pricing', '/contact', '/login', '/register']) {
      expect(disallow.some((rule) => rule === open || (!rule.endsWith('$') && open.startsWith(rule)))).toBe(false)
    }
    expect(robots.sitemap).toBe('https://digistay.vn/sitemap.xml')
  })

  it('lists the indexed marketing pages, absolute on the app', () => {
    expect(digistaySitemap(APP).map((e) => e.url)).toEqual(['https://digistay.vn/', 'https://digistay.vn/pricing', 'https://digistay.vn/contact'])
  })
})

describe('a published hotel', () => {
  it('is open to crawlers but for the API, with its sitemap on the canonical origin', () => {
    const robots = hotelRobots(published)
    expect(rulesOf(robots)).toEqual({ userAgent: '*', allow: '/', disallow: '/api/' })
    expect(robots.sitemap).toBe(`${ORIGIN}/sitemap.xml`)
  })

  it('lists the home page and every room page, in both languages, with alternates', () => {
    const map = hotelSitemap(published)
    expect(map.map((e) => e.url)).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/en`,
      `${ORIGIN}/rooms/r1`,
      `${ORIGIN}/en/rooms/r1`,
      `${ORIGIN}/rooms/r2`,
      `${ORIGIN}/en/rooms/r2`,
    ])
    expect(map[0].alternates).toEqual({ languages: { vi: `${ORIGIN}/`, en: `${ORIGIN}/en`, 'x-default': `${ORIGIN}/` } })
    expect(map[1].alternates).toEqual(map[0].alternates)
    expect(map[3].alternates).toEqual({
      languages: { vi: `${ORIGIN}/rooms/r1`, en: `${ORIGIN}/en/rooms/r1`, 'x-default': `${ORIGIN}/rooms/r1` },
    })
  })

  it('dates each page by its last change; the home page by the latest of all', () => {
    const map = hotelSitemap(published)
    expect(map[0].lastModified).toEqual(d('2026-10-20T00:00:00Z'))
    expect(map[2].lastModified).toEqual(d('2026-10-20T00:00:00Z'))
    expect(map[4].lastModified).toEqual(d('2026-09-01T00:00:00Z'))
    expect(hotelSitemap({ ...published, rooms: [] })[0].lastModified).toEqual(d('2026-10-01T00:00:00Z'))
  })

  it('escapes room ids in URLs', () => {
    expect(hotelSitemap({ ...published, rooms: [{ id: 'a&b<c', updatedAt: d('2026-10-01T00:00:00Z') }] })[2].url).toBe(
      `${ORIGIN}/rooms/a%26b%3Cc`
    )
  })
})

describe('an unpublished, inactive or unknown hotel', () => {
  it('is closed to crawlers, with an empty sitemap', () => {
    expect(hotelRobots(null)).toEqual(closedRobots())
    expect(rulesOf(hotelRobots(null))).toEqual({ userAgent: '*', disallow: '/' })
    expect(hotelRobots(null).sitemap).toBeUndefined()
    expect(hotelSitemap(null)).toEqual([])
  })
})
