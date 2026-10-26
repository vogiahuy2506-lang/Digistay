/**
 * Issuing the automatic invoice the moment a booking is fully paid (task
 * 38) and the buyer's public invoice link (task 39), against real Postgres
 * and the fake Mắt Bão (src/test/integration/fake-matbao.ts).
 *
 * Next's after() has no request scope here, so it is replaced by a queue the
 * test runs, as Next does once the response has gone out. The SMTP send is
 * mocked.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
const mail = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendInvoiceEmail: mail,
}))
const afterQueue = vi.hoisted(() => [] as unknown[])
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: unknown) => {
    afterQueue.push(task)
  },
}))
// The lookup's rate limit uses Redis: an in-memory one (CI has none).
const redis = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    get: async (k: string) => data.get(k) ?? null,
    set: async (k: string, v: string) => (data.set(k, v), 'OK'),
    del: async (k: string) => (data.delete(k) ? 1 : 0),
    incr: async (k: string) => {
      const n = Number(data.get(k) ?? 0) + 1
      data.set(k, String(n))
      return n
    },
    expire: async () => 1,
    ttl: async () => 600,
  }
})
vi.mock('@/lib/db/redis', () => ({ redis }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createBooking, createPendingPayment, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { FAKE_PDF, FakeMatbao, type FakeMatbaoAccount } from '@/test/integration/fake-matbao'
import { lockBooking, syncBookingPayments } from '@/lib/payments/booking-payments'
import { LIMITS } from '@/lib/security/limits'
import { clearMatbaoTokens } from './matbao-client'
import { connectEinvoice, type EinvoiceSettings } from './matbao'
import { autoIssuePaidBookings, runEinvoiceJobs } from './jobs'
import { invoiceLookupToken } from './lookup-link'
import { loadInvoiceLookup } from './lookup-view'
import { GET as listInvoicesRoute } from '@/app/api/invoices/route'
import { POST as publishRoute } from '@/app/api/invoices/[id]/publish/route'
import { POST as replaceRoute } from '@/app/api/invoices/[id]/replace/route'
import { POST as paymentsRoute } from '@/app/api/payments/route'
import { POST as confirmRoute } from '@/app/api/payments/[id]/confirm/route'
import { PATCH as optionsRoute } from '@/app/api/properties/[id]/einvoice/route'
import { GET as publicPdfRoute } from '@/app/api/public/invoices/[token]/pdf/route'

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
const TOTAL = 2_160_000

const signInAs = (user: { id: string; email: string }) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const req = (method: string, body?: object, headers: Record<string, string> = {}) =>
  new NextRequest('http://digistay.test/api/x', { method, headers, ...(body && { body: JSON.stringify(body) }) })
const params = <K extends string>(key: K, value: string) => ({ params: Promise.resolve({ [key]: value } as Record<K, string>) })

/** Runs what the routes left for after the response, as Next would. */
async function afterResponse() {
  while (afterQueue.length) {
    const task = afterQueue.shift()
    await (typeof task === 'function' ? task() : task)
  }
}

async function tenant({ autoIssue }: { autoIssue: boolean }) {
  const t = await createTenant()
  await connectEinvoice(t.property.id, SETTINGS(), t.owner.id)
  signInAs(t.owner)
  if (autoIssue) expect((await optionsRoute(req('PATCH', { autoIssue: true }), params('id', t.property.id))).status).toBe(200)
  return t
}

async function booking(propertyId: string, locale = 'vi') {
  const b = await createBooking(propertyId, { totalAmount: TOTAL, status: 'CONFIRMED' })
  return prisma.booking.update({ where: { id: b.id }, data: { guestName: 'Trần Thị Bình', locale } })
}

async function payCash(bookingId: string, amount: number) {
  const res = await paymentsRoute(req('POST', { bookingId, method: 'CASH', amount }))
  expect(res.status).toBeLessThan(300)
}

const invoicesOf = (bookingId: string) => prisma.invoice.findMany({ where: { bookingId } })

