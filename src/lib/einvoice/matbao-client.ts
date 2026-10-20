/**
 * HTTP client for Mắt Bão's e-invoice API ("API Proxy HDDT"), one account
 * per property (Part 6). Shapes follow Founder AI's client, which runs in
 * production; the published docs differ from what the API returns:
 * create-invoice answers `data: [{ errorCode, data: { maSoHDon, shDon,
 * urlDownloadPDF } }]`, nested twice.
 */
import { createHash } from 'crypto'

export const MATBAO_BASE_URLS = {
  DEMO: 'https://demo-api-hddt.matbao.in:11443',
  PRODUCTION: 'https://api-hddt.matbao.in:11443',
} as const
export type MatbaoEnvironment = keyof typeof MATBAO_BASE_URLS

const TIMEOUT_MS = 30_000
/** Tokens last 24 h; renew a little earlier. */
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000
const MAX_PDF_BYTES = 10 * 1024 * 1024
/** Where PDF links may point (measured: Mắt Bão demo serves PDFs from mifi.vn). */
const PDF_HOST_SUFFIXES = ['matbao.in', 'matbao.net', 'mifi.vn']

/** Codes Mắt Bão uses for "try again later" (Founder AI's list). */
const RETRYABLE_CODES = new Set(['315', '321', '322', '325', '326', '329', '330'])

export class MatbaoError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'MatbaoError'
  }
}

export interface MatbaoAccount {
  environment: MatbaoEnvironment
  taxCode: string
  username: string
  password: string
}

export interface CreateResult {
  /** "200" issued, "304" this MaTraCuu was already issued */
  code: string
  message: string | null
  maSoHDon: string | null
  soHDon: string | null
  pdfUrl: string | null
}

const tokens = new Map<string, { token: string; expiresAt: number }>()

/** Tests point this at a fake server; production uses the official URLs. */
function baseUrlFor(environment: MatbaoEnvironment): string {
  return process.env.MATBAO_BASE_URL || MATBAO_BASE_URLS[environment]
}

function cacheKey(account: MatbaoAccount): string {
  return createHash('sha256')
    .update(`${account.environment}|${account.taxCode}|${account.username}|${account.password}`)
    .digest('hex')
}

