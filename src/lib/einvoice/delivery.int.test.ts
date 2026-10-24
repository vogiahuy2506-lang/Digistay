/**
 * Invoice emails and auto-issue on full payment, against real Postgres and
 * the fake Mắt Bão (src/test/integration/fake-matbao.ts). The SMTP send is
 * mocked: what is checked is when we send, to whom, what is attached, and
 * that nothing is sent or issued twice.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const mail = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendInvoiceEmail: mail,
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking, createPendingPayment, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { FAKE_PDF, FakeMatbao, type FakeMatbaoAccount } from '@/test/integration/fake-matbao'
import { lockBooking, syncBookingPayments } from '@/lib/payments/booking-payments'
import { clearMatbaoTokens } from './matbao-client'
import { connectEinvoice, type EinvoiceSettings } from './matbao'
import { EMAIL_MAX_ATTEMPTS, sendInvoiceEmailFor } from './delivery'
import { autoIssuePaidBookings, retryAutoIssued, runEinvoiceJobs } from './jobs'
import { POST as createInvoiceRoute } from '@/app/api/invoices/route'
import { POST as publishRoute } from '@/app/api/invoices/[id]/publish/route'
import { POST as cancelRoute } from '@/app/api/invoices/[id]/cancel/route'
import { POST as emailRoute } from '@/app/api/invoices/[id]/email/route'
import { PATCH as optionsRoute } from '@/app/api/properties/[id]/einvoice/route'
import { POST as jobsRoute } from '@/app/api/internal/einvoice-jobs/route'

const fake = new FakeMatbao()
const SERIES = `C${new Date().getFullYear() % 100}TAA`
let ACCOUNT: FakeMatbaoAccount
const SETTINGS = (): EinvoiceSettings => ({
  environment: 'DEMO',
  taxCode: ACCOUNT.taxCode,
  username: ACCOUNT.username,
  password: ACCOUNT.password,
  templateCode: '1',
  series: SERIES,
  vatCode: 8,
})
const originalBase = process.env.MATBAO_BASE_URL

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const req = (method: string, body?: object) =>
  new NextRequest('http://digistay.test/api/x', { method, ...(body && { body: JSON.stringify(body) }) })
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const MINUTE = 60 * 1000

const COMPANY = {
  buyerType: 'company',
  companyName: 'Công ty TNHH Du Lịch Sen',
  companyAddress: '12 Lê Lợi, Quận 1, TP.HCM',
  taxCode: '0309876543',
  companyEmail: 'ketoan@sen.vn',
  customerName: 'Nguyễn Văn An',
  customerEmail: 'an@sen.vn',
}

async function connectedTenant(memberRole?: 'USER' | 'RECEPTIONIST') {
  const tenant = await createTenant(memberRole ? { memberRole } : {})
  await connectEinvoice(tenant.property.id, SETTINGS(), tenant.owner.id)
  signInAs(tenant.owner)
  return tenant
}

async function publishedInvoice(propertyId: string, body: object = { ...COMPANY, totalAmount: 1_080_000 }) {
  const booking = await createBooking(propertyId, { totalAmount: 1_080_000, status: 'CHECKED_OUT' })
  const created = await (await createInvoiceRoute(req('POST', { bookingId: booking.id, ...body }))).json()
  const published = await (await publishRoute(req('POST'), params(created.data.id))).json()
  expect(published.success).toBe(true)
  return published.data
}

const invoiceOf = (id: string) => prisma.invoice.findUniqueOrThrow({ where: { id } })

/** Pays the booking in full the way the payment paths do. */
async function payInFull(booking: { id: string; propertyId: string; totalAmount: number }, paidAt = new Date()) {
  const payment = await createPendingPayment(booking, booking.totalAmount)
  await prisma.$transaction(async (tx) => {
    await lockBooking(tx, booking.id)
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', paidAt } })
    await syncBookingPayments(tx, booking.id)
  })
}

const setOptions = (propertyId: string, body: object) => optionsRoute(req('PATCH', body), params(propertyId))

