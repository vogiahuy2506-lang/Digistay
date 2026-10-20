/**
 * Two-factor sign-in against real Postgres (Part 4f): setup, the sign-in
 * step, replay and lock, recovery codes, turning it off, and the API
 * routes. Session revocation (Redis) is mocked so tests can control it.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/auth/session-revocation', () => ({
  isSessionRevoked: vi.fn(async () => false),
  revokeSessions: vi.fn(async () => {}),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isSessionRevoked, revokeSessions } from '@/lib/auth/session-revocation'
import { createUser, resetDatabase } from '@/test/integration/fixtures'
import { timeStep, totpForStep } from './totp'
import { readChallenge } from './two-factor-challenge'
import { TWO_FACTOR_REQUIRED } from './two-factor-shared'
import {
  TwoFactorError,
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  requireSecondFactorIfEnabled,
  verifySecondFactor,
} from './two-factor'
import { authorizeWithSecondFactor, googleSignInGate } from './two-factor-login'
import { GET as statusRoute } from '@/app/api/users/me/two-factor/route'
import { POST as setupRoute } from '@/app/api/users/me/two-factor/setup/route'
import { POST as enableRoute } from '@/app/api/users/me/two-factor/enable/route'
import { POST as disableRoute } from '@/app/api/users/me/two-factor/disable/route'

const NOW = Date.now()
const STEP = timeStep(NOW)
const at = (step: number) => step * 30_000 + 1_000
const originalSecret = process.env.NEXTAUTH_SECRET

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'integration-nextauth-secret-123456'
})
beforeEach(async () => {
  await resetDatabase()
  vi.mocked(isSessionRevoked).mockResolvedValue(false)
  vi.mocked(revokeSessions).mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET
  else process.env.NEXTAUTH_SECRET = originalSecret
  await prisma.$disconnect()
})

/** A user with two-factor on; `secret` is the TOTP secret, enabled at STEP. */
async function userWithTwoFactor(password: string | null = 'correct horse') {
  const user = await createUser()
  if (password) {
    await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 4) } })
  }
  const { secret } = await beginTwoFactorSetup(user.id, user.email)
  const recoveryCodes = await confirmTwoFactorSetup(user.id, totpForStep(secret, STEP), at(STEP))
  return { user, secret, recoveryCodes }
}

async function expectTwoFactorError(promise: Promise<unknown>, code: TwoFactorError['code']) {
  const error = await promise.then(
    () => null,
    (e) => e
  )
  expect(error).toBeInstanceOf(TwoFactorError)
  expect(error.code).toBe(code)
  return error as TwoFactorError
}

describe('setup', () => {
  it('stores the secret encrypted and only turns on with a right code', async () => {
    const user = await createUser()
    const { secret, otpauthUrl, qrDataUrl } = await beginTwoFactorSetup(user.id, user.email)
    expect(otpauthUrl).toContain(`secret=${secret}`)
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true)

    const row = await prisma.userTwoFactor.findUniqueOrThrow({ where: { userId: user.id } })
    expect(row.secret.startsWith('v1.')).toBe(true)
    expect(row.secret).not.toContain(secret)
    expect(row.enabledAt).toBeNull()
    await expect(requireSecondFactorIfEnabled(user.id, 'password')).resolves.toBeUndefined()

    await expectTwoFactorError(confirmTwoFactorSetup(user.id, '000000', at(STEP)), 'invalidCode')
    const codes = await confirmTwoFactorSetup(user.id, totpForStep(secret, STEP), at(STEP))
    expect(codes).toHaveLength(8)

    const enabled = await prisma.userTwoFactor.findUniqueOrThrow({ where: { userId: user.id } })
    expect(enabled.enabledAt).not.toBeNull()
    expect(enabled.recoveryCodes).toHaveLength(8)
    expect(enabled.recoveryCodes.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true)
    expect(await getTwoFactorStatus(user.id)).toMatchObject({ enabled: true, recoveryCodesLeft: 8 })
    expect(await prisma.activityLog.count({ where: { userId: user.id, action: 'TWO_FACTOR_ENABLED' } })).toBe(1)
  })

  it('restarting a pending setup replaces the secret; an enabled one is never replaced', async () => {
    const user = await createUser()
    const first = await beginTwoFactorSetup(user.id, user.email)
    const second = await beginTwoFactorSetup(user.id, user.email)
    await expectTwoFactorError(confirmTwoFactorSetup(user.id, totpForStep(first.secret, STEP), at(STEP)), 'invalidCode')
    await confirmTwoFactorSetup(user.id, totpForStep(second.secret, STEP), at(STEP))

    await expectTwoFactorError(beginTwoFactorSetup(user.id, user.email), 'alreadyEnabled')
    await expectTwoFactorError(confirmTwoFactorSetup(user.id, totpForStep(second.secret, STEP + 1), at(STEP + 1)), 'notPending')
  })
})

