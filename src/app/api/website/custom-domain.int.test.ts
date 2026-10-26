/**
 * Custom domains against real Postgres, with DNS faked (audit 2026-10-20).
 * A domain is attached only when it points at this exact property AND the
 * TXT proves this workspace controls it; a failed or flaky check changes
 * nothing; a domain another site holds stays with that site.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ownershipRecord, resolver } from '@/lib/custom-domain'
import { POST as verify } from './domain/verify/route'
import { PUT as putSettings } from './settings/route'
import { GET as sslStatus } from './ssl/provision/route'
import { createTenant, resetDatabase } from '@/test/integration/fixtures'

const ROOT = 'digistay.vn'
const OUR_IP = '203.0.113.10'
const HOST = 'www.khachsan.vn'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
function signInAs(user: { id: string; email: string }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
}

function req(url: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
}

const dnsError = (code: string) => Object.assign(new Error(code), { code })

/** Fake DNS: CNAME and A records by host, TXT by full record name; `down` hosts time out. */
function dns(zone: { cname?: Record<string, string>; a?: Record<string, string[]>; txt?: Record<string, string[]>; down?: string[] }) {
  const a: Record<string, string[]> = { [ROOT]: [OUR_IP], ...zone.a }
  const down = new Set(zone.down ?? [])
  vi.spyOn(resolver, 'resolveCname').mockImplementation(async (host: string) => {
    if (down.has(host)) throw dnsError('ETIMEOUT')
    if (zone.cname?.[host]) return [zone.cname[host]]
    throw dnsError(a[host] ? 'ENODATA' : 'ENOTFOUND')
  })
  vi.spyOn(resolver, 'resolve4').mockImplementation(async (host: string) => {
    if (down.has(host)) throw dnsError('ETIMEOUT')
    if (a[host]) return a[host]
    throw dnsError('ENOTFOUND')
  })
  vi.spyOn(resolver, 'resolveTxt').mockImplementation(async (name: string) => {
    if (zone.txt?.[name]) return zone.txt[name].map((value) => [value])
    throw dnsError('ENODATA')
  })
}

const txtFor = (workspaceId: string, host = HOST) => {
  const { name, value } = ownershipRecord(workspaceId, host)
  return { [name]: [value] }
}

const settingsOf = (propertyId: string) =>
  prisma.websiteSettings.findUnique({
    where: { propertyId },
    select: { customDomain: true, domainVerificationStatus: true },
  })

function verifyAs(propertyId: string, domain = HOST) {
  return verify(req('/api/website/domain/verify', 'POST', { propertyId, domain }))
}

beforeEach(async () => {
  process.env.ROOT_DOMAIN = ROOT
  process.env.NEXTAUTH_SECRET = 'test-secret-for-custom-domains'
  await resetDatabase()
})
afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.CUSTOM_DOMAIN_CNAME_TARGET
})
afterAll(() => prisma.$disconnect())

