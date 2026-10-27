/**
 * Deleting and restoring properties and workspaces against real Postgres
 * (src/lib/deletion): who may, what stops it, that a deleted one is gone for
 * the dashboard API, the public site and the jobs (src/lib/db/soft-delete.ts),
 * that restoring brings it back within the plan, and that the purge removes
 * every row after 30 days, rows that do not cascade included.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
// No request scope here: emails stay queued in the outbox.
vi.mock('next/server', async (original) => ({ ...(await original<typeof import('next/server')>()), after: () => {} }))

import { auth } from '@/lib/auth'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { getAccess } from '@/lib/auth/access'
import { createBooking, createRoomType, createTenant, createUser, publishSite, resetDatabase } from '@/test/integration/fixtures'
import { DELETE as deleteProperty, GET as getProperty } from '@/app/api/properties/[id]/route'
import { GET as listProperties, POST as createProperty } from '@/app/api/properties/route'
import { POST as restoreProperty } from '@/app/api/properties/[id]/restore/route'
import { GET as propertyDeletion } from '@/app/api/properties/[id]/deletion/route'
import { DELETE as deleteWorkspace, GET as getWorkspace } from '@/app/api/workspaces/[id]/route'
import { GET as listWorkspaces, POST as createWorkspace } from '@/app/api/workspaces/route'
import { POST as restoreWorkspace } from '@/app/api/workspaces/[id]/restore/route'
import { GET as workspaceDeletion } from '@/app/api/workspaces/[id]/deletion/route'
import { GET as deletedProperties } from '@/app/api/workspaces/[id]/deleted-properties/route'
import { GET as deletedWorkspaces } from '@/app/api/workspaces/deleted/route'
import { GET as getBooking } from '@/app/api/bookings/[id]/route'
import { GET as notifications } from '@/app/api/notifications/route'
import { POST as purgeRoute } from '@/app/api/internal/purge-deleted/route'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { siteForCustomDomain } from '@/lib/public-site/custom-domains'
import { autoIssuePaidBookings, sendDueInvoiceEmails } from '@/lib/einvoice/jobs'
import { reconcilePendingPayos } from '@/lib/payments/payos-reconcile'
import { workspaceUsage } from '@/lib/billing/limits'

const DAY = 86_400_000
const CRON = 'c'.repeat(40)
const mockAuth = vi.mocked(auth)
const signInAs = (user: { id: string; email: string }) => mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (url: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

const delProperty = (id: string, confirmName: unknown) => deleteProperty(req(`/api/properties/${id}`, 'DELETE', { confirmName }), params(id))
const delWorkspace = (id: string, confirmName: unknown) => deleteWorkspace(req(`/api/workspaces/${id}`, 'DELETE', { confirmName }), params(id))
const purge = () => purgeRoute(req('/api/internal/purge-deleted', 'POST', undefined, { 'x-cron-secret': CRON }))
/** Moves a deletion `days` into the past, as if the time had passed. */
const backdateProperty = (id: string, days: number) =>
  prismaWithDeleted.property.update({ where: { id }, data: { deletedAt: new Date(Date.now() - days * DAY) } })
const backdateWorkspace = (id: string, days: number) =>
  prismaWithDeleted.workspace.update({ where: { id }, data: { deletedAt: new Date(Date.now() - days * DAY) } })

/** A stay around today: checked in yesterday, out tomorrow. */
const stayNow = () => ({ checkInDate: new Date(Date.now() - DAY), checkOutDate: new Date(Date.now() + DAY) })
/** A stay that ended last week. */
const stayPast = () => ({ checkInDate: new Date(Date.now() - 9 * DAY), checkOutDate: new Date(Date.now() - 7 * DAY) })

beforeAll(() => {
  process.env.CRON_SECRET = CRON
})
beforeEach(async () => {
  await resetDatabase()
  mockAuth.mockReset()
})
afterAll(() => prisma.$disconnect())

