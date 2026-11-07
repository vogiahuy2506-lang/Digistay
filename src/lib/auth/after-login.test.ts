import { describe, it, expect } from 'vitest'
import { afterLogin } from './after-login'

describe('afterLogin', () => {
  it('goes back to a path of this site', () => {
    expect(afterLogin('/invitations/abc')).toBe('/invitations/abc')
  })
  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])('refuses %s', (raw) => {
    expect(afterLogin(raw)).toBe('/workspaces')
  })
  it('redirects super admin to /admin when no custom path is given', () => {
    expect(afterLogin(null, 'SUPER_ADMIN')).toBe('/admin')
    expect(afterLogin('', 'SUPER_ADMIN')).toBe('/admin')
    expect(afterLogin('/workspaces', 'SUPER_ADMIN')).toBe('/admin')
  })
  it('respects specific callback paths even for super admin', () => {
    expect(afterLogin('/admin/system', 'SUPER_ADMIN')).toBe('/admin/system')
    expect(afterLogin('/invitations/123', 'SUPER_ADMIN')).toBe('/invitations/123')
  })
})

