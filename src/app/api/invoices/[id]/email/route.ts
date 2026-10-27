import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { can, checkAccess } from '@/lib/auth/access'
import { sendInvoiceEmailFor } from '@/lib/einvoice/delivery'
import { lockedResponseForProperty } from '@/lib/billing/guard'

/**
 * POST /api/invoices/[id]/email — send the issued invoice to the buyer now
 * (again), PDF attached (src/lib/einvoice/delivery.ts). invoices_manage.
 */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const sess = await requireSession()
  if (!sess.ok) return sess.response

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true, propertyId: true, property: { select: { workspaceId: true } } },
  })
  if (!invoice) return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
  const granted = await checkAccess(sess.session.user.id, invoice.property.workspaceId, null, {
    propertyId: invoice.propertyId,
    notFound: 'Không tìm thấy hóa đơn',
  })
  if (!granted.ok) return granted.response
  if (!can(granted.access, 'invoices_manage', invoice.propertyId)) {
    return NextResponse.json({ success: false, error: 'Không có quyền gửi hoá đơn' }, { status: 403 })
  }
  const locked = await lockedResponseForProperty(invoice.propertyId)
  if (locked) return locked
  if (invoice.status !== 'PUBLISHED') {
    return NextResponse.json({ success: false, error: 'Chỉ gửi được hoá đơn đã phát hành' }, { status: 409 })
  }

  const { outcome, error } = await sendInvoiceEmailFor(id, new Date(), { again: true })
  const fresh = await prisma.invoice.findUniqueOrThrow({
    where: { id },
    select: { emailStatus: true, emailedAt: true, emailError: true, emailAttempts: true },
  })
  if (outcome === 'sent') return NextResponse.json({ success: true, data: fresh, message: 'Đã gửi hoá đơn cho người mua' })
  const message =
    outcome === 'skipped'
      ? 'Hoá đơn không có email người mua'
      : outcome === 'not-due'
        ? 'Hoá đơn đang được gửi, vui lòng đợi'
        : error ?? 'Không gửi được email'
  const status = outcome === 'not-due' ? 409 : outcome === 'skipped' ? 400 : 502
  return NextResponse.json({ success: false, error: message, data: fresh }, { status })
}
