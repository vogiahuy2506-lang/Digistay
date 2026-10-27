import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { can, checkAccess } from '@/lib/auth/access'
import { EinvoiceError } from '@/lib/einvoice/matbao'
import { createReplacementDraft } from '@/lib/einvoice/replacement'
import { lockedResponseForProperty } from '@/lib/billing/guard'

/**
 * POST /api/invoices/[id]/replace — a draft replacement for an issued
 * invoice (src/lib/einvoice/replacement.ts). invoices_manage, like publishing.
 */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ success: false, error: 'Không có quyền lập hoá đơn thay thế' }, { status: 403 })
  }
  const locked = await lockedResponseForProperty(invoice.propertyId)
  if (locked) return locked

  try {
    const draft = await createReplacementDraft(id, sess.session.user.id)
    return NextResponse.json({ success: true, data: draft, message: 'Đã tạo hoá đơn thay thế (nháp)' })
  } catch (error) {
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message, ...error.extra }, { status: error.status })
    }
    console.error('Replace invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lập hoá đơn thay thế' }, { status: 500 })
  }
}