describe('DELETE /api/properties/[id]', () => {
  it('is the owner’s only: a member gets 403, an outsider 404, nothing changes', async () => {
    const { property, member } = await createTenant({ memberRole: 'ADMIN' })
    signInAs(member!)
    expect((await delProperty(property.id, property.name)).status).toBe(403)
    signInAs(await createUser())
    expect((await delProperty(property.id, property.name)).status).toBe(404)
    expect((await propertyDeletion(req('/x', 'GET'), params(property.id))).status).toBe(404)
    expect(await prismaWithDeleted.property.findUniqueOrThrow({ where: { id: property.id } })).toMatchObject({ deletedAt: null })
  })

  it('needs the name typed (letter case aside)', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    for (const typed of [undefined, '', 'Hotel', `${property.name}x`]) {
      const res = await delProperty(property.id, typed)
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('NAME_MISMATCH')
    }
    expect((await delProperty(property.id, ` ${property.name.toUpperCase()} `)).status).toBe(200)
  })

  it('is refused while guests are staying or booked later, and says how many', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    // These do not count: over, cancelled, no-show, checked out.
    await prisma.booking.update({ where: { id: (await createBooking(property.id)).id }, data: stayPast() })
    await createBooking(property.id, { status: 'CANCELLED' })
    await createBooking(property.id, { status: 'NO_SHOW' })
    await prisma.booking.update({ where: { id: (await createBooking(property.id, { status: 'CHECKED_OUT' })).id }, data: stayNow() })
    // These do: upcoming (pending, confirmed), and a guest still in past their check-out day.
    await createBooking(property.id)
    await createBooking(property.id, { status: 'CONFIRMED' })
    await prisma.booking.update({ where: { id: (await createBooking(property.id, { status: 'CHECKED_IN' })).id }, data: stayPast() })

    const preflight = await (await propertyDeletion(req('/x', 'GET'), params(property.id))).json()
    expect(preflight.data).toMatchObject({ name: property.name, booked: 3, restoreDays: 30 })

    const res = await delProperty(property.id, property.name)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'GUESTS_BOOKED', count: 3 })
    expect(await prismaWithDeleted.property.findUniqueOrThrow({ where: { id: property.id } })).toMatchObject({ deletedAt: null })
  })

  it('is not stopped by the workspace’s plan lock', async () => {
    const { owner, workspace, property } = await createTenant()
    await prisma.subscription.create({
      data: { workspaceId: workspace.id, plan: 'growth', trial: false, periodStart: new Date(Date.now() - 60 * DAY), periodEnd: new Date(Date.now() - 20 * DAY) },
    })
    signInAs(owner)
    expect((await delProperty(property.id, property.name)).status).toBe(200)
  })
})

