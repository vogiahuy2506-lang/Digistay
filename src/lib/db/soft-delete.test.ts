import { describe, it, expect } from 'vitest'
import { liveArgs } from './soft-delete'

const LIVE_WORKSPACE = { deletedAt: null }
const LIVE_PROPERTY = { deletedAt: null, workspace: LIVE_WORKSPACE }

describe('liveArgs: reads never see soft-deleted properties and workspaces', () => {
  it('a property: not deleted, in a workspace not deleted', () => {
    expect(liveArgs('Property', 'findUnique', { where: { subdomain: 'a' } })).toEqual({
      where: { subdomain: 'a', ...LIVE_PROPERTY },
    })
  })

  it('a workspace: not deleted', () => {
    expect(liveArgs('Workspace', 'findMany', { where: { ownerId: 'u' } })).toEqual({ where: { ownerId: 'u', deletedAt: null } })
    expect(liveArgs('Workspace', 'count', undefined)).toEqual({ where: { deletedAt: null } })
  })

  it('a row of a property (booking, invoice…) by id: only when its property is live', () => {
    expect(liveArgs('Booking', 'findUnique', { where: { id: 'b' }, include: { payments: true } })).toEqual({
      where: { id: 'b', property: LIVE_PROPERTY },
      include: { payments: true },
    })
    expect(liveArgs('PropertyEinvoice', 'findMany', { where: { autoIssue: true } })).toEqual({
      where: { autoIssue: true, property: LIVE_PROPERTY },
    })
  })

  it('a row of a workspace (member, invitation): only when the workspace is live', () => {
    expect(liveArgs('Invitation', 'findUnique', { where: { token: 't' } })).toEqual({ where: { token: 't', workspace: LIVE_WORKSPACE } })
    expect(liveArgs('WorkspaceMember', 'findMany', { where: { userId: 'u' } })).toEqual({ where: { userId: 'u', workspace: LIVE_WORKSPACE } })
  })

  it('keeps the access check written in the query and adds to it', () => {
    const access = { OR: [{ ownerId: 'u' }, { members: { some: { userId: 'u' } } }] }
    expect(liveArgs('Booking', 'findFirst', { where: { id: 'b', property: { workspace: access } } })).toEqual({
      where: { id: 'b', property: { workspace: { ...access, deletedAt: null }, deletedAt: null } },
    })
  })

  it('relation filters on a property or workspace match live ones (direct, is, some, inside AND / OR)', () => {
    expect(liveArgs('Invoice', 'findMany', { where: { property: { is: { einvoice: { is: { autoIssue: true } } } } } })).toEqual({
      where: { property: { is: { einvoice: { is: { autoIssue: true } }, ...LIVE_PROPERTY } } },
    })
    expect(liveArgs('Workspace', 'count', { where: { OR: [{ properties: { some: { id: 'p' } } }] } })).toEqual({
      where: { OR: [{ properties: { some: { id: 'p', deletedAt: null } } }], deletedAt: null },
    })
    expect(liveArgs('Booking', 'count', { where: { AND: [{ property: { workspaceId: 'w' } }] } })).toEqual({
      where: { AND: [{ property: { workspaceId: 'w', ...LIVE_PROPERTY } }], property: LIVE_PROPERTY },
    })
  })

  it('a filter of rows that do not belong to a property passes through to the ones that do', () => {
    // RoomTypePricing belongs to a room type, not directly to a property.
    expect(liveArgs('RoomTypePricing', 'findMany', { where: { roomType: { property: { workspaceId: 'w' } } } })).toEqual({
      where: { roomType: { property: { workspaceId: 'w', ...LIVE_PROPERTY } } },
    })
    expect(liveArgs('User', 'findUnique', { where: { email: 'a@b.c' } })).toEqual({ where: { email: 'a@b.c' } })
  })

  it('lists of properties in include, select and _count hold live ones', () => {
    expect(
      liveArgs('Workspace', 'findUnique', {
        where: { id: 'w' },
        include: { properties: { select: { id: true } }, members: true, _count: { select: { properties: true, members: true } } },
      })
    ).toEqual({
      where: { id: 'w', deletedAt: null },
      include: {
        properties: { select: { id: true }, where: { deletedAt: null } },
        members: true,
        _count: { select: { properties: { where: { deletedAt: null } }, members: true } },
      },
    })
    expect(liveArgs('User', 'findUnique', { where: { id: 'u' }, select: { ownedWorkspaces: true } })).toEqual({
      where: { id: 'u' },
      select: { ownedWorkspaces: { where: { deletedAt: null } } },
    })
  })

  it('a query that names deletedAt itself sees deleted rows (the "recently deleted" lists)', () => {
    expect(liveArgs('Property', 'findMany', { where: { workspaceId: 'w', deletedAt: { not: null } } })).toEqual({
      where: { workspaceId: 'w', deletedAt: { not: null } },
    })
    expect(liveArgs('Workspace', 'findFirst', { where: { id: 'w', deletedAt: { not: null } } })).toEqual({
      where: { id: 'w', deletedAt: { not: null } },
    })
  })

  it('an owner relation left undefined still gets the live check (undefined is no filter to Prisma)', () => {
    expect(liveArgs('Booking', 'findMany', { where: { property: undefined } })).toEqual({ where: { property: LIVE_PROPERTY } })
  })

  it('leaves writes, raw arguments and the plan’s own rows alone', () => {
    const args = { where: { id: 'p' }, data: { name: 'x' } }
    expect(liveArgs('Property', 'update', args)).toBe(args)
    expect(liveArgs('Booking', 'deleteMany', args)).toBe(args)
    const plan = { where: { workspaceId: 'w' } }
    expect(liveArgs('Subscription', 'findUnique', plan)).toBe(plan)
    expect(liveArgs('SubscriptionPayment', 'findMany', plan)).toBe(plan)
  })

  it('does not change the caller’s objects', () => {
    const where = { id: 'b', property: { workspaceId: 'w' } }
    const args = { where }
    liveArgs('Booking', 'findFirst', args)
    expect(args).toEqual({ where: { id: 'b', property: { workspaceId: 'w' } } })
  })
})
