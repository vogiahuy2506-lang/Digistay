import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { revokeSessions } from '@/lib/auth/session-revocation'
import { confirmTwoFactorSetup, TwoFactorError } from '@/lib/auth/two-factor'
import { LIMITS } from '@/lib/security/limits'
import { clearLimit, isBlocked, recordFailure, tooManyRequests } from '@/lib/security/rate-limit'
import { errorResponse, readCode, unauthorized } from '../respond'

/**
 * POST /api/users/me/two-factor/enable { code } — turns it on and returns
 * the recovery codes (shown only now). Signs out every device, this one
 * included (decision 2026-10-20): the client sends the user to /login once
 * the codes are saved.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  const userId = session.user.id

  const blocked = await isBlocked(LIMITS.twoFactorSetupUser, userId)
  if (!blocked.allowed) {
    return tooManyRequests('Bạn đã nhập sai mã quá nhiều lần. Vui lòng thử lại sau.', blocked.retryAfterSec)
  }

  try {
    const { code } = await readCode(request)
    const recoveryCodes = await confirmTwoFactorSetup(userId, code)
    await clearLimit(LIMITS.twoFactorSetupUser, userId)
    await revokeSessions(userId)
    return NextResponse.json(
      { success: true, data: { recoveryCodes }, signedOut: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (error instanceof TwoFactorError && error.code === 'invalidCode') {
      await recordFailure(LIMITS.twoFactorSetupUser, userId)
    }
    return errorResponse(error, 'enable')
  }
}
