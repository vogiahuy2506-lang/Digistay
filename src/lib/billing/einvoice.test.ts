import { describe, expect, it } from 'vitest'
import { buildSubscriptionInvoice, invoiceBuyerSchema, lookupCodeFor, planLine, platformEinvoiceConfigured, platformEinvoiceSettings, readBuyer } from './einvoice'

const env = {
  DIGISTAY_MATBAO_TAX_CODE: '0312345678',
  DIGISTAY_MATBAO_USERNAME: 'digistay',
  DIGISTAY_MATBAO_PASSWORD: 'secret',
  DIGISTAY_MATBAO_SERIES: 'c26taa',
}

describe('platform e-invoice settings', () => {
  it('is off until every account setting is real (not the template placeholders)', () => {
    expect(platformEinvoiceConfigured(env)).toBe(true)
    expect(platformEinvoiceConfigured({ ...env, DIGISTAY_MATBAO_PASSWORD: 'PASTE_DIGISTAY_MATBAO_PASSWORD' })).toBe(false)
    expect(platformEinvoiceConfigured({ ...env, DIGISTAY_MATBAO_SERIES: ' ' })).toBe(false)
  })

  it('defaults to DEMO and to "not subject to VAT", template 1, series upper-cased', () => {
    expect(platformEinvoiceSettings(env)).toMatchObject({ environment: 'DEMO', templateCode: '1', series: 'C26TAA', vatCode: -1 })
    expect(platformEinvoiceSettings({ ...env, DIGISTAY_MATBAO_ENV: 'production', DIGISTAY_MATBAO_VAT: '8' })).toMatchObject({ environment: 'PRODUCTION', vatCode: 8 })
    // An empty or unknown rate is not "0%".
    expect(platformEinvoiceSettings({ ...env, DIGISTAY_MATBAO_VAT: '' }).vatCode).toBe(-1)
    expect(platformEinvoiceSettings({ ...env, DIGISTAY_MATBAO_VAT: '7' }).vatCode).toBe(-1)
  })
})

describe('the buyer picked at checkout', () => {
  it('takes a person with a CCCD and a company with its tax code and address', () => {
    expect(invoiceBuyerSchema.safeParse({ type: 'personal', name: 'Nguyễn An', idNumber: '079123456789' }).success).toBe(true)
    expect(invoiceBuyerSchema.safeParse({ type: 'personal', name: 'Nguyễn An', idNumber: '12345' }).success).toBe(false)
    const company = invoiceBuyerSchema.safeParse({ type: 'company', taxCode: '0312.345.678-001', companyName: 'Công ty Mây', address: '1 Lê Lợi, Huế' })
    expect(company.success && company.data).toMatchObject({ taxCode: '0312345678-001' })
    const noAddress = invoiceBuyerSchema.safeParse({ type: 'company', taxCode: '0312345678', companyName: 'Công ty Mây', address: '' })
    expect(noAddress.success).toBe(false)
  })

  it('reads anything unreadable on a payment as "no invoice wanted"', () => {
    expect(readBuyer(null)).toEqual({ type: 'none' })
    expect(readBuyer({ type: 'company', taxCode: 'x' })).toEqual({ type: 'none' })
  })
})

describe('buildSubscriptionInvoice', () => {
  const settings = { templateCode: '1', series: 'C26TAA' }
  const now = new Date('2026-10-27T03:04:05Z')
  const base = {
    buyerType: 'company',
    buyerName: 'Trần Bình',
    idNumber: null,
    companyName: 'Công ty TNHH Mây',
    taxCode: '0312345678',
    address: '1 Lê Lợi, Huế',
    email: 'ketoan@may.vn',
    amount: 50_000,
    vatCode: -1,
    lookupCode: lookupCodeFor('123456789'),
  }
  const payment = { plan: 'growth', billing: 'YEAR' as const }

  it('names the plan without dates and puts the company in NMua_Ten', () => {
    const p = buildSubscriptionInvoice(base, payment, settings, now)
    expect(p).toMatchObject({ KHMSHDon: '1', KHHDon: 'C26TAA', MaTraCuu: 'DSG123456789', NLap: '2026-10-27T10:04:05' })
    expect(p).toMatchObject({ NMua_Ten: 'Công ty TNHH Mây', NMua_MST: '0312345678', NMua_DChi: '1 Lê Lợi, Huế', NMua_HVTNMHang: 'Trần Bình', NMua_DCTDTu: 'ketoan@may.vn' })
    expect(p.DSHHDVu[0]).toMatchObject({ THHDVu: 'Phần mềm Digistay - Gói Growth 12 tháng', DVTinh: 'Gói', SLuong: 1 })
    expect(planLine({ plan: 'starter', billing: 'MONTH' })).toBe('Phần mềm Digistay - Gói Starter 1 tháng')
  })

  it('is not subject to VAT by default: no tax, the total is what was paid', () => {
    const p = buildSubscriptionInvoice(base, payment, settings, now)
    expect(p.DSHHDVu[0]).toMatchObject({ TSuat: -1, TThue: 0, ThTien: 50_000, TgTien: 50_000 })
    expect(p).toMatchObject({ TgThTien: 50_000, TgTThue: 0, TgTTTBSo: 50_000 })
  })

  it('splits VAT out of the amount paid when a rate is set', () => {
    const p = buildSubscriptionInvoice({ ...base, amount: 5_000, vatCode: 8 }, payment, settings, now)
    expect(p.DSHHDVu[0]).toMatchObject({ TSuat: 8, ThTien: 4_630, TThue: 370, TgTien: 5_000 })
  })

  it('writes a person with their CCCD, and an anonymous sale as "Bán cho người tiêu dùng"', () => {
    const person = buildSubscriptionInvoice({ ...base, buyerType: 'personal', companyName: null, taxCode: null, idNumber: '079123456789', address: null }, payment, settings, now)
    expect(person).toMatchObject({ NMua_Ten: '', NMua_MST: '', NMua_HVTNMHang: 'Trần Bình', NMua_CCCDan: '079123456789' })
    const none = buildSubscriptionInvoice({ ...base, buyerType: 'none', email: null }, payment, settings, now)
    expect(none).toMatchObject({ NMua_Ten: '', NMua_HVTNMHang: 'Bán cho người tiêu dùng', NMua_DCTDTu: '' })
  })
})
