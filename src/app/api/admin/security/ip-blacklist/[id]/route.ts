import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const { id } = await props.params
  const body = await request.json().catch(() => null)
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : undefined

  if (isActive === undefined) {
    return NextResponse.json({ success: false, error: 'Thiếu trạng thái kích hoạt' }, { status: 400 })
  }

  const updated = await prisma.ipBlacklist.update({
    where: { id },
    data: { isActive },
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const { id } = await props.params

  try {
    const deleted = await prisma.ipBlacklist.delete({
      where: { id },
    })

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: check.admin.id,
          action: 'UNBLOCK_IP',
          entityType: 'IP_BLACKLIST',
          entityId: id,
          metadata: { ipAddress: deleted.ipAddress },
        },
      })
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, message: `Đã gỡ chặn IP ${deleted.ipAddress}` })
  } catch {
    return NextResponse.json({ success: false, error: 'Không tìm thấy địa chỉ IP để gỡ chặn' }, { status: 404 })
  }
}

