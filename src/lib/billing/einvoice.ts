/**
 * VAT e-invoices for plan payments, issued by Digistay under its own tax
 * code through its own Mắt Bão account (hotels issue theirs with their own
 * accounts: src/lib/einvoice/matbao.ts). Founder AI's flow, which runs in
 * production:
 *
 * - The buyer is picked at checkout and kept on the payment: none (sold to
 *   a consumer, not emailed), personal (name + CCCD) or company (tax code,
 *   name, address).
 * - Marking a payment paid creates its invoice in the same transaction
 *   (checkout.ts). It is issued right after the response, and by the plan
 *   jobs until it is: retries with backoff; a refusal waits for someone
 *   (/admin/system).
 * - MaTraCuu is fixed per invoice ("DSG" + order code), so a retry after a
 *   timeout answers 304 instead of issuing twice. One conditional update
 *   claims an invoice (ISSUING, leased through nextAttemptAt).
 * - The amount is what was paid, VAT included; the rate is
 *   DIGISTAY_MATBAO_VAT (default KCT: software is not subject to VAT).
 * - The PDF is emailed to the payer for personal and company invoices.
 * - Off until DIGISTAY_MATBAO_* are set: payments then make no invoice.
 */
import { timingSafeEqual } from 'crypto'
import { after } from 'next/server'
import { z } from 'zod'
import type { Prisma, SubscriptionInvoice, SubscriptionPayment } from '@prisma/client'
import { prisma, prismaWithDeleted } from '@/lib/db'
import { sendRendered } from '@/lib/email'
import { MatbaoClient, MatbaoError, type MatbaoEnvironment } from '@/lib/einvoice/matbao-client'
import { formatNLap } from '@/lib/einvoice/matbao'
import { vndToWords } from '@/lib/einvoice/amount-words'
import { CQT_LABELS } from '@/lib/einvoice/cqt-labels'
import { normalizeTaxCode } from '@/lib/einvoice/tax-code'
import { VAT_LABELS, isVatCode, splitGross, type VatCode } from '@/lib/einvoice/vat'
import { planById } from '@/lib/marketing/plans'
import { realSetting } from './platform-payos'
import { subscriptionInvoiceMessage } from './emails'

type Db = Prisma.TransactionClient | typeof prisma

// ---------------------------------------------------------------- settings

const REQUIRED = ['DIGISTAY_MATBAO_TAX_CODE', 'DIGISTAY_MATBAO_USERNAME', 'DIGISTAY_MATBAO_PASSWORD', 'DIGISTAY_MATBAO_SERIES'] as const

export function platformEinvoiceConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return REQUIRED.every((key) => realSetting(env[key]))
}

/** Digistay's Mắt Bão account; callers check platformEinvoiceConfigured() first. */
export function platformEinvoiceSettings(env: Record<string, string | undefined> = process.env) {
  const vat = env.DIGISTAY_MATBAO_VAT?.trim() ? Number(env.DIGISTAY_MATBAO_VAT.trim()) : -1
  return {
    // DEMO unless said otherwise: test payments must not make real invoices.
    environment: (env.DIGISTAY_MATBAO_ENV?.trim().toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'DEMO') as MatbaoEnvironment,
    taxCode: env.DIGISTAY_MATBAO_TAX_CODE?.trim() ?? '',
    username: env.DIGISTAY_MATBAO_USERNAME?.trim() ?? '',
    password: env.DIGISTAY_MATBAO_PASSWORD?.trim() ?? '',
    templateCode: env.DIGISTAY_MATBAO_TEMPLATE?.trim() || '1',
    series: env.DIGISTAY_MATBAO_SERIES?.trim().toUpperCase() ?? '',
    vatCode: (isVatCode(vat) ? vat : -1) as VatCode,
  }
}

type Settings = ReturnType<typeof platformEinvoiceSettings>

function client(settings: Settings) {
  const { environment, taxCode, username, password } = settings
  return new MatbaoClient({ environment, taxCode, username, password })
}

/** What the plan page says about the tax: "Không chịu thuế (KCT)", "8%"… */
export function platformVatLabel(): string {
  return VAT_LABELS[platformEinvoiceSettings().vatCode]
}

// ------------------------------------------------------------------- buyer

const text = (max: number) => z.string().trim().max(max)

export const BUYER_TYPES = ['none', 'personal', 'company'] as const

