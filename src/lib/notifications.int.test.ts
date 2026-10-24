/**
 * The dashboard's bell (src/lib/notifications.ts) against real Postgres:
 * who hears about a new booking or a paid deposit, and the API that reads
 * and marks a user's own notices only.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { WorkspaceRole } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createRoomType, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { createBooking } from '@/lib/bookings/create-booking'
import { queueGuestDepositReceived } from '@/lib/payments/deposit-received'
import { GET, POST } from '@/app/api/notifications/route'

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

async function hotel() {
  const tenant = await createTenant()
  const staff = {} as Record<WorkspaceRole, { id: string; email: string }>
  for (const role of ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'] as WorkspaceRole[]) {
    staff[role] = await createUser()
    await prisma.workspaceMember.create({ data: { workspaceId: tenant.workspace.id, userId: staff[role].id, role } })
  }
  const room = await createRoomType(tenant.property.id, { totalRooms: 5 })
  return { ...tenant, staff, room }
}

const book = (propertyId: string, roomTypeId: string, createdById: string | null) =>
  createBooking({
    propertyId,
    roomTypeId,
    guestName: 'Ngô Thị Chuông',
    guestEmail: 'chuong@example.com',
    guestPhone: '0900000020',
    checkIn: new Date('2026-12-10T00:00:00+07:00'),
    checkOut: new Date('2026-12-12T00:00:00+07:00'),
    numAdults: 2,
    numChildren: 0,
    createdById,
  })

const recipients = async (type: string) =>
  (await prisma.notification.findMany({ where: { type }, select: { userId: true } })).map((n) => n.userId).sort()

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(auth).mockReset()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('who hears about a booking', () => {
  it("a guest's booking from the website: the owner and the front desk, not plain members", async () => {
    const { owner, staff, property, room, workspace } = await hotel()
    const { booking } = await book(property.id, room.id, null)

    expect(await recipients('booking_new')).toEqual([owner.id, staff.ADMIN.id, staff.MANAGER.id, staff.RECEPTIONIST.id].sort())
    const one = await prisma.notification.findFirstOrThrow({ where: { userId: owner.id } })
    expect(one).toMatchObject({
      workspaceId: workspace.id,
      propertyId: property.id,
      link: `/workspace/${workspace.slug}/properties/${property.id}/bookings/${booking.id}`,
      readAt: null,
    })
    expect(one.data).toMatchObject({ bookingCode: booking.bookingCode, guestName: 'Ngô Thị Chuông', propertyName: property.name, fromWebsite: true })
  })

  it('a booking staff made: the owner and admins, never the one who made it', async () => {
    const { owner, staff, property, room } = await hotel()
    await book(property.id, room.id, staff.RECEPTIONIST.id)
    expect(await recipients('booking_new')).toEqual([owner.id, staff.ADMIN.id].sort())

    await prisma.notification.deleteMany()
    await book(property.id, room.id, staff.ADMIN.id)
    expect(await recipients('booking_new')).toEqual([owner.id])
  })

  it('a paid online deposit tells the front desk too', async () => {
    const { owner, staff, property, room } = await hotel()
    const { booking } = await book(property.id, room.id, null)
    await prisma.$transaction((tx) => queueGuestDepositReceived(tx, { bookingId: booking.id, amount: 300_000, metadata: { guestDeposit: true } }, false))
    expect(await recipients('deposit_paid')).toEqual([owner.id, staff.ADMIN.id, staff.MANAGER.id, staff.RECEPTIONIST.id].sort())
    // Not for staff-recorded money, nor for a booking already cancelled.
    await prisma.notification.deleteMany({ where: { type: 'deposit_paid' } })
    await prisma.$transaction((tx) => queueGuestDepositReceived(tx, { bookingId: booking.id, amount: 1, metadata: {} }, false))
    await prisma.$transaction((tx) => queueGuestDepositReceived(tx, { bookingId: booking.id, amount: 1, metadata: { guestDeposit: true } }, true))
    expect(await recipients('deposit_paid')).toEqual([])
  })
})

describe('/api/notifications', () => {
  it("reads and marks a user's own notices only", async () => {
    const { owner, staff, property, room } = await hotel()
    await book(property.id, room.id, null)
    await book(property.id, room.id, null)

    signInAs(owner)
    const mine = await (await GET()).json()
    expect(mine.data.unread).toBe(2)
    expect(mine.data.items).toHaveLength(2)

    // Someone else's id does nothing to it.
    const theirs = await prisma.notification.findFirstOrThrow({ where: { userId: staff.ADMIN.id } })
    const mark = (body: object) => POST(new NextRequest('http://digistay.test/api/notifications', { method: 'POST', body: JSON.stringify(body) }))
    expect((await (await mark({ ids: [theirs.id, mine.data.items[0].id] })).json()).data.marked).toBe(1)
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: theirs.id } })).readAt).toBeNull()
    expect((await (await GET()).json()).data.unread).toBe(1)

    expect((await (await mark({ all: true })).json()).data.marked).toBe(1)
    expect((await (await GET()).json()).data.unread).toBe(0)
    expect(await prisma.notification.count({ where: { userId: staff.ADMIN.id, readAt: null } })).toBe(2)

    expect((await mark({ ids: [] })).status).toBe(400)
  })

  it('needs a session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    expect((await GET()).status).toBe(401)
  })
})
