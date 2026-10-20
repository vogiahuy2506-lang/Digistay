/**
 * The email outbox against real Postgres: booking and invitation emails are
 * queued with the request (encrypted), sent once, retried with backoff,
 * given up and alerted. The SMTP send is mocked.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const sent = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendRendered: sent,
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, resetDatabase } from '@/test/integration/fixtures'
import { OUTBOX_MAX_ATTEMPTS, queueEmail, sendDueEmails, sendQueuedEmail } from './outbox'
import { findProblems } from '@/lib/ops/alerts'
import { POST as createBooking } from '@/app/api/bookings/route'
import { POST as invite } from '@/app/api/workspaces/[id]/invitations/route'
import { POST as outboxRoute } from '@/app/api/internal/email-outbox/route'

const MINUTE = 60 * 1000
const SITE = 'https://digistay.test'
const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const post = (body: object) => new NextRequest('http://digistay.test/api/x', { method: 'POST', body: JSON.stringify(body) })

async function roomType(propertyId: string, totalRooms = 1) {
  return prisma.roomType.create({
    data: { propertyId, name: 'Deluxe', slug: `deluxe-${Math.random().toString(36).slice(2, 7)}`, bedType: 'DOUBLE', totalRooms },
  })
}

const bookingBody = (propertyId: string, roomTypeId: string) => ({
  propertyId,
  roomTypeId,
  guestName: 'Lê Thị Hoa',
  guestEmail: 'hoa@example.com',
  guestPhone: '0912345678',
  checkInDate: '2026-12-01T07:00:00.000Z',
  checkOutDate: '2026-12-03T05:00:00.000Z',
  numAdults: 2,
})

beforeEach(async () => {
  await resetDatabase()
  sent.mockReset()
  sent.mockResolvedValue({ success: true, sent: true })
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await prisma.$disconnect()
})

describe('booking emails', () => {
  it('are queued with the booking, link to real pages, and are sent once', async () => {
    const { owner, property, workspace } = await createTenant()
    signInAs(owner)
    const rt = await roomType(property.id)
    const res = await createBooking(post(bookingBody(property.id, rt.id)))
    expect(res.status).toBe(200)
    const booking = (await res.json()).data

    const rows = await prisma.emailOutbox.findMany({ orderBy: { kind: 'asc' } })
    expect(rows.map((r) => [r.kind, r.toEmail, r.status, r.refId])).toEqual([
      ['booking_confirmation', 'hoa@example.com', 'PENDING', booking.id],
      ['owner_new_booking', owner.email, 'PENDING', booking.id],
    ])
    // Stored encrypted.
    expect(rows.every((r) => r.message.startsWith('v1.') && !r.message.includes('Lê Thị Hoa'))).toBe(true)
    // Outside a request there is no "after the response": the job sends them.
    expect(sent).not.toHaveBeenCalled()

    expect(await sendDueEmails()).toMatchObject({ sent: 2, failed: 0 })
    const byTo = Object.fromEntries(sent.mock.calls.map(([to, message]) => [to.email, message]))
    expect(byTo['hoa@example.com'].html).toContain(`${SITE}/${property.subdomain}`)
    expect(byTo['hoa@example.com'].html).not.toContain('/bookings/')
    expect(byTo[owner.email].text).toContain(`${SITE}/workspace/${workspace.slug}/properties/${property.id}/bookings/${booking.id}`)
    expect(await prisma.emailOutbox.count({ where: { status: 'SENT' } })).toBe(2)

    await sendDueEmails()
    expect(sent).toHaveBeenCalledTimes(2)
  })

  it('a booking that is refused queues nothing', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const rt = await roomType(property.id, 1)
    expect((await createBooking(post(bookingBody(property.id, rt.id)))).status).toBe(200)
    expect((await createBooking(post(bookingBody(property.id, rt.id)))).status).toBe(409) // full
    expect(await prisma.emailOutbox.count()).toBe(2)
  })
})

describe('invitation emails', () => {
  it('are queued encrypted (the link holds the token) and sent with it', async () => {
    const { owner, workspace } = await createTenant()
    signInAs(owner)
    const res = await invite(post({ email: 'nv@example.com', role: 'RECEPTIONIST' }), { params: Promise.resolve({ id: workspace.id }) })
    expect(res.status).toBe(200)
    const invitation = await prisma.invitation.findFirstOrThrow({ where: { email: 'nv@example.com' } })
    const row = await prisma.emailOutbox.findFirstOrThrow({ where: { kind: 'workspace_invite' } })
    expect(row.refId).toBe(invitation.id)
    expect(row.message).not.toContain(invitation.token)

    await sendDueEmails()
    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent.mock.calls[0][1].html).toContain(`${SITE}/invitations/${invitation.token}`)
  })
})

describe('sending', () => {
  const queued = () => queueEmail('booking_confirmation', { to: { email: 'k@example.com' }, subject: 'S', text: 'T', html: '<p>T</p>' })

  it('a failure is retried with backoff, then given up, and the ops alerts list it', async () => {
    const id = await queued()
    sent.mockResolvedValue({ success: true, sent: false, error: 'Email service not configured' })
    const t0 = Date.now()
    await sendDueEmails(new Date(t0))
    let row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } })
    expect(row).toMatchObject({ status: 'FAILED', attempts: 1 })
    expect(row.error).toContain('chưa cấu hình')
    expect(row.nextAt!.getTime()).toBe(t0 + 10 * MINUTE)

    await sendDueEmails(new Date(t0 + 5 * MINUTE))
    expect(sent).toHaveBeenCalledTimes(1)
    let at = t0
    for (const wait of [10, 30, 120, 360]) {
      at += wait * MINUTE
      await sendDueEmails(new Date(at))
    }
    row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } })
    expect(sent).toHaveBeenCalledTimes(OUTBOX_MAX_ATTEMPTS)
    expect(row).toMatchObject({ status: 'FAILED', attempts: OUTBOX_MAX_ATTEMPTS, nextAt: null })
    await sendDueEmails(new Date(at + 24 * 60 * MINUTE))
    expect(sent).toHaveBeenCalledTimes(OUTBOX_MAX_ATTEMPTS)

    const problem = (await findProblems()).find((f) => f.key === 'email_gave_up')!
    expect(problem.lines[0]).toContain('k@example.com')
  })

  it('a send that throws is a failure too; three senders at once send one email', async () => {
    const id = await queued()
    sent.mockRejectedValueOnce(new Error('socket hang up'))
    expect((await sendQueuedEmail(id)).outcome).toBe('failed')

    sent.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true, sent: true }), 50)))
    for (let round = 0; round < 3; round++) {
      sent.mockClear()
      await prisma.emailOutbox.update({ where: { id }, data: { status: 'PENDING', nextAt: null } })
      const outcomes = await Promise.all([1, 2, 3].map(() => sendQueuedEmail(id)))
      expect(outcomes.filter((o) => o.outcome === 'sent')).toHaveLength(1)
      expect(sent).toHaveBeenCalledTimes(1)
    }
  })

  it('sent emails are dropped after 30 days; the job route needs the cron secret', async () => {
    const id = await queued()
    await sendDueEmails()
    await prisma.emailOutbox.update({ where: { id }, data: { sentAt: new Date(Date.now() - 31 * 24 * 60 * MINUTE) } })

    const run = (secret?: string) =>
      outboxRoute(new NextRequest('http://digistay.test/api/internal/email-outbox', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} }))
    const secret = `outbox-${Math.random().toString(36).slice(2)}-${Date.now()}`
    vi.stubEnv('CRON_SECRET', secret)
    expect((await run()).status).toBe(401)
    const res = await run(secret)
    expect((await res.json()).data).toMatchObject({ sent: 0, pruned: 1 })
    expect(await prisma.jobRun.count({ where: { job: 'email-outbox', status: 'SUCCESS' } })).toBe(1)
  })
})
