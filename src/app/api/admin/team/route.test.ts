import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/admin/guard', () => ({
  requirePlatformAdmin: vi.fn(),
}))

vi.mock('@/lib/admin/team', () => ({
  listAdminTeam: vi.fn(),
  assignAdminRole: vi.fn(),
  updateAdminRole: vi.fn(),
  toggleAdminDisabled: vi.fn(),
  revokeAdminRole: vi.fn(),
  resetAdminTwoFactor: vi.fn(),
  AdminTeamError: class AdminTeamError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message)
    }
  },
}))

import { requirePlatformAdmin } from '@/lib/admin/guard'
import {
  listAdminTeam,
  assignAdminRole,
  updateAdminRole,
  toggleAdminDisabled,
  revokeAdminRole,
  resetAdminTwoFactor,
  AdminTeamError,
} from '@/lib/admin/team'
import { GET as getTeam, POST as postTeam } from './route'
import { PATCH as patchMember, DELETE as deleteMember } from './[userId]/route'
import { POST as postReset2Fa } from './[userId]/reset-2fa/route'

describe('Admin Team Management APIs (/api/admin/team)', () => {
  const currentAdmin = {
    id: 'admin-1',
    email: 'admin@digistay.vn',
    role: 'SUPER_ADMIN',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      ok: true,
      admin: currentAdmin as any,
    })
  })

  it('GET returns admin team members and stats', async () => {
    vi.mocked(listAdminTeam).mockResolvedValueOnce({
      members: [
        {
          id: 'admin-1',
          name: 'Super User',
          email: 'admin@digistay.vn',
          role: 'SUPER_ADMIN',
          avatar: null,
          image: null,
          hasTwoFactor: true,
          twoFactorEnabledAt: new Date(),
          isDisabled: false,
          disabledAt: null,
          disabledReason: null,
          createdAt: new Date(),
        },
      ],
      stats: {
        total: 1,
        superAdmins: 1,
        admins: 0,
        twoFactorRate: 100,
        twoFactorCount: 1,
        disabledCount: 0,
      },
    })

    const res = await getTeam()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.stats.total).toBe(1)
  })

  it('POST assigns an admin role to a user', async () => {
    vi.mocked(assignAdminRole).mockResolvedValueOnce({
      id: 'user-2',
      email: 'staff@digistay.vn',
      role: 'ADMIN',
    } as any)

    const req = new NextRequest('http://localhost/api/admin/team', {
      method: 'POST',
      body: JSON.stringify({
        email: 'staff@digistay.vn',
        role: 'ADMIN',
      }),
    })

    const res = await postTeam(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(assignAdminRole).toHaveBeenCalledWith(currentAdmin, 'staff@digistay.vn', 'ADMIN')
  })

  it('PATCH updates role of an admin', async () => {
    vi.mocked(updateAdminRole).mockResolvedValueOnce({
      id: 'admin-2',
      email: 'staff@digistay.vn',
      role: 'SUPER_ADMIN',
    } as any)

    const req = new NextRequest('http://localhost/api/admin/team/admin-2', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'CHANGE_ROLE',
        role: 'SUPER_ADMIN',
      }),
    })

    const res = await patchMember(req, { params: Promise.resolve({ userId: 'admin-2' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(updateAdminRole).toHaveBeenCalledWith(currentAdmin, 'admin-2', 'SUPER_ADMIN')
  })

  it('PATCH toggles disabled state of an admin', async () => {
    vi.mocked(toggleAdminDisabled).mockResolvedValueOnce({
      id: 'admin-2',
      email: 'staff@digistay.vn',
      disabledAt: new Date(),
    } as any)

    const req = new NextRequest('http://localhost/api/admin/team/admin-2', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'TOGGLE_DISABLE',
        disabled: true,
        reason: 'Temporary lock',
      }),
    })

    const res = await patchMember(req, { params: Promise.resolve({ userId: 'admin-2' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(toggleAdminDisabled).toHaveBeenCalledWith(currentAdmin, 'admin-2', true, 'Temporary lock')
  })

  it('DELETE revokes admin role', async () => {
    vi.mocked(revokeAdminRole).mockResolvedValueOnce({
      id: 'admin-2',
      email: 'staff@digistay.vn',
      role: 'USER',
    } as any)

    const req = new NextRequest('http://localhost/api/admin/team/admin-2', {
      method: 'DELETE',
    })

    const res = await deleteMember(req, { params: Promise.resolve({ userId: 'admin-2' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(revokeAdminRole).toHaveBeenCalledWith(currentAdmin, 'admin-2')
  })

  it('POST reset-2fa calls resetAdminTwoFactor', async () => {
    vi.mocked(resetAdminTwoFactor).mockResolvedValueOnce(undefined)

    const req = new NextRequest('http://localhost/api/admin/team/admin-2/reset-2fa', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Lost phone and authenticator app',
      }),
    })

    const res = await postReset2Fa(req, { params: Promise.resolve({ userId: 'admin-2' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(resetAdminTwoFactor).toHaveBeenCalledWith(
      currentAdmin,
      'admin-2',
      'Lost phone and authenticator app'
    )
  })
})