/** The buyer picked at checkout (the plan page's invoice step). */
export const invoiceBuyerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('personal'),
    name: text(120).min(2, 'Vui lòng nhập họ tên người mua'),
    idNumber: z.string().trim().regex(/^(\d{9}|\d{12})$/, 'Số CCCD gồm 12 chữ số (CMND cũ: 9 chữ số)'),
    address: text(250).optional(),
  }),
  z.object({
    type: z.literal('company'),
    taxCode: z.string().transform((value, ctx) => {
      const code = normalizeTaxCode(value)
      if (!code) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Mã số thuế gồm 10 hoặc 13 chữ số' })
      return code ?? ''
    }),
    companyName: text(250).min(2, 'Vui lòng nhập tên công ty'),
    address: text(250).min(5, 'Vui lòng nhập địa chỉ công ty'),
    /** The person buying for the company (optional on the invoice) */
    name: text(120).optional(),
  }),
])

export type InvoiceBuyer = z.infer<typeof invoiceBuyerSchema>

/** The buyer stored on a payment; anything unreadable is "none". */
export function readBuyer(value: Prisma.JsonValue | null | undefined): InvoiceBuyer {
  const parsed = invoiceBuyerSchema.safeParse(value)
  return parsed.success ? parsed.data : { type: 'none' }
}

