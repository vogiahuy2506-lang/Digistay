/**
 * The sign-in side of two-factor (Part 4f): what the `two-factor` provider
 * and the Google signIn callback in ./index.ts call. See ./two-factor.ts.
 */
import { prisma } from '@/lib/db'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { isBlocked, recordFailure } from '@/lib/security/rate-limit'
import { LOGIN_ERRORS } from './credentials'
import { isSessionRevoked } from './session-revocation'
import { issueChallenge, readChallenge } from './two-factor-challenge'
import { TWO_FACTOR_ERRORS, TwoFactorError, isTwoFactorEnabled, verifySecondFactor } from './two-factor'
import { ACCOUNT_DISABLED, TWO_FACTOR_QUERY } from './two-factor-shared'

type Headers = Parameters<typeof getClientIp>[0]

/** authorize() of the `two-factor` provider: a valid challenge plus a valid code. */
export async function authorizeWithSecondFactor(
  credentials: Record<string, string> | undefined,
  headers?: Headers
) {
  const ip = getClientIp(headers)
  const blocked = await isBlocked(LIMITS.twoFactorVerifyIp, ip)
  if (!blocked.allowed) throw new Error(LOGIN_ERRORS.tooMany)

  const challenge = readChallenge(credentials?.challenge)
  // A password change (or turning two-factor on) after the challenge voids it.
  if (!challenge || (await isSessionRevoked(challenge.userId, challenge.issuedAt))) {
    throw new Error(TWO_FACTOR_ERRORS.expired)
  }

  try {
    await verifySecondFactor(challenge.userId, String(credentials?.code ?? ''))
  } catch (error) {
    if (error instanceof TwoFactorError) {
      if (error.code === 'invalidCode') await recordFailure(LIMITS.twoFactorVerifyIp, ip)
      throw new Error(error.message)
    }
    throw error
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { id: true, email: true, name: true, image: true, role: true, disabledAt: true },
  })
  if (!user) throw new Error(TWO_FACTOR_ERRORS.expired)
  // Locked after the password step: no session either.
  if (user.disabledAt) throw new Error(LOGIN_ERRORS.disabled)
  const { disabledAt: _disabledAt, ...signedIn } = user
  return signedIn
}

/**
 * Google signIn callback: true to continue, or a redirect to the code step
 * when the account behind this Google login has two-factor on. That is the
 * already linked account, or else the account with the same email, which
 * next-auth links automatically (allowDangerousEmailAccountLinking). An
 * account Digistay locked goes back to the login page, which says so.
 */
export async function googleSignInGate(
  account: { provider: string; providerAccountId: string },
  email: string | null | undefined
): Promise<true | string> {
  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
    select: { userId: true },
  })
  const userId =
    linked?.userId ??
    (email ? (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id : undefined)
  if (userId && (await prisma.user.findUnique({ where: { id: userId }, select: { disabledAt: true } }))?.disabledAt) {
    return `/login?error=${ACCOUNT_DISABLED}`
  }
  if (!userId || !(await isTwoFactorEnabled(userId))) return true
  return `/login?${TWO_FACTOR_QUERY}=${encodeURIComponent(issueChallenge(userId, 'google'))}`
}
