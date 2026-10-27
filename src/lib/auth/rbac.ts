/**
 * The session check API routes share. Who may do what in a workspace is
 * src/lib/auth/access.ts (permissions, src/lib/auth/permissions.ts).
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Require that the current user is logged in. Returns the session on
 * success, or a 401 NextResponse on failure (so callers can `return` it
 * directly).
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      ),
    }
  }
  return { ok: true as const, session }
}