beforeAll(async () => {
  await fake.start()
  process.env.MATBAO_BASE_URL = fake.url
})
beforeEach(async () => {
  await resetDatabase()
  fake.accounts.length = 0
  fake.issued.clear()
  fake.createCalls.length = 0
  fake.failNext = null
  ACCOUNT = fake.addAccount({
    taxCode: '0312345678',
    username: 'ks-demo',
    password: 'mat-khau-dung',
    templates: [{ khmshDon: '1', khhDon: SERIES, cLai: 100 }],
  })
  clearMatbaoTokens()
  mail.mockReset()
  mail.mockResolvedValue({ success: true, sent: true, id: 'm1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(async () => {
  await fake.stop()
  process.env.MATBAO_BASE_URL = originalBase
  await prisma.$disconnect()
})

describe('invoice emails', () => {
  it('publishing queues it; the job sends the PDF once, to the company email', async () => {
    const { property } = await connectedTenant()
    const invoice = await publishedInvoice(property.id)
    expect(invoice.emailStatus).toBe('PENDING')
    // Outside a request there is no "after the response": the job sends it.
    expect(mail).not.toHaveBeenCalled()

    expect((await runEinvoiceJobs()).emails).toEqual({ sent: 1, failed: 0, skipped: 0 })
    expect(mail).toHaveBeenCalledTimes(1)
    const sent = mail.mock.calls[0][0]
    expect(sent).toMatchObject({
      to: 'ketoan@sen.vn',
      customerName: COMPANY.companyName,
      einvoiceNumber: invoice.einvoiceNumber,
      series: SERIES,
      lookupCode: `DS${invoice.invoiceNumber}`,
      totalAmount: 1_080_000,
      taxAmount: 80_000,
    })
    expect(Buffer.compare(sent.pdf.content, FAKE_PDF)).toBe(0)
    expect(await invoiceOf(invoice.id)).toMatchObject({ emailStatus: 'SENT', emailAttempts: 1, emailError: null })

    await runEinvoiceJobs()
    expect(mail).toHaveBeenCalledTimes(1)
  })

  it('is in the language of the booking it is for', async () => {
    const { property } = await connectedTenant()
    const vi_ = await publishedInvoice(property.id)
    const en = await publishedInvoice(property.id)
    await prisma.booking.update({ where: { id: en.bookingId }, data: { locale: 'en' } })
    await runEinvoiceJobs()
    const localeOf = (id: string) => mail.mock.calls.find(([sent]) => sent.einvoiceNumber === id)?.[0].locale
    expect(localeOf(vi_.einvoiceNumber)).toBe('vi')
    expect(localeOf(en.einvoiceNumber)).toBe('en')
  })

  it('a failure is tried again with backoff, and given up after the last attempt', async () => {
    const { property } = await connectedTenant()
    const invoice = await publishedInvoice(property.id)
    mail.mockResolvedValue({ success: true, sent: false, error: 'Email service not configured' })

    const t0 = Date.now()
    await runEinvoiceJobs(new Date(t0))
    let row = await invoiceOf(invoice.id)
    expect(row).toMatchObject({ emailStatus: 'FAILED', emailAttempts: 1 })
    expect(row.emailError).toContain('chưa cấu hình gửi email')
    expect(row.emailNextAt!.getTime()).toBe(t0 + 10 * MINUTE)

    await runEinvoiceJobs(new Date(t0 + 5 * MINUTE)) // not yet
    expect(mail).toHaveBeenCalledTimes(1)

    // 10 min, 30 min, 2 h, 6 h after each failure; then no more.
    let at = t0
    for (const wait of [10, 30, 120, 360]) {
      at += wait * MINUTE
      await runEinvoiceJobs(new Date(at))
    }
    row = await invoiceOf(invoice.id)
    expect(mail).toHaveBeenCalledTimes(EMAIL_MAX_ATTEMPTS)
    expect(row).toMatchObject({ emailStatus: 'FAILED', emailAttempts: EMAIL_MAX_ATTEMPTS, emailNextAt: null })
    await runEinvoiceJobs(new Date(at + 24 * 60 * MINUTE))
    expect(mail).toHaveBeenCalledTimes(EMAIL_MAX_ATTEMPTS)

    // Staff can still send it by hand, once SMTP works.
    mail.mockResolvedValue({ success: true, sent: true })
    const res = await emailRoute(req('POST'), params(invoice.id))
    expect(res.status).toBe(200)
    expect(await invoiceOf(invoice.id)).toMatchObject({ emailStatus: 'SENT', emailError: null })
  })

  it('no buyer email is skipped; with emails off nothing is queued, but staff can send', async () => {
    const { property } = await connectedTenant()
    const noEmail = await publishedInvoice(property.id, { ...COMPANY, companyEmail: '', totalAmount: 1_080_000 })
    await prisma.invoice.update({ where: { id: noEmail.id }, data: { customerEmail: '' } })
    await runEinvoiceJobs()
    expect(await invoiceOf(noEmail.id)).toMatchObject({ emailStatus: 'SKIPPED', emailNextAt: null })
    expect(mail).not.toHaveBeenCalled()

    expect((await setOptions(property.id, { emailInvoices: false })).status).toBe(200)
    const quiet = await publishedInvoice(property.id)
    expect(quiet.emailStatus).toBeNull()
    await runEinvoiceJobs()
    expect(mail).not.toHaveBeenCalled()

    expect((await emailRoute(req('POST'), params(quiet.id))).status).toBe(200)
    expect(mail).toHaveBeenCalledTimes(1)
    expect(mail.mock.calls[0][0].to).toBe('ketoan@sen.vn')
  })

  it('staff only, issued invoices only, and two senders at once send one email', async () => {
    const { property, member, owner } = await connectedTenant('USER')
    const invoice = await publishedInvoice(property.id)

    signInAs(member!)
    expect((await emailRoute(req('POST'), params(invoice.id))).status).toBe(403)
    signInAs(owner)
    const booking = await createBooking(property.id, { totalAmount: 500_000 })
    const draft = await (await createInvoiceRoute(req('POST', { bookingId: booking.id, ...COMPANY, totalAmount: 500_000 }))).json()
    expect((await emailRoute(req('POST'), params(draft.data.id))).status).toBe(409)

    // A slow SMTP makes the overlap certain; several rounds, as one can run in order by chance.
    mail.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true, sent: true }), 50)))
    for (let round = 0; round < 3; round++) {
      mail.mockClear()
      await prisma.invoice.update({ where: { id: invoice.id }, data: { emailStatus: 'PENDING', emailNextAt: null } })
      const outcomes = await Promise.all([1, 2, 3].map(() => sendInvoiceEmailFor(invoice.id)))
      expect(outcomes.filter((o) => o.outcome === 'sent')).toHaveLength(1)
      expect(mail).toHaveBeenCalledTimes(1)
    }
  })
})

