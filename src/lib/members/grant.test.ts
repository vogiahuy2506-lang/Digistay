import { describe, it, expect } from 'vitest'
import type { Access } from '@/lib/auth/access'
import { PERMISSIONS, ROLE_PRESETS, type Permission } from '@/lib/auth/permissions'
import {
  GRANT_TOO_WIDE,
  MEMBER_ABOVE_YOU,
  NOT_YOURSELF,
  PICK_A_PROPERTY,
  PROPERTIES_TOO_WIDE,
  UNKNOWN_PROPERTY,
  grantProblem,
  memberProblem,
  toGrant,
} from './grant'

const access = (permissions: readonly Permission[], propertyIds: string[] | null = null, isOwner = false): Access => ({
  workspaceId: 'w',
  userId: 'me',
  isOwner,
  role: 'MANAGER',
  customPermissions: false,
  permissions: new Set(permissions),
  propertyIds,
})

describe('toGrant', () => {
  it('stores a set equal to the role’s preset as the preset', () => {
    expect(toGrant({ role: 'RECEPTIONIST', permissions: [...ROLE_PRESETS.RECEPTIONIST], allProperties: true, propertyIds: [] }, [])).toEqual({
      role: 'RECEPTIONIST',
      customPermissions: false,
      permissions: [],
      allProperties: true,
      propertyIds: [],
    })
  })

  it('stores another set as the member’s own, completed', () => {
    const grant = toGrant({ role: 'USER', permissions: ['payments_manage'], allProperties: false, propertyIds: ['a', 'a'] }, ['a', 'b'])
    expect(grant).toEqual({ role: 'USER', customPermissions: true, permissions: ['bookings_view', 'payments_manage'], allProperties: false, propertyIds: ['a'] })
  })

  it('wants a property of the workspace when limited', () => {
    expect(toGrant({ role: 'USER', allProperties: false, propertyIds: [] }, ['a'])).toBe(PICK_A_PROPERTY)
    expect(toGrant({ role: 'USER', allProperties: false, propertyIds: ['x'] }, ['a'])).toBe(UNKNOWN_PROPERTY)
  })
})

describe('nobody gives more than they have', () => {
  const grant = (permissions: Permission[], allProperties = true, propertyIds: string[] = []) => ({
    role: 'USER' as const,
    customPermissions: true,
    permissions,
    allProperties,
    propertyIds,
  })

  it('lets the owner give anything', () => {
    expect(grantProblem(access([], null, true), grant([...PERMISSIONS]))).toBeNull()
  })

  it('refuses a permission the giver lacks', () => {
    expect(grantProblem(access(ROLE_PRESETS.MANAGER), grant(['billing_manage']))).toBe(GRANT_TOO_WIDE)
    expect(grantProblem(access(ROLE_PRESETS.MANAGER), grant(['bookings_view', 'revenue_view']))).toBeNull()
  })

  it('keeps a giver limited to some properties to those', () => {
    const limited = access(ROLE_PRESETS.MANAGER, ['a'])
    expect(grantProblem(limited, grant(['bookings_view']))).toBe(PROPERTIES_TOO_WIDE)
    expect(grantProblem(limited, grant(['bookings_view'], false, ['b']))).toBe(PROPERTIES_TOO_WIDE)
    expect(grantProblem(limited, grant(['bookings_view'], false, ['a']))).toBeNull()
  })

  it('refuses changing oneself or someone holding more', () => {
    const member = { userId: 'other', role: 'ADMIN' as const, customPermissions: false, permissions: [], allProperties: true, propertyIds: [] }
    expect(memberProblem(access(ROLE_PRESETS.MANAGER), member)).toBe(MEMBER_ABOVE_YOU)
    expect(memberProblem(access(ROLE_PRESETS.MANAGER), { ...member, role: 'RECEPTIONIST' })).toBeNull()
    expect(memberProblem(access(ROLE_PRESETS.ADMIN), { ...member, userId: 'me' })).toBe(NOT_YOURSELF)
    expect(memberProblem(access([], null, true), member)).toBeNull()
  })
})
