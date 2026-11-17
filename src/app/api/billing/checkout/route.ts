import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createDefaultWorkspace } from '@/lib/auth/default-workspace'
import { isPlanId } from '@/lib/marketing/plans'
import { BillingError, createCheckout } from '@/lib/billing/checkout'
import { invoiceBuyerSchema, isPlatformEinvoiceReady } from '@/lib/billing/einvoice'
import { paymentView } from '@/lib/billing/view'
import { appOrigin } from '@/lib/public-site/site-host'

const schema = z.object({
  plan: z.string().trim().min(1),
  billing: z.enum(['MONTH', 'YEAR']),
  invoice: z.unknown().optional(),
  voucherCode: z.string().trim().optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }

  const userId = session.user.id
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Gói hoặc chu kỳ thanh toán không hợp lệ' }, { status: 400 })
  }

  const planId = parsed.data.plan
  if (!isPlanId(planId)) {
    const custom = await prisma.platformPlan.findUnique({ where: { id: planId }, select: { id: true, isActive: true } })
    if (!custom || !custom.isActive) {
      return NextResponse.json({ success: false, error: 'Gói dịch vụ không tồn tại hoặc đã ngừng cung cấp' }, { status: 400 })
    }
  }

  let invoiceBuyer
  if (await isPlatformEinvoiceReady()) {
    const buyer = invoiceBuyerSchema.safeParse(parsed.data.invoice ?? { type: 'none' })
    if (!buyer.success) {
      return NextResponse.json({ success: false, error: buyer.error.issues[0]?.message ?? 'Thông tin hoá đơn không hợp lệ' }, { status: 400 })
    }
    invoiceBuyer = buyer.data
  }

  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId, deletedAt: null },
    select: { id: true, slug: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!workspace) {
    const created = await createDefaultWorkspace(userId, session.user.name || session.user.email || 'Hệ thống lưu trú')
    workspace = { id: created.id, slug: created.slug }
  }

  try {
    const payment = await createCheckout({
      workspaceId: workspace.id,
      plan: parsed.data.plan,
      billing: parsed.data.billing,
      userId,
      returnUrl: `${appOrigin()}/billing/checkout`,
      invoiceBuyer,
      voucherCode: parsed.data.voucherCode,
    })
    return NextResponse.json({ success: true, data: await paymentView(payment) })
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    throw error
  }
}
