/**
 * A fake SePay payment gateway for tests (task 34): the order API
 * (SEPAY_API_BASE_URL) and the card checkout (SEPAY_CHECKOUT_BASE_URL) on
 * one port. Like SePay, it checks Basic auth on the API and the HMAC
 * signature of the checkout form, keeps orders by invoice number with
 * SePay's own "SEPAY-..." ids, and sends the IPN with X-Secret-Key.
 *
 *   GET  /v1/order?q=&created_at=&page=&per_page=  → { data: [...], meta }
 *   GET  /v1/order/detail/<SePay order id>         → { data: order }
 *   POST /v1/checkout/init (form)                  → the order is created;
 *        with autoPay the card is charged at once, the IPN delivered, and
 *        the browser sent to success_url (the browser tests use this)
 */
import http from 'http'
import type { AddressInfo } from 'net'
import { signCheckoutFields } from '../../lib/payments/sepay-sign'

export interface FakeSepayAccount {
  merchantId: string
  secretKey: string
}

export interface FakeSepayOrder {
  id: string
  order_id: string
  order_invoice_number: string
  order_status: 'AUTHENTICATION_NOT_NEEDED' | 'CAPTURED' | 'CANCELLED'
  order_amount: string
  order_currency: 'VND'
  order_description: string
  created_at: string
  account: FakeSepayAccount
  transactions: { id: string; transaction_id: string; payment_method: string; transaction_status: string; transaction_amount: string; card_brand: string; card_number: string; transaction_date: string }[]
}

let seq = 0

export class FakeSepay {
  readonly accounts = new Map<string, FakeSepayAccount>()
  readonly orders = new Map<string, FakeSepayOrder>()
  /** The IPN URL of each merchant, set by the test (the hotel sets it in SePay's dashboard). */
  readonly ipnUrls = new Map<string, string>()
  /** Or worked out when needed (the browser tests know the hotel only after their setup). */
  ipnUrlFor?: (merchantId: string) => string
  /** Charge the card as soon as the checkout form arrives (browser tests). */
  autoPay = false
  /** false: like a hotel that did not set the IPN's auth type to SECRET_KEY. */
  sendSecretHeader = true
  /** API calls received, for assertions. */
  readonly calls: string[] = []
  url = ''
  private server = http.createServer((req, res) => this.handle(req, res))

