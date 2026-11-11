import { prisma } from '@/lib/db'
import { realSetting } from '@/lib/billing/platform-payos'
import nodemailer from 'nodemailer'
import { PayOS } from '@payos/node'

export interface PayosSettings {
  clientId: string
  apiKey: string
  checksumKey: string
  webhookUrl: string
}

export interface MatbaoSettings {
  environment: 'demo' | 'prod'
  taxCode: string
  username: string
  password?: string
  invoiceSeries: string
  templateCode: string
}

export interface GeminiSettings {
  apiKey: string
  defaultModel: string
  temperature: number
}

export interface SmtpSettings {
  host: string
  port: number
  username: string
  password?: string
  fromName: string
  fromEmail: string
  secure: boolean
}

export interface BrandingSettings {
  companyName: string
  legalName: string
  hotline: string
  supportEmail: string
  address: string
  websiteUrl: string
}

export interface AllPlatformSettings {
  payos: PayosSettings
  matbao: MatbaoSettings
  gemini: GeminiSettings
  smtp: SmtpSettings
  branding: BrandingSettings
}

export const MASKED_SECRET = '••••••••'

/**
 * Returns all platform settings with sensitive credentials masked for UI display.
 */
export async function getAllPlatformSettings(): Promise<AllPlatformSettings> {
  const rows = await prisma.platformSetting.findMany()
  const map = new Map<string, any>(rows.map((r) => [r.key, r.value]))

  // 1. PayOS
  const payosDb = map.get('payos') || {}
  const payos: PayosSettings = {
    clientId: payosDb.clientId || process.env.DIGISTAY_PAYOS_CLIENT_ID || '',
    apiKey: payosDb.apiKey ? MASKED_SECRET : process.env.DIGISTAY_PAYOS_API_KEY ? MASKED_SECRET : '',
    checksumKey: payosDb.checksumKey ? MASKED_SECRET : process.env.DIGISTAY_PAYOS_CHECKSUM_KEY ? MASKED_SECRET : '',
    webhookUrl: `${process.env.NEXTAUTH_URL || 'https://digistay.vn'}/api/webhooks/payos/digistay`,
  }

  // 2. Mắt Bão
  const matbaoDb = map.get('matbao') || {}
  const matbao: MatbaoSettings = {
    environment: matbaoDb.environment || (process.env.MATBAO_ENV === 'prod' ? 'prod' : 'demo'),
    taxCode: matbaoDb.taxCode || process.env.MATBAO_TAX_CODE || '',
    username: matbaoDb.username || process.env.MATBAO_USERNAME || '',
    password: matbaoDb.password ? MASKED_SECRET : process.env.MATBAO_PASSWORD ? MASKED_SECRET : '',
    invoiceSeries: matbaoDb.invoiceSeries || process.env.MATBAO_SERIES || '1C26TDS',
    templateCode: matbaoDb.templateCode || process.env.MATBAO_TEMPLATE || '01GTKT0/001',
  }

  // 3. Gemini
  const geminiDb = map.get('gemini') || {}
  const gemini: GeminiSettings = {
    apiKey: geminiDb.apiKey ? MASKED_SECRET : process.env.GEMINI_API_KEY ? MASKED_SECRET : '',
    defaultModel: geminiDb.defaultModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    temperature: geminiDb.temperature ?? 0.7,
  }

  // 4. SMTP
  const smtpDb = map.get('smtp') || {}
  const smtp: SmtpSettings = {
    host: smtpDb.host || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: smtpDb.port || parseInt(process.env.SMTP_PORT || '587', 10),
    username: smtpDb.username || process.env.SMTP_USER || '',
    password: smtpDb.password ? MASKED_SECRET : process.env.SMTP_PASS ? MASKED_SECRET : '',
    fromName: smtpDb.fromName || process.env.SMTP_FROM_NAME || 'Digistay Platform',
    fromEmail: smtpDb.fromEmail || process.env.SMTP_FROM_EMAIL || 'support@digistay.vn',
    secure: smtpDb.secure ?? false,
  }

  // 5. Branding
  const brandingDb = map.get('branding') || {}
  const branding: BrandingSettings = {
    companyName: brandingDb.companyName || 'Digistay Hospitality Platform',
    legalName: brandingDb.legalName || 'Công ty TNHH Giải pháp Khách sạn Digistay',
    hotline: brandingDb.hotline || '1900 8888',
    supportEmail: brandingDb.supportEmail || 'support@digistay.vn',
    address: brandingDb.address || 'Quận 1, TP. Hồ Chí Minh, Việt Nam',
    websiteUrl: brandingDb.websiteUrl || 'https://digistay.vn',
  }

  return { payos, matbao, gemini, smtp, branding }
}

