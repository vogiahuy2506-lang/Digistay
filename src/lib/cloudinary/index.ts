/**
 * Image storage: Cloudinary, in the folder `digistay/` of the account Digistay
 * shares with UKNOW (docs/RUNBOOK.md, "Lưu ảnh (Cloudinary)").
 *
 * - Uploads are signed here with the API secret, so the browser never holds
 *   a key; POST /api/upload decides the folder (the workspace and property
 *   the file belongs to) and checks the file first (src/lib/media/upload-input.ts).
 * - Pages ask Cloudinary for the size they show (src/lib/media/image-url.ts),
 *   so the original stays as uploaded (the dashboard shrinks it to 2400 px
 *   before sending, src/lib/media/upload-client.ts).
 * - Without the three CLOUDINARY_* variables (or with the template's
 *   placeholders) nothing is stored: uploads answer 503. Never a data: URL
 *   instead: it would put whole photos into the database, the cached site and
 *   the session cookie (a user's avatar).
 * - Nothing is deleted from Cloudinary when a photo is removed in Digistay:
 *   the same URL may still be a website's cover or a dish's photo.
 */
import { createHash } from 'crypto'

export interface UploadResult {
  url: string
  publicId: string
  width: number
  height: number
  format: string
  bytes: number
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message)
    this.name = 'UploadError'
  }
}

interface CloudinaryConfig {
  cloud: string
  key: string
  secret: string
  base: string
}

/** .env.production.template's values, which mean "not set". */
const PLACEHOLDER = /^(CHANGE_ME|PASTE_.*)$/

export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? ''
  const key = process.env.CLOUDINARY_API_KEY?.trim() ?? ''
  const secret = process.env.CLOUDINARY_API_SECRET?.trim() ?? ''
  if (!cloud || !key || !secret || [cloud, key, secret].some((v) => PLACEHOLDER.test(v))) return null
  // The cloud name goes into URLs; Cloudinary's are letters, digits, - and _.
  if (!/^[a-z0-9_-]+$/i.test(cloud)) return null
  // CLOUDINARY_API_BASE_URL: tests point it at a fake Cloudinary.
  const base = (process.env.CLOUDINARY_API_BASE_URL || 'https://api.cloudinary.com').replace(/\/+$/, '')
  return { cloud, key, secret, base }
}

export const isImageStorageConfigured = () => cloudinaryConfig() !== null

/**
 * Cloudinary's request signature: every signed parameter sorted by name,
 * `name=value` joined with `&`, the API secret appended, SHA-1 in hex.
 * `file`, `api_key`, `resource_type` and `cloud_name` are never signed.
 */
export function signParams(params: Record<string, string | number>, secret: string): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('sha1').update(toSign + secret).digest('hex')
}

/**
 * Store one image (a data: URL already checked by upload-input.ts) under
 * `folder`. Returns where Cloudinary serves it.
 */
export async function uploadImage(dataUrl: string, folder: string): Promise<UploadResult> {
  const config = cloudinaryConfig()
  if (!config) throw new UploadError('Chưa cấu hình nơi lưu ảnh', 503)

  const timestamp = Math.floor(Date.now() / 1000)
  const form = new FormData()
  form.set('file', dataUrl)
  form.set('folder', folder)
  form.set('timestamp', String(timestamp))
  form.set('api_key', config.key)
  form.set('signature', signParams({ folder, timestamp }, config.secret))

  const res = await fetch(`${config.base}/v1_1/${config.cloud}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60_000),
  }).catch((error) => {
    console.error('[upload] Cloudinary unreachable:', error instanceof Error ? error.message : error)
    return null
  })
  const data = await res?.json().catch(() => null)
  if (!res?.ok || typeof data?.secure_url !== 'string') {
    // Cloudinary's own reason (bad signature, quota, unreadable file) goes to the log, not the user.
    if (res) console.error('[upload] Cloudinary refused:', res.status, data?.error?.message ?? '')
    throw new UploadError('Không tải được ảnh lên, vui lòng thử lại', 502)
  }
  // Only ever hand out where our own account serves the file.
  if (!data.secure_url.startsWith(`https://res.cloudinary.com/${config.cloud}/image/upload/`)) {
    console.error('[upload] Cloudinary answered an unexpected URL')
    throw new UploadError('Không tải được ảnh lên, vui lòng thử lại', 502)
  }
  return {
    url: data.secure_url,
    publicId: String(data.public_id ?? ''),
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
    format: String(data.format ?? ''),
    bytes: Number(data.bytes) || 0,
  }
}
