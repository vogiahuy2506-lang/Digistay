import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { getSubscriptionInvoicePdf, platformEinvoiceConfigured } from '@/lib/billing/einvoice'
import { MatbaoError } from '@/lib/einvoice/matbao-client'

/**
 * GET /api/workspaces/[id]/subscription/payments/[paymentId]/invoice — the
 * PDF of a plan payment's e-invoice, fetched from Digistay's Mắt Bão
 * account (src/lib/billing/einvoice.ts). Owner and admins.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await props.params
  const access = await requireWorkspaceRole(id, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response

  const invoice = await prisma.subscriptionInvoice.findFirst({ where: { paymentId, workspaceId: id } })
  if (!invoice) return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
  if (invoice.status !== 'ISSUED') return NextResponse.json({ success: false, error: 'Hoá đơn chưa phát hành' }, { status: 409 })
  if (!platformEinvoiceConfigured()) return NextResponse.json({ success: false, error: 'Digistay chưa kết nối hoá đơn điện tử' }, { status: 503 })

  try {
    const { pdf, filename } = await getSubscriptionInvoicePdf(invoice)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof MatbaoError) return NextResponse.json({ success: false, error: error.message }, { status: 502 })
    throw error
  }
}
