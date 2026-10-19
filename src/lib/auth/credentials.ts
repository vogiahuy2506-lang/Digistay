/**
 * Username/email + password sign-in (the next-auth Credentials provider).
 *
 * Brute-force protection, three layers (failed attempts only, so many
 * people signing in correctly from one office IP are never blocked):
 * - per IP + login name: LIMITS.loginNameIp
 * - per IP, any name:    LIMITS.loginIp (spraying many accounts)
 * - per account:         LIMITS.accountFailures → locked for ACCOUNT_LOCK_SEC
 *
 * A locked account answers a wrong password with the usual generic error;
 * only the correct password reveals the lock. Unknown login names still run
 * a bcrypt comparison. Neither the existence nor the lock state of an
 * account can be probed without its password.
 */
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/db/redis'
import { getClientIp } from '@/lib/security/client-ip'
import { ACCOUNT_LOCK_SEC, LIMITS } from '@/lib/security/limits'
import { clearLimit, isBlocked, recordFailure } from '@/lib/security/rate-limit'

export const LOGIN_ERRORS = {
  missing: 'Vui lòng nhập tên đăng nhập và mật khẩu',
  invalid: 'Tên đăng nhập hoặc mật khẩu không chính xác',
  tooMany: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.',
  locked: 'Tài khoản tạm khoá 30 phút do đăng nhập sai nhiều lần. Bạn có thể đặt lại mật khẩu để mở khoá ngay.',
  unverified: 'Vui lòng xác thực email trước khi đăng nhập. Kiểm tra hộp thư đến của bạn.',
}

// bcrypt (cost 12) of a random string nobody knows: compared against when
// the login name does not exist, so the response takes as long as a real one.
const TIMING_EQUALIZER_HASH = '$2a$12$dYq4OnhrbQJnUjj73L17neLgVVC0FkPqULBxPuHnzOLL24Hj5EfU2'

const lockKey = (userId: string) => `auth:locked:${userId}`

async function isAccountLocked(userId: string): Promise<boolean> {
  try {
    return (await redis.get(lockKey(userId))) !== null
  } catch (error) {
    console.error('[login] lock check failed, allowing:', error)
    return false
  }
}

async function recordAccountFailure(userId: string): Promise<void> {
  const failures = await recordFailure(LIMITS.accountFailures, userId)
  if (failures < LIMITS.accountFailures.limit) return
  try {
    await redis.set(lockKey(userId), '1', 'EX', ACCOUNT_LOCK_SEC)
    await clearLimit(LIMITS.accountFailures, userId)
  } catch (error) {
    console.error('[login] could not lock account:', error)
  }
}

/** Clears the lock and failure counter, e.g. after a password reset. */
export async function unlockAccount(userId: string): Promise<void> {
  await clearLimit(LIMITS.accountFailures, userId)
  try {
    await redis.del(lockKey(userId))
  } catch (error) {
    console.error('[login] could not unlock account:', error)
  }
}

export async function authorizeWithPassword(
  credentials: Record<string, string> | undefined,
  headers: Headers | Record<string, string | string[] | undefined> | undefined
) {
  if (!credentials?.username || !credentials?.password) {
    throw new Error(LOGIN_ERRORS.missing)
  }

  const loginName = credentials.username.trim()
  const password = credentials.password
  const ip = getClientIp(headers)
  const nameIpId = `${ip}:${loginName.toLowerCase()}`

  const [byNameIp, byIp] = await Promise.all([
    isBlocked(LIMITS.loginNameIp, nameIpId),
    isBlocked(LIMITS.loginIp, ip),
  ])
  if (!byNameIp.allowed || !byIp.allowed) throw new Error(LOGIN_ERRORS.tooMany)

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: loginName }, { email: { equals: loginName, mode: 'insensitive' } }],
    },
  })

  const recordIpFailures = () =>
    Promise.all([recordFailure(LIMITS.loginNameIp, nameIpId), recordFailure(LIMITS.loginIp, ip)])

  if (!user || !user.password) {
    await bcrypt.compare(password, TIMING_EQUALIZER_HASH)
    await recordIpFailures()
    throw new Error(LOGIN_ERRORS.invalid)
  }

  const passwordOk = await bcrypt.compare(password, user.password)
  if (!passwordOk) {
    await Promise.all([recordIpFailures(), recordAccountFailure(user.id)])
    throw new Error(LOGIN_ERRORS.invalid)
  }

  // Only now, with the right password, may the caller learn about the lock.
  if (await isAccountLocked(user.id)) throw new Error(LOGIN_ERRORS.locked)

  await Promise.all([clearLimit(LIMITS.loginNameIp, nameIpId), clearLimit(LIMITS.accountFailures, user.id)])

  if (!user.emailVerified) throw new Error(LOGIN_ERRORS.unverified)

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  }
}
