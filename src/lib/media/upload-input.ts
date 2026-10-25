/**
 * What an upload must be before it goes to Cloudinary (src/lib/cloudinary):
 * a base64 data: URL of a JPEG, PNG, WebP, GIF or AVIF photo, at most 10 MB,
 * whose bytes are what its type says. No SVG: it is a document that can
 * carry script, and hotels' photos never need it.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const
export type UploadType = (typeof UPLOAD_TYPES)[number]

export type ParsedImage = { ok: true; type: UploadType; bytes: number; dataUrl: string } | { ok: false; error: string }

const DATA_URL = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/]+={0,2})$/

/** The file's first bytes, per type (a renamed .html is not a photo). */
function looksLike(type: UploadType, head: Buffer): boolean {
  const ascii = (from: number, to: number) => head.subarray(from, to).toString('latin1')
  switch (type) {
    case 'image/jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    case 'image/png':
      return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case 'image/gif':
      return ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a'
    case 'image/webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    case 'image/avif':
      return ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))
  }
}

export function parseImageDataUrl(value: unknown): ParsedImage {
  if (typeof value !== 'string' || value === '') return { ok: false, error: 'Vui lòng cung cấp hình ảnh' }
  // A 10 MB file is ~13.4 MB of base64; refuse more before matching it.
  if (value.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 64) {
    return { ok: false, error: 'Kích thước file không được vượt quá 10MB' }
  }
  const match = DATA_URL.exec(value)
  if (!match) return { ok: false, error: 'Định dạng hình ảnh không hợp lệ' }
  const type = match[1] as UploadType
  if (!UPLOAD_TYPES.includes(type)) return { ok: false, error: 'Chỉ chấp nhận ảnh JPG, PNG, WebP, GIF hoặc AVIF' }
  const base64 = match[2]
  const bytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
  if (bytes > MAX_UPLOAD_BYTES) return { ok: false, error: 'Kích thước file không được vượt quá 10MB' }
  if (!looksLike(type, Buffer.from(base64.slice(0, 24), 'base64'))) {
    return { ok: false, error: 'Định dạng hình ảnh không hợp lệ' }
  }
  return { ok: true, type, bytes, dataUrl: value }
}
