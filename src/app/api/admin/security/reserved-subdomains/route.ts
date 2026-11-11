import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { RESERVED_SUBDOMAINS } from '@/lib/subdomains'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const SubdomainSchema = z.object({
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/, 'Tên miền con chỉ được chứa chữ cái thường, số và dấu gạch ngang'),
  reason: z.string().trim().max(300).optional().nullable(),
})

export async function GET() {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const customList = await prisma.reservedSubdomain.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    success: true,
    data: {
      staticReserved: Array.from(RESERVED_SUBDOMAINS).sort(),
      customReserved: customList,
    },
  })
}

export async function POST(request: NextRequest) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const body = await request.json().catch(() => null)
  const parsed = SubdomainSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ' },
      { status: 400 }
    )
  }

  const { subdomain, reason } = parsed.data

  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return NextResponse.json(
      { success: false, error: `Tên miền con "${subdomain}" đã nằm trong danh sách cấm mặc định của hệ thống` },
      { status: 400 }
    )
  }

  const existing = await prisma.reservedSubdomain.findUnique({
    where: { subdomain },
  })
  if (existing) {
    return NextResponse.json(
      { success: false, error: `Tên miền con "${subdomain}" đã tồn tại trong danh sách cấm` },
      { status: 400 }
    )
  }

  const created = await prisma.reservedSubdomain.create({
    data: {
      subdomain,
      reason: reason || null,
    },
  })

  // Log activity
  try {
    await prisma.activityLog.create({
      data: {
        userId: check.admin.id,
        action: 'ADD_RESERVED_SUBDOMAIN',
        entityType: 'RESERVED_SUBDOMAIN',
        entityId: created.id,
        metadata: { subdomain, reason },
      },
    })
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ success: true, data: created })
}