/** The buyer of the workspace's last payment that named one: the plan page fills it in again. */
export async function lastBuyer(workspaceId: string, db: Db = prisma): Promise<InvoiceBuyer | null> {
  const rows = await db.subscriptionPayment.findMany({
    where: { workspaceId, invoiceBuyer: { not: { equals: null } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { invoiceBuyer: true },
  })
  for (const row of rows) {
    const buyer = readBuyer(row.invoiceBuyer)
    if (buyer.type !== 'none') return buyer
  }
  return null
}

// ----------------------------------------------------------------- invoice

export const lookupCodeFor = (orderCode: string) => `DSG${orderCode}`

/**
 * "Phần mềm Digistay - Gói Growth 1 tháng". No dates: a scheduled
 * downgrade's period moves if the period before it changes.
 */
export function planLine(payment: Pick<SubscriptionPayment, 'plan' | 'billing'>): string {
  const name = planById(payment.plan).id
  return `Phần mềm Digistay - Gói ${name.charAt(0).toUpperCase()}${name.slice(1)} ${payment.billing === 'YEAR' ? '12 tháng' : '1 tháng'}`
}

/**
 * Creates the invoice of a payment being marked paid, in that transaction.
 * Returns its id, or null when Digistay issues no invoices yet.
 */
export async function prepareSubscriptionInvoice(
  payment: SubscriptionPayment,
  db: Db,
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  if (!platformEinvoiceConfigured(env)) return null
  const buyer = readBuyer(payment.invoiceBuyer)
  const email = buyer.type === 'none' ? null : await payerEmail(payment, db)
  const row = await db.subscriptionInvoice.create({
    data: {
      paymentId: payment.id,
      workspaceId: payment.workspaceId,
      buyerType: buyer.type,
      buyerName: buyer.type === 'none' ? null : (buyer.name ?? null),
      idNumber: buyer.type === 'personal' ? buyer.idNumber : null,
      companyName: buyer.type === 'company' ? buyer.companyName : null,
      taxCode: buyer.type === 'company' ? buyer.taxCode : null,
      address: buyer.type === 'none' ? null : (buyer.address ?? null),
      email,
      amount: payment.amount,
      vatCode: platformEinvoiceSettings(env).vatCode,
      lookupCode: lookupCodeFor(payment.orderCode),
    },
    select: { id: true },
  })
  return row.id
}

/** The one who paid, or the owner. */
async function payerEmail(payment: Pick<SubscriptionPayment, 'workspaceId' | 'createdById'>, db: Db) {
  const payer = payment.createdById
    ? await db.user.findUnique({ where: { id: payment.createdById }, select: { email: true } })
    : null
  if (payer?.email) return payer.email
  // The plain client: a deleted workspace (src/lib/deletion) still gets its invoice.
  const { owner } = await prismaWithDeleted.workspace.findUniqueOrThrow({ where: { id: payment.workspaceId }, select: { owner: { select: { email: true } } } })
  return owner.email
}

/** The create-invoice payload (pure; shapes in src/lib/einvoice/matbao-client.ts). */
export function buildSubscriptionInvoice(
  invoice: Pick<
    SubscriptionInvoice,
    'buyerType' | 'buyerName' | 'idNumber' | 'companyName' | 'taxCode' | 'address' | 'email' | 'amount' | 'vatCode' | 'lookupCode'
  >,
  payment: Pick<SubscriptionPayment, 'plan' | 'billing'>,
  settings: Pick<Settings, 'templateCode' | 'series'>,
  now: Date,
) {
  const vatCode: VatCode = isVatCode(invoice.vatCode) ? invoice.vatCode : -1
  const { net, vat, gross } = splitGross(invoice.amount, vatCode)
  // NMua_Ten is the company ("Tên đơn vị"), NMua_HVTNMHang the person.
  const buyer: Record<string, string> =
    invoice.buyerType === 'company'
      ? {
          NMua_Ten: invoice.companyName ?? '',
          NMua_MST: invoice.taxCode ?? '',
          NMua_DChi: invoice.address ?? '',
          NMua_HVTNMHang: invoice.buyerName ?? '',
          NMua_DCTDTu: invoice.email ?? '',
        }
      : invoice.buyerType === 'personal'
        ? {
            NMua_Ten: '',
            NMua_MST: '',
            NMua_DChi: invoice.address ?? '',
            NMua_HVTNMHang: invoice.buyerName ?? '',
            NMua_CCCDan: invoice.idNumber ?? '',
            NMua_DCTDTu: invoice.email ?? '',
          }
        : { NMua_Ten: '', NMua_MST: '', NMua_DChi: '', NMua_HVTNMHang: 'Bán cho người tiêu dùng', NMua_DCTDTu: '' }
  return {
    KHMSHDon: settings.templateCode,
    KHHDon: settings.series,
    MaTraCuu: invoice.lookupCode,
    MTChieu: invoice.lookupCode.slice(0, 20),
    // 0: a MaTraCuu already issued is not imported again (answer 304).
    KTraMaTraCuuTrung: 0,
    NLap: formatNLap(now),
    LoaiHDon: 1,
    TCHDon: 0,
    DVTTe: 704,
    TGia: 1,
    HTTToan: 'Tiền mặt/Chuyển khoản',
    ...buyer,
    DSHHDVu: [
      {
        TChat: 1,
        STT: 1,
        THHDVu: planLine(payment),
        DVTinh: 'Gói',
        SLuong: 1,
        DGia: net,
        ThTienChuaCK: net,
        TLCKhau: 0,
        STCKhau: 0,
        ThTien: net,
        TSuat: vatCode,
        TThue: vat,
        TgTien: gross,
      },
    ],
    TgThTien: net,
    TTCKTMai: 0,
    TGTKhac: 0,
    TgTThue: vat,
    TgTTTBSo: gross,
    TgTTTBChu: vndToWords(gross),
  }
}

/** Longer than a login plus a create call, both 30 s at most. */
const ISSUE_LEASE_MS = 2 * 60 * 1000
/** Wait after the 1st, 2nd… failure that may pass by itself; then someone must retry. */
const ISSUE_BACKOFF_MIN = [2, 10, 30, 120, 360, 720]

export type IssueOutcome = 'issued' | 'failed' | 'not-due' | 'off'

/**
 * Issues the invoice if it is due (or, with `force`, a failed one: someone
 * asked). Safe to call from anywhere, any number of times, concurrently.
 */
export async function issueSubscriptionInvoice(
  id: string,
  now = new Date(),
  { force = false } = {},
): Promise<{ outcome: IssueOutcome; error?: string }> {
  if (!platformEinvoiceConfigured()) return { outcome: 'off' }
  const settings = platformEinvoiceSettings()
  const claimed = await prisma.subscriptionInvoice.updateMany({
    where: {
      id,
      OR: [
        { status: 'PENDING' },
        { status: 'FAILED', ...(!force && { nextAttemptAt: { lte: now } }) },
        { status: 'ISSUING', nextAttemptAt: { lte: now } },
      ],
    },
    data: {
      status: 'ISSUING',
      nextAttemptAt: new Date(now.getTime() + ISSUE_LEASE_MS),
      attempts: { increment: 1 },
      environment: settings.environment,
      templateCode: settings.templateCode,
      series: settings.series,
    },
  })
  if (claimed.count === 0) return { outcome: 'not-due' }

  const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id }, include: { payment: true } })
  let result
  try {
    result = await client(settings).createInvoice(buildSubscriptionInvoice(invoice, invoice.payment, settings, now))
  } catch (error) {
    // A refusal (bad data, wrong password, no numbers left) will not pass by itself.
    const retryable = !(error instanceof MatbaoError) || error.retryable
    const message =
      error instanceof MatbaoError
        ? retryable
          ? error.message
          : `Mắt Bão từ chối: ${error.message} (mã ${error.code})`
        : 'Lỗi khi gọi Mắt Bão'
    const wait = retryable ? ISSUE_BACKOFF_MIN[invoice.attempts - 1] : undefined
    await prisma.subscriptionInvoice.updateMany({
      where: { id, status: 'ISSUING' },
      data: {
        status: 'FAILED',
        error: message.slice(0, 500),
        nextAttemptAt: wait === undefined ? null : new Date(now.getTime() + wait * 60_000),
      },
    })
    if (error instanceof MatbaoError) console.warn(`[billing] plan invoice ${invoice.lookupCode} failed (attempt ${invoice.attempts}): ${message}`)
    else console.error(`[billing] plan invoice ${invoice.lookupCode} failed:`, error)
    return { outcome: 'failed', error: message }
  }

  await prisma.subscriptionInvoice.update({
    where: { id },
    data: {
      status: 'ISSUED',
      issuedAt: now,
      invoiceCode: result.maSoHDon,
      einvoiceNumber: result.soHDon,
      error: null,
      nextAttemptAt: null,
      emailStatus: invoice.email ? 'PENDING' : null,
    },
  })
  return { outcome: 'issued' }
}

