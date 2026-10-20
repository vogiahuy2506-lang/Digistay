import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/workspaces/[id]/stats
 * Get workspace-level statistics including all properties.
 */
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Check workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    })

    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    // Get all properties in workspace
    const properties = await prisma.property.findMany({
      where: { workspaceId: id },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        roomTypes: {
          select: {
            totalRooms: true,
            availableRooms: true,
          },
        },
      },
    })

    // Get all bookings across properties (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const bookings = await prisma.booking.findMany({
      where: {
        property: { workspaceId: id },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        depositAmount: true,
        paymentStatus: true,
        createdAt: true,
        propertyId: true,
        payments: {
          where: { status: 'PAID' },
          select: { amount: true, method: true },
        },
      },
    })

    // Calculate stats
    const propertyIds = properties.map(p => p.id)
    const totalRooms = properties.reduce((sum, p) => sum + p.roomTypes.reduce((s, rt) => s + rt.totalRooms, 0), 0)
    const totalBookings = bookings.length
    const pendingBookings = bookings.filter(b => b.status === 'PENDING').length
    const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED').length
    const checkedInBookings = bookings.filter(b => b.status === 'CHECKED_IN').length

    // Revenue calculation
    const monthlyRevenue = bookings
      .filter(b => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW')
      .reduce((sum, b) => sum + b.depositAmount, 0)

    const totalRevenue = bookings
      .filter(b => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW')
      .reduce((sum, b) => sum + b.totalAmount, 0)

    // Today's stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayBookings = bookings.filter(b => {
      const checkIn = new Date(b.createdAt)
      return checkIn >= today && checkIn < tomorrow
    })

    const todayCheckIns = await prisma.booking.count({
      where: {
        property: { workspaceId: id },
        status: 'CHECKED_IN',
        actualCheckIn: { gte: today, lt: tomorrow },
      },
    })

    const todayCheckOuts = await prisma.booking.count({
      where: {
        property: { workspaceId: id },
        status: 'CHECKED_OUT',
        actualCheckOut: { gte: today, lt: tomorrow },
      },
    })

    // Get member count
    const memberCount = await prisma.workspaceMember.count({
      where: { workspaceId: id },
    })

    // Per-property breakdown
    const propertyStats = properties.map(p => {
      const pBookings = bookings.filter(b => b.propertyId === p.id)
      const pRevenue = pBookings.reduce((sum, b) => sum + b.depositAmount, 0)
      const pRooms = p.roomTypes.reduce((s, rt) => s + rt.totalRooms, 0)
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        totalBookings: pBookings.length,
        revenue: pRevenue,
        totalRooms: pRooms,
        isActive: p.isActive,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        // Summary
        totalProperties: properties.length,
        activeProperties: properties.filter(p => p.isActive).length,
        totalRooms,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        checkedInBookings,
        monthlyRevenue,
        totalRevenue,
        memberCount,
        // Today's numbers
        todayBookings: todayBookings.length,
        todayCheckIns,
        todayCheckOuts,
        // Breakdown
        byProperty: propertyStats,
        // By status
        bookingsByStatus: {
          PENDING: bookings.filter(b => b.status === 'PENDING').length,
          CONFIRMED: bookings.filter(b => b.status === 'CONFIRMED').length,
          CHECKED_IN: bookings.filter(b => b.status === 'CHECKED_IN').length,
          CHECKED_OUT: bookings.filter(b => b.status === 'CHECKED_OUT').length,
          CANCELLED: bookings.filter(b => b.status === 'CANCELLED').length,
          NO_SHOW: bookings.filter(b => b.status === 'NO_SHOW').length,
        },
      },
    })
  } catch (error) {
    console.error('Get workspace stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi lấy thống kê workspace' },
      { status: 500 }
    )
  }
}
