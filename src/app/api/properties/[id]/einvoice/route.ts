import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { EinvoiceError, connectEinvoice, disconnectEinvoice, getEinvoiceStatus } from '@/lib/einvoice/matbao'
import { isVatCode } from '@/lib/einvoice/vat'

type Props = { params: Promise<{ id: string }> }

const settingsSchema = z.object({
  environment: z.enum(['DEMO', 'PRODUCTION']),
  taxCode: z.string().trim().regex(/^\d{10}(-\d{3})?$/, 'Mã số thuế gồm 10 số (hoặc 10 số-3 số)'),
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập Mắt Bão'),
  password: z.string().optional(),
  templateCode: z.string().trim().min(1, 'Vui lòng nhập mẫu số').max(6),
  series: z.string().trim().regex(/^[A-Za-z0-9]{6}$/, 'Ký hiệu gồm 6 ký tự, ví dụ C26TAA'),
  vatCode: z.number().refine(isVatCode, 'Vui lòng chọn thuế suất'),
})

async function workspaceOf(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property?.workspaceId ?? null
}

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

/** GET — the property's Mắt Bão settings (never the password). */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ALL_MEMBERS)
  if (!access.ok) return access.response
  const includeWebhookUrl = access.role === 'ADMIN'
  return NextResponse.json({ success: true, data: await getEinvoiceStatus(id, { includeWebhookUrl }) })
}

/** PUT — save and check the account. Owner/ADMIN: invoices go out under the hotel's tax code. */
export async function PUT(request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response

  const parsed = settingsSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  try {
    const { vatCode, password, ...rest } = parsed.data
    const status = await connectEinvoice(
      id,
      { ...rest, vatCode: vatCode as never, password: password || undefined },
      access.userId
    )
    await prisma.activityLog.create({
      data: {
        userId: access.userId,
        workspaceId,
        propertyId: id,
        action: 'EINVOICE_CONNECTED',
        entityType: 'PROPERTY',
        entityId: id,
        metadata: { environment: rest.environment, series: rest.series, vatCode },
      },
    })
    return NextResponse.json({ success: true, data: status, message: 'Đã kết nối Mắt Bão' })
  } catch (error) {
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[einvoice] connect failed:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi kết nối Mắt Bão' }, { status: 500 })
  }
}

/** DELETE — disconnect. Issued invoices stay on Mắt Bão. */
export async function DELETE(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response
  await disconnectEinvoice(id)
  await prisma.activityLog.create({
    data: { userId: access.userId, workspaceId, propertyId: id, action: 'EINVOICE_DISCONNECTED', entityType: 'PROPERTY', entityId: id },
  })
  return NextResponse.json({ success: true, message: 'Đã ngắt kết nối Mắt Bão' })
}
