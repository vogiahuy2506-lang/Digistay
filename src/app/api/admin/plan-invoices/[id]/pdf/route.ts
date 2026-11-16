import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { getSubscriptionInvoicePdf } from '@/lib/billing/einvoice'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response

  const { id } = await props.params
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      lookupCode: true,
      invoiceCode: true,
      einvoiceNumber: true,
    },
  })

  if (!invoice) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
  }

  if (invoice.status !== 'ISSUED') {
    return NextResponse.json({ success: false, error: 'Hóa đơn chưa được phát hành' }, { status: 400 })
  }

  try {
    const { pdf, filename } = await getSubscriptionInvoicePdf(invoice)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Download subscription invoice PDF error:', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tải file PDF từ Mắt Bão lúc này' },
      { status: 502 }
    )
  }
}