/** The issued invoice's PDF, from Mắt Bão. */
export async function getSubscriptionInvoicePdf(invoice: Pick<SubscriptionInvoice, 'status' | 'lookupCode' | 'invoiceCode' | 'einvoiceNumber'>) {
  if (invoice.status !== 'ISSUED') throw new MatbaoError('Hoá đơn chưa phát hành', 'not_issued', false)
  const pdf = await client(platformEinvoiceSettings()).downloadPdf({ maTraCuu: invoice.lookupCode, maSoHDon: invoice.invoiceCode })
  return { pdf, filename: `hoa-don-digistay-${invoice.einvoiceNumber ?? invoice.lookupCode}.pdf` }
}

// ------------------------------------------------------------------- email

export const EMAIL_MAX_ATTEMPTS = 5
const EMAIL_LEASE_MS = 3 * 60 * 1000
const EMAIL_BACKOFF_MS = [10, 30, 120, 360].map((minutes) => minutes * 60 * 1000)

function emailDueWhere(now: Date): Prisma.SubscriptionInvoiceWhereInput {
  return {
    status: 'ISSUED',
    OR: [{ emailStatus: 'PENDING' }, { emailStatus: { in: ['FAILED', 'SENDING'] }, emailNextAt: { lte: now } }],
  }
}

/** Emails the PDF if due (or, with `again`, whatever its state: someone asked). */
export async function sendSubscriptionInvoiceEmail(id: string, now = new Date(), { again = false } = {}) {
  const claimed = await prisma.subscriptionInvoice.updateMany({
    where: {
      id,
      email: { not: null },
      ...(again
        ? { status: 'ISSUED', OR: [{ emailStatus: null }, { emailStatus: { not: 'SENDING' } }, { emailNextAt: { lte: now } }] }
        : emailDueWhere(now)),
    },
    data: { emailStatus: 'SENDING', emailNextAt: new Date(now.getTime() + EMAIL_LEASE_MS) },
  })
  if (claimed.count === 0) return { outcome: 'not-due' as const }

  // The plain client: a deleted workspace's invoice is still sent (the money came).
  const invoice = await prismaWithDeleted.subscriptionInvoice.findUniqueOrThrow({
    where: { id },
    include: { payment: { include: { workspace: { select: { name: true, slug: true } } } } },
  })
  const settle = (data: Prisma.SubscriptionInvoiceUpdateManyMutationInput) =>
    prisma.subscriptionInvoice.updateMany({ where: { id, emailStatus: 'SENDING' }, data })
  const attempts = invoice.emailAttempts + 1
  try {
    const { pdf, filename } = await getSubscriptionInvoicePdf(invoice)
    const message = subscriptionInvoiceMessage({
      workspace: invoice.payment.workspace,
      buyer: invoice.companyName ?? invoice.buyerName,
      line: planLine(invoice.payment),
      einvoiceNumber: invoice.einvoiceNumber,
      series: invoice.series,
      templateCode: invoice.templateCode,
      lookupCode: invoice.lookupCode,
      amount: invoice.amount,
    })
    const result = await sendRendered({ email: invoice.email!, name: invoice.buyerName ?? undefined }, message, [
      { filename, content: pdf, contentType: 'application/pdf' },
    ])
    if (!result.sent) throw new Error(result.success ? 'Máy chủ chưa cấu hình gửi email (SMTP)' : `Không gửi được email: ${result.error}`)
  } catch (error) {
    const message = error instanceof MatbaoError ? `Không lấy được PDF từ Mắt Bão: ${error.message}` : (error as Error).message
    const next = attempts < EMAIL_MAX_ATTEMPTS ? new Date(now.getTime() + EMAIL_BACKOFF_MS[attempts - 1]) : null
    await settle({ emailStatus: 'FAILED', emailAttempts: attempts, emailNextAt: next, emailError: message.slice(0, 500) })
    console.warn(`[billing] plan invoice email ${invoice.lookupCode} failed (attempt ${attempts}): ${message}`)
    return { outcome: 'failed' as const, error: message }
  }
  await settle({ emailStatus: 'SENT', emailAttempts: attempts, emailNextAt: null, emailedAt: now, emailError: null })
  return { outcome: 'sent' as const }
}

