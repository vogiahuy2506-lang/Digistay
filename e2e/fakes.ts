/**
 * The outside world for the browser tests, in one process (started by
 * playwright.config.ts): the integration tests' fake PayOS and fake Mắt Bão
 * on fixed ports, an SMTP sink, and a control server the specs talk to.
 *
 *   GET  /ready                  → 200 once everything listens
 *   POST /payos/pay/<orderCode>  → the guest pays; the signed webhook is
 *                                  delivered to the app (Digistay's own
 *                                  webhook for a plan payment); { webhookStatus }
 *   GET  /matbao/calls           → the create-invoice payloads received
 *   GET  /mail                   → the emails received (raw MIME)
 *   GET  /v2/business/<taxCode>  → the tax register lookup (TAX_LOOKUP_BASE_URL)
 */
import http from 'http'
import net from 'net'
import { FakePayos } from '../src/test/integration/fake-payos'
import { FakeMatbao } from '../src/test/integration/fake-matbao'
import { E2E } from './env'

const payos = new FakePayos()
let payosWebhook = ''
payos.deliver = async (url, body) => {
  payosWebhook = url
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.status
}
payos.addAccount(E2E.payosAccount)
payos.addAccount(E2E.platformPayos)

const matbao = new FakeMatbao()
matbao.addAccount({
  ...E2E.matbaoAccount,
  templates: [{ khmshDon: '1', khhDon: E2E.matbaoSeries, cLai: 100 }],
})
matbao.addAccount({
  ...E2E.platformMatbao,
  templates: [{ khmshDon: '1', khhDon: E2E.platformMatbaoSeries, cLai: 100 }],
})

// SMTP sink: accepts any login (AUTH PLAIN), no STARTTLS.
const mails: { to: string; raw: string }[] = []
const smtp = net.createServer((sock) => {
  let inData = false
  let buf = ''
  let msg = ''
  let to = ''
  const say = (line: string) => sock.write(`${line}\r\n`)
  say('220 e2e-sink ESMTP')
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8')
    let i: number
    while ((i = buf.indexOf('\r\n')) !== -1) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 2)
      if (inData) {
        if (line === '.') {
          inData = false
          mails.push({ to, raw: msg })
          msg = ''
          say('250 OK')
        } else msg += `${line.startsWith('..') ? line.slice(1) : line}\r\n`
        continue
      }
      const cmd = line.slice(0, 4).toUpperCase()
      if (cmd === 'EHLO') sock.write('250-e2e-sink\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n')
      else if (cmd === 'RCPT') {
        to = line.replace(/^RCPT TO:\s*<?([^>]*)>?.*$/i, '$1')
        say('250 OK')
      } else if (cmd === 'DATA') {
        inData = true
        say('354 go')
      } else if (cmd === 'QUIT') {
        say('221 bye')
        sock.end()
      } else if (cmd === 'AUTH') say('235 OK')
      else say('250 OK')
    }
  })
})

const json = (res: http.ServerResponse, status: number, body: unknown) =>
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))

const control = http.createServer(async (req, res) => {
  const url = req.url ?? '/'
  if (url === '/ready') return json(res, 200, { ok: true })
  if (url === '/matbao/calls') return json(res, 200, matbao.createCalls)
  if (url === '/mail') return json(res, 200, mails)
  // VietQR's tax register lookup (src/lib/einvoice/tax-lookup.ts): one company, "51" for any other code.
  const business = url.match(/^\/v2\/business\/([\d-]+)$/)
  if (business) {
    const known = business[1] === E2E.taxCompany.taxCode
    return json(res, 200, known
      ? { code: '00', data: { id: E2E.taxCompany.taxCode, name: E2E.taxCompany.name, address: E2E.taxCompany.address, status: 'NNT đang hoạt động' } }
      : { code: '51', desc: 'Tax not found', data: null })
  }
  const pay = url.match(/^\/payos\/pay\/(\d+)$/)
  if (req.method === 'POST' && pay) {
    try {
      const body = await payos.pay(Number(pay[1]))
      // A plan payment is on Digistay's account, whose webhook is registered once outside the tests.
      const platform = payos.links.get(Number(pay[1]))?.account.clientId === E2E.platformPayos.clientId
      const r = await fetch(platform ? `${E2E.baseURL}/api/webhooks/payos/digistay` : payosWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      return json(res, 200, { webhookStatus: r.status })
    } catch (error) {
      return json(res, 400, { error: String(error) })
    }
  }
  return json(res, 404, { error: 'not found' })
})

;(async () => {
  await payos.start(E2E.ports.payos)
  await matbao.start(E2E.ports.matbao)
  await new Promise<void>((resolve) => smtp.listen(E2E.ports.smtp, '127.0.0.1', resolve))
  await new Promise<void>((resolve) => control.listen(E2E.ports.control, '127.0.0.1', resolve))
  console.log(`[e2e fakes] PayOS ${payos.url}, Mắt Bão ${matbao.url}, SMTP :${E2E.ports.smtp}, control :${E2E.ports.control}`)
})()
