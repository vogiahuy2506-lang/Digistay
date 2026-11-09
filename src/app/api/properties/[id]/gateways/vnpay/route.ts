import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAccess } from '@/lib/auth/access'
import { connectVnpay, disconnectVnpay, getVnpayStatus, VnpayError } from '@/lib/payments/vnpay'
import { lockedResponseForProperty } from '@/lib/billing/guard'

type Props = { params: Promise<{ id: string }> }

const connectSchema = z.object({
  tmnCode: z.string().trim().min(1, 'Vui lòng nhập Terminal ID (TMN Code)'),
  hashSecret: z.string().trim().min(1, 'Vui lòng nhập Hash Secret'),
  environment: z.enum(['SANDBOX', 'PRODUCTION']).optional().default('SANDBOX'),
})

async function workspaceOf(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property?.workspaceId ?? null
}

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

/** GET — connection status of VNPay */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireAccess(workspaceId, null, { propertyId: id })
  if (!access.ok) return access.response
  return NextResponse.json({ success: true, data: await getVnpayStatus(id) })
}

/** PUT — connect or update VNPay */
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
    const status = await connectVnpay(id, parsed.data, access.userId)
    await prisma.activityLog.create({
      data: {
        userId: access.userId,
        workspaceId,
        propertyId: id,
        action: 'PAYMENT_RECEIVED',
        entityType: 'PROPERTY',
        entityId: id,
        metadata: { gateway: 'VNPAY', action: 'CONNECTED' },
      },
    })
    return NextResponse.json({ success: true, data: status, message: 'Đã kết nối Cổng VNPay thành công' })
  } catch (error) {
    if (error instanceof VnpayError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json({ success: false, error: 'Không thể kết nối Cổng VNPay' }, { status: 500 })
  }
}

/** DELETE — disconnect VNPay */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireAccess(workspaceId, 'payment_settings', { propertyId: id })
  if (!access.ok) return access.response

  await disconnectVnpay(id)
  return NextResponse.json({ success: true, message: 'Đã hủy kết nối Cổng VNPay' })
}