  async start(port = 0) {
    await new Promise<void>((resolve) => this.server.listen(port, '127.0.0.1', resolve))
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`
    return this
  }

  async stop() {
    await new Promise<void>((resolve) => this.server.close(() => resolve()))
  }

  addAccount(account: FakeSepayAccount) {
    this.accounts.set(account.merchantId, account)
    return account
  }

  /** An order as the checkout would create it (tests that skip the browser). */
  createOrder(account: FakeSepayAccount, invoice: string, amount: number) {
    const id = `SEPAY-${(++seq).toString(16).toUpperCase().padStart(13, '0')}`
    const order: FakeSepayOrder = {
      id: String(seq),
      order_id: id,
      order_invoice_number: invoice,
      order_status: 'AUTHENTICATION_NOT_NEEDED',
      order_amount: `${amount}.00`,
      order_currency: 'VND',
      order_description: '',
      created_at: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19).replace('T', ' '),
      account,
      transactions: [],
    }
    this.orders.set(invoice, order)
    return order
  }

  /** The card is charged: the order is CAPTURED; returns the IPN body SePay sends. */
  pay(invoice: string, amount?: number) {
    const order = this.orders.get(invoice)
    if (!order) throw new Error(`no fake SePay order ${invoice}`)
    order.order_status = 'CAPTURED'
    if (amount !== undefined) order.order_amount = `${amount}.00`
    order.transactions.push({
      id: `${seq}01`,
      transaction_id: `TXN${invoice}`,
      payment_method: 'CARD',
      transaction_status: 'APPROVED',
      transaction_amount: order.order_amount,
      card_brand: 'VISA',
      card_number: '4111XXXXXXXX1111',
      transaction_date: order.created_at,
    })
    return this.ipnBody(order)
  }

  ipnBody(order: FakeSepayOrder) {
    return {
      timestamp: Math.floor(Date.now() / 1000),
      notification_type: 'ORDER_PAID',
      order: {
        id: order.id,
        order_id: order.order_id,
        order_status: order.order_status,
        order_currency: order.order_currency,
        order_amount: order.order_amount,
        order_invoice_number: order.order_invoice_number,
        custom_data: [],
        order_description: order.order_description,
      },
      transaction: order.transactions[0] ?? null,
      customer: null,
    }
  }

  /** Delivers the IPN for an order to the merchant's IPN URL; returns our app's HTTP status. */
  async deliver(order: FakeSepayOrder) {
    const url = this.ipnUrls.get(order.account.merchantId) ?? this.ipnUrlFor?.(order.account.merchantId)
    if (!url) return 0
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.sendSecretHeader && { 'X-Secret-Key': order.account.secretKey }) },
      body: JSON.stringify(this.ipnBody(order)),
    })
    return res.status
  }

  private send(res: http.ServerResponse, status: number, body: object) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  private view(order: FakeSepayOrder, detail: boolean) {
    const { account: _a, transactions, ...rest } = order
    return detail ? { ...rest, transactions } : rest
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const raw = Buffer.concat(chunks).toString('utf8')
    const url = new URL(req.url ?? '/', this.url)
    this.calls.push(`${req.method} ${url.pathname}${url.search}`)

    if (req.method === 'POST' && url.pathname === '/v1/checkout/init') return this.checkout(raw, res)

    const auth = String(req.headers.authorization ?? '')
    const [merchantId, secretKey] = Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString('utf8').split(':')
    const account = this.accounts.get(merchantId)
    if (!account || account.secretKey !== secretKey) return this.send(res, 401, { message: 'Unauthenticated.' })

    if (req.method === 'GET' && url.pathname === '/v1/order') {
      const q = url.searchParams.get('q')
      const day = url.searchParams.get('created_at')
      const perPage = Number(url.searchParams.get('per_page') ?? 20)
      const page = Number(url.searchParams.get('page') ?? 1)
      const all = [...this.orders.values()].filter(
        (o) => o.account === account && (!q || o.order_invoice_number.includes(q)) && (!day || o.created_at.startsWith(day))
      )
      const slice = all.slice((page - 1) * perPage, page * perPage)
      return this.send(res, 200, {
        data: slice.map((o) => this.view(o, false)),
        meta: { per_page: perPage, total: all.length, has_more: page * perPage < all.length, current_page: page, page_count: Math.ceil(all.length / perPage) },
      })
    }
    const detail = url.pathname.match(/^\/v1\/order\/detail\/(.+)$/)
    if (req.method === 'GET' && detail) {
      const order = [...this.orders.values()].find((o) => o.order_id === decodeURIComponent(detail[1]) && o.account === account)
      if (!order) return this.send(res, 404, { message: 'Không tìm thấy đơn hàng' })
      return this.send(res, 200, { data: this.view(order, true) })
    }
    return this.send(res, 404, { message: 'not found' })
  }

  private async checkout(raw: string, res: http.ServerResponse) {
    const fields = [...new URLSearchParams(raw).entries()]
    const get = (name: string) => fields.find(([k]) => k === name)?.[1] ?? ''
    const account = this.accounts.get(get('merchant'))
    const unsigned = fields.filter(([k]) => k !== 'signature')
    if (!account || get('signature') !== signCheckoutFields(unsigned, account.secretKey)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Chữ ký không hợp lệ')
    }
    const order = this.createOrder(account, get('order_invoice_number'), Number(get('order_amount')))
    order.order_description = get('order_description')
    if (this.autoPay) {
      this.pay(order.order_invoice_number)
      await this.deliver(order)
      res.writeHead(303, { Location: get('success_url') })
      return res.end()
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<p>SePay giả: ${order.order_invoice_number}</p>`)
  }
}
