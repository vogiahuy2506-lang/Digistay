import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { regenerateRecoveryCodes } from '@/lib/auth/two-factor'
import { errorResponse, readCode, unauthorized } from '../respond'

/**
 * POST /api/users/me/two-factor/recovery-codes { code } — replaces every
 * recovery code. Wrong codes count toward the two-factor lock.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  try {
    const { code } = await readCode(request)
    const recoveryCodes = await regenerateRecoveryCodes(session.user.id, code)
    return NextResponse.json({ success: true, data: { recoveryCodes } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error, 'recovery codes')
  }
}
