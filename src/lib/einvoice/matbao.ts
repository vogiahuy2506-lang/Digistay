/**
 * Mắt Bão e-invoices with one account per property (Part 6): each hotel
 * issues invoices under its own tax code.
 *
 * - The password is encrypted with secret-box, bound to the property.
 *   Saving the account logs in and checks that the template (mẫu số) and
 *   series (ký hiệu) exist this year; otherwise the previous account (or
 *   none) is put back.
 * - Publishing: one conditional update claims the invoice (PUBLISHING),
 *   then Mắt Bão is called. MaTraCuu is fixed per invoice (DS + invoice
 *   number), so if a call times out after Mắt Bão issued it, publishing
 *   again answers 304 instead of issuing a second invoice. A claim older
 *   than PUBLISH_LEASE_MS may be taken again (crash mid-call).
 * - Amounts are VAT-inclusive (vat.ts); the VAT code is the one copied onto
 *   the invoice when it was created.
 * - Issued invoices cannot be cancelled here: that needs a tax-office notice
 *   (mẫu 04) on Mắt Bão's portal.
 *
 * Lessons from Founder AI (one platform account there): CLAUDE.md, "Quy ước
 * code", Hoá đơn điện tử.
 */
import type { Invoice, Prisma, PropertyEinvoice } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, secretContext } from '@/lib/security/secret-box'
import { vndToWords } from './amount-words'
import { MatbaoClient, MatbaoError, type MatbaoEnvironment } from './matbao-client'
import { isVatCode, splitGross, type VatCode } from './vat'

/** Longer than a login plus a create call, both 30 s at most. */
export const PUBLISH_LEASE_MS = 2 * 60 * 1000
const HANOI_TZ = 'Asia/Ho_Chi_Minh'

export class EinvoiceError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
    this.name = 'EinvoiceError'
  }
}

const passwordCtx = (propertyId: string) => secretContext('property_einvoice', propertyId, 'password')

function clientFor(config: PropertyEinvoice): MatbaoClient {
  return new MatbaoClient({
    environment: config.environment as MatbaoEnvironment,
    taxCode: config.taxCode,
    username: config.username,
    password: decryptSecret(config.password, passwordCtx(config.propertyId)),
  })
}

export function lookupCodeFor(invoice: Pick<Invoice, 'invoiceNumber' | 'lookupCode'>): string {
  return invoice.lookupCode ?? `DS${invoice.invoiceNumber}`
}

export async function getEinvoiceStatus(propertyId: string) {
  const row = await prisma.propertyEinvoice.findUnique({ where: { propertyId } })
  if (!row) return { connected: false as const }
  const { password: _password, connectedById: _by, ...visible } = row
  return { connected: Boolean(row.verifiedAt), ...visible }
}

export interface EinvoiceSettings {
  environment: MatbaoEnvironment
  taxCode: string
  username: string
  /** Omit to keep the stored one. */
  password?: string
  templateCode: string
  series: string
  vatCode: VatCode
}

/** Saves the account and checks it with Mắt Bão; restores the previous one if that fails. */
export async function connectEinvoice(propertyId: string, input: EinvoiceSettings, userId: string, now = new Date()) {
  const previous = await prisma.propertyEinvoice.findUnique({ where: { propertyId } })
  if (!input.password && !previous) throw new EinvoiceError('Vui lòng nhập mật khẩu Mắt Bão')
  const data = {
    environment: input.environment,
    taxCode: input.taxCode.trim(),
    username: input.username.trim(),
    password: input.password ? encryptSecret(input.password, passwordCtx(propertyId)) : previous!.password,
    templateCode: input.templateCode.trim(),
    series: input.series.trim().toUpperCase(),
    vatCode: input.vatCode,
    verifiedAt: null,
    remainingNumbers: null,
    connectedById: userId,
  }
  const row = await prisma.propertyEinvoice.upsert({ where: { propertyId }, create: { propertyId, ...data }, update: data })

  try {
    const client = clientFor(row)
    await client.login(true)
    const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: HANOI_TZ, year: 'numeric' }).format(now))
    const templates = await client.templates(year)
    const match = templates.find((t) => t.templateCode === row.templateCode && t.series === row.series)
    if (!match) {
      const known = templates.map((t) => `${t.templateCode}/${t.series}`).join(', ') || 'không có'
      throw new EinvoiceError(
        `Tài khoản Mắt Bão không có mẫu số ${row.templateCode}, ký hiệu ${row.series} cho năm ${year} (hiện có: ${known})`
      )
    }
    if (match.remaining <= 0) throw new EinvoiceError(`Ký hiệu ${row.series} đã hết số hoá đơn`)
    return await prisma.propertyEinvoice.update({
      where: { propertyId },
      data: { verifiedAt: new Date(), remainingNumbers: match.remaining },
      select: { propertyId: true },
    }).then(() => getEinvoiceStatus(propertyId))
  } catch (error) {
    if (previous) {
      const { createdAt: _c, updatedAt: _u, propertyId: _p, ...restore } = previous
      await prisma.propertyEinvoice.update({ where: { propertyId }, data: restore })
    } else {
      await prisma.propertyEinvoice.deleteMany({ where: { propertyId } })
    }
    if (error instanceof EinvoiceError) throw error
    throw new EinvoiceError(error instanceof MatbaoError ? error.message : 'Không kiểm tra được tài khoản Mắt Bão', 400)
  }
}

