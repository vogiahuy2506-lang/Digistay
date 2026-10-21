/**
 * Optional two-factor sign-in with an authenticator app (Part 4f). Users
 * turn it on themselves from their profile; it is never required.
 *
 * - Setup writes a pending row (enabledAt null) and only takes effect once
 *   the user enters a code from the app, so a bad scan cannot lock anyone out.
 * - Turning it on signs out every device, this one included, like a
 *   password change (decision 2026-10-20): it is often turned on after a
 *   suspected leak.
 * - At sign-in, a right password (or Google) with two-factor on creates no
 *   session: it hands out a challenge (two-factor-challenge.ts) and the
 *   `two-factor` provider signs in only with a valid code.
 * - TOTP codes cannot be reused (lastUsedStep); recovery codes work once.
 *   TOTP_LOCK_AFTER wrong codes lock the second factor for a while; the
 *   counter lives in Postgres, so it holds without Redis.
 * - Lost phone and lost recovery codes: an operator resets it after checking
 *   who is asking (docs/RUNBOOK.md, "Đặt lại xác thực hai lớp"). There is
 *   deliberately no reset by email: email is what attackers take over first.
 */
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, secretContext } from '@/lib/security/secret-box'
import { TWO_FACTOR_LOCK_AFTER, TWO_FACTOR_LOCK_SEC } from '@/lib/security/limits'
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from './recovery-codes'
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp'
import { issueChallenge, type ChallengeMethod } from './two-factor-challenge'
import { TWO_FACTOR_REQUIRED } from './two-factor-shared'
import { TWO_FACTOR_ERRORS } from './error-messages'

const ISSUER = 'Digistay'

// Shown translated on the login page (error-messages.ts, AUTH_ERROR_KEYS).
export { TWO_FACTOR_ERRORS }

export class TwoFactorError extends Error {
  constructor(
    public readonly code: keyof typeof TWO_FACTOR_ERRORS,
    public readonly status: number,
    public readonly retryAfterSec?: number
  ) {
    super(TWO_FACTOR_ERRORS[code])
    this.name = 'TwoFactorError'
  }
}

const secretCtx = (userId: string) => secretContext('user_two_factor', userId, 'secret')

function hashCodes(codes: string[]): string[] {
  return codes.map((code) => hashRecoveryCode(normalizeRecoveryCode(code)!))
}

async function logActivity(userId: string, action: string, metadata?: Prisma.InputJsonObject) {
  await prisma.activityLog.create({
    data: { userId, action, entityType: 'USER', entityId: userId, metadata },
  })
}

export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  const row = await prisma.userTwoFactor.findUnique({ where: { userId }, select: { enabledAt: true } })
  return Boolean(row?.enabledAt)
}

export async function getTwoFactorStatus(userId: string) {
  const [row, user] = await Promise.all([
    prisma.userTwoFactor.findUnique({ where: { userId }, select: { enabledAt: true, recoveryCodes: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { password: true } }),
  ])
  const enabledAt = row?.enabledAt ?? null
  return {
    enabled: enabledAt !== null,
    enabledAt,
    recoveryCodesLeft: enabledAt ? row!.recoveryCodes.length : 0,
    /** Google-only accounts have no password to ask for. */
    requiresPassword: Boolean(user?.password),
  }
}

/** Starts (or restarts) setup with a new secret; never touches an enabled row. */
export async function beginTwoFactorSetup(userId: string, accountLabel: string) {
  const secret = generateTotpSecret()
  const data = {
    secret: encryptSecret(secret, secretCtx(userId)),
    enabledAt: null,
    recoveryCodes: [],
    lastUsedStep: null,
    failedAttempts: 0,
    lockedUntil: null,
  }
  const restarted = await prisma.userTwoFactor.updateMany({ where: { userId, enabledAt: null }, data })
  if (restarted.count === 0) {
    try {
      await prisma.userTwoFactor.create({ data: { userId, ...data } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new TwoFactorError('alreadyEnabled', 409)
      }
      throw error
    }
  }
  const url = otpauthUrl({ issuer: ISSUER, account: accountLabel, secret })
  return { secret, otpauthUrl: url, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 240 }) }
}

/**
 * Confirms setup with a code from the app. Returns the recovery codes, the
 * only time they are ever shown. The caller signs out every session.
 */
export async function confirmTwoFactorSetup(userId: string, code: string, now = Date.now()): Promise<string[]> {
  const row = await prisma.userTwoFactor.findUnique({ where: { userId } })
  if (!row || row.enabledAt) throw new TwoFactorError('notPending', 400)

  const check = verifyTotp(decryptSecret(row.secret, secretCtx(userId)), code.trim(), { timestampMs: now })
  if (!check.ok) throw new TwoFactorError('invalidCode', 400)

  const recoveryCodes = generateRecoveryCodes()
  // Same secret as checked: a setup restarted meanwhile must not be enabled.
  const enabled = await prisma.userTwoFactor.updateMany({
    where: { userId, enabledAt: null, secret: row.secret },
    data: { enabledAt: new Date(now), recoveryCodes: hashCodes(recoveryCodes), lastUsedStep: check.step },
  })
  if (enabled.count === 0) throw new TwoFactorError('notPending', 400)
  await logActivity(userId, 'TWO_FACTOR_ENABLED')
  return recoveryCodes
}