describe('POST /api/website/domain/verify', () => {
  it("a CNAME to another hotel's subdomain is not enough", async () => {
    const a = await createTenant()
    const b = await createTenant()
    dns({ cname: { [HOST]: `${b.property.subdomain}.${ROOT}` }, txt: txtFor(a.workspace.id) })
    signInAs(a.owner)

    const res = await verifyAs(a.property.id)

    expect(res.status).toBe(422)
    expect((await res.json()).data.status).toBe('wrong_target')
    expect(await settingsOf(a.property.id)).toBeNull()
  })

  it('an A record pointing here, without the TXT, is not enough', async () => {
    const a = await createTenant()
    dns({ a: { 'khachsan.vn': [OUR_IP] } })
    signInAs(a.owner)

    const res = await verifyAs(a.property.id, 'khachsan.vn')

    expect(res.status).toBe(422)
    expect((await res.json()).data.status).toBe('txt_missing')
    expect(await settingsOf(a.property.id)).toBeNull()
  })

  it("another workspace's TXT does not prove this one owns the domain", async () => {
    const a = await createTenant()
    const b = await createTenant()
    dns({ cname: { [HOST]: `${a.property.subdomain}.${ROOT}` }, txt: txtFor(b.workspace.id) })
    signInAs(a.owner)

    const res = await verifyAs(a.property.id)

    expect(res.status).toBe(422)
    expect((await res.json()).data.status).toBe('txt_wrong')
    expect(await settingsOf(a.property.id)).toBeNull()
  })

  it('attaches the domain once it points at this property and the TXT matches', async () => {
    const a = await createTenant()
    dns({ cname: { [HOST]: `${a.property.subdomain}.${ROOT}` }, txt: txtFor(a.workspace.id) })
    signInAs(a.owner)

    const res = await verifyAs(a.property.id, 'WWW.KhachSan.VN.')

    expect(res.status).toBe(200)
    expect(await settingsOf(a.property.id)).toEqual({ customDomain: HOST, domainVerificationStatus: 'verified' })
  })

  it("offers the CNAME (www) only once the site's own subdomain resolves; A records for the root domain", async () => {
    const a = await createTenant()
    signInAs(a.owner)

    dns({})
    const before = (await (await verifyAs(a.property.id)).json()).data.records
    expect(before.cnameReady).toBe(false)
    expect(before.a).toEqual([{ type: 'A', name: HOST, value: OUR_IP }])

    dns({ a: { [`${a.property.subdomain}.${ROOT}`]: [OUR_IP] } })
    const after = (await (await verifyAs(a.property.id)).json()).data.records
    expect(after.cnameReady).toBe(true)
    expect(after.cname).toEqual({ type: 'CNAME', name: HOST, value: `${a.property.subdomain}.${ROOT}` })
    expect(await settingsOf(a.property.id)).toBeNull()
  })

  it("never offers a CNAME to a subdomain behind Cloudflare's proxy (it would not reach this server)", async () => {
    const a = await createTenant()
    signInAs(a.owner)

    dns({ a: { [`${a.property.subdomain}.${ROOT}`]: ['104.16.1.1'] } })
    const records = (await (await verifyAs(a.property.id)).json()).data.records
    expect(records.cnameReady).toBe(false)
    expect(records.a).toEqual([{ type: 'A', name: HOST, value: OUR_IP }])
  })

  it('with CUSTOM_DOMAIN_CNAME_TARGET, every site points at that DNS-only name, not at its proxied subdomain', async () => {
    process.env.CUSTOM_DOMAIN_CNAME_TARGET = 'domains.digistay.vn'
    const a = await createTenant()
    signInAs(a.owner)
    // The subdomain is proxied (Cloudflare's address); the apex too, to show A records follow the target.
    const zone = {
      a: { 'domains.digistay.vn': [OUR_IP], [`${a.property.subdomain}.${ROOT}`]: ['104.16.1.1'], [ROOT]: ['104.16.1.2'] },
      txt: txtFor(a.workspace.id),
    }

    dns({ ...zone, cname: { [HOST]: `${a.property.subdomain}.${ROOT}` } })
    const old = await verifyAs(a.property.id)
    expect(old.status).toBe(422)
    const { data } = await old.json()
    expect(data.status).toBe('wrong_target')
    expect(data.records.cnameReady).toBe(true)
    expect(data.records.cname).toEqual({ type: 'CNAME', name: HOST, value: 'domains.digistay.vn' })
    expect(data.records.a).toEqual([{ type: 'A', name: HOST, value: OUR_IP }])
    expect(await settingsOf(a.property.id)).toBeNull()

    dns({ ...zone, cname: { [HOST]: 'domains.digistay.vn.' } })
    expect((await verifyAs(a.property.id)).status).toBe(200)
    expect(await settingsOf(a.property.id)).toEqual({ customDomain: HOST, domainVerificationStatus: 'verified' })

    // A root domain: A records with the target's address.
    dns({ ...zone, a: { ...zone.a, 'khachsan.vn': [OUR_IP] }, txt: txtFor(a.workspace.id, 'khachsan.vn') })
    expect((await verifyAs(a.property.id, 'khachsan.vn')).status).toBe(200)
  })

  it('a domain another site holds answers 409 and stays with that site', async () => {
    // Hotel A left it attached and its DNS still points at Digistay; B controls
    // the domain now and has its own records right.
    const a = await createTenant()
    const b = await createTenant()
    await prisma.websiteSettings.create({
      data: { propertyId: a.property.id, customDomain: HOST, domainVerificationStatus: 'verified' },
    })
    dns({ cname: { [HOST]: `${b.property.subdomain}.${ROOT}` }, txt: txtFor(b.workspace.id) })
    signInAs(b.owner)

    const res = await verifyAs(b.property.id)

    expect(res.status).toBe(409)
    // What support checks before moving it (RUNBOOK): B's own TXT, not A's
    expect((await res.json()).data.records.txt.value).toBe(ownershipRecord(b.workspace.id, HOST).value)
    expect(await settingsOf(a.property.id)).toEqual({ customDomain: HOST, domainVerificationStatus: 'verified' })
    expect(await settingsOf(b.property.id)).toBeNull()
  })

  it('says the domain is taken before asking for DNS changes that could not help', async () => {
    const a = await createTenant()
    const b = await createTenant()
    await prisma.websiteSettings.create({
      data: { propertyId: a.property.id, customDomain: HOST, domainVerificationStatus: 'verified' },
    })
    dns({})
    signInAs(b.owner)

    expect((await verifyAs(b.property.id)).status).toBe(409)
  })

  it("the site's own verified domain is not asked for the TXT again, and a failed recheck changes nothing", async () => {
    const a = await createTenant()
    await prisma.websiteSettings.create({
      data: { propertyId: a.property.id, customDomain: HOST, domainVerificationStatus: 'verified' },
    })
    signInAs(a.owner)

    dns({ cname: { [HOST]: `${a.property.subdomain}.${ROOT}` } })
    expect((await verifyAs(a.property.id)).status).toBe(200)

    dns({ down: [HOST] })
    expect((await verifyAs(a.property.id)).status).toBe(503)
    expect(await settingsOf(a.property.id)).toEqual({ customDomain: HOST, domainVerificationStatus: 'verified' })
  })

  it('receptionists and plain members cannot attach a domain', async () => {
    for (const role of ['RECEPTIONIST', 'USER'] as const) {
      const a = await createTenant({ memberRole: role })
      dns({ cname: { [HOST]: `${a.property.subdomain}.${ROOT}` }, txt: txtFor(a.workspace.id) })
      signInAs(a.member!)

      expect((await verifyAs(a.property.id)).status, role).toBe(403)
      expect(await settingsOf(a.property.id)).toBeNull()
    }
  })

  it("Digistay's own hostnames are refused", async () => {
    const a = await createTenant()
    const b = await createTenant()
    signInAs(a.owner)

    for (const domain of [ROOT, `${b.property.subdomain}.${ROOT}`, 'khachsan.vn/x']) {
      expect((await verifyAs(a.property.id, domain)).status, domain).toBe(400)
    }
  })

  it('the database refuses a second site with the same domain', async () => {
    const a = await createTenant()
    const b = await createTenant()
    await prisma.websiteSettings.create({ data: { propertyId: a.property.id, customDomain: HOST } })

    await expect(prisma.websiteSettings.create({ data: { propertyId: b.property.id, customDomain: HOST } })).rejects.toMatchObject({
      code: 'P2002',
    })
  })
})

