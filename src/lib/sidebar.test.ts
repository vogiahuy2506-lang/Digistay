import { describe, it, expect } from 'vitest'
import {
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  clampSidebarWidth,
  foldsSidebar,
  parseSidebarPref,
  serializeSidebarPref,
} from './sidebar'

describe('sidebar preference', () => {
  it('reads the width and the fold back', () => {
    expect(parseSidebarPref('300')).toEqual({ width: 300, collapsed: false })
    expect(parseSidebarPref('300c')).toEqual({ width: 300, collapsed: true })
    expect(parseSidebarPref(serializeSidebarPref({ width: 312.6, collapsed: true }))).toEqual({ width: 313, collapsed: true })
  })

  it('falls back to the default on anything else', () => {
    for (const value of [undefined, null, '', 'wide', '300x', '-5', '12345']) {
      expect(parseSidebarPref(value)).toEqual({ width: SIDEBAR_DEFAULT, collapsed: false })
    }
  })

  it('keeps the width within bounds', () => {
    expect(parseSidebarPref('10')).toEqual({ width: SIDEBAR_MIN, collapsed: false })
    expect(parseSidebarPref('9999c')).toEqual({ width: SIDEBAR_MAX, collapsed: true })
    expect(clampSidebarWidth(SIDEBAR_MIN - 1)).toBe(SIDEBAR_MIN)
    expect(clampSidebarWidth(SIDEBAR_MAX + 1)).toBe(SIDEBAR_MAX)
  })
})

describe('foldsSidebar', () => {
  it('folds on the website builder only', () => {
    expect(foldsSidebar('/workspace/ks/properties/p1/website')).toBe(true)
    expect(foldsSidebar('/workspace/ks/properties/p1/website/')).toBe(true)
    expect(foldsSidebar('/workspace/ks/properties/p1')).toBe(false)
    expect(foldsSidebar('/workspace/ks/properties/p1/bookings')).toBe(false)
    expect(foldsSidebar('/workspace/ks/members')).toBe(false)
    expect(foldsSidebar(null)).toBe(false)
  })
})