describe('auto-issue on full payment', () => {
  async function autoTenant() {
    const tenant = await connectedTenant('USER')
    const res = await setOptions(tenant.property.id, { autoIssue: true })
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ autoIssue: true })
    return tenant
  }

  async function paidBooking(propertyId: string, vat: object = {}, paidAt?: Date) {
    const booking = await createBooking(propertyId, { totalAmount: 2_160_000, status: 'CONFIRMED' })
    await prisma.booking.update({ where: { id: booking.id }, data: { guestName: 'Trần Thị Bình', ...vat } })
    await payInFull(booking, paidAt)
    return booking
  }

  const invoicesOf = (bookingId: string) => prisma.invoice.findMany({ where: { bookingId } })

  it('a booking paid in full gets one invoice, issued and emailed, to the company the guest entered', async () => {
    const { property } = await autoTenant()
    const booking = await paidBooking(property.id, {
      vatCompany: 'Công ty CP Lữ Hành Mai',
      vatTaxCode: '0301112223',
      vatAddress: '5 Hai Bà Trưng, Hà Nội',
      vatEmail: 'hoadon@mai.vn',
    })
    const guest = await paidBooking(property.id)

    const summary = await runEinvoiceJobs()
    expect(summary.issued).toEqual({ created: 2, published: 2, needsStaff: 0 })
    const [company] = await invoicesOf(booking.id)
    expect(company).toMatchObject({
      autoIssued: true,
      status: 'PUBLISHED',
      buyerType: 'company',
      taxCode: '0301112223',
      totalAmount: 2_160_000,
      subtotal: 2_000_000,
      emailStatus: 'SENT',
    })
    const sentCompany = fake.createCalls.find((c) => c.MaTraCuu === `DS${company.invoiceNumber}`)!
    expect(sentCompany).toMatchObject({ NMua_Ten: 'Công ty CP Lữ Hành Mai', NMua_MST: '0301112223', TgTTTBSo: 2_160_000 })
    expect(mail.mock.calls.map(([m]) => m.to).sort()).toEqual(['hoadon@mai.vn', guest.guestEmail].sort())

    const [personal] = await invoicesOf(guest.id)
    expect(personal).toMatchObject({ buyerType: 'personal', customerName: 'Trần Thị Bình', status: 'PUBLISHED' })
    expect(await prisma.activityLog.count({ where: { action: 'PUBLISH', userId: null } })).toBe(2)

    await runEinvoiceJobs()
    expect(await prisma.invoice.count()).toBe(2)
    expect(fake.createCalls).toHaveLength(2)
  })

  it('only bookings fully paid since it was turned on, never invoiced, not cancelled', async () => {
    const { property, owner } = await autoTenant()
    const before = await paidBooking(property.id, {}, new Date(Date.now() - 60 * MINUTE))
    const partly = await createBooking(property.id, { totalAmount: 2_160_000, status: 'CONFIRMED' })
    await payInFull({ ...partly, totalAmount: 500_000 })
    const staffInvoiced = await paidBooking(property.id)
    signInAs(owner)
    await createInvoiceRoute(req('POST', { bookingId: staffInvoiced.id, ...COMPANY, totalAmount: 1_000_000 }))
    const cancelled = await paidBooking(property.id)
    await prisma.booking.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } })

    await runEinvoiceJobs()
    expect(await invoicesOf(before.id)).toHaveLength(0)
    expect(await invoicesOf(partly.id)).toHaveLength(0)
    expect((await invoicesOf(staffInvoiced.id)).map((i) => i.autoIssued)).toEqual([false])
    expect(await invoicesOf(cancelled.id)).toHaveLength(0)
    expect(fake.createCalls).toHaveLength(0)

    // Staff cancelled the automatic invoice of a booking: it is not made again.
    const third = await paidBooking(property.id, { vatTaxCode: 'sai-ma' })
    await runEinvoiceJobs()
    const [auto] = await invoicesOf(third.id)
    expect((await cancelRoute(req('POST'), params(auto.id))).status).toBe(200)
    await runEinvoiceJobs()
    expect(await invoicesOf(third.id)).toHaveLength(1)

    // Turned off: nothing new.
    await setOptions(property.id, { autoIssue: false })
    const later = await paidBooking(property.id)
    await runEinvoiceJobs()
    expect(await invoicesOf(later.id)).toHaveLength(0)
  })

  it('two runs at once (overlapping timers) issue one invoice per booking', async () => {
    const { property } = await autoTenant()
    for (let round = 0; round < 3; round++) {
      const booking = await paidBooking(property.id)
      await Promise.all([autoIssuePaidBookings(), autoIssuePaidBookings(), autoIssuePaidBookings()])
      expect(await invoicesOf(booking.id)).toHaveLength(1)
    }
    expect(fake.issued.size).toBe(3)
  })

  it('details Mắt Bão would refuse wait for staff with the reason, and are never sent', async () => {
    const { property } = await autoTenant()
    const booking = await paidBooking(property.id, { vatCompany: 'Công ty ABC', vatTaxCode: '123', vatAddress: 'Hà Nội 1' })
    expect((await runEinvoiceJobs()).issued).toEqual({ created: 1, published: 0, needsStaff: 1 })
    await runEinvoiceJobs()
    const invoices = await invoicesOf(booking.id)
    expect(invoices).toHaveLength(1)
    expect(invoices[0]).toMatchObject({ status: 'PENDING', autoIssued: true })
    expect(invoices[0].publishError).toContain('chưa hợp lệ')
    expect(fake.createCalls).toHaveLength(0)
  })

  it('a connection lost after Mắt Bão issued it is settled by publishing again, with one invoice', async () => {
    const { property } = await autoTenant()
    const booking = await paidBooking(property.id)
    fake.failNext = 'drop-after-issue'
    // The retry step of the same run publishes it again: Mắt Bão answers 304.
    expect(await runEinvoiceJobs()).toMatchObject({ issued: { created: 1, published: 0 }, retried: { retried: 1, published: 1 } })
    const [invoice] = await invoicesOf(booking.id)
    expect(invoice.status).toBe('PUBLISHED')
    expect(invoice.metadata).toMatchObject({ matbao: { code: '304', alreadyIssued: true } })
    expect(fake.issued.size).toBe(1)
    expect(fake.createCalls).toHaveLength(2)

    await runEinvoiceJobs()
    expect(fake.createCalls).toHaveLength(2)
  })

  it('a retry that died mid-call (stuck PUBLISHING) is taken over once the lease is over', async () => {
    const { property } = await autoTenant()
    const booking = await paidBooking(property.id)
    fake.failNext = 'drop-before-issue'
    await autoIssuePaidBookings() // uncertain: PENDING, lookupCode kept
    const [invoice] = await invoicesOf(booking.id)
    expect(invoice).toMatchObject({ status: 'PENDING', lookupCode: `DS${invoice.invoiceNumber}` })
    // A retry claimed it, then the process died before Mắt Bão answered.
    await prisma.$executeRaw`UPDATE invoices SET status = 'PUBLISHING', "updatedAt" = now() WHERE id = ${invoice.id}`

    expect(await retryAutoIssued()).toEqual({ retried: 0, published: 0 })
    expect(await retryAutoIssued(new Date(Date.now() + 3 * MINUTE))).toEqual({ retried: 1, published: 1 })
    expect((await invoiceOf(invoice.id)).status).toBe('PUBLISHED')
    expect(fake.issued.size).toBe(1)
  })

  it('only owners/ADMINs switch it, on a connected property; turning it on starts the clock', async () => {
    const { property, member, owner } = await connectedTenant('USER')
    signInAs(member!)
    expect((await setOptions(property.id, { autoIssue: true })).status).toBe(403)
    signInAs(owner)
    expect((await setOptions(property.id, {})).status).toBe(400)

    const t = Date.now()
    await setOptions(property.id, { autoIssue: true })
    const since = (await prisma.propertyEinvoice.findUniqueOrThrow({ where: { propertyId: property.id } })).autoIssueSince!
    expect(since.getTime()).toBeGreaterThanOrEqual(t)
    await setOptions(property.id, { autoIssue: true }) // already on: the clock stays
    expect((await prisma.propertyEinvoice.findUniqueOrThrow({ where: { propertyId: property.id } })).autoIssueSince).toEqual(since)

    const other = await createTenant()
    signInAs(other.owner)
    expect((await setOptions(other.property.id, { autoIssue: true })).status).toBe(400) // not connected
  })

  it('the job endpoint needs the cron secret', async () => {
    const run = (secret?: string) =>
      jobsRoute(
        new NextRequest('http://digistay.test/api/internal/einvoice-jobs', {
          method: 'POST',
          headers: secret ? { 'x-cron-secret': secret } : {},
        })
      )
    const previous = process.env.CRON_SECRET
    const secret = 'a'.repeat(16) + Math.random().toString(36).slice(2)
    try {
      delete process.env.CRON_SECRET
      expect((await run(secret)).status).toBe(503)
      process.env.CRON_SECRET = secret
      expect((await run()).status).toBe(401)
      expect((await run(secret.replace(/^a/, 'b'))).status).toBe(401)
      const ok = await run(secret)
      expect(ok.status).toBe(200)
      expect((await ok.json()).data).toMatchObject({ issued: { created: 0 }, emails: { sent: 0 } })
    } finally {
      process.env.CRON_SECRET = previous
    }
  })
})
