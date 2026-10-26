import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { PLAN_IDS } from '@/lib/marketing/plans'
import { BillingError, createCheckout } from '@/lib/billing/checkout'
import { invoiceBuyerSchema, platformEinvoiceConfigured } from '@/lib/billing/einvoice'
import { paymentView } from '@/lib/billing/view'
import { appOrigin } from '@/lib/public-site/site-host'

const schema = z.object({ plan: z.enum(PLAN_IDS), billing: z.enum(['MONTH', 'YEAR']), invoice: z.unknown().optional() })

/**
 * POST /api/workspaces/[id]/subscription/checkout — a PayOS link and VietQR
 * for a plan on Digistay's account (owner and admins). Allowed while the
 * workspace is locked: paying is how it unlocks. `invoice` names the
 * e-invoice's buyer (src/lib/billing/einvoice.ts) when Digistay issues them.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await requireWorkspaceRole(id, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Gói hoặc chu kỳ thanh toán không hợp lệ' }, { status: 400 })

  let invoiceBuyer
  if (platformEinvoiceConfigured()) {
    const buyer = invoiceBuyerSchema.safeParse(parsed.data.invoice ?? { type: 'none' })
    if (!buyer.success) {
      return NextResponse.json({ success: false, error: buyer.error.issues[0]?.message ?? 'Thông tin hoá đơn không hợp lệ' }, { status: 400 })
    }
    invoiceBuyer = buyer.data
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id }, select: { slug: true } })
  try {
    const payment = await createCheckout({
      workspaceId: id,
      plan: parsed.data.plan,
      billing: parsed.data.billing,
      userId: access.userId,
      returnUrl: `${appOrigin()}/workspace/${workspace.slug}/billing`,
      invoiceBuyer,
    })
    return NextResponse.json({ success: true, data: await paymentView(payment) })
  } catch (error) {
    if (error instanceof BillingError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    throw error
  }
}