export async function disconnectEinvoice(propertyId: string) {
  await prisma.propertyEinvoice.deleteMany({ where: { propertyId } })
}

/** Mắt Bão NLap: Vietnam local time without offset (UTC here made it off by 7 h). */
export function formatNLap(date: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: HANOI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => p.find((x) => x.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

function vnDate(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: HANOI_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

type InvoiceForPayload = Pick<
  Invoice,
  | 'invoiceNumber'
  | 'lookupCode'
  | 'buyerType'
  | 'companyName'
  | 'companyAddress'
  | 'taxCode'
  | 'companyEmail'
  | 'customerName'
  | 'customerEmail'
  | 'customerAddress'
  | 'totalAmount'
> & { booking: { bookingCode: string; checkInDate: Date; checkOutDate: Date } }

/** The create-invoice payload for one invoice (pure; see the shapes in matbao-client.ts). */
export function buildMatbaoInvoice(
  invoice: InvoiceForPayload,
  config: Pick<PropertyEinvoice, 'templateCode' | 'series'>,
  vatCode: VatCode,
  now: Date
) {
  const { net, vat, gross } = splitGross(invoice.totalAmount, vatCode)
  const lookupCode = lookupCodeFor(invoice)

  // NMua_Ten is the buyer company ("Tên đơn vị"), NMua_HVTNMHang the person:
  // putting a person's name in NMua_Ten printed it as a company (Founder AI).
  const buyer: Record<string, string> =
    invoice.buyerType === 'company'
      ? {
          NMua_Ten: invoice.companyName,
          NMua_MST: invoice.taxCode,
          NMua_DChi: invoice.companyAddress,
          NMua_HVTNMHang: invoice.customerName,
          NMua_DCTDTu: invoice.companyEmail || invoice.customerEmail,
        }
      : invoice.buyerType === 'personal'
        ? {
            NMua_Ten: '',
            NMua_MST: '',
            NMua_DChi: invoice.customerAddress ?? '',
            NMua_HVTNMHang: invoice.customerName,
            NMua_DCTDTu: invoice.customerEmail,
          }
        : { NMua_Ten: '', NMua_MST: '', NMua_DChi: '', NMua_HVTNMHang: 'Bán cho người tiêu dùng', NMua_DCTDTu: '' }

  const { bookingCode, checkInDate, checkOutDate } = invoice.booking
  return {
    KHMSHDon: config.templateCode,
    KHHDon: config.series,
    MaTraCuu: lookupCode,
    MTChieu: lookupCode.slice(0, 20),
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
        THHDVu: `Dịch vụ lưu trú - đơn ${bookingCode} (${vnDate(checkInDate)} - ${vnDate(checkOutDate)})`,
        DVTinh: 'Lần',
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

async function verifiedConfig(propertyId: string) {
  const config = await prisma.propertyEinvoice.findUnique({ where: { propertyId } })
  if (!config?.verifiedAt) {
    throw new EinvoiceError('Khách sạn chưa kết nối hoá đơn điện tử Mắt Bão (trang Hoá đơn → Kết nối)')
  }
  return config
}

function asObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Prisma.JsonObject) : {}
}

/** Issues the invoice through Mắt Bão. Safe to call again after any failure. */
export async function publishInvoice(invoiceId: string, userId: string, now = new Date()) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { booking: { select: { bookingCode: true, checkInDate: true, checkOutDate: true } } },
  })
  if (!invoice) throw new EinvoiceError('Không tìm thấy hoá đơn', 404)
  if (invoice.status === 'PUBLISHED') throw new EinvoiceError('Hoá đơn đã được phát hành', 409)
  if (invoice.status === 'CANCELLED' || invoice.status === 'REPLACED') {
    throw new EinvoiceError('Hoá đơn đã huỷ, không phát hành được', 409)
  }
  const config = await verifiedConfig(invoice.propertyId)
  // Invoices created before this part have no VAT code: use the property's.
  const vatCode: VatCode = isVatCode(invoice.vatCode) ? invoice.vatCode : (config.vatCode as VatCode)
  const split = splitGross(invoice.totalAmount, vatCode)
  const lookupCode = lookupCodeFor(invoice)

  const claimed = await prisma.invoice.updateMany({
    where: {
      id: invoiceId,
      OR: [
        { status: { in: ['DRAFT', 'PENDING'] } },
        { status: 'PUBLISHING', updatedAt: { lt: new Date(now.getTime() - PUBLISH_LEASE_MS) } },
      ],
    },
    data: {
      status: 'PUBLISHING',
      lookupCode,
      publishError: null,
      eInvoiceProvider: 'MATBAO',
      invoicePattern: config.templateCode,
      invoiceSeries: config.series,
      vatCode,
      subtotal: split.net,
      taxAmount: split.vat,
      taxRate: split.rate,
    },
  })
  if (claimed.count === 0) throw new EinvoiceError('Hoá đơn đang được phát hành, vui lòng đợi', 409)

  let result
  try {
    result = await clientFor(config).createInvoice(buildMatbaoInvoice({ ...invoice, lookupCode }, config, vatCode, now))
  } catch (error) {
    const message =
      error instanceof MatbaoError
        ? error.retryable
          ? `${error.message}. Bạn có thể bấm phát hành lại: Mắt Bão không xuất trùng hoá đơn này.`
          : `Mắt Bão từ chối: ${error.message} (mã ${error.code})`
        : 'Lỗi khi gọi Mắt Bão'
    // A refusal means nothing was issued: the invoice may be edited again.
    // A timeout may have issued it: keep lookupCode, which locks edits
    // (invoices.ts) until publishing again settles it.
    const refused = error instanceof MatbaoError && !error.retryable
    await prisma.invoice.updateMany({
      where: { id: invoiceId, status: 'PUBLISHING' },
      data: { status: 'PENDING', publishError: message, ...(refused && { lookupCode: null }) },
    })
    if (!(error instanceof MatbaoError)) console.error('[einvoice] publish failed:', error)
    throw new EinvoiceError(message, 502)
  }

  const published = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PUBLISHED',
      publishedAt: now,
      invoiceCode: result.maSoHDon,
      einvoiceNumber: result.soHDon,
      pdfUrl: result.pdfUrl,
      metadata: {
        ...asObject(invoice.metadata),
        matbao: {
          environment: config.environment,
          code: result.code,
          // 304: issued by an earlier attempt; Mắt Bão does not repeat the number.
          ...(result.code === '304' && { alreadyIssued: true }),
        },
      },
    },
  })
  await prisma.activityLog.create({
    data: {
      userId,
      propertyId: invoice.propertyId,
      action: 'PUBLISH',
      entityType: 'INVOICE',
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        provider: 'MATBAO',
        environment: config.environment,
        einvoiceNumber: result.soHDon,
        lookupCode,
      },
    },
  })
  if (config.remainingNumbers != null && result.code === '200') {
    await prisma.propertyEinvoice.updateMany({
      where: { propertyId: invoice.propertyId, remainingNumbers: { gt: 0 } },
      data: { remainingNumbers: { decrement: 1 } },
    })
  }
  return published
}

/** The issued invoice's PDF, fetched from Mắt Bão with the property's account. */
export async function getInvoicePdf(invoiceId: string): Promise<{ pdf: Buffer; filename: string }> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) throw new EinvoiceError('Không tìm thấy hoá đơn', 404)
  if (invoice.status !== 'PUBLISHED' || !invoice.lookupCode) throw new EinvoiceError('Hoá đơn chưa phát hành', 409)
  const config = await verifiedConfig(invoice.propertyId)
  try {
    const pdf = await clientFor(config).downloadPdf({ maTraCuu: invoice.lookupCode, maSoHDon: invoice.invoiceCode })
    return { pdf, filename: `hoa-don-${invoice.einvoiceNumber ?? invoice.invoiceNumber}.pdf` }
  } catch (error) {
    if (error instanceof MatbaoError) throw new EinvoiceError(error.message, 502)
    throw error
  }
}