// -------------------------------------------------------------- scheduling

/** Issues, then emails, once the response has gone out; outside a request the plan jobs do it. */
export function issueAfterResponse(id: string | null) {
  if (!id) return
  try {
    after(async () => {
      const issued = await issueSubscriptionInvoice(id).catch((error) => {
        console.error('[billing] plan invoice failed:', error)
        return null
      })
      if (issued?.outcome === 'issued') await sendSubscriptionInvoiceEmail(id).catch((error) => console.error('[billing] plan invoice email failed:', error))
    })
  } catch {
    // Not in a request: runSubscriptionInvoiceJobs picks it up.
  }
}

/** For the plan jobs: invoices due to be issued, then their emails. */
export async function runSubscriptionInvoiceJobs(now = new Date()) {
  if (!platformEinvoiceConfigured()) return { issued: 0, failed: 0, emailed: 0 }
  const due = await prisma.subscriptionInvoice.findMany({
    where: { OR: [{ status: 'PENDING' }, { status: { in: ['FAILED', 'ISSUING'] }, nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: { id: true },
  })
  let issued = 0
  let failed = 0
  for (const { id } of due) {
    const { outcome } = await issueSubscriptionInvoice(id, now)
    if (outcome === 'issued') issued++
    if (outcome === 'failed') failed++
  }
  const emails = await prisma.subscriptionInvoice.findMany({ where: { email: { not: null }, ...emailDueWhere(now) }, take: 50, select: { id: true } })
  let emailed = 0
  for (const { id } of emails) {
    if ((await sendSubscriptionInvoiceEmail(id, now)).outcome === 'sent') emailed++
  }
  return { issued, failed, emailed }
}

// ------------------------------------------------------- tax office status

const FINAL = new Set([4, 6, 9])

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Mắt Bão's callback with the tax office's answer (like the hotels' in
 * src/lib/einvoice/matbao-webhook.ts): unsigned, the secret in the URL
 * (DIGISTAY_MATBAO_WEBHOOK_SECRET) is the credential.
 */
export async function handlePlatformMatbaoWebhook(token: string, body: unknown): Promise<{ status: number; outcome: string }> {
  const secret = process.env.DIGISTAY_MATBAO_WEBHOOK_SECRET?.trim()
  if (!realSetting(secret)) return { status: 404, outcome: 'not_configured' }
  if (!sameSecret(token, secret!)) return { status: 401, outcome: 'bad_token' }

  const data = (body ?? {}) as Record<string, unknown>
  const fkey = typeof data.Fkey === 'string' ? data.Fkey : null
  const code = Number(data.MaTTHDon)
  if (!fkey || !Number.isInteger(code) || !(code in CQT_LABELS)) return { status: 400, outcome: 'bad_payload' }

  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { lookupCode: fkey },
    select: { id: true, cqtStatus: true, einvoiceNumber: true },
  })
  // Invoices made on Mắt Bão's portal are not ours.
  if (!invoice) return { status: 200, outcome: 'unknown' }
  if (invoice.cqtStatus != null && FINAL.has(invoice.cqtStatus) && !FINAL.has(code)) return { status: 200, outcome: 'stale' }

  const note = typeof data.GhiChuCQT === 'string' && data.GhiChuCQT.trim() ? data.GhiChuCQT.trim() : null
  const number = data.No != null && data.No !== '' ? String(data.No) : null
  await prisma.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: { cqtStatus: code, cqtNote: note, ...(invoice.einvoiceNumber == null && number && { einvoiceNumber: number }) },
  })
  if (code === 6) console.warn(`[billing] tax office refused plan invoice ${fkey}: ${note ?? ''}`)
  return { status: 200, outcome: 'updated' }
}
