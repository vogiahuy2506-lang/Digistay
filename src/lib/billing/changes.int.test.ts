/**
 * Changing plans and the plan e-invoices against real Postgres, the real
 * PayOS SDK on the fake PayOS and our Mắt Bão client on the fake Mắt Bão:
 * renewals chained to the end, upgrades from now, downgrades waiting for
 * the end (and moving with it), then the invoice of each payment: issued,
 * retried, emailed with its PDF, its tax-office status, its PDF route.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const store = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
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
    },
  }
})
const mail = vi.hoisted(() => vi.fn(async () => ({ success: true, sent: true })))
vi.mock('@/lib/db/redis', () => ({ redis: store.redis }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/email', async (original) => ({ ...(await original<typeof import('@/lib/email')>()), sendRendered: mail }))
// No request scope here: what runs after the response is left to the jobs.
vi.mock('next/server', async (original) => ({ ...(await original<typeof import('next/server')>()), after: () => {} }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, resetDatabase } from '@/test/integration/fixtures'
import { FakePayos, type FakeAccount } from '@/test/integration/fake-payos'
import { FAKE_PDF, FakeMatbao } from '@/test/integration/fake-matbao'
import { clearMatbaoTokens } from '@/lib/einvoice/matbao-client'
import { GET as getSubscription } from '@/app/api/workspaces/[id]/subscription/route'
import { POST as checkoutRoute } from '@/app/api/workspaces/[id]/subscription/checkout/route'
import { GET as invoicePdf } from '@/app/api/workspaces/[id]/subscription/payments/[paymentId]/invoice/route'
import { POST as platformWebhook } from '@/app/api/webhooks/payos/digistay/route'
import { POST as matbaoWebhook } from '@/app/api/webhooks/matbao/digistay/[token]/route'
import { workspacePlan } from './subscription'
import { periodEndFrom } from './period'
import { runSubscriptionReminders } from './jobs'
import { runSubscriptionInvoiceJobs } from './einvoice'

const payos = new FakePayos()
const matbao = new FakeMatbao()
const DIGISTAY: FakeAccount = { clientId: 'digistay-client', apiKey: 'digistay-api', checksumKey: 'digistay-checksum' }
const MATBAO = { taxCode: '0319999999', username: 'digistay', password: 'mb-secret', templates: [{ khmshDon: '1', khhDon: 'C26TDG', cLai: 100 }] }
const WEBHOOK_SECRET = 'w'.repeat(32)
const saved = { ...process.env }
const DAY = 86_400_000
const KEYS = [
  'PAYOS_BASE_URL', 'MATBAO_BASE_URL', 'NEXTAUTH_URL', 'DIGISTAY_PAYOS_CLIENT_ID', 'DIGISTAY_PAYOS_API_KEY', 'DIGISTAY_PAYOS_CHECKSUM_KEY',
  'DIGISTAY_MATBAO_TAX_CODE', 'DIGISTAY_MATBAO_USERNAME', 'DIGISTAY_MATBAO_PASSWORD', 'DIGISTAY_MATBAO_SERIES', 'DIGISTAY_MATBAO_WEBHOOK_SECRET',
]

const signInAs = (user: { id: string; email: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) })

async function buy(workspaceId: string, plan: string, billing: string, invoice?: object) {
  const res = await checkoutRoute(
    new NextRequest(`http://digistay.test/x`, { method: 'POST', body: JSON.stringify({ plan, billing, ...(invoice && { invoice }) }) }),
    params({ id: workspaceId }),
  )
  return { res, body: await res.json() }
}

/** Buys and pays through the webhook; returns the payment row after. */
async function buyAndPay(workspaceId: string, plan: string, billing: string, invoice?: object) {
  const { res, body } = await buy(workspaceId, plan, billing, invoice)
  expect(res.status, JSON.stringify(body)).toBe(200)
  const paid = await payos.pay(Number(body.data.orderCode))
  await platformWebhook(new NextRequest('http://digistay.test/w', { method: 'POST', body: JSON.stringify(paid), headers: { 'x-real-ip': '203.0.113.20' } }))
  return prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: body.data.id } })
}

