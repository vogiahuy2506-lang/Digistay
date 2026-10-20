import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { disableTwoFactor, TwoFactorError } from '@/lib/auth/two-factor'
import { LIMITS } from '@/lib/security/limits'
import { clearLimit, isBlocked, recordFailure, tooManyRequests } from '@/lib/security/rate-limit'
import { errorResponse, readCode, unauthorized } from '../respond'

/**
 * POST /api/users/me/two-factor/disable { code, password? } — turns it off.
 * Needs the password (when the account has one) and a code, so a stolen
 * session alone cannot remove it.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  const userId = session.user.id

  // Same per-user budget as other password checks (change password/email).
  const blocked = await isBlocked(LIMITS.passwordCheckUser, userId)
  if (!blocked.allowed) {
    return tooManyRequests('Bạn đã nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau.', blocked.retryAfterSec)
  }

  try {
    const { code, password } = await readCode(request)
    await disableTwoFactor(userId, { code, password })
    await clearLimit(LIMITS.passwordCheckUser, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof TwoFactorError && error.code === 'wrongPassword') {
      await recordFailure(LIMITS.passwordCheckUser, userId)
    }
    return errorResponse(error, 'disable')
  }
}