beforeAll(async () => {
  await fake.start()
  process.env.MATBAO_BASE_URL = fake.url
  process.env.NEXTAUTH_SECRET ??= 'issue-now-test-secret' // signs the lookup link (lookup-link.ts)
  process.env.NEXTAUTH_URL ??= 'https://digistay.test'
})
beforeEach(async () => {
  await resetDatabase()
  afterQueue.length = 0
  redis.data.clear()
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

describe('auto-issue the moment a booking is fully paid', () => {
  it('a cash payment settling the booking issues and emails the invoice after the response; the job then has nothing to do', async () => {
    const { property } = await tenant({ autoIssue: true })
    const b = await booking(property.id, 'en')
    await payCash(b.id, TOTAL)
    // Not inside the request: the guest's payment answer never waits for Mắt Bão.
    expect(await invoicesOf(b.id)).toHaveLength(0)

    await afterResponse()
    const [invoice] = await invoicesOf(b.id)
    expect(invoice).toMatchObject({ autoIssued: true, status: 'PUBLISHED', totalAmount: TOTAL, emailStatus: 'SENT', fiscalCode: ACCOUNT.taxCode })
    expect(fake.createCalls).toHaveLength(1)
    expect(mail).toHaveBeenCalledTimes(1)
    // The email links to the buyer's page, in the booking's language.
    expect(mail.mock.calls[0][0]).toMatchObject({
      to: b.guestEmail,
      locale: 'en',
      lookupUrl: `${process.env.NEXTAUTH_URL}/${property.subdomain}/en/hoa-don/${invoiceLookupToken(invoice.id)}`,
    })

    // The job is only the fallback: no second invoice, no second email.
    expect(await runEinvoiceJobs()).toMatchObject({
      issued: { created: 0, published: 0, needsStaff: 0 },
      retried: { retried: 0, published: 0 },
      emails: { sent: 0, failed: 0, skipped: 0 },
    })
    expect(await invoicesOf(b.id)).toHaveLength(1)
    expect(fake.createCalls).toHaveLength(1)
    expect(mail).toHaveBeenCalledTimes(1)
  })

  it('a transfer staff confirm issues it too (the path manual "guest says transferred" payments are recorded through)', async () => {
    const { property } = await tenant({ autoIssue: true })
    const b = await booking(property.id)
    const payment = await createPendingPayment(b, TOTAL)
    expect((await confirmRoute(req('POST'), params('id', payment.id))).status).toBe(200)
    await afterResponse()
    expect((await invoicesOf(b.id)).map((i) => i.status)).toEqual(['PUBLISHED'])
  })

  it('a partial payment issues nothing; the payment that completes it does', async () => {
    const { property } = await tenant({ autoIssue: true })
    const b = await booking(property.id)
    await payCash(b.id, 1_000_000)
    await afterResponse()
    expect(await invoicesOf(b.id)).toHaveLength(0)
    expect(fake.createCalls).toHaveLength(0)

    await payCash(b.id, TOTAL - 1_000_000)
    await afterResponse()
    expect(await invoicesOf(b.id)).toHaveLength(1)
    expect(fake.createCalls).toHaveLength(1)
  })

  it('manual issuing (auto-issue off): a fully paid booking gets no invoice, now or from the job', async () => {
    const { property } = await tenant({ autoIssue: false })
    const b = await booking(property.id)
    await payCash(b.id, TOTAL)
    await afterResponse()
    await runEinvoiceJobs()
    expect(await invoicesOf(b.id)).toHaveLength(0)

    // Switched back to manual after using automatic: nothing either.
    expect((await optionsRoute(req('PATCH', { autoIssue: true }), params('id', property.id))).status).toBe(200)
    expect((await optionsRoute(req('PATCH', { autoIssue: false }), params('id', property.id))).status).toBe(200)
    const later = await booking(property.id)
    await payCash(later.id, TOTAL)
    await afterResponse()
    await runEinvoiceJobs()
    expect(await invoicesOf(later.id)).toHaveLength(0)
    expect(fake.createCalls).toHaveLength(0)
  })

  it('a payment rolled back after it settled the booking issues nothing', async () => {
    const { property } = await tenant({ autoIssue: true })
    const b = await booking(property.id)
    const payment = await createPendingPayment(b, TOTAL)
    await expect(
      prisma.$transaction(async (tx) => {
        await lockBooking(tx, b.id)
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', paidAt: new Date() } })
        await syncBookingPayments(tx, b.id)
        throw new Error('later step failed')
      })
    ).rejects.toThrow('later step failed')
    expect(afterQueue).toHaveLength(1) // scheduled inside the transaction...
    await afterResponse()
    expect(await invoicesOf(b.id)).toHaveLength(0) // ...but the booking is not paid
  })

  it('issuing at once and the job at the same moment make one invoice', async () => {
    const { property } = await tenant({ autoIssue: true })
    for (let round = 0; round < 3; round++) {
      const b = await booking(property.id)
      await payCash(b.id, TOTAL)
      await Promise.all([afterResponse(), autoIssuePaidBookings(), autoIssuePaidBookings()])
      expect(await invoicesOf(b.id)).toHaveLength(1)
    }
    expect(fake.issued.size).toBe(3)
    await runEinvoiceJobs()
    expect(fake.issued.size).toBe(3)
    // Each invoice emailed once, whoever issued it.
    expect(mail).toHaveBeenCalledTimes(3)
  })
})

describe('the public invoice link', () => {
  async function issued(locale = 'vi') {
    const t = await tenant({ autoIssue: true })
    const b = await booking(t.property.id, locale)
    await prisma.booking.update({
      where: { id: b.id },
      data: { vatCompany: 'Công ty CP Lữ Hành Mai', vatTaxCode: '0301112223', vatAddress: '5 Hai Bà Trưng, Hà Nội' },
    })
    await payCash(b.id, TOTAL)
    await afterResponse()
    const [invoice] = await invoicesOf(b.id)
    expect(invoice.status).toBe('PUBLISHED')
    return { ...t, booking: b, invoice, token: invoiceLookupToken(invoice.id) }
  }
  const pdf = (token: string, query = '', ip = '203.0.113.7') =>
    publicPdfRoute(new NextRequest(`http://digistay.test/api/public/invoices/${token}/pdf${query}`, { headers: { 'x-real-ip': ip } }), params('token', token))

  it('shows the invoice on its own hotel only, and serves its PDF for the right token', async () => {
    const { property, invoice, token } = await issued()
    expect(await loadInvoiceLookup(property.subdomain, token)).toMatchObject({
      status: 'PUBLISHED',
      environment: 'DEMO',
      seller: { name: property.name, taxCode: ACCOUNT.taxCode },
      buyer: { kind: 'company', company: 'Công ty CP Lữ Hành Mai', taxCode: '0301112223', name: 'Trần Thị Bình' },
      number: invoice.einvoiceNumber,
      pattern: '1',
      series: SERIES,
      lookupCode: `DS${invoice.invoiceNumber}`,
      totalAmount: TOTAL,
      taxAmount: 160_000,
      replacedBy: null,
    })
    // Another hotel's site does not show it.
    expect(await loadInvoiceLookup(`${property.subdomain}-x`, token)).toBeNull()

    const res = await pdf(token)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain(`attachment; filename="hoa-don-${invoice.einvoiceNumber}.pdf"`)
    expect(Buffer.from(await res.arrayBuffer()).equals(FAKE_PDF)).toBe(true)
  })

  it('a wrong token, the guessable MaTraCuu, or an invoice not issued is a 404', async () => {
    const { property, invoice, token, booking: b } = await issued()
    const [id, sig] = token.split('.')
    for (const wrong of [`${id}.${sig.slice(0, -2)}AA`, `${id}x.${sig}`, id, `DS${invoice.invoiceNumber}`]) {
      expect((await pdf(wrong)).status).toBe(404)
      expect(await loadInvoiceLookup(property.subdomain, wrong)).toBeNull()
    }
    // A draft has a valid token (staff are never given its link) but nothing to show.
    const other = await booking(property.id)
    const draft = await prisma.invoice.create({
      data: {
        bookingId: other.id,
        propertyId: property.id,
        invoiceNumber: 'INVDRAFT1',
        companyName: '',
        companyAddress: '',
        taxCode: '',
        customerName: b.guestName,
        customerEmail: b.guestEmail,
        subtotal: 100_000,
        taxAmount: 0,
        totalAmount: 100_000,
        status: 'DRAFT',
      },
    })
    expect((await pdf(invoiceLookupToken(draft.id))).status).toBe(404)
    expect(await loadInvoiceLookup(property.subdomain, invoiceLookupToken(draft.id))).toBeNull()
  })

  it('when Mắt Bão cannot serve the PDF, the guest goes back to the page, which says so', async () => {
    const { property, token } = await issued()
    await prisma.propertyEinvoice.delete({ where: { propertyId: property.id } }) // hotel disconnected Mắt Bão
    const res = await pdf(token, '?lang=en')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`${process.env.NEXTAUTH_URL}/${property.subdomain}/en/hoa-don/${token}?pdf=failed`)
  })

  it('a replaced invoice says so and points at its replacement; only the replacement serves a PDF', async () => {
    const { property, invoice, token } = await issued()
    const draft = await (await replaceRoute(req('POST'), params('id', invoice.id))).json()
    expect(draft.success).toBe(true)
    expect((await (await publishRoute(req('POST'), params('id', draft.data.id))).json()).success).toBe(true)

    const view = await loadInvoiceLookup(property.subdomain, token)
    expect(view).toMatchObject({ status: 'REPLACED', replacedBy: { token: invoiceLookupToken(draft.data.id) } })
    expect((await pdf(token)).status).toBe(404)
    const replacement = await loadInvoiceLookup(property.subdomain, invoiceLookupToken(draft.data.id))
    expect(replacement).toMatchObject({ status: 'PUBLISHED', replaces: invoice.einvoiceNumber })
    expect((await pdf(invoiceLookupToken(draft.data.id))).status).toBe(200)
  })

  it('staff get the link to copy, for issued invoices only, in the buyer\'s language', async () => {
    const { property, invoice, token } = await issued('en')
    const res = await listInvoicesRoute(new NextRequest(`http://digistay.test/api/invoices?propertyId=${property.id}`))
    const { data } = await res.json()
    expect(data.find((i: { id: string }) => i.id === invoice.id).lookupUrl).toBe(
      `${process.env.NEXTAUTH_URL}/${property.subdomain}/en/hoa-don/${token}`
    )
  })

  it('is rate-limited per IP', async () => {
    const { token } = await issued()
    for (let i = 0; i < LIMITS.invoiceLookupIp.limit; i++) expect((await pdf(`nope${i}.x`, '', '198.51.100.1')).status).toBe(404)
    const limited = await pdf(token, '', '198.51.100.1')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
    // Another visitor is not affected.
    expect((await pdf(token, '', '198.51.100.2')).status).toBe(200)
  })
})