/** The workspace on a paid plan whose period ends in `daysLeft` days. */
async function onPlan(workspaceId: string, plan: string, billing: 'MONTH' | 'YEAR', daysLeft: number) {
  const end = new Date(Date.now() + daysLeft * DAY)
  const data = { plan, billing, trial: false, periodStart: new Date(end.getTime() - 30 * DAY), periodEnd: end }
  await prisma.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data })
  return end
}

const subOf = (workspaceId: string) => prisma.subscription.findUniqueOrThrow({ where: { workspaceId } })

beforeAll(async () => {
  await payos.start()
  payos.addAccount(DIGISTAY)
  await matbao.start()
  matbao.addAccount(MATBAO)
  process.env.PAYOS_BASE_URL = payos.url
  process.env.MATBAO_BASE_URL = matbao.url
  process.env.NEXTAUTH_URL = 'http://digistay.test'
})
beforeEach(async () => {
  await resetDatabase()
  store.data.clear()
  payos.links.clear()
  matbao.createCalls.length = 0
  matbao.issued.clear()
  matbao.failNext = null
  clearMatbaoTokens()
  mail.mockClear()
  process.env.DIGISTAY_PAYOS_CLIENT_ID = DIGISTAY.clientId
  process.env.DIGISTAY_PAYOS_API_KEY = DIGISTAY.apiKey
  process.env.DIGISTAY_PAYOS_CHECKSUM_KEY = DIGISTAY.checksumKey
  process.env.DIGISTAY_MATBAO_TAX_CODE = MATBAO.taxCode
  process.env.DIGISTAY_MATBAO_USERNAME = MATBAO.username
  process.env.DIGISTAY_MATBAO_PASSWORD = MATBAO.password
  process.env.DIGISTAY_MATBAO_SERIES = 'C26TDG'
  process.env.DIGISTAY_MATBAO_WEBHOOK_SECRET = WEBHOOK_SECRET
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  await payos.stop()
  await matbao.stop()
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  await prisma.$disconnect()
})

