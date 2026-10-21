import { describe, it, expect } from 'vitest'
import { afterLogin } from './after-login'

describe('afterLogin', () => {
  it('goes back to a path of this site', () => {
    expect(afterLogin('/invitations/abc')).toBe('/invitations/abc')
  })
  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])('refuses %s', (raw) => {
    expect(afterLogin(raw)).toBe('/workspaces')
  })
})
