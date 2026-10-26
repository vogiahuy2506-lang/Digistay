import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { guestsBooked, livePropertyForOwner } from '@/lib/deletion/deletion'
import { RESTORE_DAYS } from '@/lib/deletion/rules'

/**
 * GET /api/properties/[id]/deletion — what deleting the property involves,
 * for the owner's confirm dialog (the "Vùng nguy hiểm" card shows only when
 * this answers): the name to type, the guests booked (who stop it), the
 * e-invoices issued (to download before the purge) and the days to restore.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
  }
  const found = await livePropertyForOwner(id, session.user.id)
  if (!found.ok) {
    return found.status === 404
      ? NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 404 })
      : NextResponse.json({ success: false, error: 'Chỉ chủ sở hữu workspace mới có thể xoá cơ sở' }, { status: 403 })
  }

  const [booked, issuedInvoices] = await Promise.all([
    guestsBooked(prisma, { propertyId: id }),
    prisma.invoice.count({ where: { propertyId: id, publishedAt: { not: null } } }),
  ])
  return NextResponse.json({
    success: true,
    data: { name: found.row.name, booked, issuedInvoices, restoreDays: RESTORE_DAYS },
  })
}
