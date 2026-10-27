/**
 * Who may use Digistay's operator pages (/admin) and their API
 * (/api/admin/*): users with the platform role SUPER_ADMIN (User.role, not
 * a workspace role), read from the database on every call rather than from
 * the session token, and not locked. Granting the role is SQL on purpose
 * (docs/RUNBOOK.md). Anyone else signed in gets 404, so neither the pages
 * nor their data show they exist.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'

export const ADMIN_NOT_FOUND = 'Không tìm thấy'

export interface PlatformAdmin {
  id: string
  email: string
  name: string | null
}

/** The operator behind `userId`, or null when they are not one. */
export async function platformAdmin(userId: string): Promise<PlatformAdmin | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, disabledAt: true },
  })
  if (!user || user.role !== 'SUPER_ADMIN' || user.disabledAt) return null
  return { id: user.id, email: user.email, name: user.name }
}

/** For /api/admin/* routes: 401 signed out, 404 for anyone but an operator. */
export async function requirePlatformAdmin() {
  const sess = await requireSession()
  if (!sess.ok) return sess
  const admin = await platformAdmin(sess.session.user.id)
  if (!admin) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: ADMIN_NOT_FOUND }, { status: 404 }),
    }
  }
  return { ok: true as const, admin }
}
