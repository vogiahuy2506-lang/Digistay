import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAccess } from '@/lib/auth/access'
import { connectSepay, disconnectSepay, getSepayStatus, SepayError } from '@/lib/payments/sepay'
import { lockedResponseForProperty } from '@/lib/billing/guard'

type Props = { params: Promise<{ id: string }> }

const connectSchema = z.object({
  apiKey: z.string().trim().min(1, 'Vui lòng nhập SePay API Key'),
  webhookToken: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  bankCode: z.string().trim().optional(),
})

async function workspaceOf(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property?.workspaceId ?? null
}

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

/** GET — connection status of SePay */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireAccess(workspaceId, null, { propertyId: id })
  if (!access.ok) return access.response
  return NextResponse.json({ success: true, data: await getSepayStatus(id) })
}

/** PUT — connect or update SePay */
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
    const status = await connectSepay(id, parsed.data, access.userId)
    await prisma.activityLog.create({
      data: {
        userId: access.userId,
        workspaceId,
        propertyId: id,
        action: 'PAYMENT_RECEIVED',
        entityType: 'PROPERTY',
        entityId: id,
        metadata: { gateway: 'SEPAY', action: 'CONNECTED' },
      },
    })
    return NextResponse.json({ success: true, data: status, message: 'Đã kết nối SePay thành công' })
  } catch (error) {
    if (error instanceof SepayError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json({ success: false, error: 'Không thể kết nối SePay' }, { status: 500 })
  }
}

/** DELETE — disconnect SePay */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireAccess(workspaceId, 'payment_settings', { propertyId: id })
  if (!access.ok) return access.response

  await disconnectSepay(id)
  return NextResponse.json({ success: true, message: 'Đã hủy kết nối SePay' })
}

