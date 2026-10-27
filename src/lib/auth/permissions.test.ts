import { describe, it, expect } from 'vitest'
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  effectivePermissions,
  isPropertyPermission,
  normalizePermissions,
  presetOf,
  rolesWith,
} from './permissions'

describe('the permission catalogue', () => {
  it('lists each permission once', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
    expect(PERMISSIONS.length).toBe(Object.values(PERMISSION_GROUPS).flat().length)
  })

  it('applies the workspace group to the workspace and the rest per property', () => {
    expect(isPropertyPermission('bookings_edit')).toBe(true)
    expect(isPropertyPermission('payment_settings')).toBe(true)
    expect(isPropertyPermission('members_manage')).toBe(false)
    expect(isPropertyPermission('billing_manage')).toBe(false)
  })
})

describe('the role presets', () => {
  it('give an admin everything and the others less, each within the one above', () => {
    expect(ROLE_PRESETS.ADMIN).toEqual(PERMISSIONS)
    for (const [lower, upper] of [['USER', 'RECEPTIONIST'], ['RECEPTIONIST', 'MANAGER'], ['MANAGER', 'ADMIN']] as const) {
      expect(ROLE_PRESETS[upper]).toEqual(expect.arrayContaining([...ROLE_PRESETS[lower]]))
      expect(ROLE_PRESETS[upper].length).toBeGreaterThan(ROLE_PRESETS[lower].length)
    }
  })

  it('keep the plan, the workspace settings and the payment settings for admins', () => {
    expect(rolesWith('billing_manage')).toEqual(['ADMIN'])
    expect(rolesWith('workspace_settings')).toEqual(['ADMIN'])
    expect(rolesWith('payment_settings')).toEqual(['ADMIN'])
    expect(rolesWith('members_manage')).toEqual(['ADMIN', 'MANAGER'])
    expect(rolesWith('bookings_create')).toEqual(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'])
  })

  it('are valid sets themselves', () => {
    for (const preset of Object.values(ROLE_PRESETS)) expect(normalizePermissions(preset)).toEqual([...preset])
  })
})

describe('a ticked set', () => {
  it('drops unknown keys and adds what a permission needs, in catalogue order', () => {
    expect(normalizePermissions(['bookings_edit', 'nope', 42, 'revenue_view'])).toEqual(['bookings_view', 'bookings_edit', 'revenue_view'])
  })

  it('is the member’s own when custom, else the role’s preset', () => {
    expect(effectivePermissions({ role: 'USER', customPermissions: false, permissions: ['billing_manage'] })).toEqual([...ROLE_PRESETS.USER])
    expect(effectivePermissions({ role: 'USER', customPermissions: true, permissions: ['payments_manage'] })).toEqual(['bookings_view', 'payments_manage'])
  })

  it('is recognised as a preset when it equals one', () => {
    expect(presetOf([...ROLE_PRESETS.RECEPTIONIST].reverse())).toBe('RECEPTIONIST')
    expect(presetOf(['bookings_view'])).toBeNull()
  })
})
