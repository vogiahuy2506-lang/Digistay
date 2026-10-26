import { describe, expect, it } from 'vitest'
import { googleSignInConfigured } from './google'

describe('googleSignInConfigured', () => {
  it('needs both the client id and the secret', () => {
    expect(googleSignInConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).toBe(true)
    expect(googleSignInConfigured({ GOOGLE_CLIENT_ID: 'id' })).toBe(false)
    expect(googleSignInConfigured({ GOOGLE_CLIENT_SECRET: 'secret' })).toBe(false)
  })

  it('treats the template placeholders as missing', () => {
    expect(googleSignInConfigured({ GOOGLE_CLIENT_ID: 'PASTE_GOOGLE_CLIENT_ID', GOOGLE_CLIENT_SECRET: 'PASTE_GOOGLE_CLIENT_SECRET' })).toBe(false)
  })

  it('treats blank values as missing', () => {
    expect(googleSignInConfigured({ GOOGLE_CLIENT_ID: ' ', GOOGLE_CLIENT_SECRET: 'secret' })).toBe(false)
  })
})
