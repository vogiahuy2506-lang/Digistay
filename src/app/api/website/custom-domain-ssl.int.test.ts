/**
 * A verified custom domain, served and given HTTPS (plan items 18–19),
 * against real Postgres with DNS faked: verification queues its certificate,
 * docker/certbot/custom-domains.sh sees it through /api/internal/custom-domains
 * and reports back, a failure waits an hour (or "Thử lại"), and the
 * middleware's lookup (/api/public/site-host) only knows verified domains.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ownershipRecord, resolver } from '@/lib/custom-domain'
import { POST as verify } from './domain/verify/route'
import { PUT as putSettings } from './settings/route'
import { POST as requestSsl, GET as sslStatus } from './ssl/provision/route'
import { GET as pending, POST as report } from '../internal/custom-domains/route'
import { GET as siteHost } from '../public/site-host/route'
import { RETRY_AFTER_MS } from '@/lib/public-site/custom-domains'
import { createTenant, resetDatabase } from '@/test/integration/fixtures'

const ROOT = 'digistay.vn'
const OUR_IP = '203.0.113.10'
const HOST = 'www.khachsan.vn'
const SECRET = 'cron-secret-for-tests'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string }) => mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })

function req(url: string, init: { method?: string; body?: unknown; form?: string; secret?: string } = {}) {
  const headers: Record<string, string> = {}
  if (init.secret) headers['x-cron-secret'] = init.secret
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  })
}

/** DNS where HOST points at us (A record) and carries the workspace's TXT. */
function goodDns(workspaceId: string) {
  const txt = ownershipRecord(workspaceId, HOST)
  vi.spyOn(resolver, 'resolveCname').mockRejectedValue(Object.assign(new Error('ENODATA'), { code: 'ENODATA' }))
  vi.spyOn(resolver, 'resolve4').mockImplementation(async (host: string) => (host === ROOT || host === HOST ? [OUR_IP] : []))
  vi.spyOn(resolver, 'resolveTxt').mockImplementation(async (name: string) => (name === txt.name ? [[txt.value]] : []))
}

const queue = async () => (await (await pending(req('/api/internal/custom-domains', { secret: SECRET }))).text()).split('\n').filter(Boolean)
const outcome = (ok: boolean) => report(req('/api/internal/custom-domains', { method: 'POST', secret: SECRET, form: `domain=${HOST}&ok=${ok ? 1 : 0}` }))
const ssl = (propertyId: string) =>
  prisma.websiteSettings.findUniqueOrThrow({
    where: { propertyId },
    select: { sslEnabled: true, sslProvider: true, sslRequestedAt: true, sslCheckedAt: true, sslError: true },
  })

beforeEach(async () => {
  process.env.ROOT_DOMAIN = ROOT
  process.env.NEXTAUTH_SECRET = 'test-secret-for-custom-domains'
  process.env.CRON_SECRET = SECRET
  await resetDatabase()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => prisma.$disconnect())

describe('custom domain: serving and HTTPS', () => {
  it('verification queues the certificate; the script issues it; the middleware lookup finds the site', async () => {
    const { owner, workspace, property } = await createTenant()
    signInAs(owner)
    goodDns(workspace.id)

    // Not verified yet: unknown to the lookup.
    expect((await siteHost(req(`/api/public/site-host?host=${HOST}`))).status).toBe(404)

    expect((await verify(req('/api/website/domain/verify', { method: 'POST', body: { propertyId: property.id, domain: HOST } }))).status).toBe(200)
    expect((await ssl(property.id)).sslRequestedAt).not.toBeNull()
    expect(await queue()).toEqual([HOST])

    const lookup = await siteHost(req(`/api/public/site-host?host=${HOST.toUpperCase()}`))
    expect(lookup.status).toBe(200)
    expect((await lookup.json()).data.subdomain).toBe(property.subdomain)

    expect((await outcome(true)).status).toBe(200)
    expect(await ssl(property.id)).toMatchObject({ sslEnabled: true, sslProvider: 'letsencrypt', sslError: null })
    expect(await queue()).toEqual([])
    expect((await (await sslStatus(req(`/api/website/ssl/provision?propertyId=${property.id}`))).json()).data.state).toBe('active')
  })

  it('a failed issuance waits an hour, or until "Thử lại"', async () => {
    const { owner, workspace, property } = await createTenant()
    signInAs(owner)
    goodDns(workspace.id)
    await verify(req('/api/website/domain/verify', { method: 'POST', body: { propertyId: property.id, domain: HOST } }))

    await outcome(false)
    expect(await ssl(property.id)).toMatchObject({ sslEnabled: false, sslError: 'issue_failed' })
    expect(await queue()).toEqual([])
    expect((await (await sslStatus(req(`/api/website/ssl/provision?propertyId=${property.id}`))).json()).data.state).toBe('failed')

    // An hour later it is tried again by itself.
    await prisma.websiteSettings.update({ where: { propertyId: property.id }, data: { sslCheckedAt: new Date(Date.now() - RETRY_AFTER_MS - 1000) } })
    expect(await queue()).toEqual([HOST])

    // Or at once with "Thử lại".
    await outcome(false)
    expect(await queue()).toEqual([])
    expect((await requestSsl(req('/api/website/ssl/provision', { method: 'POST', body: { propertyId: property.id } }))).status).toBe(200)
    expect(await queue()).toEqual([HOST])
  })

  it('the internal routes need the cron secret; removing the domain stops serving it', async () => {
    const { owner, workspace, property } = await createTenant()
    signInAs(owner)
    goodDns(workspace.id)
    await verify(req('/api/website/domain/verify', { method: 'POST', body: { propertyId: property.id, domain: HOST } }))

    expect((await pending(req('/api/internal/custom-domains'))).status).toBe(401)
    expect((await pending(req('/api/internal/custom-domains', { secret: 'wrong' }))).status).toBe(401)
    expect((await report(req('/api/internal/custom-domains', { method: 'POST', form: `domain=${HOST}&ok=1` }))).status).toBe(401)
    expect((await ssl(property.id)).sslEnabled).toBe(false)

    const removed = await putSettings(req('/api/website/settings', { method: 'PUT', body: { propertyId: property.id, settings: { customDomain: '' } } }))
    expect(removed.status).toBe(200)
    expect((await siteHost(req(`/api/public/site-host?host=${HOST}`))).status).toBe(404)
    expect(await queue()).toEqual([])
    expect(await ssl(property.id)).toMatchObject({ sslRequestedAt: null, sslError: null })
  })

  it('a receptionist cannot ask for a certificate', async () => {
    const { workspace, property, member } = await createTenant({ memberRole: 'RECEPTIONIST' })
    goodDns(workspace.id)
    signInAs(member!)
    expect((await requestSsl(req('/api/website/ssl/provision', { method: 'POST', body: { propertyId: property.id } }))).status).toBe(403)
  })
})