describe('a deleted property', () => {
  async function deletedHotel() {
    const tenant = await createTenant({ memberRole: 'RECEPTIONIST' })
    const { owner, property } = tenant
    await publishSite(property.id)
    await prisma.websiteSettings.update({
      where: { propertyId: property.id },
      data: { customDomain: 'khachsan-xoa.vn', domainVerificationStatus: 'verified' },
    })
    const booking = await prisma.booking.update({ where: { id: (await createBooking(property.id)).id }, data: stayPast() })
    signInAs(owner)
    expect((await delProperty(property.id, property.name)).status).toBe(200)
    return { ...tenant, booking }
  }

  it('is gone from the dashboard API, for the owner and the staff', async () => {
    const { owner, member, workspace, property, booking } = await deletedHotel()
    for (const user of [owner, member!]) {
      signInAs(user)
      expect([403, 404]).toContain((await getProperty(req('/x', 'GET'), params(property.id))).status)
      expect((await getBooking(req('/x', 'GET'), params(booking.id))).status).toBe(404)
      const list = await (await listProperties(req(`/api/properties?workspaceId=${workspace.id}`, 'GET'))).json()
      expect(list.data).toEqual([])
    }
    // Deleting it again finds nothing.
    signInAs(owner)
    expect((await delProperty(property.id, property.name)).status).toBe(404)
  })

  it('is gone from the public site, by subdomain and by custom domain', async () => {
    const { property } = await deletedHotel()
    mockAuth.mockResolvedValue(null as never)
    expect(await loadVisibleSite(property.subdomain)).toBeNull()
    expect(await siteForCustomDomain('khachsan-xoa.vn')).toBeNull()
  })

  it('keeps its subdomain and its name taken until the purge', async () => {
    const { owner, workspace, property } = await deletedHotel()
    signInAs(owner)
    const res = await createProperty(
      req('/api/properties', 'POST', { workspaceId: workspace.id, name: 'Khác hẳn', type: 'HOTEL', address: '12 Lê Lợi', city: 'Huế', subdomain: property.subdomain })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Subdomain đã được sử dụng, vui lòng chọn tên khác')
  })

  it('no longer counts against the plan, and the bell drops its notices', async () => {
    const { owner, workspace, property } = await deletedHotel()
    expect((await workspaceUsage(workspace.id)).properties).toBe(0)
    await prisma.notification.create({ data: { userId: owner.id, workspaceId: workspace.id, propertyId: property.id, type: 'booking_new', data: {} } })
    await prisma.notification.create({ data: { userId: owner.id, workspaceId: workspace.id, type: 'booking_new', data: {} } })
    signInAs(owner)
    const bell = await (await notifications()).json()
    expect(bell.data.items).toHaveLength(1)
    expect(bell.data.unread).toBe(1)
  })

  it('is listed for the owner under "Đã xoá gần đây", for no one else', async () => {
    const { owner, member, workspace, property } = await deletedHotel()
    signInAs(owner)
    const list = await (await deletedProperties(req('/x', 'GET'), params(workspace.id))).json()
    expect(list.data).toEqual([expect.objectContaining({ id: property.id, name: property.name, handle: property.subdomain, daysLeft: 30 })])
    signInAs(member!)
    expect((await deletedProperties(req('/x', 'GET'), params(workspace.id))).status).toBe(403)
  })

  it('is skipped by the e-invoice and PayOS jobs', async () => {
    const { property, booking } = await deletedHotel()
    await prismaWithDeleted.propertyEinvoice.create({
      data: {
        propertyId: property.id, environment: 'DEMO', taxCode: '0302712571-999', username: 'u', password: 'p', templateCode: '1', series: 'C26TAT', vatCode: 8,
        autoIssue: true, autoIssueSince: new Date(Date.now() - 30 * DAY), verifiedAt: new Date(),
      },
    })
    await prismaWithDeleted.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'PAID', status: 'CONFIRMED' } })
    await prismaWithDeleted.payment.create({
      data: { bookingId: booking.id, propertyId: property.id, amount: 1, netAmount: 1, method: 'BANK_TRANSFER', status: 'PAID', paidAt: new Date() },
    })
    await prismaWithDeleted.payment.create({
      data: { bookingId: booking.id, propertyId: property.id, amount: 1, netAmount: 1, method: 'QR_VIETQR', status: 'PENDING', paymentGateway: 'PAYOS', gatewayOrderCode: '424242' },
    })
    await prismaWithDeleted.invoice.create({
      data: {
        bookingId: booking.id, propertyId: property.id, invoiceNumber: 'INVDEL1', companyName: 'A', companyAddress: 'B', taxCode: '0101010101',
        customerName: 'C', customerEmail: 'c@example.com', subtotal: 1, taxAmount: 0, totalAmount: 1, status: 'PUBLISHED', publishedAt: new Date(), emailStatus: 'PENDING',
      },
    })

    expect(await autoIssuePaidBookings()).toEqual({ created: 0, published: 0, needsStaff: 0 })
    expect(await sendDueInvoiceEmails()).toEqual({ sent: 0, failed: 0, skipped: 0 })
    expect((await reconcilePendingPayos()).checked).toBe(0)
    expect(await prismaWithDeleted.invoice.count({ where: { propertyId: property.id } })).toBe(1)
  })
})

