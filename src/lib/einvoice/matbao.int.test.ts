/**
 * Mắt Bão e-invoices per property against real Postgres; our client talks
 * HTTP to a fake Mắt Bão (src/test/integration/fake-matbao.ts) (Part 6).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
// Webhook rate limits use Redis: an in-memory one (CI has none).
const redis = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
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
import { createBooking, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { FAKE_PDF, FakeMatbao, type FakeMatbaoAccount } from '@/test/integration/fake-matbao'
import { clearMatbaoTokens } from './matbao-client'
import { CREDENTIALS_UNREADABLE, PUBLISH_LEASE_MS, connectEinvoice, formatNLap, type EinvoiceSettings } from './matbao'
import { encryptSecret, secretContext } from '@/lib/security/secret-box'
import { POST as createInvoiceRoute } from '@/app/api/invoices/route'
import { PUT as updateInvoiceRoute } from '@/app/api/invoices/[id]/route'
import { POST as publishRoute } from '@/app/api/invoices/[id]/publish/route'
import { POST as cancelRoute } from '@/app/api/invoices/[id]/cancel/route'
import { GET as pdfRoute } from '@/app/api/invoices/[id]/pdf/route'
import { GET as settingsRoute } from '@/app/api/properties/[id]/einvoice/route'
import { POST as matbaoWebhook } from '@/app/api/webhooks/matbao/[propertyId]/[token]/route'
import { POST as replaceRoute } from '@/app/api/invoices/[id]/replace/route'
import { POST as adjustRoute } from '@/app/api/invoices/[id]/adjust/route'

const fake = new FakeMatbao()
const year = new Date().getFullYear() % 100
const SERIES = `C${year}TAA`
const freshAccount = (): FakeMatbaoAccount => ({
  taxCode: '0312345678',
  username: 'ks-demo',
  password: 'mat-khau-dung',
  templates: [{ khmshDon: '1', khhDon: SERIES, cLai: 100 }],
})
let ACCOUNT = freshAccount()
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

const COMPANY = {
  buyerType: 'company',
  companyName: 'Công ty TNHH Du Lịch Sen',
  companyAddress: '12 Lê Lợi, Quận 1, TP.HCM',
  taxCode: '0309876543',
  customerName: 'Nguyễn Văn An',
  customerEmail: 'an@sen.vn',
}

async function connectedTenant(memberRole?: 'USER' | 'RECEPTIONIST') {
  const tenant = await createTenant(memberRole ? { memberRole } : {})
  await connectEinvoice(tenant.property.id, SETTINGS(), tenant.owner.id)
  const booking = await createBooking(tenant.property.id, { totalAmount: 2_160_000, status: 'CHECKED_OUT' })
  signInAs(tenant.owner)
  return { ...tenant, booking }
}

async function createInvoice(bookingId: string, body: object = { ...COMPANY, totalAmount: 1_080_000 }) {
  const res = await createInvoiceRoute(req('POST', { bookingId, ...body }))
  return { res, body: await res.json() }
}

const publish = async (id: string) => {
  const res = await publishRoute(req('POST'), params(id))
  return { res, body: await res.json() }
}

beforeAll(async () => {
  await fake.start()
  process.env.MATBAO_BASE_URL = fake.url
})
beforeEach(async () => {
  await resetDatabase()
  fake.accounts.length = 0
  fake.issued.clear()
  fake.createCalls.length = 0
  ACCOUNT = fake.addAccount(freshAccount())
  clearMatbaoTokens()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterAll(async () => {
  await fake.stop()
  process.env.MATBAO_BASE_URL = originalBase
  await prisma.$disconnect()
})

describe('connecting a property', () => {
  it('logs in, checks the series and stores the password encrypted', async () => {
    const { property, owner } = await createTenant()
    const status = await connectEinvoice(property.id, SETTINGS(), owner.id)
    expect(status).toMatchObject({ connected: true, series: SERIES, remainingNumbers: 100, vatCode: 8 })
    expect(status).not.toHaveProperty('password')
    const row = await prisma.propertyEinvoice.findUniqueOrThrow({ where: { propertyId: property.id } })
    expect(row.password.startsWith('v1.')).toBe(true)
    expect(row.password).not.toContain('mat-khau')
  })

  it('a wrong password or a series not in the account stores nothing', async () => {
    const { property, owner } = await createTenant()
    await expect(connectEinvoice(property.id, { ...SETTINGS(), password: 'sai' }, owner.id)).rejects.toThrow(
      'Mắt Bão từ chối đăng nhập'
    )
    await expect(connectEinvoice(property.id, { ...SETTINGS(), series: 'C25TAA' }, owner.id)).rejects.toThrow(
      `hiện có: 1/${SERIES}`
    )
    expect(await prisma.propertyEinvoice.count()).toBe(0)
  })

  it('a failed change keeps the working account; saving without a password keeps it', async () => {
    const { property, owner } = await createTenant()
    await connectEinvoice(property.id, SETTINGS(), owner.id)
    await expect(connectEinvoice(property.id, { ...SETTINGS(), password: 'sai' }, owner.id)).rejects.toThrow()
    const kept = await connectEinvoice(property.id, { ...SETTINGS(), password: undefined, vatCode: 10 }, owner.id)
    expect(kept).toMatchObject({ connected: true, vatCode: 10 })
  })
})

describe('a password the keys cannot read', () => {
  // As after DATA_ENCRYPTION_KEYS lost the key it was saved with: bound to another row, it fails to decrypt.
  const scramble = (propertyId: string) =>
    prisma.propertyEinvoice.update({
      where: { propertyId },
      data: {
        password: encryptSecret('mat-khau-dung', secretContext('property_einvoice', 'another-row', 'password')),
        webhookToken: encryptSecret('token', secretContext('property_einvoice', 'another-row', 'webhookToken')),
      },
    })
  const settingsOf = async (propertyId: string) => {
    const res = await settingsRoute(req('GET'), params(propertyId))
    return { status: res.status, body: await res.json() }
  }

  it('the settings still load, flagged with what to do', async () => {
    const { property } = await connectedTenant()
    await scramble(property.id)

    const { status, body } = await settingsOf(property.id)
    expect(status).toBe(200)
    expect(body.data).toMatchObject({ connected: true, series: SERIES, credentialsUnreadable: true, credentialsError: CREDENTIALS_UNREADABLE })
    expect(body.data).not.toHaveProperty('webhookUrl')
  })

  it('publishing says so, claims nothing and calls nobody; saving the password again fixes it', async () => {
    const { property, booking, owner } = await connectedTenant()
    const { body: created } = await createInvoice(booking.id)
    await scramble(property.id)

    const { res, body } = await publish(created.data.id)
    expect(res.status).toBe(409)
    expect(body.error).toBe(CREDENTIALS_UNREADABLE)
    expect(fake.createCalls).toHaveLength(0)
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: created.data.id } })).toMatchObject({
      status: created.data.status,
      lookupCode: null,
      publishError: CREDENTIALS_UNREADABLE,
    })

    // Saving without a password keeps the unreadable one: refused with the same words.
    await expect(connectEinvoice(property.id, { ...SETTINGS(), password: undefined }, owner.id)).rejects.toThrow(CREDENTIALS_UNREADABLE)

    await connectEinvoice(property.id, SETTINGS(), owner.id)
    const { body: fixed } = await settingsOf(property.id)
    expect(fixed.data).not.toHaveProperty('credentialsUnreadable')
    expect(fixed.data.webhookUrl).toContain(`/api/webhooks/matbao/${property.id}/`)
    expect((await publish(created.data.id)).res.status).toBe(200)
  })
})

describe('creating invoices', () => {
  it('splits the VAT out of what the guest paid, with the property rate', async () => {
    const { booking } = await connectedTenant()
    const { res, body } = await createInvoice(booking.id)
    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({ totalAmount: 1_080_000, subtotal: 1_000_000, taxAmount: 80_000, vatCode: 8, status: 'PENDING' })
  })

  it('refuses bad tax codes, unconnected properties, and invoicing more than the booking', async () => {
    const { booking } = await connectedTenant()
    expect((await createInvoice(booking.id, { ...COMPANY, taxCode: '123', totalAmount: 100_000 })).res.status).toBe(400)
    expect((await createInvoice(booking.id, { ...COMPANY, totalAmount: 1_080_000 })).res.status).toBe(200)
    const over = await createInvoice(booking.id, { ...COMPANY, totalAmount: 1_080_001 })
    expect(over.res.status).toBe(400)
    expect(over.body.error).toContain('1.080.000')

    const other = await createTenant()
    const otherBooking = await createBooking(other.property.id, { totalAmount: 500_000 })
    signInAs(other.owner)
    expect((await createInvoice(otherBooking.id, { ...COMPANY, totalAmount: 500_000 })).res.status).toBe(400)
  })
})

describe('publishing', () => {
  it('sends the right invoice once, and records the number Mắt Bão gives', async () => {
    const { booking, owner } = await connectedTenant()
    const { body: created } = await createInvoice(booking.id)
    const before = formatNLap(new Date())
    const { res, body } = await publish(created.data.id)
    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({ status: 'PUBLISHED', einvoiceNumber: '1', lookupCode: `DS${created.data.invoiceNumber}` })

    const sent = fake.createCalls[0]
    expect(sent).toMatchObject({
      KHMSHDon: '1',
      KHHDon: SERIES,
      MaTraCuu: `DS${created.data.invoiceNumber}`,
      LoaiHDon: 1,
      KTraMaTraCuuTrung: 0,
      NMua_Ten: COMPANY.companyName,
      NMua_MST: COMPANY.taxCode,
      NMua_HVTNMHang: COMPANY.customerName,
      TgThTien: 1_000_000,
      TgTThue: 80_000,
      TgTTTBSo: 1_080_000,
      TgTTTBChu: 'Một triệu không trăm tám mươi nghìn đồng',
    })
    expect(sent.DSHHDVu[0]).toMatchObject({ TSuat: 8, DGia: 1_000_000, TThue: 80_000, TgTien: 1_080_000 })
    expect(sent.DSHHDVu[0].THHDVu).toContain(booking.bookingCode)
    // Vietnam local time, no offset (Mắt Bão compares it with the previous invoice).
    expect(sent.NLap).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    expect(sent.NLap >= before).toBe(true)

    expect((await publish(created.data.id)).res.status).toBe(409)
    expect(fake.createCalls).toHaveLength(1)
    expect(await prisma.activityLog.count({ where: { action: 'PUBLISH', userId: owner.id } })).toBe(1)
    expect((await prisma.propertyEinvoice.findFirstOrThrow()).remainingNumbers).toBe(99)
  })

  it('a person is the buyer, not a company; a walk-in is "Bán cho người tiêu dùng"', async () => {
    const { booking } = await connectedTenant()
    const person = await createInvoice(booking.id, {
      buyerType: 'personal',
      customerName: 'Trần Thị Bình',
      customerEmail: 'binh@example.com',
      customerAddress: 'Đà Lạt',
      totalAmount: 540_000,
    })
    await publish(person.body.data.id)
    expect(fake.createCalls[0]).toMatchObject({ NMua_Ten: '', NMua_MST: '', NMua_HVTNMHang: 'Trần Thị Bình' })

    const walkIn = await createInvoice(booking.id, {
      buyerType: 'consumer',
      customerName: 'Khách lẻ',
      customerEmail: 'le@example.com',
      totalAmount: 540_000,
    })
    await publish(walkIn.body.data.id)
    expect(fake.createCalls[1]).toMatchObject({ NMua_Ten: '', NMua_HVTNMHang: 'Bán cho người tiêu dùng', NMua_DCTDTu: '' })
  })

  it('two staff publishing at once issue one invoice', async () => {
    const { booking } = await connectedTenant()
    const { body: created } = await createInvoice(booking.id)
    const results = await Promise.all([publish(created.data.id), publish(created.data.id), publish(created.data.id)])
    expect(results.filter((r) => r.res.status === 200)).toHaveLength(1)
    expect(fake.createCalls).toHaveLength(1)
  })

  it('a connection lost after Mắt Bão issued it: edits are locked, publishing again gets 304, no second invoice', async () => {
    const { booking } = await connectedTenant()
    const { body: created } = await createInvoice(booking.id)
    fake.failNext = 'drop-after-issue'
    const first = await publish(created.data.id)
    expect(first.res.status).toBe(502)
    expect(first.body.error).toContain('phát hành lại')

    const edit = await updateInvoiceRoute(req('PUT', { ...COMPANY, totalAmount: 500_000 }), params(created.data.id))
    expect(edit.status).toBe(409)
    expect((await cancelRoute(req('POST'), params(created.data.id))).status).toBe(409)

    const again = await publish(created.data.id)
    expect(again.res.status).toBe(200)
    expect(again.body.data.status).toBe('PUBLISHED')
    expect(again.body.data.metadata).toMatchObject({ matbao: { code: '304', alreadyIssued: true } })
    expect(fake.issued.size).toBe(1)
  })

  it('a refusal (series out of numbers) leaves it editable, with the reason', async () => {
    const { booking } = await connectedTenant()
    const { body: created } = await createInvoice(booking.id)
    fake.failNext = { errorCode: '327', message: 'Ký hiệu đã hết số' }
    const refused = await publish(created.data.id)
    expect(refused.res.status).toBe(502)
    expect(refused.body.error).toContain('327')
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: created.data.id } })
    expect(row).toMatchObject({ status: 'PENDING', lookupCode: null, publishError: expect.stringContaining('327') })
    const edit = await updateInvoiceRoute(req('PUT', { ...COMPANY, totalAmount: 540_000 }), params(created.data.id))
    expect(edit.status).toBe(200)
    expect((await edit.json()).data).toMatchObject({ totalAmount: 540_000, subtotal: 500_000, taxAmount: 40_000 })
  })

  it('a publish stuck in PUBLISHING can be taken over after the lease', async () => {
    const { booking } = await connectedTenant()
    const { body: created } = await createInvoice(booking.id)
    await prisma.invoice.update({ where: { id: created.data.id }, data: { status: 'PUBLISHING' } })
    expect((await publish(created.data.id)).res.status).toBe(409)
    await prisma.$executeRaw`UPDATE invoices SET "updatedAt" = ${new Date(Date.now() - PUBLISH_LEASE_MS - 1000)} WHERE id = ${created.data.id}`
    expect((await publish(created.data.id)).res.status).toBe(200)
  })

  it('logs in again when the token has expired', async () => {
    const { booking } = await connectedTenant()
    const { body: created } = await createInvoice(booking.id)
    fake.expireTokens()
    expect((await publish(created.data.id)).res.status).toBe(200)
  })

  it('only staff may publish; issued invoices are cancelled on the Mắt Bão portal', async () => {
    const { booking, member } = await connectedTenant('USER')
    const { body: created } = await createInvoice(booking.id)
    signInAs(member!)
    expect((await publish(created.data.id)).res.status).toBe(403)
  })
})

describe('PDF', () => {
  it('is fetched from Mắt Bão for members, not for outsiders or unpublished invoices', async () => {
    const { booking, owner } = await connectedTenant()
    const { body: created } = await createInvoice(booking.id)
    expect((await pdfRoute(req('GET'), params(created.data.id))).status).toBe(409)
    await publish(created.data.id)

    const pdf = await pdfRoute(req('GET'), params(created.data.id))
    expect(pdf.status).toBe(200)
    expect(pdf.headers.get('content-type')).toBe('application/pdf')
    expect(Buffer.from(await pdf.arrayBuffer())).toEqual(FAKE_PDF)

    const cancel = await cancelRoute(req('POST'), params(created.data.id))
    expect(cancel.status).toBe(400)
    expect((await cancel.json()).error).toContain('mẫu 04')

    const outsider = await createTenant()
    signInAs(outsider.owner)
    expect((await pdfRoute(req('GET'), params(created.data.id))).status).toBe(404)
    signInAs(owner)
  })
})

describe('tax-office webhook', () => {
  const callback = (propertyId: string, token: string, body: object) =>
    matbaoWebhook(new NextRequest(`http://digistay.test/api/webhooks/matbao/${propertyId}/${token}`, { method: 'POST', body: JSON.stringify(body) }), {
      params: Promise.resolve({ propertyId, token }),
    })
  const payload = (fkey: string, code: number, extra: object = {}) => ({
    InvID: 'QVh5dWZs==', No: 1, Pattern: '1', Serial: SERIES, Fkey: fkey, MCCQT: '00ABC', MaTTHDon: code, TenTTHDon: 'x', GhiChuCQT: '', Loai: 3, ...extra,
  })

  async function published() {
    const tenant = await connectedTenant()
    const { body: created } = await createInvoice(tenant.booking.id)
    await publish(created.data.id)
    const settings = await (await settingsRoute(req('GET'), params(tenant.property.id))).json()
    const url: string = settings.data.webhookUrl
    return { ...tenant, invoiceId: created.data.id, fkey: `DS${created.data.invoiceNumber}`, token: url.split('/').pop()! }
  }

  it('only owners/ADMINs see the webhook URL (it holds a secret)', async () => {
    const { property, member, token } = await (async () => {
      const t = await connectedTenant('RECEPTIONIST')
      const s = await (await settingsRoute(req('GET'), params(t.property.id))).json()
      return { ...t, token: s.data.webhookUrl as string }
    })()
    expect(token).toContain(`/api/webhooks/matbao/${property.id}/`)
    signInAs(member!)
    const asStaff = await (await settingsRoute(req('GET'), params(property.id))).json()
    expect(asStaff.data.connected).toBe(true)
    expect(asStaff.data).not.toHaveProperty('webhookUrl')
    expect(asStaff.data).not.toHaveProperty('webhookToken')
  })

  it('records the tax-office status, refuses a wrong token, keeps final statuses', async () => {
    const { property, invoiceId, fkey, token } = await published()
    expect((await callback(property.id, 'wrong-token', payload(fkey, 4))).status).toBe(401)
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).cqtStatus).toBeNull()

    expect((await callback(property.id, token, payload(fkey, 4))).status).toBe(200)
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).toMatchObject({ cqtStatus: 4, cqtCode: '00ABC' })

    // A late "not sent yet" does not undo "code issued".
    await callback(property.id, token, payload(fkey, 3))
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).cqtStatus).toBe(4)
  })

  it('a refusal is recorded with its note and logged for staff', async () => {
    const { property, invoiceId, fkey, token } = await published()
    await callback(property.id, token, payload(fkey, 6, { GhiChuCQT: 'Sai mã số thuế người mua' }))
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).toMatchObject({
      cqtStatus: 6,
      cqtNote: 'Sai mã số thuế người mua',
    })
    expect(await prisma.activityLog.count({ where: { action: 'EINVOICE_CQT_REFUSED', entityId: invoiceId } })).toBe(1)
  })

  it("another property's token or invoice changes nothing; a missing number is filled", async () => {
    const a = await published()
    const b = await published()
    // B's valid token naming A's invoice: not found within B.
    expect((await callback(b.property.id, b.token, payload(a.fkey, 6))).status).toBe(200)
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: a.invoiceId } })).cqtStatus).toBeNull()
    // A's token on B's URL: refused.
    expect((await callback(b.property.id, a.token, payload(b.fkey, 4))).status).toBe(401)

    await prisma.invoice.update({ where: { id: a.invoiceId }, data: { einvoiceNumber: null } })
    await callback(a.property.id, a.token, payload(a.fkey, 4, { No: 57 }))
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: a.invoiceId } })).einvoiceNumber).toBe('57')
    expect((await callback(a.property.id, a.token, { Fkey: a.fkey })).status).toBe(400)
  })
})

describe('replacement invoices', () => {
  const replace = async (id: string) => {
    const res = await replaceRoute(req('POST'), params(id))
    return { res, body: await res.json() }
  }

  async function issued() {
    const tenant = await connectedTenant('USER')
    const { body: created } = await createInvoice(tenant.booking.id, { ...COMPANY, totalAmount: 2_160_000 })
    const { body: published } = await publish(created.data.id)
    return { ...tenant, original: published.data }
  }

  it('a corrected copy, issued as TCHDon 1 naming the original, which becomes REPLACED', async () => {
    const { original, booking } = await issued()
    const { res, body: draft } = await replace(original.id)
    expect(res.status).toBe(200)
    expect(draft.data).toMatchObject({ status: 'PENDING', replacesInvoiceId: original.id, totalAmount: 2_160_000, taxCode: COMPANY.taxCode })

    // The booking is fully invoiced by the original; its replacement may still hold the whole amount.
    const fixed = await updateInvoiceRoute(req('PUT', { ...COMPANY, taxCode: '0301112223', totalAmount: 2_160_000 }), params(draft.data.id))
    expect(fixed.status).toBe(200)
    // ...but no third invoice fits.
    expect((await createInvoice(booking.id, { ...COMPANY, totalAmount: 1_000 })).res.status).toBe(400)

    const { res: pub, body: issuedReplacement } = await publish(draft.data.id)
    expect(pub.status).toBe(200)
    const sent = fake.createCalls.at(-1)!
    expect(sent).toMatchObject({
      TCHDon: 1,
      MSHDonDCLQuan: original.invoiceCode,
      KHMSHDCLQuan: '1',
      KHHDCLQuan: SERIES,
      SHDCLQuan: original.einvoiceNumber,
      NMua_MST: '0301112223',
    })
    expect(sent.NLHDCLQuan).toBe(formatNLap(new Date(original.publishedAt)))
    expect(sent.GChu).toContain(`số ${original.einvoiceNumber}`)
    expect(issuedReplacement.data.status).toBe('PUBLISHED')
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: original.id } })).status).toBe('REPLACED')
    expect(await prisma.activityLog.count({ where: { action: 'INVOICE_REPLACED', entityId: original.id } })).toBe(1)
  })

  it('one active replacement per invoice, only for issued invoices, only by staff', async () => {
    const { original, booking, member, owner } = await issued()
    expect((await replace(original.id)).res.status).toBe(200)
    const second = await replace(original.id)
    expect(second.res.status).toBe(409)
    expect(second.body.error).toContain('đã có hoá đơn thay thế')

    const { body: pending } = await createInvoice(booking.id, { ...COMPANY, totalAmount: 1_000 }).catch(() => ({ body: null as any }))
    expect(pending?.success).toBe(false) // fully invoiced already

    const other = await createInvoice((await createBooking(original.propertyId, { totalAmount: 500_000 })).id, {
      ...COMPANY,
      totalAmount: 500_000,
    })
    expect((await replace(other.body.data.id)).res.status).toBe(409) // not issued

    signInAs(member!)
    expect((await replace(original.id)).res.status).toBe(403)
    signInAs(owner)
  })

  it('a cancelled draft frees the invoice for another replacement', async () => {
    const { original } = await issued()
    const { body: draft } = await replace(original.id)
    expect((await cancelRoute(req('POST'), params(draft.data.id))).status).toBe(200)
    expect((await replace(original.id)).res.status).toBe(200)
  })
})

describe('adjustment invoices', () => {
  const adjust = async (id: string, body: object) => {
    const res = await adjustRoute(req('POST', body), params(id))
    return { res, body: await res.json() }
  }
  const replace = async (id: string) => replaceRoute(req('POST'), params(id))

  async function issued(totalAmount: number) {
    const tenant = await connectedTenant('USER')
    const { body: created } = await createInvoice(tenant.booking.id, { ...COMPANY, totalAmount })
    const { body: published } = await publish(created.data.id)
    return { ...tenant, original: published.data }
  }

  it('an increase: TCHDon 2 with the difference, naming the original, which stays issued', async () => {
    const { original, booking } = await issued(1_080_000)
    const { res, body: draft } = await adjust(original.id, { direction: 'increase', amount: 540_000, reason: 'Khách ở thêm 1 đêm' })
    expect(res.status).toBe(200)
    expect(draft.data).toMatchObject({
      status: 'PENDING',
      adjustsInvoiceId: original.id,
      totalAmount: 540_000,
      subtotal: 500_000,
      taxAmount: 40_000,
      taxCode: COMPANY.taxCode,
    })
    // 1,080,000 + 540,000 of 2,160,000 invoiced: 600,000 more does not fit.
    expect((await createInvoice(booking.id, { ...COMPANY, totalAmount: 600_000 })).res.status).toBe(400)

    const { res: pub, body: issuedAdjustment } = await publish(draft.data.id)
    expect(pub.status).toBe(200)
    const sent = fake.createCalls.at(-1)!
    expect(sent).toMatchObject({
      TCHDon: 2,
      MSHDonDCLQuan: original.invoiceCode,
      KHMSHDCLQuan: '1',
      KHHDCLQuan: SERIES,
      SHDCLQuan: original.einvoiceNumber,
      TgThTien: 500_000,
      TgTThue: 40_000,
      TgTTTBSo: 540_000,
      NMua_MST: COMPANY.taxCode,
    })
    expect(sent.NLHDCLQuan).toBe(formatNLap(new Date(original.publishedAt)))
    expect(sent.GChu).toContain(`Điều chỉnh tăng cho hóa đơn mẫu số 1 ký hiệu ${SERIES} số ${original.einvoiceNumber}`)
    expect(sent.GChu).toContain('Lý do: Khách ở thêm 1 đêm')
    expect(sent.DSHHDVu[0].THHDVu).toMatch(/^Điều chỉnh tăng: dịch vụ lưu trú/)
    expect(issuedAdjustment.data.status).toBe('PUBLISHED')
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: original.id } })).status).toBe('PUBLISHED')
    expect(await prisma.activityLog.count({ where: { action: 'INVOICE_ADJUSTED', entityId: original.id } })).toBe(1)
  })

  it('a decrease is negative (TCHDon 3), and frees room in the booking only once issued', async () => {
    const { original, booking } = await issued(2_160_000)
    const { body: draft } = await adjust(original.id, { direction: 'decrease', amount: 1_080_000, reason: 'Giảm giá cho khách đoàn' })
    expect(draft.data).toMatchObject({ totalAmount: -1_080_000, subtotal: -1_000_000, taxAmount: -80_000 })
    // Not issued yet: the booking still counts as fully invoiced.
    expect((await createInvoice(booking.id, { ...COMPANY, totalAmount: 1_000 })).res.status).toBe(400)

    expect((await publish(draft.data.id)).res.status).toBe(200)
    const sent = fake.createCalls.at(-1)!
    expect(sent).toMatchObject({ TCHDon: 3, TgThTien: -1_000_000, TgTThue: -80_000, TgTTTBSo: -1_080_000 })
    expect(sent.DSHHDVu[0]).toMatchObject({ DGia: -1_000_000, ThTien: -1_000_000, TThue: -80_000, TgTien: -1_080_000 })
    expect(sent.TgTTTBChu).toBe('Âm một triệu không trăm tám mươi nghìn đồng')
    expect(sent.GChu).toContain('Điều chỉnh giảm cho hóa đơn')

    // Issued: the room is back, and the invoice cannot go below zero.
    const over = await adjust(original.id, { direction: 'decrease', amount: 1_080_001, reason: 'Giảm thêm' })
    expect(over.res.status).toBe(400)
    expect(over.body.error).toContain('1.080.000')
    expect((await createInvoice(booking.id, { ...COMPANY, totalAmount: 1_080_000 })).res.status).toBe(200)
  })

  it('one unissued adjustment at a time, never alongside a replacement, and not editable', async () => {
    const { original } = await issued(2_160_000)
    const { body: draft } = await adjust(original.id, { direction: 'decrease', amount: 100_000, reason: 'Bớt phụ thu' })
    const second = await adjust(original.id, { direction: 'decrease', amount: 50_000, reason: 'Bớt thêm' })
    expect(second.res.status).toBe(409)
    expect(second.body.error).toContain('chưa phát hành')

    const replacing = await replace(original.id)
    expect(replacing.status).toBe(409)
    expect((await replacing.json()).error).toContain('đã có hoá đơn điều chỉnh')
    const edited = await updateInvoiceRoute(req('PUT', { ...COMPANY, totalAmount: 50_000 }), params(draft.data.id))
    expect(edited.status).toBe(409)

    // A cancelled adjustment blocks nothing; a replacement then blocks adjusting.
    expect((await cancelRoute(req('POST'), params(draft.data.id))).status).toBe(200)
    expect((await replace(original.id)).status).toBe(200)
    const blocked = await adjust(original.id, { direction: 'decrease', amount: 50_000, reason: 'Bớt phụ thu' })
    expect(blocked.res.status).toBe(409)
    expect(blocked.body.error).toContain('hoá đơn thay thế')
  })

  it('only issued invoices, never an adjustment itself, only staff, only valid input', async () => {
    const { original, booking, member, owner } = await issued(1_080_000)
    const { body: draft } = await adjust(original.id, { direction: 'increase', amount: 100_000, reason: 'Phụ thu minibar' })
    expect((await adjust(draft.data.id, { direction: 'decrease', amount: 1, reason: 'Thử điều chỉnh' })).res.status).toBe(409) // not issued
    await publish(draft.data.id)
    const nested = await adjust(draft.data.id, { direction: 'decrease', amount: 1, reason: 'Thử điều chỉnh' })
    expect(nested.res.status).toBe(409)
    expect(nested.body.error).toContain('hoá đơn gốc')

    expect((await adjust(original.id, { direction: 'increase', amount: 0, reason: 'Phụ thu minibar' })).res.status).toBe(400)
    expect((await adjust(original.id, { direction: 'increase', amount: 1_000 })).res.status).toBe(400)
    expect((await adjust(original.id, { direction: 'sideways', amount: 1_000, reason: 'Phụ thu minibar' })).res.status).toBe(400)
    // 1,080,000 + 100,000 issued; 980,001 more is over the booking.
    expect((await adjust(original.id, { direction: 'increase', amount: 980_001, reason: 'Phụ thu minibar' })).res.status).toBe(400)

    signInAs(member!)
    expect((await adjust(original.id, { direction: 'increase', amount: 1_000, reason: 'Phụ thu minibar' })).res.status).toBe(403)
    signInAs(owner)
    expect(await prisma.invoice.count({ where: { bookingId: booking.id } })).toBe(2)
  })
})
