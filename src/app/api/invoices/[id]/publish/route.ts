import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession, getWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { EinvoiceError, publishInvoice } from '@/lib/einvoice/matbao'
import { emailAfterResponse } from '@/lib/einvoice/delivery'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/invoices/[id]/publish — issue the invoice through the
 * property's Mắt Bão account (Part 6). Staff (owner, ADMIN, MANAGER,
 * RECEPTIONIST) only: an issued invoice is a legal document. Safe to call
 * again after a failure; see src/lib/einvoice/matbao.ts.
 */
export async function POST(_request: NextRequest, props: RouteParams) {
  const { id } = await props.params
  const sess = await requireSession()
  if (!sess.ok) return sess.response

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { property: { select: { workspaceId: true } } },
  })
  const role = invoice ? await getWorkspaceRole(invoice.property.workspaceId, sess.session.user.id) : null
  if (!invoice || !role) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
  }
  if (!(WorkspaceRoles.STAFF_AND_UP as readonly string[]).includes(role)) {
    return NextResponse.json({ success: false, error: 'Không có quyền phát hành hóa đơn' }, { status: 403 })
  }

  try {
    const published = await publishInvoice(id, sess.session.user.id)
    if (published.emailStatus === 'PENDING') emailAfterResponse(id)
    return NextResponse.json({ success: true, data: published, message: 'Phát hành hóa đơn thành công' })
  } catch (error) {
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Publish invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi phát hành hóa đơn' }, { status: 500 })
  }
}
