import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTwoFactorStatus } from '@/lib/auth/two-factor'
import { errorResponse, unauthorized } from './respond'

/** GET /api/users/me/two-factor — whether it is on, and how many recovery codes are left. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  try {
    return NextResponse.json({ success: true, data: await getTwoFactorStatus(session.user.id) })
  } catch (error) {
    return errorResponse(error, 'status')
  }
}
