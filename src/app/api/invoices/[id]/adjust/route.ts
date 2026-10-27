import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { can, checkAccess } from '@/lib/auth/access'
import { EinvoiceError } from '@/lib/einvoice/matbao'
import { adjustmentInputSchema, createAdjustmentDraft } from '@/lib/einvoice/adjustment'
import { lockedResponseForProperty } from '@/lib/billing/guard'

/**
 * POST /api/invoices/[id]/adjust — a draft adjustment (increase or
 * decrease) for an issued invoice (src/lib/einvoice/adjustment.ts).
 * invoices_manage, like publishing.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const sess = await requireSession()
  if (!sess.ok) return sess.response

  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { propertyId: true, property: { select: { workspaceId: true } } } })
  if (!invoice) return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
  const granted = await checkAccess(sess.session.user.id, invoice.property.workspaceId, null, {
    propertyId: invoice.propertyId,
    notFound: 'Không tìm thấy hóa đơn',
  })
  if (!granted.ok) return granted.response
  if (!can(granted.access, 'invoices_manage', invoice.propertyId)) {
    return NextResponse.json({ success: false, error: 'Không có quyền lập hoá đơn điều chỉnh' }, { status: 403 })
  }
  const locked = await lockedResponseForProperty(invoice.propertyId)
  if (locked) return locked

  const validation = adjustmentInputSchema.safeParse(await request.json().catch(() => null))
  if (!validation.success) {
    return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
  }

  try {
    const draft = await createAdjustmentDraft(id, sess.session.user.id, validation.data)
    return NextResponse.json({ success: true, data: draft, message: 'Đã tạo hoá đơn điều chỉnh (nháp)' })
  } catch (error) {
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message, ...error.extra }, { status: error.status })
    }
    console.error('Adjust invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lập hoá đơn điều chỉnh' }, { status: 500 })
  }
}
