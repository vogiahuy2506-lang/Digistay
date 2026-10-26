import { describe, it, expect } from 'vitest'
import { activeHref, primaryNav, workspaceNav } from './nav'

const items = [...primaryNav('demo', 'p1'), ...workspaceNav('demo')]
const P = '/workspace/demo/properties/p1'

describe('dashboard menu', () => {
  it('lights up the most specific entry', () => {
    expect(activeHref(P, items)).toBe(P)
    expect(activeHref(`${P}/bookings`, items)).toBe(`${P}/bookings`)
    // A booking's page belongs to "Đặt phòng"...
    expect(activeHref(`${P}/bookings/b1`, items)).toBe(`${P}/bookings`)
    // ...and so does the new-booking form (walk-ins, phone bookings): no menu entry of its own.
    expect(activeHref(`${P}/bookings/new`, items)).toBe(`${P}/bookings`)
    expect(activeHref(`${P}/reports/daily`, items)).toBe(`${P}/reports/daily`)
    expect(activeHref(`${P}/reports`, items)).toBe(`${P}/reports`)
  })

  it('has one entry for the bookings: the calendar lights up "Đặt phòng"', () => {
    // The list, the month and the room plan are views of one page (bookings-views.tsx).
    expect(items.map((i) => i.key)).not.toContain('calendar')
    expect(items.filter((i) => i.href.endsWith('/calendar'))).toEqual([])
    expect(activeHref(`${P}/calendar`, items)).toBe(`${P}/bookings`)
  })

  it('does not match a sibling that only shares a prefix', () => {
    expect(activeHref('/workspace/demo/properties/p10/bookings', items)).toBeUndefined()
    expect(activeHref('/workspace/demo/membership', items)).toBeUndefined()
    expect(activeHref(`${P}/calendars`, items)).toBe(P)
  })

  it('prefers the longer path, whether an href or an extra one', () => {
    const nested = [
      { key: 'overview' as const, href: '/a', also: ['/a/b/c'], roles: [], group: 'main' as const },
      { key: 'bookings' as const, href: '/a/b', roles: [], group: 'main' as const },
    ]
    expect(activeHref('/a/b', nested)).toBe('/a/b')
    expect(activeHref('/a/b/c/d', nested)).toBe('/a')
    expect(activeHref('/a/x', nested)).toBe('/a')
  })

  it('shows the workspace menu outside a property', () => {
    // The workspace home lists the properties, so "Cơ sở" is that one page.
    expect(primaryNav('demo').map((i) => i.key)).toEqual(['properties'])
  })

  it('hides bank accounts and settings from everyone but the owner', () => {
    const forRole = (role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER') =>
      items.filter((i) => i.roles.includes(role)).map((i) => i.key)
    expect(forRole('MANAGER')).not.toContain('bankAccounts')
    expect(forRole('MANAGER')).not.toContain('settings')
    expect(forRole('ADMIN')).toEqual(expect.arrayContaining(['bankAccounts', 'settings']))
    expect(forRole('USER')).toEqual(['overview', 'bookings'])
  })

  it('lights up "Cơ sở" on the workspace home', () => {
    const outside = [...primaryNav('demo'), ...workspaceNav('demo')]
    expect(activeHref('/workspace/demo', outside)).toBe('/workspace/demo')
    expect(activeHref('/workspace/demo/settings', outside)).toBe('/workspace/demo/settings')
  })
})