describe('verifySecondFactor', () => {
  it('accepts a code once: the same code, even sent twice at once, works a single time', async () => {
    const { user, secret } = await userWithTwoFactor()
    // The step used to enable is spent already.
    await expectTwoFactorError(verifySecondFactor(user.id, totpForStep(secret, STEP), at(STEP)), 'invalidCode')

    const code = totpForStep(secret, STEP + 1)
    const results = await Promise.allSettled([
      verifySecondFactor(user.id, code, at(STEP + 1)),
      verifySecondFactor(user.id, code, at(STEP + 1)),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    await expectTwoFactorError(verifySecondFactor(user.id, code, at(STEP + 1)), 'invalidCode')
  })

  it('locks after 5 wrong codes, even for the right one, until the lock ends', async () => {
    const { user, secret } = await userWithTwoFactor()
    for (let i = 1; i <= 4; i++) {
      await expectTwoFactorError(verifySecondFactor(user.id, '000000', at(STEP + 1)), 'invalidCode')
    }
    const locked = await expectTwoFactorError(verifySecondFactor(user.id, '000000', at(STEP + 1)), 'locked')
    expect(locked.status).toBe(403)
    await expectTwoFactorError(verifySecondFactor(user.id, totpForStep(secret, STEP + 1), at(STEP + 1)), 'locked')

    const later = STEP + 32 // the lock (15 minutes) is over
    await expect(verifySecondFactor(user.id, totpForStep(secret, later), at(later))).resolves.toEqual({
      usedRecoveryCode: false,
    })
  })

  it('takes each recovery code once, even when sent twice at once', async () => {
    const { user, recoveryCodes } = await userWithTwoFactor()
    const code = recoveryCodes[0].toLowerCase()
    const results = await Promise.allSettled([
      verifySecondFactor(user.id, code, at(STEP)),
      verifySecondFactor(user.id, code, at(STEP)),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    await expectTwoFactorError(verifySecondFactor(user.id, recoveryCodes[0], at(STEP)), 'invalidCode')
    expect((await getTwoFactorStatus(user.id)).recoveryCodesLeft).toBe(7)
    expect(await prisma.activityLog.count({ where: { userId: user.id, action: 'TWO_FACTOR_RECOVERY_CODE_USED' } })).toBe(1)
  })

  it('new recovery codes replace the old ones', async () => {
    const { user, secret, recoveryCodes } = await userWithTwoFactor()
    const fresh = await regenerateRecoveryCodes(user.id, totpForStep(secret, STEP + 1), at(STEP + 1))
    await expectTwoFactorError(verifySecondFactor(user.id, recoveryCodes[1], at(STEP + 1)), 'invalidCode')
    await expect(verifySecondFactor(user.id, fresh[0], at(STEP + 1))).resolves.toEqual({ usedRecoveryCode: true })
  })
})

describe('turning it off', () => {
  it('needs the password and a code', async () => {
    const { user, secret } = await userWithTwoFactor('correct horse')
    const code = totpForStep(secret, STEP + 1)
    await expectTwoFactorError(disableTwoFactor(user.id, { code }, at(STEP + 1)), 'passwordRequired')
    await expectTwoFactorError(disableTwoFactor(user.id, { code, password: 'wrong' }, at(STEP + 1)), 'wrongPassword')
    await expectTwoFactorError(
      disableTwoFactor(user.id, { code: '000000', password: 'correct horse' }, at(STEP + 1)),
      'invalidCode'
    )
    await disableTwoFactor(user.id, { code, password: 'correct horse' }, at(STEP + 1))
    expect(await prisma.userTwoFactor.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.activityLog.count({ where: { userId: user.id, action: 'TWO_FACTOR_DISABLED' } })).toBe(1)
  })

  it('a Google-only account (no password) needs just a code', async () => {
    const { user, secret } = await userWithTwoFactor(null)
    expect((await getTwoFactorStatus(user.id)).requiresPassword).toBe(false)
    await disableTwoFactor(user.id, { code: totpForStep(secret, STEP + 1) }, at(STEP + 1))
    expect(await prisma.userTwoFactor.count()).toBe(0)
  })
})

describe('sign-in', () => {
  async function challengeFor(userId: string) {
    const error = await requireSecondFactorIfEnabled(userId, 'password').then(
      () => null,
      (e: Error) => e
    )
    expect(error?.message.startsWith(TWO_FACTOR_REQUIRED)).toBe(true)
    return error!.message.slice(TWO_FACTOR_REQUIRED.length)
  }
  const nextCode = (secret: string) => totpForStep(secret, timeStep(Date.now()) + 1)

  it('a right password gives a challenge, not a session; the code completes it', async () => {
    const { user, secret } = await userWithTwoFactor()
    const challenge = await challengeFor(user.id)
    expect(readChallenge(challenge)).toMatchObject({ userId: user.id, method: 'password' })

    await expect(authorizeWithSecondFactor({ challenge, code: '000000' })).rejects.toThrow('Mã xác thực không đúng')
    const signedIn = await authorizeWithSecondFactor({ challenge, code: nextCode(secret) })
    expect(signedIn).toMatchObject({ id: user.id, email: user.email })
  })

  it('refuses a forged, missing or revoked challenge', async () => {
    const { user, secret } = await userWithTwoFactor()
    await expect(authorizeWithSecondFactor({ challenge: 'tfc1.forged.sig', code: nextCode(secret) })).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn'
    )
    await expect(authorizeWithSecondFactor({ code: nextCode(secret) })).rejects.toThrow('Phiên đăng nhập đã hết hạn')

    const challenge = await challengeFor(user.id)
    vi.mocked(isSessionRevoked).mockResolvedValue(true) // e.g. the password changed meanwhile
    await expect(authorizeWithSecondFactor({ challenge, code: nextCode(secret) })).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn'
    )
  })

  it('Google: sends an account with two-factor on to the code step, others straight in', async () => {
    const { user } = await userWithTwoFactor(null)
    const plain = await createUser()
    await prisma.account.create({
      data: { userId: user.id, type: 'oauth', provider: 'google', providerAccountId: 'linked-sub' },
    })

    const linked = await googleSignInGate({ provider: 'google', providerAccountId: 'linked-sub' }, 'other@example.com')
    const byEmail = await googleSignInGate({ provider: 'google', providerAccountId: 'new-sub' }, user.email)
    for (const redirect of [linked, byEmail]) {
      expect(typeof redirect).toBe('string')
      const challenge = new URL(redirect as string, 'http://localhost').searchParams.get('twoFactor')
      expect(readChallenge(challenge)).toMatchObject({ userId: user.id, method: 'google' })
    }
    expect(await googleSignInGate({ provider: 'google', providerAccountId: 'x' }, plain.email)).toBe(true)
    expect(await googleSignInGate({ provider: 'google', providerAccountId: 'y' }, 'nobody@example.com')).toBe(true)
  })
})

describe('API routes', () => {
  const signInAs = (id: string) => vi.mocked(auth).mockResolvedValue({ user: { id } } as never)
  const post = (body: object) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) })

  it('refuses anonymous requests', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    expect((await statusRoute()).status).toBe(401)
    expect((await setupRoute()).status).toBe(401)
  })

  it('setup then enable returns the codes once and signs out every device', async () => {
    const user = await createUser()
    signInAs(user.id)
    const { data } = await (await setupRoute()).json()

    const wrong = await enableRoute(post({ code: '000000' }))
    expect(wrong.status).toBe(400)
    expect(revokeSessions).not.toHaveBeenCalled()

    const res = await enableRoute(post({ code: totpForStep(data.secret, timeStep(Date.now())) }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.recoveryCodes).toHaveLength(8)
    expect(body.signedOut).toBe(true)
    expect(revokeSessions).toHaveBeenCalledWith(user.id)
    expect((await (await statusRoute()).json()).data).toMatchObject({ enabled: true, recoveryCodesLeft: 8 })
  })

  it('disable answers in Vietnamese and keeps two-factor on when the password is wrong', async () => {
    const { user, secret } = await userWithTwoFactor('correct horse')
    signInAs(user.id)
    const res = await disableRoute(post({ code: totpForStep(secret, timeStep(Date.now()) + 1), password: 'nope' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Mật khẩu không đúng')
    expect(await prisma.userTwoFactor.count({ where: { userId: user.id } })).toBe(1)
  })
})
