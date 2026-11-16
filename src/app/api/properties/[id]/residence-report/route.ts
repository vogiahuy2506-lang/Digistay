import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'
import { ROOM_SEGMENT_SELECT, withRoomTypeNames } from '@/lib/bookings/room-type-names'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const propertyId = params.id

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const access = await checkPropertyAccess(session.user.id, propertyId, 'bookings_view', 'Không tìm thấy cơ sở lưu trú')
    if (!access.ok) return access.response

    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')

    // Base date in Vietnam (UTC+7)
    const baseDate = dateParam ? new Date(dateParam) : new Date(Date.now() + 7 * 3_600_000)
    const year = baseDate.getFullYear()
    const month = baseDate.getMonth()
    const day = baseDate.getDate()

    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0))
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999))

    // Query bookings active on that day (or checked in on that day)
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        status: { in: ['CHECKED_IN', 'CONFIRMED'] },
        OR: [
          // Range check: guest is staying across this day
          {
            checkInDate: { lte: endOfDay },
            checkOutDate: { gte: startOfDay },
          },
          // Or actually checked in on this day
          {
            actualCheckIn: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
      include: {
        bookingItems: true,
        roomSegments: { orderBy: { fromDate: 'asc' }, select: ROOM_SEGMENT_SELECT },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
      },
      orderBy: { checkInDate: 'asc' },
    })

    const bookingsWithTypes = await withRoomTypeNames(bookings)

    interface ResidentGuest {
      bookingId: string
      bookingCode: string
      guestName: string
      idType: string
      idNumber: string
      nationality: string
      birthDate: string | null
      gender: string | null
      address: string | null
      phone: string
      roomNumber: string
      roomTypeName: string
      checkInDate: string
      checkOutDate: string
      actualCheckIn: string | null
      status: string
      isPrimary: boolean
    }

    const guests: ResidentGuest[] = []

    for (const b of bookingsWithTypes) {
      const roomNum = b.bookingItems?.[0]?.roomNumber || (b.roomSegments?.[0]?.roomNumber ?? 'Chưa xếp')
      const roomType = b.bookingItems?.[0]?.roomTypeName || ''

      // Primary guest
      guests.push({
        bookingId: b.id,
        bookingCode: b.bookingCode,
        guestName: b.guestName,
        idType: b.guestIdType || 'CCCD',
        idNumber: b.guestIdNumber || '',
        nationality: b.guestNationality || 'Việt Nam',
        birthDate: b.guestBirthDate ? new Date(b.guestBirthDate).toISOString().slice(0, 10) : null,
        gender: b.guestGender || null,
        address: b.guestAddress || null,
        phone: b.guestPhone || '',
        roomNumber: roomNum,
        roomTypeName: roomType,
        checkInDate: b.checkInDate.toISOString(),
        checkOutDate: b.checkOutDate.toISOString(),
        actualCheckIn: b.actualCheckIn ? b.actualCheckIn.toISOString() : null,
        status: b.status,
        isPrimary: true,
      })

      // Additional stay guests if any
      if (Array.isArray(b.stayGuests)) {
        for (const sg of b.stayGuests as any[]) {
          if (!sg || !sg.name) continue
          guests.push({
            bookingId: b.id,
            bookingCode: b.bookingCode,
            guestName: sg.name,
            idType: sg.idType || 'CCCD',
            idNumber: sg.idNumber || '',
            nationality: sg.nationality || 'Việt Nam',
            birthDate: sg.birthDate ? String(sg.birthDate).slice(0, 10) : null,
            gender: sg.gender || null,
            address: sg.address || b.guestAddress || null,
            phone: sg.phone || b.guestPhone || '',
            roomNumber: roomNum,
            roomTypeName: roomType,
            checkInDate: b.checkInDate.toISOString(),
            checkOutDate: b.checkOutDate.toISOString(),
            actualCheckIn: b.actualCheckIn ? b.actualCheckIn.toISOString() : null,
            status: b.status,
            isPrimary: false,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: dateParam || new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10),
      data: guests,
      total: guests.length,
    })
  } catch (error) {
    console.error('Residence report error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xuất danh sách lưu trú' }, { status: 500 })
  }
}
