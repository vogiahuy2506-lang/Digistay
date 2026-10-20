/**
 * A fake PayOS Merchant API for integration tests (Part 5). The real SDK
 * talks HTTP to it (PAYOS_BASE_URL). Like PayOS, it checks the client id,
 * API key and request signature, signs its responses and webhooks with the
 * account's checksum key, and calls the webhook URL during confirm-webhook.
 */
import http from 'http'
import type { AddressInfo } from 'net'
import { NodeCryptoProvider } from '@payos/node/lib/crypto/node-crypto'

export interface FakeAccount {
  clientId: string
  apiKey: string
  checksumKey: string
}

export interface FakeLink {
  orderCode: number
  amount: number
  amountPaid: number
  description: string
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED'
  account: FakeAccount
  transactions: { reference: string; amount: number; transactionDateTime: string }[]
}

const crypto = new NodeCryptoProvider()

export class FakePayos {
  readonly accounts = new Map<string, FakeAccount>()
  readonly links = new Map<number, FakeLink>()
  /** What our webhook answered to the confirm-webhook test, by URL. */
  readonly confirmCalls: { webhookUrl: string; status: number }[] = []
  /** Delivers a webhook to our app; returns the HTTP status it answered. */
  deliver: (webhookUrl: string, body: object) => Promise<number> = async () => 200
  url = ''
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

  addAccount(account: FakeAccount) {
    this.accounts.set(account.clientId, account)
    return account
  }

  /** A signed webhook body, as PayOS sends it when the link is paid. */
  async webhookBody(link: Pick<FakeLink, 'orderCode' | 'amount' | 'description'>, checksumKey: string, code = '00') {
    const data = {
      orderCode: link.orderCode,
      amount: link.amount,
      description: link.description,
      accountNumber: '0011223344',
      reference: `FT${link.orderCode}`,
      transactionDateTime: '2026-10-20 10:00:00',
      currency: 'VND',
      paymentLinkId: `pl${link.orderCode}`,
      code,
      desc: code === '00' ? 'Thành công' : 'Lỗi',
      counterAccountBankId: '',
      counterAccountBankName: '',
      counterAccountName: '',
      counterAccountNumber: '',
      virtualAccountName: '',
      virtualAccountNumber: '',
    }
    return { code, desc: 'success', success: code === '00', data, signature: await crypto.createSignatureFromObj(data, checksumKey) }
  }

  /** The guest pays: the link becomes PAID; returns the webhook to deliver. */
  async pay(orderCode: number, amount?: number) {
    const link = this.links.get(orderCode)
    if (!link) throw new Error(`no fake link ${orderCode}`)
    const paid = amount ?? link.amount
    link.status = 'PAID'
    link.amountPaid = paid
    link.transactions.push({ reference: `FT${orderCode}`, amount: paid, transactionDateTime: '2026-10-20 10:00:00' })
    return this.webhookBody({ ...link, amount: paid }, link.account.checksumKey)
  }

  private async send(res: http.ServerResponse, status: number, body: object) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  private async ok(res: http.ServerResponse, account: FakeAccount, data: object, sign = true) {
    const signature = sign ? await crypto.createSignatureFromObj(data, account.checksumKey) : undefined
    return this.send(res, 200, { code: '00', desc: 'success', data, signature })
  }

  private linkData(link: FakeLink) {
    return {
      id: `pl${link.orderCode}`,
      orderCode: link.orderCode,
      amount: link.amount,
      amountPaid: link.amountPaid,
      amountRemaining: link.amount - link.amountPaid,
      status: link.status,
      createdAt: '2026-10-20T09:00:00+07:00',
      transactions: link.transactions,
      cancellationReason: null,
      canceledAt: null,
    }
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}

    const account = this.accounts.get(String(req.headers['x-client-id']))
    if (!account || req.headers['x-api-key'] !== account.apiKey) {
      return this.send(res, 401, { code: '401', desc: 'Thông tin xác thực không hợp lệ' })
    }
    const path = new URL(req.url ?? '/', this.url).pathname

    if (req.method === 'POST' && path === '/confirm-webhook') {
      const test = await this.webhookBody({ orderCode: 123, amount: 3000, description: 'VQRIO123' }, account.checksumKey)
      const status = await this.deliver(body.webhookUrl, test)
      this.confirmCalls.push({ webhookUrl: body.webhookUrl, status })
      if (status < 200 || status >= 300) return this.send(res, 200, { code: '20', desc: 'Webhook url không hợp lệ' })
      return this.ok(res, account, {
        webhookUrl: body.webhookUrl,
        accountName: 'KHACH SAN DEMO',
        accountNumber: '0011223344',
        name: 'Khách sạn Demo',
        shortName: 'MB',
      }, false)
    }

    if (req.method === 'POST' && path === '/v2/payment-requests') {
      const expected = await crypto.createSignatureOfPaymentRequest(body, account.checksumKey)
      if (body.signature !== expected) return this.send(res, 200, { code: '20', desc: 'Chữ ký không hợp lệ' })
      if (this.links.has(body.orderCode)) return this.send(res, 200, { code: '231', desc: 'Đơn thanh toán đã tồn tại' })
      const link: FakeLink = {
        orderCode: body.orderCode,
        amount: body.amount,
        amountPaid: 0,
        description: body.description,
        status: 'PENDING',
        account,
        transactions: [],
      }
      this.links.set(link.orderCode, link)
      return this.ok(res, account, {
        bin: '970422',
        accountNumber: '0011223344',
        accountName: 'KHACH SAN DEMO',
        amount: link.amount,
        description: link.description,
        orderCode: link.orderCode,
        currency: 'VND',
        paymentLinkId: `pl${link.orderCode}`,
        status: 'PENDING',
        expiredAt: body.expiredAt,
        checkoutUrl: `https://pay.payos.vn/web/pl${link.orderCode}`,
        qrCode: `00020101021238570010A000000727FAKE${link.orderCode}`,
      })
    }

    const match = path.match(/^\/v2\/payment-requests\/(\d+)(\/cancel)?$/)
    const link = match ? this.links.get(Number(match[1])) : undefined
    if (match && (!link || link.account !== account)) return this.send(res, 200, { code: '101', desc: 'Không tìm thấy đơn' })
    if (link && req.method === 'GET' && !match![2]) return this.ok(res, account, this.linkData(link))
    if (link && req.method === 'POST' && match![2]) {
      if (link.status !== 'PENDING') return this.send(res, 200, { code: '20', desc: 'Đơn không thể huỷ' })
      link.status = 'CANCELLED'
      return this.ok(res, account, this.linkData(link))
    }
    return this.send(res, 404, { code: '404', desc: 'not found' })
  }
}
