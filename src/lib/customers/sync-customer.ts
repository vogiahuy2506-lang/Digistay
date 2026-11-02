import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type Db = Prisma.TransactionClient | typeof prisma

export interface SyncCustomerOptions {
  autoTags?: boolean
}

/**
 * Task 49: Đồng bộ hoặc cập nhật hồ sơ khách hàng (CustomerProfile) từ một đơn đặt phòng.
 * Được kích hoạt khi booking chuyển sang CHECKED_OUT hoặc thanh toán thành công (PAID).
 */
export async function syncCustomerProfileFromBooking(
  db: Db,
  bookingId: string,
  options?: SyncCustomerOptions
) {
  if (
    typeof db?.booking?.findUnique !== 'function' ||
    typeof db?.customerProfile?.findFirst !== 'function'
  ) {
    return null
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      propertyId: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      status: true,
      paymentStatus: true,
    },
  })

  if (!booking) return null

  const email = (booking.guestEmail || '').trim().toLowerCase()
  const phone = (booking.guestPhone || '').trim()

  // Cần ít nhất số điện thoại hoặc email để định danh khách hàng
  if (!email && !phone) return null

  // Tìm hồ sơ khách đã có sẵn theo propertyId và email/phone
  let existing = await db.customerProfile.findFirst({
    where: {
      propertyId: booking.propertyId,
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
  })

  // Tính toán lại tổng quan lịch sử lưu trú của khách tại khách sạn này
  const relevantBookings = await db.booking.findMany({
    where: {
      propertyId: booking.propertyId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      OR: [
        ...(phone ? [{ guestPhone: phone }] : []),
        ...(email ? [{ guestEmail: email }] : []),
      ],
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      depositAmount: true,
      checkInDate: true,
      checkOutDate: true,
      actualCheckOut: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // totalStays: số lần đã lưu trú (CHECKED_OUT hoặc CHECKED_IN)
  const stays = relevantBookings.filter(
    (b) => b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN'
  ).length

  // totalSpent: tổng số tiền đã thanh toán hoặc tổng giá trị đơn đã hoàn thành/xác nhận
  const spent = relevantBookings.reduce((sum, b) => {
    if (b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN' || b.paymentStatus === 'PAID') {
      return sum + (b.totalAmount || b.depositAmount || 0)
    }
    return sum + (b.depositAmount || 0)
  }, 0)

  // lastStayAt: lần lưu trú gần nhất
  const lastStayBooking = relevantBookings.find(
    (b) => b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN'
  )
  const lastStayAt = lastStayBooking
    ? lastStayBooking.actualCheckOut || lastStayBooking.checkOutDate
    : (relevantBookings[0]?.createdAt ?? new Date())

  const name = booking.guestName?.trim() || existing?.name || 'Khách lưu trú'

  // Gợi ý tag tự động nếu khách ở nhiều lần
  const autoTags: string[] = []
  if (options?.autoTags !== false) {
    if (stays >= 5) autoTags.push('VIP')
    else if (stays >= 2) autoTags.push('Khách quen')
  }

  if (existing) {
    const existingTags = existing.tags || []
    const combinedTags = Array.from(new Set([...existingTags, ...autoTags]))

    return db.customerProfile.update({
      where: { id: existing.id },
      data: {
        name: name || existing.name,
        email: email || existing.email,
        phone: phone || existing.phone,
        totalStays: stays,
        totalSpent: spent,
        lastStayAt,
        tags: combinedTags,
      },
    })
  }

  return db.customerProfile.create({
    data: {
      propertyId: booking.propertyId,
      name,
      email: email || '',
      phone: phone || '',
      totalStays: stays,
      totalSpent: spent,
      lastStayAt,
      tags: autoTags,
    },
  })
}

/**
 * Đồng bộ toàn bộ khách hàng từ tất cả các booking trong quá khứ của cơ sở.
 */
export async function syncAllPropertyCustomers(
  propertyId: string
): Promise<{ synced: number }> {
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    select: { id: true, guestEmail: true, guestPhone: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const seen = new Set<string>()
  const bookingIdsToSync: string[] = []

  for (const b of bookings) {
    const key = (b.guestPhone?.trim() || b.guestEmail?.trim().toLowerCase()) ?? ''
    if (key && !seen.has(key)) {
      seen.add(key)
      bookingIdsToSync.push(b.id)
    }
  }

  let synced = 0
  for (const bId of bookingIdsToSync) {
    try {
      await syncCustomerProfileFromBooking(prisma, bId)
      synced++
    } catch (err) {
      console.error(`[crm] Failed to sync customer from booking ${bId}:`, err)
    }
  }

  return { synced }
}
