import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloudinaryConfig, signParams, uploadImage, UploadError } from './index'

const ENV = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_API_BASE_URL'] as const
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))

function setEnv(values: Partial<Record<(typeof ENV)[number], string>>) {
  for (const k of ENV) {
    if (values[k] === undefined) delete process.env[k]
    else process.env[k] = values[k]
  }
}

afterEach(() => {
  setEnv(saved as Record<string, string>)
  vi.unstubAllGlobals()
})

describe('signParams', () => {
  it("matches Cloudinary's documented example", () => {
    // docs: "Generating authentication signatures"
    expect(
      signParams({ timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }, 'abcd')
    ).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e')
  })
})

describe('cloudinaryConfig', () => {
  it('is off without the three variables, or with the template placeholders', () => {
    setEnv({})
    expect(cloudinaryConfig()).toBeNull()
    setEnv({ CLOUDINARY_CLOUD_NAME: 'PASTE_CLOUDINARY_CLOUD_NAME', CLOUDINARY_API_KEY: 'CHANGE_ME', CLOUDINARY_API_SECRET: 'CHANGE_ME' })
    expect(cloudinaryConfig()).toBeNull()
    setEnv({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'CHANGE_ME' })
    expect(cloudinaryConfig()).toBeNull()
    setEnv({ CLOUDINARY_CLOUD_NAME: 'de mo/x', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 's' })
    expect(cloudinaryConfig()).toBeNull()
  })

  it('reads the account', () => {
    setEnv({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 's3cret' })
    expect(cloudinaryConfig()).toEqual({ cloud: 'demo', key: '123', secret: 's3cret', base: 'https://api.cloudinary.com' })
  })
})

describe('uploadImage', () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('answers 503 when no storage is set up, never the file back', async () => {
    setEnv({})
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(uploadImage('data:image/png;base64,AAAA', 'digistay/w')).rejects.toMatchObject({ status: 503 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('signs folder + timestamp and returns where the account serves the file', async () => {
    setEnv({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 's3cret' })
    let sent: FormData | undefined
    let url = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string, init: RequestInit) => {
        url = u
        sent = init.body as FormData
        return ok({
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/digistay/w/p/abc.jpg',
          public_id: 'digistay/w/p/abc',
          width: 1600,
          height: 1200,
          format: 'jpg',
          bytes: 1234,
        })
      })
    )
    const result = await uploadImage('data:image/jpeg;base64,/9j/', 'digistay/w/p')
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload')
    expect(sent?.get('folder')).toBe('digistay/w/p')
    expect(sent?.get('api_key')).toBe('123')
    expect(sent?.get('file')).toBe('data:image/jpeg;base64,/9j/')
    const timestamp = Number(sent?.get('timestamp'))
    expect(sent?.get('signature')).toBe(signParams({ folder: 'digistay/w/p', timestamp }, 's3cret'))
    expect(result).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/digistay/w/p/abc.jpg',
      publicId: 'digistay/w/p/abc',
      width: 1600,
      height: 1200,
      format: 'jpg',
      bytes: 1234,
    })
  })

  it('refuses an answer from another account, and a refusal', async () => {
    setEnv({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 's3cret' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => ok({ secure_url: 'https://res.cloudinary.com/other/image/upload/v1/x.jpg' })))
    await expect(uploadImage('data:image/jpeg;base64,/9j/', 'digistay/w')).rejects.toBeInstanceOf(UploadError)
    vi.stubGlobal('fetch', vi.fn(async () => ok({ error: { message: 'Invalid Signature' } }, 401)))
    await expect(uploadImage('data:image/jpeg;base64,/9j/', 'digistay/w')).rejects.toMatchObject({ status: 502 })
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))))
    await expect(uploadImage('data:image/jpeg;base64,/9j/', 'digistay/w')).rejects.toMatchObject({ status: 502 })
  })
})