describe('changing plans', () => {
  it('chains a renewal in the last 7 days to the end and refuses one earlier', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    await onPlan(t.workspace.id, 'growth', 'MONTH', 20)
    const early = await buy(t.workspace.id, 'growth', 'MONTH')
    expect(early.res.status).toBe(409)
    expect(early.body.error).toMatch(/gia hạn từ ngày/)

    const end = await onPlan(t.workspace.id, 'growth', 'MONTH', 5)
    const payment = await buyAndPay(t.workspace.id, 'growth', 'MONTH')
    expect(payment).toMatchObject({ status: 'PAID', change: 'renew' })
    expect(payment.periodStart).toEqual(end)
    const sub = await subOf(t.workspace.id)
    expect(sub.periodEnd).toEqual(periodEndFrom(end, 'MONTH'))
  })

  it('upgrades from now, giving up the days left', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    await onPlan(t.workspace.id, 'growth', 'MONTH', 20)
    const before = Date.now()
    const payment = await buyAndPay(t.workspace.id, 'business', 'MONTH')
    expect(payment.change).toBe('upgrade')
    const sub = await subOf(t.workspace.id)
    expect(sub.plan).toBe('business')
    expect(sub.periodStart.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it('schedules a downgrade for the end; it starts on time when the plan is read, and emails the owner', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const end = await onPlan(t.workspace.id, 'business', 'MONTH', 10)
    const payment = await buyAndPay(t.workspace.id, 'starter', 'MONTH')
    expect(payment).toMatchObject({ change: 'downgrade' })
    expect(payment.periodStart).toEqual(end)
    let sub = await subOf(t.workspace.id)
    expect(sub).toMatchObject({ plan: 'business', nextPlan: 'starter', nextBilling: 'MONTH', nextPaymentId: payment.id })
    expect(sub.nextPeriodEnd).toEqual(periodEndFrom(end, 'MONTH'))

    // A second change while one waits is refused.
    const again = await buy(t.workspace.id, 'growth', 'MONTH')
    expect(again.res.status).toBe(409)
    expect(again.body.error).toMatch(/Đã hẹn đổi sang gói Starter/)

    // No "your plan ends" reminders: the workspace goes on with Starter.
    expect(await runSubscriptionReminders(new Date(end.getTime() - 2 * DAY))).toMatchObject({ sent: 0 })

    const plan = await workspacePlan(t.workspace.id, prisma, new Date(end.getTime() + 60_000))
    expect(plan).toMatchObject({ planId: 'starter', state: 'active' })
    sub = await subOf(t.workspace.id)
    expect(sub).toMatchObject({ plan: 'starter', nextPlan: null, trial: false })
    expect(sub.periodStart).toEqual(end)
    const switched = await prisma.emailOutbox.findMany({ where: { kind: 'subscription_switched' } })
    expect(switched).toHaveLength(1)
  })

  it('moves a waiting downgrade when an upgrade changes the end before it', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const end = await onPlan(t.workspace.id, 'growth', 'MONTH', 10)
    const down = await buyAndPay(t.workspace.id, 'starter', 'MONTH')
    const length = periodEndFrom(end, 'MONTH').getTime() - end.getTime()

    const up = await buyAndPay(t.workspace.id, 'growth', 'YEAR')
    expect(up.change).toBe('upgrade')
    const sub = await subOf(t.workspace.id)
    expect(sub.nextPlan).toBe('starter')
    expect(sub.nextPeriodEnd!.getTime()).toBe(sub.periodEnd.getTime() + length)
    const moved = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: down.id } })
    expect(moved.periodStart).toEqual(sub.periodEnd)
  })

  it('refuses yearly → monthly with 30 days or more left', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    await onPlan(t.workspace.id, 'growth', 'YEAR', 200)
    const { res, body } = await buy(t.workspace.id, 'business', 'MONTH')
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/Gói năm còn từ 30 ngày/)
  })

  it('tells the plan page what each purchase does', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    await onPlan(t.workspace.id, 'growth', 'MONTH', 20)
    const res = await getSubscription(new NextRequest('http://digistay.test/x'), params({ id: t.workspace.id }))
    const { data } = await res.json()
    expect(data.changes.growth.MONTH).toMatchObject({ kind: 'renew', blocked: 'RENEW_TOO_EARLY' })
    expect(data.changes.business.MONTH).toMatchObject({ kind: 'upgrade', lostDays: 20 })
    expect(data.changes.starter.MONTH).toMatchObject({ kind: 'downgrade', blocked: null })
    expect(data.einvoice).toMatchObject({ vat: 'Không chịu thuế (KCT)', email: t.owner.email })
  })
})