async function registerFailure(userId: string, now: number): Promise<never> {
  const { failedAttempts } = await prisma.userTwoFactor.update({
    where: { userId },
    data: { failedAttempts: { increment: 1 } },
    select: { failedAttempts: true },
  })
  if (failedAttempts >= TWO_FACTOR_LOCK_AFTER) {
    await prisma.userTwoFactor.update({
      where: { userId },
      data: { failedAttempts: 0, lockedUntil: new Date(now + TWO_FACTOR_LOCK_SEC * 1000) },
    })
    throw new TwoFactorError('locked', 403, TWO_FACTOR_LOCK_SEC)
  }
  throw new TwoFactorError('invalidCode', 401)
}

/**
 * Checks a code from the app or a recovery code for a user with two-factor
 * on. Throws TwoFactorError (invalidCode 401, locked 403) otherwise. Every
 * wrong code counts toward the lock, whichever page it came from.
 */
export async function verifySecondFactor(
  userId: string,
  code: string,
  now = Date.now()
): Promise<{ usedRecoveryCode: boolean }> {
  const row = await prisma.userTwoFactor.findUnique({ where: { userId } })
  if (!row?.enabledAt) throw new TwoFactorError('invalidCode', 401)
  if (row.lockedUntil && row.lockedUntil.getTime() > now) {
    throw new TwoFactorError('locked', 403, Math.ceil((row.lockedUntil.getTime() - now) / 1000))
  }

  const input = code.trim()
  const recovery = normalizeRecoveryCode(input)
  if (recovery) {
    const hash = hashRecoveryCode(recovery)
    // Atomic: two requests with the same code cannot both remove it.
    const used = await prisma.$executeRaw`
      UPDATE "user_two_factor"
      SET "recoveryCodes" = array_remove("recoveryCodes", ${hash}),
          "failedAttempts" = 0, "lockedUntil" = NULL, "updatedAt" = NOW()
      WHERE "userId" = ${userId} AND ${hash} = ANY("recoveryCodes")`
    if (used !== 1) return registerFailure(userId, now)
    await logActivity(userId, 'TWO_FACTOR_RECOVERY_CODE_USED', {
      recoveryCodesLeft: row.recoveryCodes.length - 1,
    })
    return { usedRecoveryCode: true }
  }

  const check = verifyTotp(decryptSecret(row.secret, secretCtx(userId)), input, {
    timestampMs: now,
    lastUsedStep: row.lastUsedStep,
  })
  if (!check.ok) return registerFailure(userId, now)
  // Atomic too: the same code sent twice at once is accepted once.
  const step = check.step!
  const marked = await prisma.userTwoFactor.updateMany({
    where: { userId, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
    data: { lastUsedStep: step, failedAttempts: 0, lockedUntil: null },
  })
  if (marked.count !== 1) return registerFailure(userId, now)
  return { usedRecoveryCode: false }
}

/** Turns it off: the password (if the account has one) and a code. */
export async function disableTwoFactor(
  userId: string,
  { code, password }: { code: string; password?: string },
  now = Date.now()
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } })
  if (user?.password) {
    if (!password) throw new TwoFactorError('passwordRequired', 400)
    if (!(await bcrypt.compare(password, user.password))) throw new TwoFactorError('wrongPassword', 400)
  }
  await verifySecondFactor(userId, code, now)
  await prisma.userTwoFactor.deleteMany({ where: { userId } })
  await logActivity(userId, 'TWO_FACTOR_DISABLED')
}

/** Replaces every recovery code; needs a valid code. */
export async function regenerateRecoveryCodes(userId: string, code: string, now = Date.now()): Promise<string[]> {
  await verifySecondFactor(userId, code, now)
  const recoveryCodes = generateRecoveryCodes()
  await prisma.userTwoFactor.update({ where: { userId }, data: { recoveryCodes: hashCodes(recoveryCodes) } })
  await logActivity(userId, 'TWO_FACTOR_RECOVERY_CODES_REGENERATED')
  return recoveryCodes
}

/**
 * Called once the first factor is right. With two-factor on, refuses the
 * sign-in and carries a challenge in the error, which next-auth hands to
 * the login page as `error` (see two-factor-shared.ts).
 */
export async function requireSecondFactorIfEnabled(userId: string, method: ChallengeMethod): Promise<void> {
  if (await isTwoFactorEnabled(userId)) {
    throw new Error(`${TWO_FACTOR_REQUIRED}${issueChallenge(userId, method)}`)
  }
}
