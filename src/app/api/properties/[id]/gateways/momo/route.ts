import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAccess } from '@/lib/auth/access'
import { connectMomo, disconnectMomo, getMomoStatus, MomoError } from '@/lib/payments/momo'
import { lockedResponseForProperty } from '@/lib/billing/guard'

type Props = { params: Promise<{ id: string }> }

const connectSchema = z.object({
  partnerCode: z.string().trim().min(1, 'Vui lòng nhập Partner Code'),
  accessKey: z.string().trim().min(1, 'Vui lòng nhập Access Key'),
  secretKey: z.string().trim().min(1, 'Vui lòng nhập Secret Key'),
  environment: z.enum(['SANDBOX', 'PRODUCTION']).optional().default('SANDBOX'),
})

async function workspaceOf(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property?.workspaceId ?? null
}

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

/** GET — connection status of MoMo */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireAccess(workspaceId, null, { propertyId: id })
  if (!access.ok) return access.response
  return NextResponse.json({ success: true, data: await getMomoStatus(id) })
}

/** PUT — connect or update MoMo */
export async function PUT(request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireAccess(workspaceId, 'payment_settings', { propertyId: id })
  if (!access.ok) return access.response
  const locked = await lockedResponseForProperty(id)
  if (locked) return locked

  const parsed = connectSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  try {
    const status = await connectMomo(id, parsed.data, access.userId)
    await prisma.activityLog.create({
      data: {
        userId: access.userId,
        workspaceId,
        propertyId: id,
        action: 'PAYMENT_RECEIVED',
        entityType: 'PROPERTY',
        entityId: id,
        metadata: { gateway: 'MOMO', action: 'CONNECTED' },
      },
    })
    return NextResponse.json({ success: true, data: status, message: 'Đã kết nối Ví MoMo thành công' })
  } catch (error) {
    if (error instanceof MomoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json({ success: false, error: 'Không thể kết nối Ví MoMo' }, { status: 500 })
  }
}

/** DELETE — disconnect MoMo */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireAccess(workspaceId, 'payment_settings', { propertyId: id })
  if (!access.ok) return access.response

  await disconnectMomo(id)
  return NextResponse.json({ success: true, message: 'Đã hủy kết nối Ví MoMo' })
}

