import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { NO_PERMISSION, requireAccess } from '@/lib/auth/access'

/**
 * POST /api/workspaces/[id]/subscription/welcome — the owner has seen the
 * free trial's welcome (src/components/billing/trial-welcome.tsx): it does
 * not show again, on any device.
 */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const granted = await requireAccess(id, null)
  if (!granted.ok) return granted.response
  if (!granted.access.isOwner) return NextResponse.json({ success: false, error: NO_PERMISSION }, { status: 403 })

  await prisma.subscription.updateMany({ where: { workspaceId: id, trialWelcomedAt: null }, data: { trialWelcomedAt: new Date() } })
  return NextResponse.json({ success: true })
}