describe('POST /api/properties/[id]/restore', () => {
  it('brings it back as it was within 30 days, for the owner only', async () => {
    const { owner, member, workspace, property } = await createTenant({ memberRole: 'ADMIN' })
    await publishSite(property.id)
    signInAs(owner)
    expect((await delProperty(property.id, property.name)).status).toBe(200)

    signInAs(member!)
    expect((await restoreProperty(req('/x', 'POST'), params(property.id))).status).toBe(403)
    signInAs(await createUser())
    expect((await restoreProperty(req('/x', 'POST'), params(property.id))).status).toBe(404)

    signInAs(owner)
    await backdateProperty(property.id, 29)
    const res = await restoreProperty(req('/x', 'POST'), params(property.id))
    expect(res.status).toBe(200)
    expect(await prisma.property.findUnique({ where: { id: property.id } })).toMatchObject({ deletedAt: null, deletedById: null })
    expect(await loadVisibleSite(property.subdomain)).toMatchObject({ propertyId: property.id })
    expect((await deletedProperties(req('/x', 'GET'), params(workspace.id)).then((r) => r.json())).data).toEqual([])
    const logs = await prisma.activityLog.findMany({ where: { entityId: property.id }, orderBy: { createdAt: 'asc' } })
    expect(logs.map((l) => l.action)).toEqual(['DELETE', 'RESTORE'])
    // Not deleted any more: nothing to restore.
    expect((await restoreProperty(req('/x', 'POST'), params(property.id))).status).toBe(404)
  })

  it('is refused after 30 days', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await delProperty(property.id, property.name)
    await backdateProperty(property.id, 31)
    expect((await restoreProperty(req('/x', 'POST'), params(property.id))).status).toBe(410)
  })

  async function deletedWithRooms(plan: 'starter' | 'growth', rooms: number) {
    const tenant = await createTenant()
    await prisma.subscription.create({
      data: { workspaceId: tenant.workspace.id, plan, billing: 'MONTH', trial: false, periodStart: new Date(), periodEnd: new Date(Date.now() + 20 * DAY) },
    })
    await createRoomType(tenant.property.id, { totalRooms: rooms })
    signInAs(tenant.owner)
    expect((await delProperty(tenant.property.id, tenant.property.name)).status).toBe(200)
    // Another property took its place meanwhile.
    const other = await prisma.property.create({
      data: { workspaceId: tenant.workspace.id, name: 'Thay thế', slug: 'thay-the', type: 'HOTEL', address: '1', city: 'Huế', subdomain: 'thay-the' },
    })
    return { ...tenant, other }
  }

  it('respects the plan’s properties (Starter: one)', async () => {
    const { property } = await deletedWithRooms('starter', 5)
    const res = await restoreProperty(req('/x', 'POST'), params(property.id))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('PLAN_LIMIT')
    expect(await prismaWithDeleted.property.findUniqueOrThrow({ where: { id: property.id } })).not.toMatchObject({ deletedAt: null })
  })

  it('respects the plan’s rooms (Growth: 60)', async () => {
    const { property, other } = await deletedWithRooms('growth', 10)
    await createRoomType(other.id, { totalRooms: 55 })
    const res = await restoreProperty(req('/x', 'POST'), params(property.id))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('PLAN_LIMIT')
    // With room for both, it comes back.
    await prisma.roomType.updateMany({ where: { propertyId: other.id }, data: { totalRooms: 50 } })
    expect((await restoreProperty(req('/x', 'POST'), params(property.id))).status).toBe(200)
  })
})

