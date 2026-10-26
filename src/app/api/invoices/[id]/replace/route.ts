import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession, getWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { EinvoiceError } from '@/lib/einvoice/matbao'
import { createReplacementDraft } from '@/lib/einvoice/replacement'
import { lockedResponse } from '@/lib/billing/guard'

/**
 * POST /api/invoices/[id]/replace — a draft replacement for an issued
 * invoice (src/lib/einvoice/replacement.ts). Staff only, like publishing.
 */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const sess = await requireSession()
  if (!sess.ok) return sess.response

  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { property: { select: { workspaceId: true } } } })
  const role = invoice ? await getWorkspaceRole(invoice.property.workspaceId, sess.session.user.id) : null
  if (!invoice || !role) return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
  if (!(WorkspaceRoles.STAFF_AND_UP as readonly string[]).includes(role)) {
    return NextResponse.json({ success: false, error: 'Không có quyền lập hoá đơn thay thế' }, { status: 403 })
  }
  const locked = await lockedResponse(invoice.property.workspaceId)
  if (locked) return locked

  try {
    const draft = await createReplacementDraft(id, sess.session.user.id)
    return NextResponse.json({ success: true, data: draft, message: 'Đã tạo hoá đơn thay thế (nháp)' })
  } catch (error) {
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Replace invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lập hoá đơn thay thế' }, { status: 500 })
  }
}