/**
 * Saves or updates a specific configuration group. Preserves existing secret if value is masked.
 */
export async function savePlatformSetting(
  key: string,
  newValues: Record<string, any>,
  adminId: string
): Promise<void> {
  const existingRow = await prisma.platformSetting.findUnique({ where: { key } })
  const existingValues: Record<string, any> = (existingRow?.value as any) || {}

  // If a sensitive field was sent as MASKED_SECRET, keep the old stored value
  const merged: Record<string, any> = { ...existingValues }
  for (const [k, v] of Object.entries(newValues)) {
    if (v === MASKED_SECRET) {
      // keep existing
      continue
    }
    merged[k] = v
  }

  await prisma.platformSetting.upsert({
    where: { key },
    create: {
      key,
      value: merged,
      updatedById: adminId,
    },
    update: {
      value: merged,
      updatedById: adminId,
    },
  })

  // Audit log
  try {
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE_PLATFORM_SETTING',
        entityType: 'PLATFORM_SETTING',
        entityId: key,
        metadata: { updatedKeys: Object.keys(newValues) },
      },
    })
  } catch {
    // Non-fatal
  }
}

/**
 * Resolves effective secret (DB override or process.env).
 */
export async function getEffectiveSetting<T>(key: string): Promise<T | null> {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key } })
    if (row?.value) return row.value as T
  } catch {
    // Fall back
  }
  return null
}

/**
 * Tests connection to Google Gemini API.
 */
export async function testGeminiPing(customApiKey?: string): Promise<{ ok: boolean; message: string }> {
  let key = customApiKey && customApiKey !== MASKED_SECRET ? customApiKey : ''
  if (!key) {
    const db = await getEffectiveSetting<GeminiSettings>('gemini')
    key = db?.apiKey || process.env.GEMINI_API_KEY || ''
  }

  if (!key) {
    return { ok: false, message: 'Chưa có Gemini API Key để kiểm tra' }
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      return { ok: true, message: 'Kết nối Google Gemini AI thành công! API Key hoạt động tốt.' }
    }
    const errJson = await res.json().catch(() => null)
    return { ok: false, message: `Lỗi từ Google Gemini: ${errJson?.error?.message || res.statusText}` }
  } catch (error: any) {
    return { ok: false, message: `Lỗi kết nối tới Gemini: ${error?.message || 'Timeout'}` }
  }
}

/**
 * Tests sending a real test email through SMTP settings.
 */
export async function testSmtpEmail(
  targetEmail: string,
  overrideConfig?: SmtpSettings
): Promise<{ ok: boolean; message: string }> {
  let host = overrideConfig?.host || process.env.SMTP_HOST || 'smtp.gmail.com'
  let port = overrideConfig?.port || parseInt(process.env.SMTP_PORT || '587', 10)
  let user = overrideConfig?.username || process.env.SMTP_USER || ''
  let pass = overrideConfig?.password && overrideConfig.password !== MASKED_SECRET
    ? overrideConfig.password
    : process.env.SMTP_PASS || ''
  let from = overrideConfig?.fromEmail || process.env.SMTP_FROM_EMAIL || 'support@digistay.vn'

  if (!user || !pass) {
    const db = await getEffectiveSetting<SmtpSettings>('smtp')
    if (db) {
      host = db.host || host
      port = db.port || port
      user = db.username || user
      pass = db.password || pass
      from = db.fromEmail || from
    }
  }

  if (!user || !pass) {
    return { ok: false, message: 'Chưa cấu hình tài khoản & mật khẩu SMTP' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    })

    await transporter.verify()

    await transporter.sendMail({
      from: `"Digistay Platform Test" <${from}>`,
      to: targetEmail,
      subject: '✅ [Digistay] Kiểm tra đường truyền gửi thư SMTP thành công',
      text: `Xin chào,\n\nĐây là email kiểm tra được gửi trực tiếp từ Trung tâm Cấu hình Nền tảng Digistay lúc ${new Date().toLocaleString('vi-VN')}.\nHạ tầng email SMTP của bạn đang hoạt động hoàn hảo.\n\nTrân trọng,\nDigistay Platform.`,
    })

    return { ok: true, message: `Đã gửi email thử nghiệm thành công tới ${targetEmail}!` }
  } catch (error: any) {
    return { ok: false, message: `Lỗi kiểm tra SMTP: ${error?.message || 'Không thể kết nối máy chủ mail'}` }
  }
}