describe('POST /api/internal/purge-deleted', () => {
  async function fullHotel() {
    const tenant = await createTenant()
    const { property, owner, workspace } = tenant
    await publishSite(property.id)
    await prisma.websiteSettings.update({
      where: { propertyId: property.id },
      data: { customDomain: 'tam-biet.vn', domainVerificationStatus: 'verified' },
    })
    const roomType = await createRoomType(property.id, { totalRooms: 2 })
    const room = await prisma.room.create({ data: { propertyId: property.id, roomTypeId: roomType.id, number: '101' } })
    await prisma.propertyImage.create({ data: { propertyId: property.id, url: 'https://res.cloudinary.com/x/a.jpg' } })
    await prisma.roomTypeImage.create({ data: { roomTypeId: roomType.id, url: 'https://res.cloudinary.com/x/b.jpg' } })
    await prisma.websiteBlock.create({ data: { propertyId: property.id, type: 'HERO', name: 'Hero' } })
    await prisma.policy.create({ data: { propertyId: property.id } })
    const booking = await prisma.booking.update({ where: { id: (await createBooking(property.id, { status: 'CHECKED_OUT' })).id }, data: stayPast() })
    await prisma.bookingItem.create({
      data: { bookingId: booking.id, roomTypeId: roomType.id, roomId: room.id, checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate, basePrice: 1, totalPrice: 1 },
    })
    await prisma.roomLock.create({ data: { propertyId: property.id, roomTypeId: roomType.id, bookingId: booking.id, lockStart: booking.checkInDate, lockEnd: booking.checkOutDate } })
    await prisma.payment.create({ data: { bookingId: booking.id, propertyId: property.id, amount: 1, netAmount: 1, method: 'CASH', status: 'PAID' } })
    const invoiceData = {
      bookingId: booking.id, propertyId: property.id, companyName: 'A', companyAddress: 'B', taxCode: '0101010101',
      customerName: 'C', customerEmail: 'c@example.com', subtotal: 1, taxAmount: 0, totalAmount: 1,
    }
    const original = await prisma.invoice.create({ data: { ...invoiceData, invoiceNumber: 'INVP1', status: 'REPLACED', publishedAt: new Date() } })
    await prisma.invoice.create({ data: { ...invoiceData, invoiceNumber: 'INVP2', status: 'PUBLISHED', publishedAt: new Date(), replacesInvoiceId: original.id } })
    await prisma.notification.create({ data: { userId: owner.id, workspaceId: workspace.id, propertyId: property.id, type: 'booking_new', data: {} } })
    await prisma.activityLog.create({ data: { workspaceId: workspace.id, propertyId: property.id, action: 'CREATE', entityType: 'BOOKING', entityId: booking.id } })
    return { ...tenant, booking }
  }

  it('removes a property deleted more than 30 days ago, every row of it, and frees its names', async () => {
    const { owner, workspace, property } = await fullHotel()
    const keeper = await createTenant()
    signInAs(owner)
    expect((await delProperty(property.id, property.name)).status).toBe(200)

    // 29 days: still restorable, kept.
    await backdateProperty(property.id, 29)
    expect((await purge()).status).toBe(200)
    expect(await prismaWithDeleted.property.count({ where: { id: property.id } })).toBe(1)

    await backdateProperty(property.id, 31)
    const res = await purge()
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ properties: 1, workspaces: 0 })

    const where = { propertyId: property.id }
    expect(await prismaWithDeleted.property.count({ where: { id: property.id } })).toBe(0)
    for (const count of [
      prismaWithDeleted.booking.count({ where }),
      prismaWithDeleted.payment.count({ where }),
      prismaWithDeleted.invoice.count({ where }),
      prismaWithDeleted.roomType.count({ where }),
      prismaWithDeleted.room.count({ where }),
      prismaWithDeleted.propertyImage.count({ where }),
      prismaWithDeleted.websiteBlock.count({ where }),
      prismaWithDeleted.websiteSettings.count({ where }),
      prismaWithDeleted.roomLock.count({ where }),
      prismaWithDeleted.policy.count({ where }),
      prismaWithDeleted.notification.count({ where }),
      prismaWithDeleted.bookingItem.count(),
      prismaWithDeleted.roomTypeImage.count(),
    ]) {
      expect(await count).toBe(0)
    }
    // The record of the deletion stays, with one saying it is gone; other hotels are untouched.
    const logs = await prismaWithDeleted.activityLog.findMany({ where: { entityId: property.id }, orderBy: { createdAt: 'asc' } })
    expect(logs.map((l) => l.action)).toEqual(['DELETE', 'PURGE'])
    expect(await prisma.property.count({ where: { id: keeper.property.id } })).toBe(1)
    expect(await prisma.jobRun.findFirst({ where: { job: 'purge-deleted' }, orderBy: { startedAt: 'desc' } })).toMatchObject({ status: 'SUCCESS' })

    // Its subdomain is free again.
    const again = await createProperty(
      req('/api/properties', 'POST', { workspaceId: workspace.id, name: property.name, type: 'HOTEL', address: '12 Lê Lợi', city: 'Huế', subdomain: property.subdomain })
    )
    expect(again.status).toBe(200)
  })

  it('needs the cron secret', async () => {
    expect((await purgeRoute(req('/api/internal/purge-deleted', 'POST'))).status).toBe(401)
  })
})