describe('PUT /api/website/settings', () => {
  function save(propertyId: unknown, settings: Record<string, unknown>) {
    return putSettings(req('/api/website/settings', 'PUT', { propertyId, settings }))
  }

  it('saves the form with the domain unchanged, refuses a new domain, removes it when emptied', async () => {
    const a = await createTenant()
    await prisma.websiteSettings.create({
      data: { propertyId: a.property.id, customDomain: HOST, domainVerificationStatus: 'verified' },
    })
    signInAs(a.owner)

    const typedIn = await save(a.property.id, { customDomain: 'www.other-hotel.vn', primaryColor: '#111111' })
    expect(typedIn.status).toBe(400)
    expect(await settingsOf(a.property.id)).toEqual({ customDomain: HOST, domainVerificationStatus: 'verified' })

    const same = await save(a.property.id, { customDomain: HOST, primaryColor: '#222222' })
    expect(same.status).toBe(200)
    const kept = await prisma.websiteSettings.findUniqueOrThrow({ where: { propertyId: a.property.id } })
    expect([kept.customDomain, kept.domainVerificationStatus, kept.primaryColor]).toEqual([HOST, 'verified', '#222222'])

    const emptied = await save(a.property.id, { customDomain: '', primaryColor: '#222222' })
    expect(emptied.status).toBe(200)
    expect(await settingsOf(a.property.id)).toEqual({ customDomain: null, domainVerificationStatus: null })
  })

  it('a propertyId filter object is refused', async () => {
    const a = await createTenant()
    const b = await createTenant()
    signInAs(b.owner)

    const res = await save({ in: [b.property.id, a.property.id] }, { primaryColor: '#333333' })

    expect(res.status).toBe(400)
    expect(await settingsOf(a.property.id)).toBeNull()
  })
})

describe('GET /api/website/ssl/provision', () => {
  it("another hotel's domain and certificate status is not found", async () => {
    const a = await createTenant()
    const b = await createTenant()
    await prisma.websiteSettings.create({ data: { propertyId: a.property.id, customDomain: HOST } })

    signInAs(b.owner)
    expect((await sslStatus(req(`/api/website/ssl/provision?propertyId=${a.property.id}`))).status).toBe(404)

    signInAs(a.owner)
    const own = await sslStatus(req(`/api/website/ssl/provision?propertyId=${a.property.id}`))
    expect(own.status).toBe(200)
    expect((await own.json()).data.customDomain).toBe(HOST)
  })
})
