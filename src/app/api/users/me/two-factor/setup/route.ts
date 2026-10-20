import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { beginTwoFactorSetup } from '@/lib/auth/two-factor'
import { errorResponse, unauthorized } from '../respond'

/**
 * POST /api/users/me/two-factor/setup — a new secret and its QR code. Not
 * active until confirmed with POST .../enable.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, username: true },
    })
    if (!user) return unauthorized()
    const data = await beginTwoFactorSetup(session.user.id, user.email || user.username || session.user.id)
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error, 'setup')
  }
}
