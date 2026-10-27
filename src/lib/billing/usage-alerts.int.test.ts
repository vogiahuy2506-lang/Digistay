/**
 * Nearing the plan's limits, against real Postgres (src/lib/billing/usage-alerts.ts):
 * the owner's bell at 80% and 100%, once each; e-invoices emailed too, per month;
 * a locked workspace is not told.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { createBooking, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { runUsageAlerts } from './usage-alerts'

const DAY = 86_400_000

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

function onGrowth(workspaceId: string, periodEnd = new Date(Date.now() + 20 * DAY)) {
  const row = { plan: 'growth', billing: 'MONTH' as const, trial: false, periodStart: new Date(Date.now() - 10 * DAY), periodEnd }
  return prisma.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...row }, update: row })
}

async function addStaff(workspaceId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const user = await createUser()
    await prisma.workspaceMember.create({ data: { workspaceId, userId: user.id, role: 'USER' } })
  }
}

async function publishInvoices(propertyId: string, count: number, at = new Date()) {
  const booking = await createBooking(propertyId)
  const stamp = Date.now()
  await prisma.invoice.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      bookingId: booking.id,
      propertyId,
      invoiceNumber: `INV-${stamp}-${i}`,
      companyName: 'Khách sạn',
      companyAddress: 'Hà Nội',
      taxCode: '0101234567',
      customerName: 'Khách',
      customerEmail: 'khach@example.com',
      subtotal: 100_000,
      taxAmount: 8_000,
      totalAmount: 108_000,
      publishedAt: at,
    })),
  })
}

const notices = (userId: string) =>
  prisma.notification.findMany({ where: { userId, type: 'plan_usage' }, orderBy: { createdAt: 'asc' }, select: { data: true, link: true } })

describe('usage alerts', () => {
  it('tells the owner at 80% and at 100%, once each, in the bell', async () => {
    const { owner, workspace } = await createTenant()
    await onGrowth(workspace.id)
    await addStaff(workspace.id, 8)

    await runUsageAlerts()
    let told = await notices(owner.id)
    expect(told).toHaveLength(1)
    expect(told[0]).toMatchObject({
      link: `/workspace/${workspace.slug}/billing`,
      data: { kind: 'staff', level: 80, used: 8, limit: 10, plan: 'growth', workspaceName: workspace.name },
    })

    // Again: nothing new.
    await runUsageAlerts()
    expect(await notices(owner.id)).toHaveLength(1)

    await addStaff(workspace.id, 2)
    await runUsageAlerts()
    told = await notices(owner.id)
    expect(told.map((n) => (n.data as { level: number }).level)).toEqual([80, 100])
    // Only e-invoices are emailed.
    expect(await prisma.emailOutbox.count({ where: { kind: 'plan_usage' } })).toBe(0)
  })

  it('emails e-invoices nearing the month’s limit, and starts over next month', async () => {
    const { owner, workspace, property } = await createTenant()
    // Still in force next month, when the count starts over.
    await onGrowth(workspace.id, new Date(Date.now() + 90 * DAY))
    await publishInvoices(property.id, 85)

    await runUsageAlerts()
    expect((await notices(owner.id)).map((n) => n.data)).toEqual([expect.objectContaining({ kind: 'invoices', level: 80, used: 85, limit: 100 })])
    const mail = await prisma.emailOutbox.findFirstOrThrow({ where: { kind: 'plan_usage' } })
    expect(mail.toEmail).toBe(owner.email)

    await publishInvoices(property.id, 15)
    await runUsageAlerts()
    expect(await prisma.emailOutbox.count({ where: { kind: 'plan_usage' } })).toBe(2)

    // Next month the count is back to 0: nothing to tell, and the month told is dropped.
    await runUsageAlerts(new Date(Date.now() + 40 * DAY))
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: workspace.id } })
    expect(sub.usageAlerts).toEqual({})
  })

  it('tells nothing to a read-only workspace', async () => {
    const { owner, workspace } = await createTenant()
    await onGrowth(workspace.id, new Date(Date.now() - 30 * DAY))
    await addStaff(workspace.id, 10)
    await runUsageAlerts()
    expect(await notices(owner.id)).toEqual([])
  })
})
