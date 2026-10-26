import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { isPlatformAdmin } from '@/lib/ops/system-status'
import { issueSubscriptionInvoice, sendSubscriptionInvoiceEmail } from '@/lib/billing/einvoice'

const schema = z.object({ action: z.enum(['retry', 'resend']) })

/**
 * POST /api/admin/plan-invoices/[id] — what the system page can do about a
 * plan e-invoice (src/lib/billing/einvoice.ts): `retry` issues a failed one
 * now (then emails it), `resend` emails an issued one again. SUPER_ADMIN
 * only; anyone else gets 404 like the page's data.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const sess = await requireSession()
  if (!sess.ok) return sess.response
  if (!(await isPlatformAdmin(sess.session.user.id))) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy' }, { status: 404 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Thao tác không hợp lệ' }, { status: 400 })
  if (!(await prisma.subscriptionInvoice.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
  }

  if (parsed.data.action === 'retry') {
    const issued = await issueSubscriptionInvoice(id, new Date(), { force: true })
    if (issued.outcome === 'issued') await sendSubscriptionInvoiceEmail(id)
    if (issued.outcome === 'failed') return NextResponse.json({ success: false, error: issued.error }, { status: 502 })
    return NextResponse.json({ success: true, data: { outcome: issued.outcome } })
  }
  const sent = await sendSubscriptionInvoiceEmail(id, new Date(), { again: true })
  if (sent.outcome === 'failed') return NextResponse.json({ success: false, error: sent.error }, { status: 502 })
  return NextResponse.json({ success: true, data: { outcome: sent.outcome } })
}
