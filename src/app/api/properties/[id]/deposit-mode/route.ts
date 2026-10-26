import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { depositSettingsOf } from '@/lib/payments/deposit-mode'
import { lockedResponse } from '@/lib/billing/guard'

type Props = { params: Promise<{ id: string }> }

/** mode and/or the receiving account of the manual QR; accountId null: the oldest active one. */
const settingsSchema = z
  .object({
    mode: z.enum(['MANUAL', 'PAYOS'], { errorMap: () => ({ message: 'Cách nhận cọc không hợp lệ' }) }).optional(),
    accountId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => v.mode !== undefined || v.accountId !== undefined, 'Không có gì để lưu')

async function workspaceOf(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
  return property?.workspaceId ?? null
}

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })

/**
 * GET — how guests pay the online deposit (src/lib/payments/deposit-mode.ts):
 * the hotel's choice, what applies now, and the account the manual QR names.
 * Any member: the policy page shows whether a deposit can be taken.
 */
export async function GET(_request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ALL_MEMBERS)
  if (!access.ok) return access.response
  return NextResponse.json({ success: true, data: await depositSettingsOf(id) })
}

/**
 * PUT { mode?: 'MANUAL' | 'PAYOS', accountId?: string | null } — owner/ADMIN
 * only, like PayOS and bank accounts: it decides where guests' money goes.
 * PAYOS needs a connected PayOS; the account must be one of this hotel's,
 * active, with QR.
 */
export async function PUT(request: NextRequest, props: Props) {
  const { id } = await props.params
  const workspaceId = await workspaceOf(id)
  if (!workspaceId) return NOT_FOUND()
  const access = await requireWorkspaceRole(workspaceId, WorkspaceRoles.ADMINS)
  if (!access.ok) return access.response
  const locked = await lockedResponse(workspaceId)
  if (locked) return locked

  const parsed = settingsSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { mode, accountId } = parsed.data

  if (mode === 'PAYOS') {
    const payos = await prisma.propertyPayos.findUnique({ where: { propertyId: id }, select: { webhookConfirmedAt: true } })
    if (!payos?.webhookConfirmedAt) {
      return NextResponse.json(
        { success: false, error: 'Chưa kết nối PayOS: kết nối PayOS trước khi chọn xác nhận tự động' },
        { status: 400 }
      )
    }
  }
  if (accountId) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: accountId, propertyId: id, isActive: true, qrEnabled: true },
      select: { id: true },
    })
    if (!account) {
      return NextResponse.json({ success: false, error: 'Tài khoản nhận tiền không hợp lệ' }, { status: 400 })
    }
  }

  await prisma.property.update({
    where: { id },
    data: { ...(mode !== undefined && { depositMode: mode }), ...(accountId !== undefined && { depositAccountId: accountId }) },
  })
  await prisma.activityLog.create({
    data: {
      userId: access.userId,
      workspaceId,
      propertyId: id,
      action: 'DEPOSIT_MODE_CHANGED',
      entityType: 'PROPERTY',
      entityId: id,
      changes: { ...(mode !== undefined && { mode }), ...(accountId !== undefined && { accountId }) },
    },
  })
  return NextResponse.json({ success: true, data: await depositSettingsOf(id), message: 'Đã lưu cách nhận cọc' })
}