describe('deleting a workspace', () => {
  it('is the owner’s only, after the name, and not while guests are booked at any of its properties', async () => {
    const { owner, member, workspace, property } = await createTenant({ memberRole: 'ADMIN' })
    signInAs(member!)
    expect((await delWorkspace(workspace.id, workspace.name)).status).toBe(403)
    expect((await workspaceDeletion(req('/x', 'GET'), params(workspace.id))).status).toBe(403)
    signInAs(await createUser())
    expect((await delWorkspace(workspace.id, workspace.name)).status).toBe(404)

    signInAs(owner)
    expect((await delWorkspace(workspace.id, 'nhầm')).status).toBe(400)
    const second = await prisma.property.create({
      data: { workspaceId: workspace.id, name: 'Thứ hai', slug: 'thu-hai', type: 'HOTEL', address: '1', city: 'Huế', subdomain: 'thu-hai' },
    })
    await createBooking(second.id, { status: 'CONFIRMED' })
    const res = await delWorkspace(workspace.id, workspace.name)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'GUESTS_BOOKED', count: 1 })
    expect(property).toBeTruthy()
  })

  it('is refused while a plan payment link is open', async () => {
    const { owner, workspace } = await createTenant()
    await prisma.subscriptionPayment.create({
      data: { workspaceId: workspace.id, plan: 'growth', billing: 'MONTH', amount: 5000, orderCode: '777001', expiresAt: new Date(Date.now() + 10 * 60_000) },
    })
    signInAs(owner)
    const res = await delWorkspace(workspace.id, workspace.name)
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('PLAN_PAYMENT_OPEN')
  })

  it('hides it and its properties from every member at once; restoring keeps the plan’s dates', async () => {
    const { owner, member, workspace, property } = await createTenant({ memberRole: 'MANAGER' })
    const periodEnd = new Date(Date.now() + 20 * DAY)
    await prisma.subscription.create({
      data: { workspaceId: workspace.id, plan: 'growth', billing: 'MONTH', trial: false, periodStart: new Date(Date.now() - 10 * DAY), periodEnd },
    })
    signInAs(owner)
    const preflight = await (await workspaceDeletion(req('/x', 'GET'), params(workspace.id))).json()
    expect(preflight.data).toMatchObject({ name: workspace.name, properties: 1, members: 1, booked: 0, planPaymentOpen: false })
    expect(preflight.data.plan).toMatchObject({ planId: 'growth', trial: false, state: 'active', daysLeft: 20 })

    expect((await delWorkspace(workspace.id, workspace.name)).status).toBe(200)

    for (const user of [owner, member!]) {
      signInAs(user)
      expect((await (await listWorkspaces()).json()).data).toEqual([])
      expect([403, 404]).toContain((await getWorkspace(req('/x', 'GET'), params(workspace.id))).status)
      expect(await getAccess(workspace.id, user.id)).toBeNull()
      expect([403, 404]).toContain((await getProperty(req('/x', 'GET'), params(property.id))).status)
    }
    expect(await loadVisibleSite(property.subdomain)).toBeNull()

    // Listed for the owner to restore; members never see it.
    signInAs(member!)
    expect((await (await deletedWorkspaces()).json()).data).toEqual([])
    expect((await restoreWorkspace(req('/x', 'POST'), params(workspace.id))).status).toBe(404)
    signInAs(owner)
    expect((await (await deletedWorkspaces()).json()).data).toEqual([expect.objectContaining({ id: workspace.id, handle: workspace.slug, daysLeft: 30 })])

    // Its slug stays taken: a new workspace with the same short name gets another.
    const made = await (await createWorkspace(req('/api/workspaces', 'POST', { name: 'Khác', slug: workspace.slug }))).json()
    expect(made.data.slug).not.toBe(workspace.slug)

    await backdateWorkspace(workspace.id, 12)
    expect((await restoreWorkspace(req('/x', 'POST'), params(workspace.id))).status).toBe(200)
    signInAs(member!)
    expect((await (await listWorkspaces()).json()).data.map((w: { id: string }) => w.id)).toEqual([workspace.id])
    expect((await getAccess(workspace.id, member!.id))?.role).toBe('MANAGER')
    expect(await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: workspace.id } })).toMatchObject({ plan: 'growth', periodEnd })
  })

  it('is refused restoring after 30 days, then purged with everything in it', async () => {
    const { owner, member, workspace, property } = await createTenant({ memberRole: 'USER' })
    const second = await prisma.property.create({
      data: { workspaceId: workspace.id, name: 'Thứ hai', slug: 'thu-hai', type: 'HOTEL', address: '1', city: 'Huế', subdomain: 'thu-hai' },
    })
    const booking = await prisma.booking.update({ where: { id: (await createBooking(second.id, { status: 'CHECKED_OUT' })).id }, data: stayPast() })
    await prisma.payment.create({ data: { bookingId: booking.id, propertyId: second.id, amount: 1, netAmount: 1, method: 'CASH', status: 'PAID' } })
    await prisma.invoice.create({
      data: {
        bookingId: booking.id, propertyId: second.id, invoiceNumber: 'INVW1', companyName: 'A', companyAddress: 'B', taxCode: '0101010101',
        customerName: 'C', customerEmail: 'c@example.com', subtotal: 1, taxAmount: 0, totalAmount: 1, status: 'PUBLISHED', publishedAt: new Date(),
      },
    })
    await prisma.invitation.create({ data: { email: 'moi@example.com', workspaceId: workspace.id, token: 'tok-ws-purge', senderId: owner.id, expiresAt: new Date(Date.now() + DAY) } })
    await prisma.subscription.create({
      data: { workspaceId: workspace.id, plan: 'growth', billing: 'MONTH', trial: false, periodStart: new Date(), periodEnd: new Date(Date.now() + 20 * DAY) },
    })
    await prisma.subscriptionPayment.create({
      data: { workspaceId: workspace.id, plan: 'growth', billing: 'MONTH', amount: 5000, orderCode: '777002', status: 'PAID', paidAt: new Date() },
    })
    // A property deleted on its own before the workspace goes with it.
    signInAs(owner)
    expect((await delProperty(property.id, property.name)).status).toBe(200)
    expect((await delWorkspace(workspace.id, workspace.name)).status).toBe(200)

    await backdateWorkspace(workspace.id, 31)
    expect((await restoreWorkspace(req('/x', 'POST'), params(workspace.id))).status).toBe(410)

    const res = await purge()
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ properties: 2, workspaces: 1 })
    // It paid for a plan: Digistay's sale stays on record, on an emptied, hidden row with a freed slug.
    expect(await prismaWithDeleted.workspace.findUnique({ where: { id: workspace.id } })).toMatchObject({ slug: `purged-${workspace.id}` })
    expect(await prismaWithDeleted.subscriptionPayment.count({ where: { workspaceId: workspace.id, status: 'PAID' } })).toBe(1)
    for (const count of [
      prismaWithDeleted.property.count({ where: { workspaceId: workspace.id } }),
      prismaWithDeleted.booking.count(),
      prismaWithDeleted.payment.count(),
      prismaWithDeleted.invoice.count(),
      prismaWithDeleted.workspaceMember.count({ where: { workspaceId: workspace.id } }),
      prismaWithDeleted.invitation.count({ where: { workspaceId: workspace.id } }),
    ]) {
      expect(await count).toBe(0)
    }
    // The people stay; only the record of the purge is left of the workspace.
    expect(await prisma.user.count({ where: { id: { in: [owner.id, member!.id] } } })).toBe(2)
    const logs = await prismaWithDeleted.activityLog.findMany({ where: { entityId: workspace.id } })
    expect(logs.map((l) => l.action)).toEqual(['PURGE'])

    // Its slug is free again.
    const made = await (await createWorkspace(req('/api/workspaces', 'POST', { name: 'Mới', slug: workspace.slug }))).json()
    expect(made.data.slug).toBe(workspace.slug)

    // The kept row is not purged again on the next run.
    expect((await (await purge()).json()).data).toMatchObject({ workspaces: 0 })
  })

  it('removes a workspace that never paid for a plan entirely', async () => {
    const { owner, workspace } = await createTenant()
    signInAs(owner)
    const property = await prisma.property.findFirstOrThrow({ where: { workspaceId: workspace.id } })
    expect((await delProperty(property.id, property.name)).status).toBe(200)
    expect((await delWorkspace(workspace.id, workspace.name)).status).toBe(200)
    await backdateWorkspace(workspace.id, 31)
    expect((await purge()).status).toBe(200)
    expect(await prismaWithDeleted.workspace.count({ where: { id: workspace.id } })).toBe(0)
  })
})
