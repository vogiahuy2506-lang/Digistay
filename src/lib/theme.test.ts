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
    expect(isDarkReady(`${P}/bookings`)).toBe(true)
    expect(isDarkReady(`${P}/bookings/b1`)).toBe(true)
    // The walk-in form still hard-codes light colors.
    expect(isDarkReady(`${P}/bookings/new`)).toBe(false)
    expect(isDarkReady(`${P}/rooms`)).toBe(false)
    expect(isDarkReady(P)).toBe(false)
    expect(isDarkReady(null)).toBe(false)
  })

  it('keeps unfinished pages light whatever the preference', () => {
    expect(effectiveTheme('dark', `${P}/bookings`)).toBe('dark')
    expect(effectiveTheme('dark', `${P}/payments`)).toBe('light')
    expect(effectiveTheme('light', `${P}/bookings`)).toBe('light')
  })
})
