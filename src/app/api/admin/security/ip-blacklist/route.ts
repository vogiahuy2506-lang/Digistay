import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const BlockIpSchema = z.object({
  ipAddress: z.string().trim().min(7, 'Địa chỉ IP không hợp lệ').max(45),
  reason: z.string().trim().min(3, 'Vui lòng ghi rõ lý do chặn (ít nhất 3 ký tự)').max(500),
  expiresAt: z.string().optional().nullable(),
})

export async function GET() {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const rows = await prisma.ipBlacklist.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: rows })
}

export async function POST(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = BlockIpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' },
      { status: 400 }
    )
  }

  const { ipAddress, reason, expiresAt } = parsed.data

  const row = await prisma.ipBlacklist.upsert({
    where: { ipAddress },
    create: {
      ipAddress,
      reason,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      createdById: check.admin.id,
    },
    update: {
      reason,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      attemptCount: { increment: 1 },
    },
  })

  // Log activity
  try {
    await prisma.activityLog.create({
      data: {
        userId: check.admin.id,
        action: 'BLOCK_IP',
        entityType: 'IP_BLACKLIST',
        entityId: row.id,
        metadata: { ipAddress, reason },
      },
    })
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ success: true, data: row })
}

