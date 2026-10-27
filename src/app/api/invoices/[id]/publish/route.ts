import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { can, checkAccess } from '@/lib/auth/access'
import { EinvoiceError, publishInvoice } from '@/lib/einvoice/matbao'
import { emailAfterResponse } from '@/lib/einvoice/delivery'
import { lockedResponseForProperty } from '@/lib/billing/guard'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/invoices/[id]/publish — issue the invoice through the
 * property's Mắt Bão account (Part 6). Only who may issue invoices at the
 * property (invoices_manage): an issued invoice is a legal document. Safe
 * to call again after a failure; see src/lib/einvoice/matbao.ts.
 */
export async function POST(_request: NextRequest, props: RouteParams) {
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
  const granted = await checkAccess(sess.session.user.id, invoice.property.workspaceId, null, {
    propertyId: invoice.propertyId,
    notFound: 'Không tìm thấy hóa đơn',
  })
  if (!granted.ok) return granted.response
  if (!can(granted.access, 'invoices_manage', invoice.propertyId)) {
    return NextResponse.json({ success: false, error: 'Không có quyền phát hành hóa đơn' }, { status: 403 })
  }
  const locked = await lockedResponseForProperty(invoice.propertyId)
  if (locked) return locked

  try {
    const published = await publishInvoice(id, sess.session.user.id)
    if (published.emailStatus === 'PENDING') emailAfterResponse(id)
    return NextResponse.json({ success: true, data: published, message: 'Phát hành hóa đơn thành công' })
  } catch (error) {
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message, ...error.extra }, { status: error.status })
    }
    console.error('Publish invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi phát hành hóa đơn' }, { status: 500 })
  }
}
