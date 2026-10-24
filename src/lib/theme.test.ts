import { describe, it, expect } from 'vitest'
import { effectiveTheme, isDarkReady, parseThemePreference } from './theme'

const P = '/workspace/demo/properties/p1'

describe('dashboard theme', () => {
  it('accepts only light or dark from the cookie', () => {
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('DARK')).toBe('light')
    expect(parseThemePreference('<script>')).toBe('light')
    expect(parseThemePreference(undefined)).toBe('light')
  })

  it('turns dark on only for pages drawn with role colors', () => {
    for (const ready of ['/workspaces', '/profile', '/workspace/demo', '/workspace/demo/members', '/workspace/demo/settings', '/workspace/demo/properties', '/workspace/demo/properties/new']) {
      expect(isDarkReady(ready)).toBe(true)
    }
    for (const ready of ['', '/bookings', '/bookings/b1', '/bookings/new', '/calendar', '/reports', '/reports/daily']) {
      expect(isDarkReady(`${P}${ready}`)).toBe(true)
    }
    for (const ready of ['/rooms', '/services', '/menu', '/policies', '/bank-accounts', '/website', '/payments', '/invoices', '/payments/', '/invoices/']) {
      expect(isDarkReady(`${P}${ready}`)).toBe(true)
    }
    // Only the pages themselves, not made-up paths below them.
    expect(isDarkReady(`${P}/payments/p1`)).toBe(false)
    expect(isDarkReady(`${P}/invoices/i1`)).toBe(false)
    // Not moved: it always redirects to /workspaces anyway.
    expect(isDarkReady('/workspace-picker/demo')).toBe(false)
    expect(isDarkReady('/admin/system')).toBe(true)
    expect(isDarkReady('/admin/other')).toBe(false)
    expect(isDarkReady('/workspace/demo/properties/p1/reports/daily/extra')).toBe(false)
    expect(isDarkReady(null)).toBe(false)
  })

  it('keeps unfinished pages light whatever the preference', () => {
    expect(effectiveTheme('dark', `${P}/bookings`)).toBe('dark')
    expect(effectiveTheme('dark', '/workspace-picker/demo')).toBe('light')
    expect(effectiveTheme('light', `${P}/bookings`)).toBe('light')
  })
})
