import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { dayParam } from '@/lib/api/list-params'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const MAX_DAYS = 62

/**
 * GET /api/properties/[id]/timeline?from=yyyy-mm-dd&days=14 — the room
 * timeline (task 25): every room type with its rooms, the stays touching
 * those Vietnam days (cancelled and no-shows left out) with the room they
 * are in, and maintenance / blocks. Front desk and up.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const property = await prisma.property.findUnique({ where: { id }, select: { workspaceId: true } })
  if (!property) return NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })
  const access = await requireWorkspaceRole(property.workspaceId, WorkspaceRoles.STAFF_AND_UP)
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
  const from = dayParam(searchParams.get('from') ?? today, 'from')
  const days = Number(searchParams.get('days') ?? 14)
  if (!from || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json({ success: false, error: 'Khoảng ngày không hợp lệ' }, { status: 400 })
  }
  const to = new Date(from.getTime() + days * DAY)

  const [roomTypes, items, locks] = await Promise.all([
    prisma.roomType.findMany({
      where: { propertyId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        totalRooms: true,
        isActive: true,
        rooms: { orderBy: { number: 'asc' }, select: { id: true, number: true, floor: true, isActive: true } },
      },
    }),
    prisma.bookingItem.findMany({
      where: {
        booking: {
          propertyId: id,
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
          checkInDate: { lt: to },
          checkOutDate: { gt: from },
        },
      },
      select: {
        roomTypeId: true,
        roomId: true,
        roomNumber: true,
        booking: {
          select: {
            id: true,
            bookingCode: true,
            guestName: true,
            status: true,
            paymentStatus: true,
            checkInDate: true,
            checkOutDate: true,
            numAdults: true,
            numChildren: true,
          },
        },
      },
    }),
    prisma.roomLock.findMany({
      where: { propertyId: id, bookingId: null, type: { in: ['MAINTENANCE', 'BLOCKED'] }, lockStart: { lt: to }, lockEnd: { gt: from } },
      select: { id: true, roomTypeId: true, roomId: true, lockStart: true, lockEnd: true, type: true, customerInfo: true },
    }),
  ])

  return NextResponse.json(
    {
      success: true,
      data: {
        from: from.toISOString(),
        days,
        roomTypes,
        stays: items.map((item) => ({
          bookingId: item.booking.id,
          bookingCode: item.booking.bookingCode,
          guestName: item.booking.guestName,
          status: item.booking.status,
          paymentStatus: item.booking.paymentStatus,
          checkIn: item.booking.checkInDate,
          checkOut: item.booking.checkOutDate,
          guests: item.booking.numAdults + item.booking.numChildren,
          roomTypeId: item.roomTypeId,
          roomId: item.roomId,
          roomNumber: item.roomNumber,
        })),
        locks: locks.map((lock) => ({
          id: lock.id,
          roomTypeId: lock.roomTypeId,
          roomId: lock.roomId,
          start: lock.lockStart,
          end: lock.lockEnd,
          type: lock.type,
          note: lock.customerInfo,
        })),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
