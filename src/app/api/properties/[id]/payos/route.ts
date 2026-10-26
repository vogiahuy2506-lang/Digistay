import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { PayosError, connectPayos, disconnectPayos, getPayosStatus } from '@/lib/payments/payos'
import { lockedResponse } from '@/lib/billing/guard'

type Props = { params: Promise<{ id: string }> }

const connectSchema = z.object({
  clientId: z.string().trim().min(1, 'Vui lòng nhập Client ID'),
  apiKey: z.string().trim().min(1, 'Vui lòng nhập API Key'),
  checksumKey: z.string().trim().min(1, 'Vui lòng nhập Checksum Key'),
})

async function workspaceOf(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property?.workspaceId ?? null
}

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

/** GET — connection status (never the keys). Staff see it to offer PayOS. */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ALL_MEMBERS)
  if (!access.ok) return access.response
  return NextResponse.json({ success: true, data: await getPayosStatus(id) })
}

/**
 * PUT { clientId, apiKey, checksumKey } — connect (or replace) the
 * property's PayOS account. Owner/ADMIN only: it decides where guests'
 * money goes.
 */
export async function PUT(request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response
  const locked = await lockedResponse(workspaceId)
  if (locked) return locked

  const parsed = connectSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  try {
    const status = await connectPayos(id, parsed.data, access.userId)
    await prisma.activityLog.create({
      data: { userId: access.userId, workspaceId, propertyId: id, action: 'PAYOS_CONNECTED', entityType: 'PROPERTY', entityId: id },
    })
    return NextResponse.json({ success: true, data: status, message: 'Đã kết nối PayOS' })
  } catch (error) {
    if (error instanceof PayosError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[payos] connect failed:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi kết nối PayOS' }, { status: 500 })
  }
}

/** DELETE — disconnect. Links already sent stop being confirmed automatically. */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response
  const locked = await lockedResponse(workspaceId)
  if (locked) return locked

  await disconnectPayos(id)
  await prisma.activityLog.create({
    data: { userId: access.userId, workspaceId, propertyId: id, action: 'PAYOS_DISCONNECTED', entityType: 'PROPERTY', entityId: id },
  })
  return NextResponse.json({ success: true, message: 'Đã ngắt kết nối PayOS' })
}
