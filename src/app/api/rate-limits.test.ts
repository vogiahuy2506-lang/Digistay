/**
 * Route-level abuse limits (Part 4b). Routes, @/lib/auth/otp and
 * @/lib/security run for real against an in-memory Redis fake; Prisma,
 * email and the session are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

const h = vi.hoisted(() => {
  const data = new Map<string, string>()
  const redis = {
    async set(key: string, value: string, _mode?: string, _ttl?: number, flag?: string) {
      if (flag === 'NX' && data.has(key)) return null
      data.set(key, value)
      return 'OK'
    },
    async get(key: string) {
      return data.get(key) ?? null
    },
    async del(key: string) {
      return data.delete(key) ? 1 : 0
    },
    async incr(key: string) {
      const n = Number(data.get(key) ?? 0) + 1
      data.set(key, String(n))
      return n
    },
    async expire() {
      return 1
    },
    async ttl() {
      return 300
    },
  }
  return { data, redis, sent: [] as string[] }
})

vi.mock('@/lib/db/redis', () => ({ redis: h.redis }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => {
  const prisma = {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    workspace: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
    property: { findMany: vi.fn(async () => []) },
    invitation: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    activityLog: { create: vi.fn() },
    // A transaction runs on the same mocks.
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(prisma)),
  }
  return { prisma }
})
// Who may invite (src/lib/auth/access.ts) is not what this file tests: the caller owns the workspace.
vi.mock('@/lib/auth/access', () => ({
  checkAccess: vi.fn(async (userId: string) => ({
    ok: true,
    userId,
    access: { workspaceId: 'ws', userId, isOwner: true, role: 'ADMIN', customPermissions: false, permissions: new Set(), propertyIds: null },
  })),
  requireAccess: vi.fn(),
}))
vi.mock('@/lib/members/invitations', () => ({
  INVITE_DAYS: 7,
  inviteExpiry: () => new Date(Date.now() + 7 * 86_400_000),
  sendInvitationEmail: vi.fn(async () => undefined),
}))
// The plan's staff limit (src/lib/billing) is not what this file tests.
vi.mock('@/lib/billing/guard', () => ({
  planResponse: vi.fn(async () => null),
  planResponseForProperty: vi.fn(async () => null),
  lockedResponse: vi.fn(async () => null),
  lockedResponseForProperty: vi.fn(async () => null),
  onlineBookingRefusal: vi.fn(async () => null),
  ROOM_TYPE_PLAN_LOCKED: 'locked',
}))
vi.mock('@/lib/email', () => ({
  sendOtpEmail: vi.fn(async ({ recipientEmail }: { recipientEmail: string }) => {
    h.sent.push(recipientEmail)
    return { success: true }
  }),
  sendPasswordChangedEmail: vi.fn(async () => ({ success: true })),
  sendWelcomeEmail: vi.fn(async () => ({ success: true })),
  sendEmailChangeEmail: vi.fn(async ({ recipientEmail }: { recipientEmail: string }) => {
    h.sent.push(recipientEmail)
    return { success: true }
  }),
  sendWorkspaceInvite: vi.fn(async () => ({ success: true })),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { POST as sendOtp } from './auth/otp/send/route'
import { POST as verifyOtp } from './auth/otp/verify/route'
import { POST as register } from './auth/register/route'
import { POST as resetPassword } from './auth/reset-password/route'
import { PUT as changePassword } from './users/me/route'
import { POST as changeEmail } from './users/me/change-email/route'
import { POST as roomLock } from './bookings/room-lock/route'
import { POST as inviteMember } from './workspaces/[id]/invitations/route'
import { issueResetToken } from '@/lib/auth/otp'

const db = prisma as unknown as {
  user: Record<'findFirst' | 'findUnique' | 'update' | 'updateMany' | 'create', ReturnType<typeof vi.fn>>
  workspace: Record<'create' | 'findFirst' | 'findUnique', ReturnType<typeof vi.fn>>
  workspaceMember: { findFirst: ReturnType<typeof vi.fn> }
  invitation: Record<'findFirst' | 'create' | 'updateMany', ReturnType<typeof vi.fn>>
}
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>

function call(handler: (r: NextRequest) => Promise<Response>, body: unknown, ip = '198.51.100.1') {
  return handler(
    new NextRequest('http://localhost/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: JSON.stringify(body),
    })
  )
}

const KNOWN = 'known@example.com'
const CURRENT = 'current-password'
const CURRENT_HASH = bcrypt.hashSync(CURRENT, 4)

// Registration and password changes hash with bcrypt cost 12 (~1 s each).
vi.setConfig({ testTimeout: 30_000 })

beforeEach(() => {
  vi.clearAllMocks()
  h.data.clear()
  h.sent.length = 0
  db.user.findFirst.mockImplementation(async ({ where }: { where: { email?: { equals: string } } }) =>
    where.email?.equals === KNOWN ? { id: 'known-id', name: 'Known' } : null
  )
  db.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
    where.id === 'me' ? { id: 'me', email: 'me@example.com', name: 'Me', password: CURRENT_HASH } : null
  )
  db.user.update.mockResolvedValue({ email: KNOWN, name: 'Known' })
  db.user.create.mockResolvedValue({ id: 'new-id', email: 'n@example.com' })
  mockAuth.mockResolvedValue({ user: { id: 'me', email: 'me@example.com' } })
})

describe('otp/send', () => {
  it('11th request from one IP gets 429 with Retry-After; another IP is unaffected', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await call(sendOtp, { email: `a${i}@example.com`, purpose: 'register' })).status).toBe(200)
    }
    const res = await call(sendOtp, { email: 'a10@example.com', purpose: 'register' })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBeTruthy()
    expect((await call(sendOtp, { email: 'b@example.com', purpose: 'register' }, '198.51.100.2')).status).toBe(200)
  })

  it('forgot-password answers an unknown email exactly like a known one, without sending', async () => {
    const known = await call(sendOtp, { email: KNOWN, purpose: 'forgot_password' })
    const unknown = await call(sendOtp, { email: 'nobody@example.com', purpose: 'forgot_password' }, '198.51.100.3')
    expect(unknown.status).toBe(known.status)
    expect(await unknown.json()).toEqual(await known.json())
    expect(h.sent).toEqual([KNOWN])

    // The 60 s cooldown applies to both too, so a second request cannot tell them apart.
    expect((await call(sendOtp, { email: KNOWN, purpose: 'forgot_password' })).status).toBe(429)
    expect(
      (await call(sendOtp, { email: 'nobody@example.com', purpose: 'forgot_password' }, '198.51.100.3')).status
    ).toBe(429)
  })
})

describe('register', () => {
  const signup = (i: number, ip?: string) =>
    call(register, { name: 'Test User', username: `user_${i}`, email: `u${i}@example.com`, password: 'long-enough-1' }, ip)

  it('6th account from one IP within an hour gets 429', async () => {
    for (let i = 0; i < 5; i++) expect((await signup(i)).status).toBe(200)
    expect((await signup(5)).status).toBe(429)
    expect((await signup(6, '198.51.100.9')).status).toBe(200)
  })

  it('new passwords need at least 8 characters', async () => {
    const res = await call(register, { name: 'Test User', username: 'short_pw', email: 's@example.com', password: '1234567' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('8 ký tự')
  })
})

describe('code verification', () => {
  it('20 wrong codes from one IP (any emails) block the IP before checking more codes', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await call(verifyOtp, { email: `v${i}@example.com`, otp: '123456' })).status).toBe(400)
    }
    expect((await call(verifyOtp, { email: 'v99@example.com', otp: '123456' })).status).toBe(429)
    // register's verify_otp shares the same budget
    expect((await call(register, { purpose: 'verify_otp', email: 'w@example.com', otp: '123456' })).status).toBe(429)
  })
})

describe('reset-password', () => {
  it('signs out every device and lifts the account lock', async () => {
    h.data.set('auth:locked:known-id', '1')
    const resetToken = await issueResetToken('known-id')
    const res = await call(resetPassword, { resetToken, newPassword: 'brand-new-pass' })
    expect(res.status).toBe(200)
    expect(Number(h.data.get('auth:revoked_before:known-id'))).toBeGreaterThan(0)
    expect(h.data.has('auth:locked:known-id')).toBe(false)
  })

  it('rejects passwords shorter than 8 characters without burning the token', async () => {
    const resetToken = await issueResetToken('known-id')
    expect((await call(resetPassword, { resetToken, newPassword: '1234567' })).status).toBe(400)
    expect((await call(resetPassword, { resetToken, newPassword: '12345678' })).status).toBe(200)
  })
})

describe('changing password or email (current password required)', () => {
  it('5 wrong current passwords block the 6th try, shared between both endpoints', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await call(changePassword, { currentPassword: 'wrong', newPassword: 'new-password-1' })).status).toBe(400)
    }
    for (let i = 0; i < 2; i++) {
      expect((await call(changeEmail, { newEmail: 'x@example.com', password: 'wrong' })).status).toBe(400)
    }
    expect((await call(changePassword, { currentPassword: CURRENT, newPassword: 'new-password-1' })).status).toBe(429)
    expect((await call(changeEmail, { newEmail: 'x@example.com', password: CURRENT })).status).toBe(429)
  })

  it('a successful password change signs out every device, this one included', async () => {
    const res = await call(changePassword, { currentPassword: CURRENT, newPassword: 'new-password-1' })
    expect(res.status).toBe(200)
    expect((await res.json()).signedOut).toBe(true)
    expect(Number(h.data.get('auth:revoked_before:me'))).toBeGreaterThan(0)
  })

  it('new password needs at least 8 characters', async () => {
    expect((await call(changePassword, { currentPassword: CURRENT, newPassword: '1234567' })).status).toBe(400)
  })
})

describe('room-lock', () => {
  it('31st hold request from one IP within 10 minutes gets 429', async () => {
    for (let i = 0; i < 30; i++) expect((await call(roomLock, {})).status).toBe(400) // invalid body, still counted
    expect((await call(roomLock, {})).status).toBe(429)
  })
})

describe("mail to any address through Digistay's server", () => {
  const invite = (email: string) =>
    call((r) => inviteMember(r, { params: Promise.resolve({ id: 'ws' }) }), { email, role: 'USER' })

  it('31st invitation from one user within an hour gets 429 before anything is written', async () => {
    db.workspace.findFirst.mockResolvedValue({ id: 'ws' })
    db.workspace.findUnique.mockResolvedValue({ ownerId: 'me' })
    db.workspaceMember.findFirst.mockResolvedValue(null)
    db.invitation.findFirst.mockResolvedValue(null)
    db.invitation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      id: 'inv',
      workspace: { name: 'W' },
      sender: { name: 'Me', email: 'me@example.com' },
      recipient: null,
    }))

    for (let i = 0; i < 30; i++) expect((await invite(`guest${i}@example.com`)).status).toBe(200)
    expect((await invite('guest30@example.com')).status).toBe(429)
    expect(db.invitation.create).toHaveBeenCalledTimes(30)
  })

  it('6th email-change request within an hour gets 429 and sends nothing', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await call(changeEmail, { newEmail: `new${i}@example.com`, password: CURRENT })).status).toBe(200)
    }
    expect((await call(changeEmail, { newEmail: 'new5@example.com', password: CURRENT })).status).toBe(429)
    expect(h.sent).toHaveLength(5)
  })
})