describe('plan e-invoices', () => {
  const company = { type: 'company', taxCode: '0312345678', companyName: 'Công ty TNHH Mây', address: '1 Lê Lợi, Huế' }

  it('issues the paid plan’s invoice to the company and emails the PDF to the payer', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const payment = await buyAndPay(t.workspace.id, 'growth', 'MONTH', company)
    const pending = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: payment.id } })
    expect(pending).toMatchObject({ status: 'PENDING', buyerType: 'company', taxCode: '0312345678', email: t.owner.email, amount: 5_000, vatCode: -1 })

    expect(await runSubscriptionInvoiceJobs()).toMatchObject({ issued: 1, emailed: 1 })
    const issued = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: payment.id } })
    expect(issued).toMatchObject({ status: 'ISSUED', lookupCode: `DSG${payment.orderCode}`, series: 'C26TDG', environment: 'DEMO', emailStatus: 'SENT' })
    expect(issued.einvoiceNumber).toBeTruthy()
    expect(matbao.createCalls[0]).toMatchObject({ MaTraCuu: `DSG${payment.orderCode}`, NMua_MST: '0312345678', NMua_Ten: 'Công ty TNHH Mây', TgTTTBSo: 5_000 })
    const [to, message, attachments] = mail.mock.calls[0] as unknown as [{ email: string }, { subject: string }, { filename: string; content: Buffer }[]]
    expect(to.email).toBe(t.owner.email)
    expect(message.subject).toMatch(/Hoá đơn điện tử/)
    expect(attachments[0].content.equals(FAKE_PDF)).toBe(true)

    // The plan page links the PDF; another workspace's owner cannot open it.
    const pdf = await invoicePdf(new NextRequest('http://digistay.test/x'), params({ id: t.workspace.id, paymentId: payment.id }))
    expect(pdf.headers.get('content-type')).toBe('application/pdf')
    const other = await createTenant()
    signInAs(other.owner)
    const refused = await invoicePdf(new NextRequest('http://digistay.test/x'), params({ id: other.workspace.id, paymentId: payment.id }))
    expect(refused.status).toBe(404)
  })

  it('issues "no invoice wanted" to a consumer and emails nothing', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const payment = await buyAndPay(t.workspace.id, 'growth', 'MONTH')
    await runSubscriptionInvoiceJobs()
    const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: payment.id } })
    expect(invoice).toMatchObject({ status: 'ISSUED', buyerType: 'none', email: null, emailStatus: null })
    expect(matbao.createCalls[0]).toMatchObject({ NMua_HVTNMHang: 'Bán cho người tiêu dùng' })
    expect(mail).not.toHaveBeenCalled()
  })

  it('refuses a buyer with a bad CCCD before making the QR', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const { res, body } = await buy(t.workspace.id, 'growth', 'MONTH', { type: 'personal', name: 'Nguyễn An', idNumber: '123' })
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/CCCD/)
  })

  it('retries after a timeout without issuing twice (Mắt Bão answers 304)', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const payment = await buyAndPay(t.workspace.id, 'growth', 'MONTH', company)
    matbao.failNext = 'drop-after-issue'
    expect(await runSubscriptionInvoiceJobs()).toMatchObject({ issued: 0, failed: 1 })
    const failed = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: payment.id } })
    expect(failed.status).toBe('FAILED')
    expect(failed.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now())

    expect(await runSubscriptionInvoiceJobs(new Date(Date.now() + 3 * 60_000))).toMatchObject({ issued: 1 })
    expect(matbao.issued.size).toBe(1)
  })

  it('makes no invoice while Digistay has no Mắt Bão account set up', async () => {
    delete process.env.DIGISTAY_MATBAO_PASSWORD
    const t = await createTenant()
    signInAs(t.owner)
    const payment = await buyAndPay(t.workspace.id, 'growth', 'MONTH', company)
    expect(payment.invoiceBuyer).toBeNull()
    expect(await prisma.subscriptionInvoice.count()).toBe(0)
  })

  it('records the tax office’s answer from Mắt Bão’s webhook, with the secret only', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const payment = await buyAndPay(t.workspace.id, 'growth', 'MONTH', company)
    await runSubscriptionInvoiceJobs()
    const call = (token: string, body: object) =>
      matbaoWebhook(new NextRequest('http://digistay.test/w', { method: 'POST', body: JSON.stringify(body), headers: { 'x-real-ip': '203.0.113.30' } }), params({ token }))
    expect((await call('wrong', { Fkey: `DSG${payment.orderCode}`, MaTTHDon: 4 })).status).toBe(401)
    expect((await call(WEBHOOK_SECRET, { Fkey: `DSG${payment.orderCode}`, MaTTHDon: 4, MCCQT: 'X' })).status).toBe(200)
    const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: payment.id } })
    expect(invoice.cqtStatus).toBe(4)
  })
})
