/**
 * The /contact form against real Postgres: a valid request is queued for
 * every recipient (encrypted, like every outbox email), an invalid one or
 * one with nobody to send to stores nothing, and the per-IP limit holds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const store = vi.hoisted(() => {
  const data = new Map<string, string>()
  return {
    data,
    redis: {
      get: async (k: string) => data.get(k) ?? null,
      set: async (k: string, v: string) => (data.set(k, v), 'OK'),
      del: async (k: string) => (data.delete(k) ? 1 : 0),
      incr: async (k: string) => {
        const n = Number(data.get(k) ?? 0) + 1
        data.set(k, String(n))
        return n
      },
      expire: async () => 1,
      ttl: async () => 600,
    },
  }
})
vi.mock('@/lib/db/redis', () => ({ redis: store.redis }))

import { prisma } from '@/lib/db'
import { resetDatabase } from '@/test/integration/fixtures'
import { POST } from '@/app/api/public/contact/route'
import { LIMITS } from '@/lib/security/limits'

const body = { name: 'Nguyễn Thu Hà', email: 'thuha@maybien.vn', phone: '0912 345 678', hotel: 'Mây Biển', topic: 'sales', message: 'Hỏi gói cho 24 phòng.' }
const send = (data: unknown, ip = '203.0.113.7') =>
  POST(new NextRequest('http://x/api/public/contact', { method: 'POST', body: JSON.stringify(data), headers: { 'x-real-ip': ip } }))

describe('POST /api/public/contact', () => {
  const env = { ...process.env }
  beforeEach(async () => {
    await resetDatabase()
    store.data.clear()
    process.env.CONTACT_EMAILS = 'sales@digistay.test, team@digistay.test'
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it('queues the request for each recipient, encrypted', async () => {
    const res = await send(body)
    expect(res.status).toBe(200)
    const rows = await prisma.emailOutbox.findMany({ orderBy: { toEmail: 'asc' } })
    expect(rows.map((r) => [r.kind, r.toEmail])).toEqual([
      ['contact_request', 'sales@digistay.test'],
      ['contact_request', 'team@digistay.test'],
    ])
    expect(rows[0].message).not.toContain('thuha@maybien.vn')
  })

  it('stores nothing for an invalid request', async () => {
    const res = await send({ ...body, email: 'not-an-email' })
    expect(res.status).toBe(400)
    expect(await prisma.emailOutbox.count()).toBe(0)
  })

  it('says it could not send when nobody is configured', async () => {
    delete process.env.CONTACT_EMAILS
    delete process.env.ALERT_EMAILS
    const res = await send(body)
    expect(res.status).toBe(503)
    expect(await prisma.emailOutbox.count()).toBe(0)
  })

  it('limits requests per IP', async () => {
    for (let i = 0; i < LIMITS.contactIp.limit; i++) expect((await send(body)).status).toBe(200)
    expect((await send(body)).status).toBe(429)
    expect((await send(body, '198.51.100.9')).status).toBe(200)
  })
})
