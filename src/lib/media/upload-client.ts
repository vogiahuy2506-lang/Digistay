/**
 * Browser side of photo uploads: shrink the photo, then POST /api/upload.
 *
 * Phone photos are often 4000+ px and 5–10 MB; the site never shows more
 * than 2000 px (src/lib/media/image-url.ts), so they are redrawn at most
 * `maxSide` px (JPEG, or WebP/PNG when the photo has transparency) before
 * leaving the browser: faster uploads, less of the shared storage used.
 * GIFs are sent as they are (redrawing would stop the animation).
 */
import { apiError } from '@/lib/i18n/api-errors'

/** What went wrong, for the caller to say in its own words (`server` carries the API's message). */
export type UploadProblem = 'notImage' | 'tooLarge' | 'unreadable' | 'failed' | 'server'

export class UploadClientError extends Error {
  constructor(
    readonly problem: UploadProblem,
    message: string = problem,
    /** the API's status, for `server` (503: no storage set up) */
    readonly status = 0
  ) {
    super(message)
    this.name = 'UploadClientError'
  }
}

const MAX_BYTES = 10 * 1024 * 1024
const SENT_AS_IS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/** The photo as a data: URL, at most `maxSide` px on its longer side. */
export async function prepareImage(file: File, maxSide = 2400): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new UploadClientError('notImage')
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new UploadClientError('tooLarge')
    return readAsDataUrl(file)
  }

  let bitmap: ImageBitmap
  try {
    // from-image: phone photos are stored sideways with an EXIF turn.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // A format this browser can't draw (HEIC outside Safari): send it only if the server takes it.
    if (SENT_AS_IS.includes(file.type) && file.size <= MAX_BYTES) return readAsDataUrl(file)
    throw new UploadClientError('unreadable')
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const small = scale === 1 && file.size <= 1.5 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  if (small) {
    bitmap.close()
    return readAsDataUrl(file)
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Transparency (a PNG logo) needs WebP or PNG; photos are smallest as JPEG.
  const transparent = file.type === 'image/png' || file.type === 'image/webp'
  // Browsers that can't encode WebP hand back a PNG, which the server takes too.
  const blob = transparent ? await toBlob(canvas, 'image/webp', 0.9) : await toBlob(canvas, 'image/jpeg', 0.86)
  if (!blob) throw new UploadClientError('unreadable')
  if (blob.size > MAX_BYTES) throw new UploadClientError('tooLarge')
  return readAsDataUrl(blob)
}

/** Where the photo is used: a property's (photos, rooms, menu, cover), a workspace's (logo), or the user's own (a new workspace's logo). */
export type UploadTarget = { propertyId: string } | { workspaceId: string } | Record<string, never>

/** Shrink and store one photo; its URL. Throws UploadClientError. */
export async function uploadPhoto(file: File, target: UploadTarget, maxSide = 2400): Promise<string> {
  const base64 = await prepareImage(file, maxSide)
  let res: Response
  try {
    res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, ...target }),
    })
  } catch {
    throw new UploadClientError('failed')
  }
  const data = await res.json().catch(() => null)
  if (res.ok && data?.success && typeof data.data?.url === 'string') return data.data.url
  const message = typeof data?.error === 'string' ? apiError(data.error) : ''
  throw message ? new UploadClientError('server', message, res.status) : new UploadClientError('failed')
}
