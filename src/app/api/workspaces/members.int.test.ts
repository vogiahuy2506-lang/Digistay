/**
 * Staff like UKNOW's, against real Postgres: invite with a role preset or
 * ticked permissions and some properties, accept (or sign up from the link),
 * change, lock, remove, leave, resend and cancel invitations, and the log of
 * all of it. Nobody gives more than they have.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAccess } from '@/lib/auth/access'
import { ROLE_PRESETS } from '@/lib/auth/permissions'
import { createProperty, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { GET as listMembers } from './[id]/members/route'
import { PATCH as patchMember, DELETE as deleteMember } from './[id]/members/[memberId]/route'
import { GET as memberLog } from './[id]/members/activity/route'
import { GET as listInvitations, POST as invite } from './[id]/invitations/route'
import { DELETE as revokeInvitation } from './[id]/invitations/[invitationId]/route'
import { POST as resendInvitation } from './[id]/invitations/[invitationId]/resend/route'
import { GET as lookupInvitation } from '../invitations/[token]/route'
import { POST as acceptInvitation } from '../invitations/[token]/accept/route'
import { POST as registerFromInvitation } from '../invitations/[token]/register/route'
import { POST as declineInvitation } from '../invitations/[token]/decline/route'
import { GET as myInvitations } from '../users/me/invitations/route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string; name?: string | null }) =>
  mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email, name: user.name ?? null } })
const signOut = () => mockAuth.mockResolvedValue(null)

const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/x', {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
const ws = (id: string) => ({ params: Promise.resolve({ id }) })
const member = (id: string, memberId: string) => ({ params: Promise.resolve({ id, memberId }) })
const invitation = (id: string, invitationId: string) => ({ params: Promise.resolve({ id, invitationId }) })
const token = (t: string) => ({ params: Promise.resolve({ token: t }) })
const json = async (res: Response) => ({ status: res.status, body: await res.json() })

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

async function memberRow(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId, userId } } })
}

describe('inviting and accepting', () => {
  it('gives the invitee exactly the ticked permissions and properties', async () => {
    const { owner, workspace, property } = await createTenant()
    const other = await createProperty(workspace.id)
    signInAs(owner)

    const sent = await json(
      await invite(req('POST', { email: 'LeTan@Example.com', role: 'RECEPTIONIST', permissions: ['payments_manage'], allProperties: false, propertyIds: [property.id] }), ws(workspace.id))
    )
    expect(sent.status).toBe(200)
    expect(sent.body.data.token).toBeUndefined()
    const row = await prisma.invitation.findFirstOrThrow({ where: { workspaceId: workspace.id } })
    expect(row).toMatchObject({ email: 'letan@example.com', customPermissions: true, permissions: ['bookings_view', 'payments_manage'], allProperties: false, propertyIds: [property.id] })

    const invitee = await createUser('letan@example.com')
    signInAs(invitee)
    const accepted = await json(await acceptInvitation(req('POST'), token(row.token)))
    expect(accepted.status).toBe(200)
    expect(accepted.body.data.workspaceSlug).toBe(workspace.slug)

    const access = await getAccess(workspace.id, invitee.id)
    expect(access && [...access.permissions]).toEqual(['bookings_view', 'payments_manage'])
    expect(access?.propertyIds).toEqual([property.id])
    expect(other.id).not.toBe(property.id)
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ACCEPTED')
  })

  it('lets an invitee without an account sign up from the link, without a code nor a workspace of their own', async () => {
    const { owner, workspace } = await createTenant()
    await prisma.user.create({ data: { email: 'dachon@example.com', name: 'Đã có', username: 'dachon' } })
    signInAs(owner)
    await invite(req('POST', { email: 'moi@example.com', role: 'USER' }), ws(workspace.id))
    const row = await prisma.invitation.findFirstOrThrow({ where: { workspaceId: workspace.id } })

    signOut()
    const preview = await json(await lookupInvitation(req('GET'), token(row.token)))
    expect(preview.body.data).toMatchObject({ hasAccount: false, role: 'USER', properties: null })

    const signUp = (body: Record<string, string>) => registerFromInvitation(req('POST', body), token(row.token))
    const form = { name: 'Nhân viên Mới', username: 'nv_moi', phone: '0901234567', password: 'Matkhau123!' }
    // The sign-up form's checks (registerSchema): a username of one's own.
    const taken = await json(await signUp({ ...form, username: 'dachon' }))
    expect(taken).toMatchObject({ status: 400, body: { error: 'Tên đăng nhập đã được sử dụng' } })

    const joined = await json(await signUp(form))
    expect(joined.status).toBe(200)
    expect(joined.body.data.workspaceSlug).toBe(workspace.slug)

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'moi@example.com' } })
    expect(user).toMatchObject({ name: 'Nhân viên Mới', username: 'nv_moi', phone: '0901234567' })
    expect(user.emailVerified).not.toBeNull()
    expect(user.password).toBeTruthy()
    expect(await prisma.workspace.count({ where: { ownerId: user.id } })).toBe(0)
    expect((await getAccess(workspace.id, user.id))?.role).toBe('USER')

    // The link is used up.
    const again = await json(await signUp({ ...form, username: 'nv_khac' }))
    expect(again).toMatchObject({ status: 400, body: { code: 'ANSWERED' } })
  })

  it('sends an invitee who has an account to sign in', async () => {
    const { owner, workspace } = await createTenant()
    await createUser('co@example.com')
    signInAs(owner)
    await invite(req('POST', { email: 'co@example.com', role: 'USER' }), ws(workspace.id))
    const row = await prisma.invitation.findFirstOrThrow({ where: { workspaceId: workspace.id } })
    signOut()
    expect((await json(await lookupInvitation(req('GET'), token(row.token)))).body.data.hasAccount).toBe(true)
    const res = await json(await registerFromInvitation(req('POST', { name: 'Ai đó', username: 'ai_do', password: 'Matkhau123!' }), token(row.token)))
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('HAS_ACCOUNT')
  })

  it('does not let an invitation past its date block a new one', async () => {
    const { owner, workspace } = await createTenant()
    signInAs(owner)
    await invite(req('POST', { email: 'cu@example.com', role: 'USER' }), ws(workspace.id))
    await prisma.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await invite(req('POST', { email: 'cu@example.com', role: 'USER' }), ws(workspace.id))).status).toBe(200)
    const rows = await prisma.invitation.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: 'asc' } })
    expect(rows.map((r) => r.status)).toEqual(['EXPIRED', 'PENDING'])
  })
})

describe('an invitee with an account hears of it in the app', () => {
  const notices = (userId: string) => prisma.notification.findMany({ where: { userId, type: 'workspace_invite' } })

  it('puts the invitation in their bell, once, until it is answered or cancelled', async () => {
    const { owner, workspace } = await createTenant()
    const invitee = await createUser('Co.TaiKhoan@example.com')
    signInAs(owner)
    await invite(req('POST', { email: 'co.taikhoan@example.com', role: 'RECEPTIONIST' }), ws(workspace.id))
    const row = await prisma.invitation.findFirstOrThrow({ where: { workspaceId: workspace.id } })

    const [notice] = await notices(invitee.id)
    expect(notice).toMatchObject({ workspaceId: workspace.id, link: '/workspaces', readAt: null })
    expect(notice.data).toMatchObject({ invitationId: row.id, workspaceName: workspace.name, role: 'RECEPTIONIST', customPermissions: false })
    expect(JSON.stringify(notice)).not.toContain(row.token)

    // Sent again: a fresh notice, not a second one.
    await prisma.notification.updateMany({ data: { readAt: new Date() } })
    expect((await resendInvitation(req('POST'), invitation(workspace.id, row.id))).status).toBe(200)
    expect(await notices(invitee.id)).toEqual([expect.objectContaining({ readAt: null })])

    // Cancelled: gone from the bell.
    expect((await revokeInvitation(req('DELETE'), invitation(workspace.id, row.id))).status).toBe(200)
    expect(await notices(invitee.id)).toEqual([])
  })

  it('takes it out of the bell once accepted or declined', async () => {
    const { owner, workspace } = await createTenant()
    const yes = await createUser('yes@example.com')
    const no = await createUser('no@example.com')
    signInAs(owner)
    await invite(req('POST', { email: 'yes@example.com', role: 'USER' }), ws(workspace.id))
    await invite(req('POST', { email: 'no@example.com', role: 'USER' }), ws(workspace.id))
    const rows = await prisma.invitation.findMany({ where: { workspaceId: workspace.id } })
    const of = (email: string) => rows.find((r) => r.email === email)!
    expect((await notices(yes.id)).length + (await notices(no.id)).length).toBe(2)

    signInAs(yes)
    expect((await acceptInvitation(req('POST'), token(of('yes@example.com').token))).status).toBe(200)
    signInAs(no)
    expect((await declineInvitation(req('POST'), token(of('no@example.com').token))).status).toBe(200)
    expect(await notices(yes.id)).toEqual([])
    expect(await notices(no.id)).toEqual([])
  })

  it('rings no bell for an email without an account', async () => {
    const { owner, workspace } = await createTenant()
    signInAs(owner)
    await invite(req('POST', { email: 'chua@example.com', role: 'USER' }), ws(workspace.id))
    expect(await prisma.notification.count()).toBe(0)
  })

  it('lists the invitations waiting on /workspaces, whatever the case of the email, with what they give', async () => {
    const { owner, workspace } = await createTenant()
    const [property] = await prisma.property.findMany({ where: { workspaceId: workspace.id } })
    const invitee = await createUser('Hoa.Ten@example.com')
    signInAs(owner)
    await invite(
      req('POST', { email: 'hoa.ten@example.com', role: 'RECEPTIONIST', permissions: ['bookings_view'], allProperties: false, propertyIds: [property.id] }),
      ws(workspace.id)
    )

    signInAs(invitee)
    const mine = await json(await myInvitations())
    expect(mine.body.data).toEqual([
      expect.objectContaining({
        role: 'RECEPTIONIST',
        customPermissions: true,
        properties: [property.name],
        workspace: expect.objectContaining({ id: workspace.id, slug: workspace.slug }),
      }),
    ])
    // Someone else's are not theirs.
    signInAs(owner)
    expect((await json(await myInvitations())).body.data).toEqual([])
  })
})

describe('resending and cancelling', () => {
  it('resends with a new date, reopens an expired one, and a cancelled link stops working', async () => {
    const { owner, workspace } = await createTenant()
    signInAs(owner)
    await invite(req('POST', { email: 'gui@example.com', role: 'USER' }), ws(workspace.id))
    const row = await prisma.invitation.findFirstOrThrow({ where: { workspaceId: workspace.id } })
    await prisma.invitation.update({ where: { id: row.id }, data: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 1000) } })

    expect((await resendInvitation(req('POST'), invitation(workspace.id, row.id))).status).toBe(200)
    const reopened = await prisma.invitation.findUniqueOrThrow({ where: { id: row.id } })
    expect(reopened.status).toBe('PENDING')
    expect(reopened.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600_000)

    expect((await revokeInvitation(req('DELETE'), invitation(workspace.id, row.id))).status).toBe(200)
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('REVOKED')
    expect((await resendInvitation(req('POST'), invitation(workspace.id, row.id))).status).toBe(400)

    const invitee = await createUser('gui@example.com')
    signInAs(invitee)
    expect((await acceptInvitation(req('POST'), token(row.token))).status).toBe(400)
    expect(await getAccess(workspace.id, invitee.id)).toBeNull()
    expect((await json(await lookupInvitation(req('GET'), token(row.token)))).body.data.status).toBe('REVOKED')
  })

  it('keeps invitations of one workspace away from the admins of another', async () => {
    const a = await createTenant()
    const b = await createTenant()
    signInAs(a.owner)
    await invite(req('POST', { email: 'x@example.com', role: 'USER' }), ws(a.workspace.id))
    const row = await prisma.invitation.findFirstOrThrow({ where: { workspaceId: a.workspace.id } })
    signInAs(b.owner)
    expect((await revokeInvitation(req('DELETE'), invitation(b.workspace.id, row.id))).status).toBe(404)
    expect((await revokeInvitation(req('DELETE'), invitation(a.workspace.id, row.id))).status).toBe(403)
    expect((await json(await listInvitations(req('GET'), ws(b.workspace.id)))).body.data).toEqual([])
  })
})

describe('nobody gives more than they have', () => {
  it('lets a manager invite and change front desk staff, but not give the plan nor touch an admin', async () => {
    const { workspace, member: manager } = await createTenant({ memberRole: 'MANAGER' })
    const admin = await createUser()
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: admin.id, role: 'ADMIN' } })
    const desk = await createUser()
    const deskRow = await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: desk.id, role: 'RECEPTIONIST' } })
    const adminRow = await memberRow(workspace.id, admin.id)
    const managerRow = await memberRow(workspace.id, manager!.id)
    signInAs(manager!)

    expect((await invite(req('POST', { email: 'a@example.com', role: 'RECEPTIONIST' }), ws(workspace.id))).status).toBe(200)
    expect((await invite(req('POST', { email: 'b@example.com', role: 'ADMIN' }), ws(workspace.id))).status).toBe(403)
    expect((await invite(req('POST', { email: 'c@example.com', role: 'USER', permissions: ['billing_manage'] }), ws(workspace.id))).status).toBe(403)

    expect((await patchMember(req('PATCH', { role: 'USER' }), member(workspace.id, deskRow.id))).status).toBe(200)
    expect((await memberRow(workspace.id, desk.id)).role).toBe('USER')
    expect((await patchMember(req('PATCH', { role: 'USER' }), member(workspace.id, adminRow.id))).status).toBe(403)
    expect((await patchMember(req('PATCH', { disabled: true }), member(workspace.id, adminRow.id))).status).toBe(403)
    expect((await deleteMember(req('DELETE'), member(workspace.id, adminRow.id))).status).toBe(403)
    expect((await patchMember(req('PATCH', { role: 'ADMIN' }), member(workspace.id, managerRow.id))).status).toBe(403)
  })

  it('keeps a manager limited to some properties to those', async () => {
    const { workspace, property, member: manager } = await createTenant({ memberRole: 'MANAGER', memberLimited: true })
    const other = await createProperty(workspace.id)
    const managerRow = await memberRow(workspace.id, manager!.id)
    await prisma.memberProperty.create({ data: { memberId: managerRow.id, propertyId: property.id } })
    signInAs(manager!)

    const all = { email: 'a@example.com', role: 'USER' }
    expect((await invite(req('POST', all), ws(workspace.id))).status).toBe(403)
    expect((await invite(req('POST', { ...all, allProperties: false, propertyIds: [other.id] }), ws(workspace.id))).status).toBe(403)
    expect((await invite(req('POST', { ...all, allProperties: false, propertyIds: [property.id] }), ws(workspace.id))).status).toBe(200)
  })

  it('shows the members page to who manages members only', async () => {
    const { owner, workspace, member: desk } = await createTenant({ memberRole: 'RECEPTIONIST' })
    signInAs(desk!)
    expect((await listMembers(req('GET'), ws(workspace.id))).status).toBe(403)
    expect((await memberLog(req('GET'), ws(workspace.id))).status).toBe(403)
    signInAs(owner)
    const page = await json(await listMembers(req('GET'), ws(workspace.id)))
    expect(page.status).toBe(200)
    expect(page.body.data.owner.id).toBe(owner.id)
    expect(page.body.data.members).toEqual([
      expect.objectContaining({ role: 'RECEPTIONIST', permissions: [...ROLE_PRESETS.RECEPTIONIST], allProperties: true, locked: null }),
    ])
    expect(page.body.data.seats).toEqual({ used: 1, limit: expect.any(Number) })
  })
})

describe('locking, removing and leaving', () => {
  it('locks a member out without taking a seat, and back in only with a free seat', async () => {
    const { owner, workspace, member: desk } = await createTenant({ memberRole: 'RECEPTIONIST' })
    const row = await memberRow(workspace.id, desk!.id)
    signInAs(owner)

    expect((await patchMember(req('PATCH', { disabled: true }), member(workspace.id, row.id))).status).toBe(200)
    expect(await getAccess(workspace.id, desk!.id)).toBeNull()
    expect((await json(await listMembers(req('GET'), ws(workspace.id)))).body.data.seats.used).toBe(0)

    // The seat is taken meanwhile: no way back in until one is free.
    const limit = (await json(await listMembers(req('GET'), ws(workspace.id)))).body.data.seats.limit as number
    for (let i = 0; i < limit; i++) {
      const u = await createUser()
      await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: u.id, role: 'USER' } })
    }
    expect((await patchMember(req('PATCH', { disabled: false }), member(workspace.id, row.id))).status).toBe(403)
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspace.id, role: 'USER' } })
    expect((await patchMember(req('PATCH', { disabled: false }), member(workspace.id, row.id))).status).toBe(200)
    expect((await getAccess(workspace.id, desk!.id))?.role).toBe('RECEPTIONIST')
  })

  it('lets any member leave, and logs everything that was done', async () => {
    const { owner, workspace, member: staff } = await createTenant({ memberRole: 'USER' })
    const row = await memberRow(workspace.id, staff!.id)
    signInAs(owner)
    await patchMember(req('PATCH', { role: 'RECEPTIONIST', permissions: ['bookings_view', 'bookings_create', 'revenue_view'] }), member(workspace.id, row.id))
    expect(await memberRow(workspace.id, staff!.id)).toMatchObject({ customPermissions: true, permissions: ['bookings_view', 'bookings_create', 'revenue_view'] })

    signInAs(staff!)
    expect((await deleteMember(req('DELETE'), member(workspace.id, row.id))).status).toBe(200)
    expect(await prisma.workspaceMember.count({ where: { workspaceId: workspace.id } })).toBe(0)

    signInAs(owner)
    const log = await json(await memberLog(req('GET'), ws(workspace.id)))
    expect(log.body.data.map((r: { action: string }) => r.action)).toEqual(['MEMBER_LEFT', 'MEMBER_UPDATED'])
    expect(log.body.data[1]).toMatchObject({
      actor: { email: owner.email },
      subject: { email: staff!.email },
      changes: { role: ['USER', 'RECEPTIONIST'], added: ['revenue_view'] },
    })
  })

  it('never removes or changes the owner', async () => {
    const { owner, workspace, member: admin } = await createTenant({ memberRole: 'ADMIN' })
    const ownerRow = await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: owner.id, role: 'ADMIN' } })
    signInAs(admin!)
    expect((await deleteMember(req('DELETE'), member(workspace.id, ownerRow.id))).status).toBe(400)
    expect((await patchMember(req('PATCH', { disabled: true }), member(workspace.id, ownerRow.id))).status).toBe(400)
  })
})