function messageOf(body: unknown, fallback: string): string {
  const b = body as Record<string, unknown> | null
  const m = b?.message ?? b?.Message ?? b?.errorMessage ?? b?.ErrorMessage
  return typeof m === 'string' && m ? m : fallback
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    // Timeouts and network errors: the request may or may not have arrived.
    const reason = (error as Error)?.name === 'AbortError' ? 'timeout' : 'network'
    throw new MatbaoError(`Không kết nối được Mắt Bão (${reason})`, reason, true)
  } finally {
    clearTimeout(timer)
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export class MatbaoClient {
  private readonly key: string
  private readonly baseUrl: string

  constructor(private readonly account: MatbaoAccount) {
    this.key = cacheKey(account)
    this.baseUrl = baseUrlFor(account.environment)
  }

  async login(force = false): Promise<string> {
    const cached = tokens.get(this.key)
    if (!force && cached && cached.expiresAt > Date.now()) return cached.token

    const res = await fetchWithTimeout(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ MST: this.account.taxCode, TDNhap: this.account.username, MKhau: this.account.password }),
    })
    const body = (await readJson(res)) as Record<string, any> | null
    const token =
      body?.accessToken ?? body?.access_token ?? body?.data?.accessToken ?? body?.Data?.accessToken ?? null
    if (!res.ok || typeof token !== 'string' || !token) {
      tokens.delete(this.key)
      throw new MatbaoError(
        `Mắt Bão từ chối đăng nhập: ${messageOf(body, `HTTP ${res.status}`)}`,
        String(res.status),
        false
      )
    }
    tokens.set(this.key, { token, expiresAt: Date.now() + TOKEN_TTL_MS })
    return token
  }

  private async request(
    path: string,
    init: { method: string; body?: unknown },
    retried = false
  ): Promise<{ ok: boolean; status: number; body: Record<string, any> | null }> {
    const token = await this.login()
    const res = await fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    if (res.status === 401 && !retried) {
      await this.login(true)
      return this.request(path, init, true)
    }
    return { ok: res.ok, status: res.status, body: (await readJson(res)) as Record<string, any> | null }
  }

  /** The account's templates and series for a year, with numbers left (CLai). */
  async templates(year: number) {
    const res = await this.request(`/api/invoice/templates?year=${year}`, { method: 'GET' })
    if (!res.ok) throw new MatbaoError(messageOf(res.body, `HTTP ${res.status}`), String(res.status), res.status >= 500)
    const list = (res.body?.data ?? res.body?.Data ?? (Array.isArray(res.body) ? res.body : [])) as Record<string, any>[]
    return list.map((t) => ({
      templateCode: String(t.khmshDon ?? t.KHMSHDon ?? t.khmshdon ?? '').trim(),
      series: String(t.khhDon ?? t.KHHDon ?? t.khhdon ?? '').trim(),
      remaining: Number(t.cLai ?? t.CLai ?? 0) || 0,
    }))
  }

  /** Issues one invoice (LoaiHDon 1). Throws MatbaoError unless code 200 or 304. */
  async createInvoice(invoice: Record<string, unknown>): Promise<CreateResult> {
    const res = await this.request('/api/invoice/create-invoice', { method: 'POST', body: [invoice] })
    if (res.status >= 500) throw new MatbaoError(messageOf(res.body, `HTTP ${res.status}`), String(res.status), true)

    const list = res.body?.data ?? res.body?.Data ?? (Array.isArray(res.body) ? res.body : null)
    const item = (Array.isArray(list) ? list[0] : list) as Record<string, any> | null | undefined
    if (!res.ok || !item) {
      const code = String(res.body?.errorCode ?? res.body?.ErrorCode ?? res.status)
      throw new MatbaoError(messageOf(res.body, 'Mắt Bão không trả kết quả'), code, RETRYABLE_CODES.has(code))
    }
    const inner = (item.data ?? item.Data ?? {}) as Record<string, any>
    const code = String(item.errorCode ?? item.ErrorCode ?? 200)
    const message = (item.errorMessage ?? item.ErrorMessage ?? item.message ?? null) as string | null
    if (code !== '200' && code !== '304') {
      throw new MatbaoError(message || `Mắt Bão báo lỗi ${code}`, code, RETRYABLE_CODES.has(code))
    }
    const so = inner.shDon ?? inner.SHDon ?? inner.soHDon
    return {
      code,
      message,
      maSoHDon: (inner.maSoHDon ?? inner.MaSoHDon ?? null) as string | null,
      soHDon: so != null && so !== '' ? String(so) : null,
      pdfUrl: (inner.urlDownloadPDF ?? inner.UrlDownloadPDF ?? null) as string | null,
    }
  }

  /** The invoice PDF: base64 in the answer, or a link on a Mắt Bão host. */
  async downloadPdf(ids: { maTraCuu: string; maSoHDon?: string | null }): Promise<Buffer> {
    const res = await this.request('/api/invoice/download-invoice', {
      method: 'POST',
      body: { MaTraCuu: ids.maTraCuu, MaSoHDon: ids.maSoHDon ?? undefined },
    })
    if (!res.ok) throw new MatbaoError(messageOf(res.body, `HTTP ${res.status}`), String(res.status), res.status >= 500)
    const b = res.body ?? {}
    const base64 = b.data_PDF_Base64 ?? b.data?.data_PDF_Base64 ?? b.Data?.data_PDF_Base64
    if (typeof base64 === 'string' && base64) return asPdf(Buffer.from(base64, 'base64'))
    const link = b.link_file ?? b.data?.link_file ?? b.data?.urlDownloadPDF ?? b.Data?.link_file
    if (typeof link === 'string' && link) return fetchPdf(link)
    throw new MatbaoError('Mắt Bão không trả file PDF', 'no_pdf', false)
  }
}

function asPdf(buffer: Buffer): Buffer {
  if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES || buffer.subarray(0, 4).toString() !== '%PDF') {
    throw new MatbaoError('File Mắt Bão trả về không phải PDF hợp lệ', 'bad_pdf', false)
  }
  return buffer
}

/** Follows a PDF link only to Mắt Bão hosts over HTTPS (no SSRF via links). */
async function fetchPdf(link: string, redirects = 0): Promise<Buffer> {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    throw new MatbaoError('Link PDF không hợp lệ', 'bad_link', false)
  }
  const host = url.hostname.toLowerCase()
  const allowed = PDF_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))
  if (url.protocol !== 'https:' || !allowed) throw new MatbaoError('Link PDF không thuộc Mắt Bão', 'bad_link', false)

  const res = await fetchWithTimeout(url.toString(), { method: 'GET', redirect: 'manual' })
  if (res.status >= 300 && res.status < 400 && res.headers.get('location') && redirects < 3) {
    return fetchPdf(new URL(res.headers.get('location')!, url).toString(), redirects + 1)
  }
  if (!res.ok) throw new MatbaoError(`Không tải được PDF (HTTP ${res.status})`, String(res.status), res.status >= 500)
  return asPdf(Buffer.from(await res.arrayBuffer()))
}

/** For tests: forget cached tokens. */
export function clearMatbaoTokens() {
  tokens.clear()
}
