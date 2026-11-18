import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { can, checkPropertyAccess } from '@/lib/auth/access'
import { syncCustomerProfileFromBooking } from '@/lib/customers/sync-customer'

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        propertyId: true,
        bookingCode: true,
        guestName: true,
        guestPhone: true,
        guestIdType: true,
        guestIdNumber: true,
        guestNationality: true,
        guestBirthDate: true,
        guestGender: true,
        guestAddress: true,
        stayGuests: true,
        status: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    const access = await checkPropertyAccess(session.user.id, booking.propertyId, 'bookings_view', 'Không tìm thấy đơn đặt phòng')
    if (!access.ok) return access.response

    return NextResponse.json({ success: true, data: booking })
  } catch (error) {
    console.error('Get guest identity error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi tải thông tin giấy tờ' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    const access = await checkPropertyAccess(session.user.id, booking.propertyId, null, 'Không tìm thấy đơn đặt phòng')
    if (!access.ok) return access.response
    if (!can(access.access, 'bookings_edit', booking.propertyId)) {
      return NextResponse.json({ success: false, error: 'Không có quyền cập nhật thông tin khách' }, { status: 403 })
    }

    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    if (!['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ có thể cập nhật giấy tờ cho đơn đang chờ, đã xác nhận hoặc đang lưu trú' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const {
      guestIdType,
      guestIdNumber,
      guestNationality,
      guestBirthDate,
      guestGender,
      guestAddress,
      stayGuests,
    } = body || {}

    const parsedBirthDate = guestBirthDate ? new Date(guestBirthDate) : null
    const validBirthDate =
      guestBirthDate === null || guestBirthDate === ''
        ? null
        : parsedBirthDate && !isNaN(parsedBirthDate.getTime())
          ? parsedBirthDate
          : undefined

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        ...(guestIdType !== undefined ? { guestIdType: guestIdType || 'CCCD' } : {}),
        ...(guestIdNumber !== undefined ? { guestIdNumber: guestIdNumber?.trim() || null } : {}),
        ...(guestNationality !== undefined ? { guestNationality: guestNationality?.trim() || 'Việt Nam' } : {}),
        ...(validBirthDate !== undefined ? { guestBirthDate: validBirthDate } : {}),
        ...(guestGender !== undefined ? { guestGender: guestGender || null } : {}),
        ...(guestAddress !== undefined ? { guestAddress: guestAddress?.trim() || null } : {}),
        ...(stayGuests !== undefined ? { stayGuests } : {}),
      },
      select: {
        id: true,
        bookingCode: true,
        guestIdType: true,
        guestIdNumber: true,
        guestNationality: true,
        guestBirthDate: true,
        guestGender: true,
        guestAddress: true,
        stayGuests: true,
      },
    })

    try {
      await syncCustomerProfileFromBooking(prisma, id)
    } catch (profileErr) {
      console.warn('Sync customer profile on guest-identity update warning:', profileErr)
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update guest identity error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi cập nhật thông tin giấy tờ khách' }, { status: 500 })
  }
}
