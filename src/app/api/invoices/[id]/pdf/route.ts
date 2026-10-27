import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { checkAccess } from '@/lib/auth/access'
import { EinvoiceError, getInvoicePdf } from '@/lib/einvoice/matbao'

/**
 * GET /api/invoices/[id]/pdf — the issued invoice's PDF, fetched from Mắt
 * Bão with the property's account. Who sees the property's bookings
 * (bookings_view): an invoice is part of its booking's record.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const sess = await requireSession()
  if (!sess.ok) return sess.response

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { propertyId: true, property: { select: { workspaceId: true } } },
  })
  if (!invoice) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
  }
  const granted = await checkAccess(sess.session.user.id, invoice.property.workspaceId, 'bookings_view', {
    propertyId: invoice.propertyId,
    notFound: 'Không tìm thấy hóa đơn',
  })
  if (!granted.ok) return granted.response

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
