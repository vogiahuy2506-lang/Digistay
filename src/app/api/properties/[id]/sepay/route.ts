import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { SEPAY_ENVIRONMENTS, SepayError, connectSepay, disconnectSepay, getSepayStatus } from '@/lib/payments/sepay'

type Props = { params: Promise<{ id: string }> }

const connectSchema = z.object({
  merchantId: z.string().trim().min(1, 'Vui lòng nhập Merchant ID'),
  secretKey: z.string().trim().min(1, 'Vui lòng nhập Secret key'),
  environment: z.enum(SEPAY_ENVIRONMENTS),
})

async function workspaceOf(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property?.workspaceId ?? null
}

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

/** GET — connection status (never the secret). */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ALL_MEMBERS)
  if (!access.ok) return access.response
  return NextResponse.json({ success: true, data: await getSepayStatus(id) })
}

/**
 * PUT { merchantId, secretKey, environment } — connect (or replace) the
 * property's SePay account, once SePay accepts the keys. Owner/ADMIN only:
 * it decides where guests' card payments go.
 */
export async function PUT(request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response

  const parsed = connectSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  try {
    const status = await connectSepay(id, parsed.data, access.userId)
    await prisma.activityLog.create({
      data: {
        userId: access.userId,
        workspaceId,
        propertyId: id,
        action: 'SEPAY_CONNECTED',
        entityType: 'PROPERTY',
        entityId: id,
        metadata: { environment: parsed.data.environment },
      },
    })
    return NextResponse.json({ success: true, data: status, message: 'Đã kết nối SePay' })
  } catch (error) {
    if (error instanceof SepayError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[sepay] connect failed:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi kết nối SePay' }, { status: 500 })
  }
}

/** DELETE — disconnect. Card payments still open are no longer confirmed automatically. */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response

  await disconnectSepay(id)
  await prisma.activityLog.create({
    data: { userId: access.userId, workspaceId, propertyId: id, action: 'SEPAY_DISCONNECTED', entityType: 'PROPERTY', entityId: id },
  })
  return NextResponse.json({ success: true, message: 'Đã ngắt kết nối SePay' })
}
