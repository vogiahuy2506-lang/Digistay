/**
 * A fake Mắt Bão e-invoice API for integration tests (Part 6). Our client
 * talks HTTP to it (MATBAO_BASE_URL). Like Mắt Bão it checks the login and
 * token, the template/series, the totals and the invoice date order (333),
 * answers 304 for a MaTraCuu already issued, and nests results the way the
 * real API does. `failNext` injects the failures that matter.
 *
 * Replacements (TCHDon 1) and adjustments (2 increase, 3 decrease) must name
 * an issued invoice of the account. Adjustment amounts are taken as signed
 * (NĐ 123 Điều 19: a decrease is negative) — Mắt Bão's documentation does
 * not say, so this is our assumption, to confirm on Mắt Bão's DEMO.
 */
import http from 'http'
import type { AddressInfo } from 'net'
import { randomUUID } from 'crypto'

export interface FakeMatbaoAccount {
  taxCode: string
  username: string
  password: string
  templates: { khmshDon: string; khhDon: string; cLai: number }[]
}

export interface IssuedInvoice {
  maTraCuu: string
  maSoHDon: string
  shDon: number
  payload: Record<string, any>
  account: FakeMatbaoAccount
  replacedBy?: string
}

type Failure = 'drop-after-issue' | 'drop-before-issue' | { errorCode: string; message: string }

export const FAKE_PDF = Buffer.from('%PDF-1.4\n% fake Mắt Bão invoice\n%%EOF')

export class FakeMatbao {
  readonly accounts: FakeMatbaoAccount[] = []
  readonly issued = new Map<string, IssuedInvoice>()
  readonly createCalls: Record<string, any>[] = []
  readonly tokens = new Map<string, FakeMatbaoAccount>()
  failNext: Failure | null = null
  url = ''
  private lastNLap = new Map<string, string>()
  private server = http.createServer((req, res) => this.handle(req, res))

  /** Port 0 picks a free one; the browser tests (e2e/fakes.ts) use fixed ports. */
  async start(port = 0) {
    await new Promise<void>((resolve) => this.server.listen(port, '127.0.0.1', resolve))
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`
    return this
  }

  async stop() {
    await new Promise<void>((resolve) => this.server.close(() => resolve()))
  }

  addAccount(account: FakeMatbaoAccount) {
    this.accounts.push(account)
    return account
  }

  /** Invalidates every token, as when they expire. */
  expireTokens() {
    this.tokens.clear()
  }

  private send(res: http.ServerResponse, status: number, body: object) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null
    const url = new URL(req.url ?? '/', this.url)

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const account = this.accounts.find(
        (a) => a.taxCode === body?.MST && a.username === body?.TDNhap && a.password === body?.MKhau
      )
      if (!account) return this.send(res, 401, { success: false, message: 'Sai thông tin đăng nhập' })
      const token = randomUUID()
      this.tokens.set(token, account)
      return this.send(res, 200, { success: true, accessToken: token })
    }

    const account = this.tokens.get(String(req.headers.authorization ?? '').replace(/^Bearer /, ''))
    if (!account) return this.send(res, 401, { message: 'Unauthorized' })

    if (req.method === 'GET' && url.pathname === '/api/invoice/templates') {
      return this.send(res, 200, { success: true, data: account.templates })
    }

    if (req.method === 'POST' && url.pathname === '/api/invoice/create-invoice') {
      const invoice = body?.[0] ?? {}
      this.createCalls.push(invoice)
      const failure = this.failNext
      this.failNext = null
      if (failure === 'drop-before-issue') return req.socket.destroy()
      if (failure && typeof failure === 'object') {
        return this.send(res, 200, { success: true, data: [{ errorCode: failure.errorCode, errorMessage: failure.message }] })
      }

      const fail = (errorCode: string, errorMessage: string) =>
        this.send(res, 200, { success: true, data: [{ errorCode, errorMessage, data: {} }] })
      if (this.issued.has(invoice.MaTraCuu)) {
        return this.send(res, 200, { success: true, data: [{ errorCode: 304, errorMessage: 'Trùng mã tra cứu', data: {} }] })
      }
      const template = account.templates.find((t) => t.khmshDon === invoice.KHMSHDon && t.khhDon === invoice.KHHDon)
      if (!template) return fail('301', 'Không tìm thấy mẫu số/ký hiệu')
      if (template.cLai <= 0) return fail('327', 'Ký hiệu đã hết số')
      const key = `${invoice.KHMSHDon}/${invoice.KHHDon}`
      if (this.lastNLap.has(key) && invoice.NLap < this.lastNLap.get(key)!) {
        return fail('333', 'Ngày lập nhỏ hơn hoá đơn trước')
      }
      let related: IssuedInvoice | undefined
      if ([1, 2, 3].includes(invoice.TCHDon)) {
        // It must name an issued invoice of this account exactly.
        related = [...this.issued.values()].find(
          (i) => i.account === account && i.maSoHDon === invoice.MSHDonDCLQuan
        )
        if (
          !related ||
          String(related.shDon) !== String(invoice.SHDCLQuan) ||
          related.payload.KHHDon !== invoice.KHHDCLQuan ||
          related.payload.KHMSHDon !== invoice.KHMSHDCLQuan ||
          !invoice.NLHDCLQuan
        ) {
          return fail('341', 'Không tìm thấy hoá đơn liên quan')
        }
        if (related.replacedBy) return fail('342', 'Hoá đơn liên quan đã bị thay thế')
        if (invoice.TCHDon === 2 && !(invoice.TgTTTBSo > 0)) return fail('343', 'Điều chỉnh tăng phải có số tiền dương')
        if (invoice.TCHDon === 3 && !(invoice.TgTTTBSo < 0)) return fail('343', 'Điều chỉnh giảm phải ghi số âm')
      }
      const lines = (invoice.DSHHDVu ?? []).filter((l: any) => l.TChat === 1)
      const net = lines.reduce((s: number, l: any) => s + l.ThTien, 0)
      const vat = lines.reduce((s: number, l: any) => s + l.TThue, 0)
      if (net !== invoice.TgThTien || vat !== invoice.TgTThue || net + vat !== invoice.TgTTTBSo) {
        return fail('310', 'Tổng tiền không khớp')
      }

      template.cLai -= 1
      this.lastNLap.set(key, invoice.NLap)
      const issued: IssuedInvoice = {
        maTraCuu: invoice.MaTraCuu,
        maSoHDon: randomUUID(),
        shDon: [...this.issued.values()].filter((i) => i.account === account).length + 1,
        payload: invoice,
        account,
      }
      this.issued.set(invoice.MaTraCuu, issued)
      if (related && invoice.TCHDon === 1) related.replacedBy = invoice.MaTraCuu
      if (failure === 'drop-after-issue') return req.socket.destroy()
      return this.send(res, 200, {
        success: true,
        data: [
          {
            errorCode: 200,
            data: { maSoHDon: issued.maSoHDon, shDon: issued.shDon, urlDownloadPDF: `https://demo.matbao.in/pdf/${issued.maSoHDon}` },
          },
        ],
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/invoice/download-invoice') {
      const issued = this.issued.get(body?.MaTraCuu)
      if (!issued || issued.account !== account) return this.send(res, 404, { message: 'Không tìm thấy hoá đơn' })
      return this.send(res, 200, { success: true, data_PDF_Base64: FAKE_PDF.toString('base64') })
    }

    return this.send(res, 404, { message: 'not found' })
  }
}
