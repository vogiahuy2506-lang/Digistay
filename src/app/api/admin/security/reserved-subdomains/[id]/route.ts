import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const check = await requirePlatformAdmin()
  if (!check.ok) return check.response

  const { id } = await props.params

  try {
    const deleted = await prisma.reservedSubdomain.delete({
      where: { id },
    })

    try {
      await prisma.activityLog.create({
        data: {
          userId: check.admin.id,
          action: 'REMOVE_RESERVED_SUBDOMAIN',
          entityType: 'RESERVED_SUBDOMAIN',
          entityId: id,
          metadata: { subdomain: deleted.subdomain },
        },
      })
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      message: `Đã xóa tên miền "${deleted.subdomain}" khỏi danh sách cấm`,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Không tìm thấy tên miền cấm để xóa' },
      { status: 404 }
    )
  }
}

