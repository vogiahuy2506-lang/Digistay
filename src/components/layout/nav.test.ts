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
    // ...but the walk-in form has its own entry.
    expect(activeHref(`${P}/bookings/new`, items)).toBe(`${P}/bookings/new`)
    expect(activeHref(`${P}/reports/daily`, items)).toBe(`${P}/reports/daily`)
    expect(activeHref(`${P}/reports`, items)).toBe(`${P}/reports`)
  })

  it('does not match a sibling that only shares a prefix', () => {
    expect(activeHref('/workspace/demo/properties/p10/bookings', items)).toBeUndefined()
    expect(activeHref('/workspace/demo/membership', items)).toBeUndefined()
  })

  it('shows the workspace menu outside a property', () => {
    // The workspace home lists the properties, so "Cơ sở" is that one page.
    expect(primaryNav('demo').map((i) => i.name)).toEqual(['Cơ sở'])
  })

  it('hides bank accounts and settings from everyone but the owner', () => {
    const forRole = (role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER') =>
      items.filter((i) => i.roles.includes(role)).map((i) => i.name)
    expect(forRole('MANAGER')).not.toContain('Ngân hàng')
    expect(forRole('MANAGER')).not.toContain('Cài đặt')
    expect(forRole('ADMIN')).toEqual(expect.arrayContaining(['Ngân hàng', 'Cài đặt']))
    expect(forRole('USER')).toEqual(['Tổng quan', 'Đặt phòng'])
  })

  it('lights up "Cơ sở" on the workspace home', () => {
    const outside = [...primaryNav('demo'), ...workspaceNav('demo')]
    expect(activeHref('/workspace/demo', outside)).toBe('/workspace/demo')
    expect(activeHref('/workspace/demo/settings', outside)).toBe('/workspace/demo/settings')
  })
})
