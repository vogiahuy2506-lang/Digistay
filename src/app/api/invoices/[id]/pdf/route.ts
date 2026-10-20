import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession, getWorkspaceRole } from '@/lib/auth/rbac'
import { EinvoiceError, getInvoicePdf } from '@/lib/einvoice/matbao'

/**
 * GET /api/invoices/[id]/pdf — the issued invoice's PDF, fetched from Mắt
 * Bão with the property's account. Members of the property's workspace.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

  try {
    const { pdf, filename } = await getInvoicePdf(id)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Invoice PDF error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tải PDF hóa đơn' }, { status: 500 })
  }
}
