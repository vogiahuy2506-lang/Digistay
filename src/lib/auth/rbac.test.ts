/**
 * Unit tests for RBAC helpers.
 *
 * These functions call Prisma and NextAuth, so we mock both modules
 * using `vi.mock` to keep tests fast and isolated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks must be declared before any imports ────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}))

// We pull auth / prisma from their modules *after* mocking.
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  getWorkspaceRole,
  getWorkspaceRoleBySlug,
  WorkspaceRoles,
} from './rbac'

const mockPrisma = prisma as ReturnType<typeof vi.mocked<typeof prisma>>
const mockAuth = auth as ReturnType<typeof vi.mocked<typeof auth>>

beforeEach(() => {
  vi.clearAllMocks()
})

// ── getWorkspaceRole ────────────────────────────────────────────────────────

describe('getWorkspaceRole', () => {
  it('returns ADMIN when the user is the workspace owner', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValueOnce({
      ownerId: 'user-1',
      members: [],
    } as never)

    const role = await getWorkspaceRole('ws-1', 'user-1')
    expect(role).toBe('ADMIN')
  })

  it('returns the stored member role when the user is not the owner', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValueOnce({
      ownerId: 'owner-1',
      members: [{ role: 'MANAGER' }],
    } as never)

    const role = await getWorkspaceRole('ws-1', 'user-2')
    expect(role).toBe('MANAGER')
  })

  it('returns null when the workspace does not exist', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValueOnce(null)

    const role = await getWorkspaceRole('nonexistent', 'user-1')
    expect(role).toBeNull()
  })

  it('returns null when the user is neither owner nor member', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValueOnce({
      ownerId: 'owner-1',
      members: [],
    } as never)

    const role = await getWorkspaceRole('ws-1', 'stranger')
    expect(role).toBeNull()
  })
})

// ── getWorkspaceRoleBySlug ──────────────────────────────────────────────────

describe('getWorkspaceRoleBySlug', () => {
  it('returns the workspace id and ADMIN for the owner', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValueOnce({
      id: 'ws-uuid-123',
      ownerId: 'user-1',
      members: [],
    } as never)

    const result = await getWorkspaceRoleBySlug('my-workspace', 'user-1')
    expect(result).toEqual({ workspaceId: 'ws-uuid-123', role: 'ADMIN' })
  })

  it('returns null when the workspace slug does not exist', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValueOnce(null)

    const result = await getWorkspaceRoleBySlug('does-not-exist', 'user-1')
    expect(result).toBeNull()
  })

  it('returns the member role with workspace id for a regular member', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValueOnce({
      id: 'ws-uuid-456',
      ownerId: 'owner-1',
      members: [{ role: 'RECEPTIONIST' }],
    } as never)

    const result = await getWorkspaceRoleBySlug('hotel-slug', 'staff-1')
    expect(result).toEqual({
      workspaceId: 'ws-uuid-456',
      role: 'RECEPTIONIST',
    })
  })
})

// ── WorkspaceRoles constants ────────────────────────────────────────────────

describe('WorkspaceRoles', () => {
  it('exposes ADMINS as just ADMIN', () => {
    expect(WorkspaceRoles.ADMINS).toEqual(['ADMIN'])
  })

  it('exposes ADMINS_AND_MANAGERS', () => {
    expect(WorkspaceRoles.ADMINS_AND_MANAGERS).toContain('ADMIN')
    expect(WorkspaceRoles.ADMINS_AND_MANAGERS).toContain('MANAGER')
  })

  it('exposes STAFF_AND_UP', () => {
    expect(WorkspaceRoles.STAFF_AND_UP).toContain('RECEPTIONIST')
  })

  it('exposes ALL_MEMBERS includes the guest role', () => {
    expect(WorkspaceRoles.ALL_MEMBERS).toContain('USER')
  })
})
