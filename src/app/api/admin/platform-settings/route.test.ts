import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/admin/guard', () => ({
  requirePlatformAdmin: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    platformSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/admin/platform-settings', () => ({
  getAllPlatformSettings: vi.fn(),
  savePlatformSetting: vi.fn(),
  testGeminiPing: vi.fn(),
  testSmtpEmail: vi.fn(),
}))

import { requirePlatformAdmin } from '@/lib/admin/guard'
import {
  getAllPlatformSettings,
  savePlatformSetting,
  testGeminiPing,
  testSmtpEmail,
} from '@/lib/admin/platform-settings'
import { GET, PUT, POST } from './route'

describe('Admin Platform Settings API (/api/admin/platform-settings)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      ok: true,
      admin: { id: 'admin-1', email: 'admin@digistay.vn', role: 'SUPER_ADMIN' } as any,
    })
  })

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('GET returns masked platform settings', async () => {
    vi.mocked(getAllPlatformSettings).mockResolvedValueOnce({
      payos: { clientId: 'client-1', apiKey: '••••••••', checksumKey: '••••••••', webhookUrl: 'https://digistay.vn/hook' },
      matbao: { environment: 'demo', taxCode: '0312345678', username: 'mb_user', invoiceSeries: '1C26TDS', templateCode: '01GTKT0/001' },
      gemini: { apiKey: '••••••••', defaultModel: 'gemini-2.5-flash', temperature: 0.7 },
      smtp: { host: 'smtp.gmail.com', port: 587, username: 'user', fromName: 'Digistay', fromEmail: 'support@digistay.vn', secure: false },
      branding: { companyName: 'Digistay', legalName: 'Digistay LLC', hotline: '1900', supportEmail: 'hi@digistay.vn', address: 'HCM', websiteUrl: 'https://digistay.vn' },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.payos.clientId).toBe('client-1')
  })

  it('PUT saves setting section and returns success', async () => {
    const req = new NextRequest('http://localhost/api/admin/platform-settings', {
      method: 'PUT',
      body: JSON.stringify({
        key: 'payos',
        value: { clientId: 'new-client-id', apiKey: '••••••••' },
      }),
    })

    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(savePlatformSetting).toHaveBeenCalledWith('payos', { clientId: 'new-client-id', apiKey: '••••••••' }, 'admin-1')
  })

  it('POST test_gemini action runs testGeminiPing', async () => {
    vi.mocked(testGeminiPing).mockResolvedValueOnce({ ok: true, message: 'Gemini OK' })

    const req = new NextRequest('http://localhost/api/admin/platform-settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'test_gemini' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toBe('Gemini OK')
  })

  it('POST test_smtp action runs testSmtpEmail', async () => {
    vi.mocked(testSmtpEmail).mockResolvedValueOnce({ ok: true, message: 'Email sent' })

    const req = new NextRequest('http://localhost/api/admin/platform-settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'test_smtp', targetEmail: 'test@example.com' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(testSmtpEmail).toHaveBeenCalledWith('test@example.com', undefined)
  })
})

