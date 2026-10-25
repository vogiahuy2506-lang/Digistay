import { describe, expect, it } from 'vitest'
import { isOwnUpload, isStoredImageUrl, resizedImage, responsiveImage } from './image-url'
import { MAX_UPLOAD_BYTES, parseImageDataUrl } from './upload-input'

const OWN = 'https://res.cloudinary.com/demo/image/upload/v1712345678/digistay/ws1/p1/abc.jpg'

describe('resizedImage / responsiveImage', () => {
  it('asks Cloudinary for the width shown, in the best format, for our own uploads', () => {
    expect(isOwnUpload(OWN)).toBe(true)
    expect(resizedImage(OWN, 480)).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_480/v1712345678/digistay/ws1/p1/abc.jpg')
    // Rounded up to the next width of the list (few sizes per photo at Cloudinary).
    expect(resizedImage(OWN, 500)).toContain(',w_800/')
    expect(resizedImage(OWN, 5000)).toContain(',w_2000/')
    // Without a version segment too.
    expect(resizedImage('https://res.cloudinary.com/demo/image/upload/digistay/x.png', 800)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/digistay/x.png'
    )
  })

  it('leaves other photos as they are', () => {
    for (const url of [
      'https://images.example.com/a.jpg',
      // Someone else's folder on Cloudinary, or a URL that already has a transformation.
      'https://res.cloudinary.com/demo/image/upload/v1/other/a.jpg',
      'https://res.cloudinary.com/demo/image/upload/w_100/v1/digistay/a.jpg',
      'http://res.cloudinary.com/demo/image/upload/v1/digistay/a.jpg',
    ]) {
      expect(resizedImage(url, 480)).toBe(url)
      expect(responsiveImage(url, '100vw')).toEqual({ src: url })
    }
    expect(resizedImage(null, 480)).toBeNull()
  })

  it('gives a srcset up to the largest width needed', () => {
    const img = responsiveImage(OWN, '300px', { fallback: 800, max: 1200 })
    expect(img.sizes).toBe('300px')
    expect(img.src).toContain(',w_800/')
    expect(img.srcSet?.split(', ').map((s) => s.split(' ')[1])).toEqual(['480w', '800w', '1200w'])
  })
})

describe('isStoredImageUrl', () => {
  it('takes https photos only', () => {
    expect(isStoredImageUrl('https://images.example.com/a.jpg')).toBe(true)
    for (const bad of ['data:image/png;base64,AAAA', 'javascript:alert(1)', 'http://x.example/a.jpg', '/uploads/a.jpg', 'https://u:p@x.example/a.jpg', '']) {
      expect(isStoredImageUrl(bad)).toBe(false)
    }
    expect(isStoredImageUrl(`https://x.example/${'a'.repeat(2100)}`)).toBe(false)
  })
})

describe('parseImageDataUrl', () => {
  const b64 = (bytes: number[], pad = 30) => Buffer.from([...bytes, ...Array(pad).fill(0)]).toString('base64')
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const JPEG = [0xff, 0xd8, 0xff, 0xe0]
  const ascii = (s: string) => [...Buffer.from(s, 'latin1')]

  it('takes photos whose bytes are what their type says', () => {
    expect(parseImageDataUrl(`data:image/png;base64,${b64(PNG)}`)).toMatchObject({ ok: true, type: 'image/png' })
    expect(parseImageDataUrl(`data:image/jpeg;base64,${b64(JPEG)}`)).toMatchObject({ ok: true, type: 'image/jpeg' })
    expect(parseImageDataUrl(`data:image/gif;base64,${b64(ascii('GIF89a'))}`)).toMatchObject({ ok: true })
    expect(parseImageDataUrl(`data:image/webp;base64,${b64([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')])}`)).toMatchObject({ ok: true })
    expect(parseImageDataUrl(`data:image/avif;base64,${b64([0, 0, 0, 0x20, ...ascii('ftypavif')])}`)).toMatchObject({ ok: true })
  })

  it('refuses the rest', () => {
    expect(parseImageDataUrl(undefined)).toEqual({ ok: false, error: 'Vui lòng cung cấp hình ảnh' })
    // A page renamed to .png, an SVG (script), a type that lies, not base64.
    expect(parseImageDataUrl(`data:image/png;base64,${Buffer.from('<html><script>x</script>').toString('base64')}`)).toMatchObject({ ok: false })
    expect(parseImageDataUrl(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)).toEqual({
      ok: false,
      error: 'Chỉ chấp nhận ảnh JPG, PNG, WebP, GIF hoặc AVIF',
    })
    expect(parseImageDataUrl(`data:image/png;base64,${b64(JPEG)}`)).toMatchObject({ ok: false })
    expect(parseImageDataUrl('data:image/png,rawbytes')).toMatchObject({ ok: false })
    expect(parseImageDataUrl(b64(PNG))).toMatchObject({ ok: false })
  })

  it('refuses more than 10 MB', () => {
    const big = `data:image/png;base64,${b64(PNG, MAX_UPLOAD_BYTES)}`
    expect(parseImageDataUrl(big)).toEqual({ ok: false, error: 'Kích thước file không được vượt quá 10MB' })
  })
})
