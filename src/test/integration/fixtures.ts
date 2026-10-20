/**
 * Data builders for integration tests. Each builder creates the minimum
 * valid rows with unique slugs/emails, so tests never depend on seed data.
 */
import type { BookingStatus, WorkspaceRole } from '@prisma/client'
import { prisma } from '@/lib/db'

let seq = 0
function uid() {
  seq += 1
  return `${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Empties every application table; keeps _prisma_migrations. */
export async function resetDatabase() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `
  if (rows.length === 0) return
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`)
}

/** Publishes the property's website: guests see it and can book (src/lib/public-site/visibility.ts). */
export function publishSite(propertyId: string) {
  return prisma.websiteSettings.upsert({
    where: { propertyId },
    update: { isPublished: true },
    create: { propertyId, isPublished: true, publishedAt: new Date() },
  })
}

export function createUser(email = `u-${uid()}@example.com`) {
  return prisma.user.create({ data: { email, name: 'Test User' } })
}

/**
 * A workspace with one property and its owner, plus (optionally) a second
 * user who is a member with `memberRole`.
 */
export async function createTenant(opts: { memberRole?: WorkspaceRole } = {}) {
  const id = uid()
  const owner = await createUser()
  const workspace = await prisma.workspace.create({
    data: { name: `Workspace ${id}`, slug: `ws-${id}`, ownerId: owner.id },
  })
  const property = await prisma.property.create({
    data: {
      workspaceId: workspace.id,
      name: `Hotel ${id}`,
      slug: `hotel-${id}`,
      type: 'HOTEL',
      address: '1 Test Street',
      city: 'Da Lat',
      subdomain: `h-${id}`,
    },
  })

  let member = null
  if (opts.memberRole) {
    member = await createUser()
    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: member.id, role: opts.memberRole },
    })
  }
  return { owner, workspace, property, member }
}

export function createBooking(
  propertyId: string,
  opts: { totalAmount?: number; status?: BookingStatus; guestEmail?: string } = {}
) {
  const total = opts.totalAmount ?? 1_000_000
  return prisma.booking.create({
    data: {
      bookingCode: `DS${uid().toUpperCase()}`,
      propertyId,
      guestName: 'Test Guest',
      guestEmail: opts.guestEmail ?? `g-${uid()}@example.com`,
      guestPhone: '0900000000',
      checkInDate: new Date('2026-11-01T14:00:00Z'),
      checkOutDate: new Date('2026-11-03T12:00:00Z'),
      subtotal: total,
      totalAmount: total,
      status: opts.status ?? 'PENDING',
    },
  })
}

export function createPendingPayment(booking: { id: string; propertyId: string }, amount: number) {
  return prisma.payment.create({
    data: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      amount,
      netAmount: amount,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
    },
  })
}

/**
 * A bookable room type: its own price row hangs off the property's price
 * list ("Bảng giá"), created on first use with the given surcharges.
 */
export async function createRoomType(
  propertyId: string,
  opts: {
    name?: string
    totalRooms?: number
    weekdayPrice?: number | null
    weekendPrice?: number
    baseOccupancy?: number
    maxAdults?: number
    maxChildren?: number
    maxOccupancy?: number
    propertyExtraAdult?: number
    propertyExtraChild?: number
  } = {}
) {
  const config =
    (await prisma.pricingConfig.findFirst({ where: { propertyId } })) ??
    (await prisma.pricingConfig.create({
      data: {
        propertyId,
        name: 'Standard',
        weekdayPrice: 1,
        weekendPrice: 1,
        extraAdultPrice: opts.propertyExtraAdult ?? 0,
        extraChildPrice: opts.propertyExtraChild ?? 0,
      },
    }))
  const id = uid()
  return prisma.roomType.create({
    data: {
      propertyId,
      name: opts.name ?? `Phòng ${id}`,
      slug: `rt-${id}`,
      bedType: 'DOUBLE',
      totalRooms: opts.totalRooms ?? 5,
      baseOccupancy: opts.baseOccupancy ?? 2,
      maxAdults: opts.maxAdults ?? 2,
      maxChildren: opts.maxChildren ?? 0,
      maxOccupancy: opts.maxOccupancy ?? 4,
      ...(opts.weekdayPrice !== null && {
        pricing: {
          create: {
            pricingId: config.id,
            weekdayPrice: opts.weekdayPrice ?? 500_000,
            weekendPrice: opts.weekendPrice ?? opts.weekdayPrice ?? 500_000,
          },
        },
      }),
    },
  })
}
