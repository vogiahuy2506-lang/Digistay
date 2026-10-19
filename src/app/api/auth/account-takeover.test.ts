/**
 * Regression tests for the account-takeover fixes in the auth routes.
 * Routes and @/lib/auth/otp run for real against an in-memory Redis fake;
 * Prisma and outgoing email are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const data = new Map<string, string>()
  const redis = {
    async set(key: string, value: string, _mode: string, _ttl: number, flag?: string) {
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
  }
  return { data, redis, sentCodes: [] as string[] }
})

vi.mock('@/lib/db/redis', () => ({ redis: h.redis }))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    workspace: { create: vi.fn() },
  },
}))

vi.mock('@/lib/email', () => ({
  sendOtpEmail: vi.fn(async ({ otp }: { otp: string }) => {
    h.sentCodes.push(otp)
    return { success: true }
  }),
  sendPasswordChangedEmail: vi.fn(async () => ({ success: true })),
  sendWelcomeEmail: vi.fn(async () => ({ success: true })),
}))

import { prisma } from '@/lib/db'
import { POST as sendOtp } from './otp/send/route'
import { POST as verifyOtp } from './otp/verify/route'
import { POST as resetPassword } from './reset-password/route'
import { POST as register } from './register/route'
import { POST as resendVerification } from './resend-verification/route'
import { authOptions } from '@/lib/auth'

const db = prisma as unknown as {
  user: Record<'findUnique' | 'findFirst' | 'update' | 'updateMany' | 'create', ReturnType<typeof vi.fn>>
  workspace: { create: ReturnType<typeof vi.fn> }
}

function call(handler: (r: NextRequest) => Promise<Response>, body: unknown) {
  return handler(
    new NextRequest('http://localhost/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

const VICTIM = { id: 'victim-id', email: 'victim@example.com', name: 'Victim' }
const lastCode = () => h.sentCodes[h.sentCodes.length - 1]

beforeEach(() => {
  vi.clearAllMocks()
  h.data.clear()
  h.sentCodes.length = 0
  db.user.findUnique.mockImplementation(async ({ where }: { where: { email?: string } }) =>
    where.email === VICTIM.email ? VICTIM : null
  )
  db.user.findFirst.mockImplementation(async ({ where }: { where: { email: { equals: string } } }) =>
    where.email.equals === VICTIM.email ? { id: VICTIM.id } : null
  )
  db.user.update.mockImplementation(async () => VICTIM)
  db.user.updateMany.mockResolvedValue({ count: 1 })
})

describe('1. reset-password needs proof, not just an email', () => {
  it('the old payload { email, newPassword } is refused and nothing is written', async () => {
    const res = await call(resetPassword, { email: VICTIM.email, newPassword: 'attacker-pass' })
    expect(res.status).toBe(400)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('an invented token is refused', async () => {
    const res = await call(resetPassword, { resetToken: 'made-up', newPassword: 'attacker-pass' })
    expect(res.status).toBe(400)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('full flow: code → resetToken → password changed for that user, token works once', async () => {
    expect((await call(sendOtp, { email: VICTIM.email, purpose: 'forgot_password' })).status).toBe(200)
    const verified = await (await call(verifyOtp, { email: VICTIM.email, otp: lastCode() })).json()
    expect(verified.success).toBe(true)
    expect(typeof verified.resetToken).toBe('string')

    const ok = await call(resetPassword, { resetToken: verified.resetToken, newPassword: 'new-secret-1' })
    expect(ok.status).toBe(200)
    expect(db.user.update).toHaveBeenCalledTimes(1)
    expect(db.user.update.mock.calls[0][0].where).toEqual({ id: VICTIM.id })

    const again = await call(resetPassword, { resetToken: verified.resetToken, newPassword: 'new-secret-2' })
    expect(again.status).toBe(400)
    expect(db.user.update).toHaveBeenCalledTimes(1)
  })

  it('a too-short password does not burn the token', async () => {
    await call(sendOtp, { email: VICTIM.email, purpose: 'forgot_password' })
    const { resetToken } = await (await call(verifyOtp, { email: VICTIM.email, otp: lastCode() })).json()
    expect((await call(resetPassword, { resetToken, newPassword: '123' })).status).toBe(400)
    expect((await call(resetPassword, { resetToken, newPassword: 'long-enough' })).status).toBe(200)
  })
})

describe('2. the session email cannot be set by the client', () => {
  it('update() reloads name/email/image from the database and ignores the body', async () => {
    db.user.findUnique.mockResolvedValueOnce({ name: 'Me', email: 'me@example.com', image: null })
    const jwt = authOptions.callbacks!.jwt!
    const token = await jwt({
      token: { id: 'me-id', email: 'me@example.com' },
      trigger: 'update',
      session: { email: 'guest-of-someone-else@example.com', name: 'x' },
    } as never)
    expect(token.email).toBe('me@example.com')
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'me-id' },
      select: { name: true, email: true, image: true },
    })
  })
})

describe('3. signup verification is bound to the email the code was sent to', () => {
  it('a code for my own email cannot verify another account through userId', async () => {
    await call(resendVerification, { email: 'attacker@example.com' }) // unknown user → no code
    db.user.findUnique.mockResolvedValueOnce({ id: 'attacker-id', email: 'attacker@example.com', emailVerified: null })
    await call(resendVerification, { email: 'attacker@example.com' })
    const code = lastCode()

    const res = await call(register, {
      purpose: 'verify_otp',
      email: 'attacker@example.com',
      otp: code,
      userId: VICTIM.id,
    })

    expect(res.status).toBe(200)
    expect(db.user.update).not.toHaveBeenCalled()
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { email: { equals: 'attacker@example.com', mode: 'insensitive' }, emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    })
  })
})

describe('4. codes never reach the logs', () => {
  let logged: string[]
  beforeEach(() => {
    logged = []
    for (const m of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '))
      })
    }
  })
  afterEach(() => vi.restoreAllMocks())

  it('otp/send, register and resend-verification do not log the code', async () => {
    await call(sendOtp, { email: VICTIM.email, purpose: 'forgot_password' })
    db.user.findUnique.mockResolvedValueOnce({ id: 'u2', email: 'new@example.com', emailVerified: null })
    await call(resendVerification, { email: 'new@example.com' })
    expect(h.sentCodes).toHaveLength(2)
    for (const code of h.sentCodes) {
      expect(logged.join('\n')).not.toContain(code)
    }
  })
})

describe('5. codes are bound to their purpose and limited in attempts', () => {
  it('a signup code cannot be exchanged for a reset token', async () => {
    db.user.findUnique.mockResolvedValueOnce(null) // otp/send register: email not taken
    await call(sendOtp, { email: VICTIM.email, purpose: 'register' })
    const res = await call(verifyOtp, { email: VICTIM.email, otp: lastCode() })
    expect(res.status).toBe(400)
    expect((await res.json()).resetToken).toBeUndefined()
  })

  it('after 5 wrong guesses the right code is refused with 429', async () => {
    await call(sendOtp, { email: VICTIM.email, purpose: 'forgot_password' })
    const code = lastCode()
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) {
      expect((await call(verifyOtp, { email: VICTIM.email, otp: wrong })).status).toBe(400)
    }
    expect((await call(verifyOtp, { email: VICTIM.email, otp: code })).status).toBe(429)
  })

  it('unknown purposes are rejected', async () => {
    expect((await call(sendOtp, { email: VICTIM.email, purpose: 'login' })).status).toBe(400)
  })

  it('a second code within 60 seconds gets 429', async () => {
    expect((await call(sendOtp, { email: VICTIM.email, purpose: 'forgot_password' })).status).toBe(200)
    expect((await call(sendOtp, { email: VICTIM.email, purpose: 'forgot_password' })).status).toBe(429)
  })
})
