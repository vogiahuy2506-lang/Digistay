/**
 * The website's version history against real Postgres
 * (src/lib/public-site/versions.ts): every save in the builder keeps the site
 * as saved, quick saves by one person merge, the newest 50 stay, a restore
 * puts every saved field back (keeping the site before it) and drops the
 * public site's cache, and only the people who may edit the site, on their
 * own site's versions, may list, restore or preview them.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { WorkspaceRole } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { revalidateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { publicSiteTag } from '@/lib/public-site/site'
import { MERGE_WINDOW_MS, SITE_VERSION_LIMIT, loadSiteVersionPreview, parseSiteSnapshot } from '@/lib/public-site/versions'
import { PUT as putBlocks } from './blocks/route'
import { PUT as putSettings } from './settings/route'
import { GET as listVersions } from './versions/route'
import { POST as restoreVersion } from './versions/[versionId]/restore/route'

const DAY = 86_400_000
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string }) => mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
const req = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })

type BlockInput = { type: string; name: string; config?: Record<string, unknown>; isEnabled?: boolean }
const saveBlocks = (propertyId: string, blocks: BlockInput[]) => putBlocks(req('/api/website/blocks', 'PUT', { propertyId, blocks }))
const saveSettings = (propertyId: string, settings: Record<string, unknown>) =>
  putSettings(req('/api/website/settings', 'PUT', { propertyId, settings }))
const list = async (propertyId: string) => {
  const res = await listVersions(req(`/api/website/versions?propertyId=${propertyId}`))
  return { status: res.status, body: await res.json() }
}
const restore = (propertyId: string, versionId: string) =>
  restoreVersion(req(`/api/website/versions/${versionId}/restore`, 'POST', { propertyId }), {
    params: Promise.resolve({ versionId }),
  })
const versionsOf = (propertyId: string) =>
  prisma.siteVersion.findMany({ where: { propertyId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
/** Moves every version of the property back in time: the next save is past the merge window. */
const age = (propertyId: string, ms = MERGE_WINDOW_MS + 1000) =>
  prisma.$executeRaw`UPDATE "site_versions" SET "createdAt" = "createdAt" - (${ms}::int * interval '1 millisecond'), "updatedAt" = "updatedAt" - (${ms}::int * interval '1 millisecond') WHERE "propertyId" = ${propertyId}`

async function hotelWith(role: WorkspaceRole) {
  const tenant = await createTenant()
  const user = await createUser()
  await prisma.workspaceMember.create({ data: { workspaceId: tenant.workspace.id, userId: user.id, role } })
  return { ...tenant, user }
}

/** What the builder's Style and Settings tabs save, all of it. */
const LOOK_A = {
  primaryColor: '#1D4ED8',
  secondaryColor: '#047857',
  accentColor: '#B45309',
  buttonColor: '#7C2D12',
  headingColor: '#1E3A8A',
  fontFamily: 'Roboto',
  headingFont: 'Merriweather',
  layout: 'classic',
  metaTitle: 'Khách sạn A',
  metaDescription: 'Mô tả A',
  translations: { en: { metaTitle: 'Hotel A', metaDescription: 'About A' } },
}
const BLOCKS_A: BlockInput[] = [
  { type: 'HERO', name: 'Banner Hero', config: { heroTitle: 'Chào A', backgroundImage: 'https://res.cloudinary.com/x/a.jpg', en: { heroTitle: 'Hello A' } } },
  { type: 'REVIEWS', name: 'Đánh giá', config: { reviews: [{ name: 'Lan', text: 'Tốt', rating: 5 }] }, isEnabled: false },
  { type: 'CONTACT', name: 'Liên hệ', config: { contactTitle: 'Gọi A', contactFormEnabled: true } },
]
const LOOK_B = {
  primaryColor: '#DC2626',
  secondaryColor: '#111827',
  accentColor: '#0EA5E9',
  buttonColor: '',
  headingColor: '',
  fontFamily: 'Inter',
  headingFont: 'Montserrat',
  layout: 'minimal',
  metaTitle: 'Khách sạn B',
  metaDescription: 'Mô tả B',
  translations: { en: { metaTitle: 'Hotel B', metaDescription: '' } },
}
const BLOCKS_B: BlockInput[] = [{ type: 'ROOMS', name: 'Phòng B', config: { roomsTitle: 'Phòng B' } }]

/** One "Lưu thay đổi" in the builder: the blocks, then the settings. */
async function builderSave(propertyId: string, blocks: BlockInput[], look: Record<string, unknown>) {
  expect((await saveBlocks(propertyId, blocks)).status).toBe(200)
  expect((await saveSettings(propertyId, look)).status).toBe(200)
}

async function liveSite(propertyId: string) {
  const [blocks, settings] = await Promise.all([
    prisma.websiteBlock.findMany({ where: { propertyId }, orderBy: { sortOrder: 'asc' } }),
    prisma.websiteSettings.findUnique({ where: { propertyId } }),
  ])
  return {
    blocks: blocks.map((b) => ({ type: b.type, name: b.name, config: b.config, isEnabled: b.isEnabled })),
    settings: settings!,
  }
}

beforeEach(async () => {
  await resetDatabase()
  vi.mocked(revalidateTag).mockClear()
})
afterAll(() => prisma.$disconnect())

describe('a save keeps a version', () => {
  it('one save in the builder (blocks, then settings) makes one version holding both', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)

    await builderSave(property.id, BLOCKS_A, LOOK_A)

    const versions = await versionsOf(property.id)
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({ kind: 'AUTO', createdById: owner.id })
    const snapshot = parseSiteSnapshot(versions[0].snapshot)
    expect(snapshot.blocks.map((b) => [b.type, b.name, b.isEnabled])).toEqual([
      ['HERO', 'Banner Hero', true],
      ['REVIEWS', 'Đánh giá', false],
      ['CONTACT', 'Liên hệ', true],
    ])
    expect(snapshot.settings).toMatchObject({ ...LOOK_A, buttonColor: '#7C2D12', headingColor: '#1E3A8A' })

    const { status, body } = await list(property.id)
    expect(status).toBe(200)
    expect(body.data.limit).toBe(SITE_VERSION_LIMIT)
    expect(body.data.versions).toEqual([
      { id: versions[0].id, kind: 'AUTO', savedAt: versions[0].updatedAt.toISOString(), by: 'Test User', restoredFromId: null },
    ])
  })

  it('quick saves by the same person update one version; later, or by someone else, a new one', async () => {
    const { owner, workspace, property } = await createTenant()
    const manager = await createUser()
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: manager.id, role: 'MANAGER' } })
    signInAs(owner)

    await builderSave(property.id, [{ type: 'HERO', name: 'Một' }], LOOK_A)
    await builderSave(property.id, [{ type: 'HERO', name: 'Hai' }], LOOK_A)
    await saveBlocks(property.id, [{ type: 'HERO', name: 'Ba' }])

    let versions = await versionsOf(property.id)
    expect(versions).toHaveLength(1)
    expect(parseSiteSnapshot(versions[0].snapshot).blocks.map((b) => b.name)).toEqual(['Ba'])
    expect(versions[0].updatedAt.getTime()).toBeGreaterThan(versions[0].createdAt.getTime())

    signInAs(manager)
    await saveBlocks(property.id, [{ type: 'HERO', name: 'Bốn' }])
    versions = await versionsOf(property.id)
    expect(versions.map((v) => v.createdById)).toEqual([manager.id, owner.id])

    await age(property.id)
    await saveBlocks(property.id, [{ type: 'HERO', name: 'Năm' }])
    versions = await versionsOf(property.id)
    expect(versions.map((v) => parseSiteSnapshot(v.snapshot).blocks[0].name)).toEqual(['Năm', 'Bốn', 'Ba'])
  })

  it('a save that changes nothing versioned (publishing) adds none', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await builderSave(property.id, BLOCKS_A, LOOK_A)
    await age(property.id)

    await builderSave(property.id, BLOCKS_A, { ...LOOK_A, isPublished: true })

    expect(await prisma.siteVersion.count({ where: { propertyId: property.id } })).toBe(1)
    expect(await prisma.websiteSettings.findUnique({ where: { propertyId: property.id } })).toMatchObject({ isPublished: true })
  })

  it(`51 saves keep the newest ${SITE_VERSION_LIMIT}`, async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)

    for (let i = 1; i <= 51; i++) {
      expect((await saveBlocks(property.id, [{ type: 'HERO', name: `Lần ${i}` }])).status).toBe(200)
      await age(property.id)
    }

    const versions = await versionsOf(property.id)
    expect(versions).toHaveLength(SITE_VERSION_LIMIT)
    expect(parseSiteSnapshot(versions[0].snapshot).blocks[0].name).toBe('Lần 51')
    expect(parseSiteSnapshot(versions.at(-1)!.snapshot).blocks[0].name).toBe('Lần 2')
  })

  it('the site as it was before its first versioned save is kept, and can be restored', async () => {
    const { owner, property } = await createTenant()
    await prisma.websiteBlock.create({ data: { propertyId: property.id, type: 'ABOUT', name: 'Giới thiệu cũ', config: { aboutTitle: 'Xưa' } } })
    signInAs(owner)

    await saveBlocks(property.id, BLOCKS_B)

    const [auto, initial] = await versionsOf(property.id)
    expect([auto.kind, initial.kind]).toEqual(['AUTO', 'INITIAL'])
    expect(initial.createdById).toBeNull()
    expect(parseSiteSnapshot(initial.snapshot).blocks).toEqual([
      { type: 'ABOUT', name: 'Giới thiệu cũ', config: { aboutTitle: 'Xưa' }, isEnabled: true },
    ])

    expect((await restore(property.id, initial.id)).status).toBe(200)
    expect((await liveSite(property.id)).blocks.map((b) => b.name)).toEqual(['Giới thiệu cũ'])
  })
})

describe('restore', () => {
  it('puts back every saved field, keeps the site before it, and drops the public site cache', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await builderSave(property.id, BLOCKS_A, LOOK_A)
    const before = await liveSite(property.id)
    const [versionA] = await versionsOf(property.id)
    await age(property.id)
    // Published, and a domain attached (by the DNS check) after version A: a restore keeps both.
    await builderSave(property.id, BLOCKS_B, { ...LOOK_B, isPublished: true })
    await prisma.websiteSettings.update({ where: { propertyId: property.id }, data: { customDomain: 'www.khachsan-a.vn', domainVerificationStatus: 'verified' } })
    const siteB = await liveSite(property.id)
    vi.mocked(revalidateTag).mockClear()

    const res = await restore(property.id, versionA.id)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    const after = await liveSite(property.id)
    expect(after.blocks).toEqual(before.blocks)
    const { id: _id, createdAt: _c, updatedAt: _u, isPublished: _p, publishedAt: _pa, ...look } = before.settings
    expect(after.settings).toMatchObject({ ...look, isPublished: true, customDomain: 'www.khachsan-a.vn', domainVerificationStatus: 'verified' })
    expect(after.settings.translations).toEqual(before.settings.translations)
    expect(before.settings.translations).toMatchObject({ en: { metaTitle: 'Hotel A' } })
    expect(revalidateTag).toHaveBeenCalledWith(publicSiteTag(property.id))

    const [restored, kept, ...older] = await versionsOf(property.id)
    expect(restored).toMatchObject({ kind: 'RESTORE', restoredFromId: versionA.id, createdById: owner.id })
    expect(kept).toMatchObject({ kind: 'BEFORE_RESTORE', createdById: owner.id })
    expect(parseSiteSnapshot(kept.snapshot).blocks).toEqual(siteB.blocks)
    expect(parseSiteSnapshot(kept.snapshot).settings).toMatchObject({ primaryColor: '#DC2626', buttonColor: null, metaTitle: 'Khách sạn B' })
    expect(older.map((v) => v.kind)).toEqual(['AUTO', 'AUTO'])
    expect(await prisma.activityLog.count({ where: { propertyId: property.id, changes: { path: ['restoredVersionId'], equals: versionA.id } } })).toBe(1)

    // And the restore can itself be undone.
    expect((await restore(property.id, kept.id)).status).toBe(200)
    const undone = await liveSite(property.id)
    expect(undone.blocks).toEqual(siteB.blocks)
    expect(undone.settings).toMatchObject({ primaryColor: '#DC2626', buttonColor: null, headingColor: null, headingFont: 'Montserrat', layout: 'minimal' })
  })

  it('a save right after a restore is a version of its own (never merged into the restore)', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await saveBlocks(property.id, BLOCKS_A)
    await age(property.id)
    await saveBlocks(property.id, BLOCKS_B)
    const [, first] = await versionsOf(property.id)
    await restore(property.id, first.id)

    await saveBlocks(property.id, [{ type: 'HERO', name: 'Sau khôi phục' }])

    expect((await versionsOf(property.id)).map((v) => v.kind)).toEqual(['AUTO', 'RESTORE', 'BEFORE_RESTORE', 'AUTO', 'AUTO'])
  })

  it('another property’s version is not found (404), even in the same workspace', async () => {
    const { owner, workspace, property } = await createTenant()
    const other = await prisma.property.create({
      data: { workspaceId: workspace.id, name: 'Khách sạn 2', slug: `hotel-2-${property.id}`, type: 'HOTEL', address: '2 Test Street', city: 'Hue', subdomain: `h2-${property.id}` },
    })
    signInAs(owner)
    await saveBlocks(other.id, BLOCKS_B)
    const [otherVersion] = await versionsOf(other.id)
    await saveBlocks(property.id, BLOCKS_A)
    const liveBefore = await liveSite(property.id)

    const res = await restore(property.id, otherVersion.id)
    expect(res.status).toBe(404)
    expect((await liveSite(property.id)).blocks).toEqual(liveBefore.blocks)
    expect(await loadSiteVersionPreview(property.subdomain, otherVersion.id)).toBeNull()
    expect(await loadSiteVersionPreview(other.subdomain, otherVersion.id)).not.toBeNull()
    expect((await restore(property.id, 'no-such-version')).status).toBe(404)
  })

  it('another workspace’s hotel and its versions stay out of reach', async () => {
    const a = await createTenant()
    const b = await createTenant()
    signInAs(b.owner)
    await saveBlocks(b.property.id, BLOCKS_B)
    const [versionB] = await versionsOf(b.property.id)

    signInAs(a.owner)
    expect((await restore(a.property.id, versionB.id)).status).toBe(404)
    expect((await restore(b.property.id, versionB.id)).status).toBe(403)
    expect((await list(b.property.id)).status).toBe(403)
    expect(await loadSiteVersionPreview(b.property.subdomain, versionB.id)).toBeNull()
  })

  it('a locked workspace cannot restore (402), and the site is unchanged', async () => {
    const { owner, workspace, property } = await createTenant()
    signInAs(owner)
    await saveBlocks(property.id, BLOCKS_A)
    await age(property.id)
    await saveBlocks(property.id, BLOCKS_B)
    const [, versionA] = await versionsOf(property.id)
    const periodEnd = new Date(Date.now() - 8 * DAY)
    await prisma.subscription.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id, plan: 'growth', billing: 'MONTH', trial: false, periodStart: new Date(periodEnd.getTime() - 30 * DAY), periodEnd },
      update: { trial: false, periodStart: new Date(periodEnd.getTime() - 30 * DAY), periodEnd },
    })

    const res = await restore(property.id, versionA.id)

    expect(res.status).toBe(402)
    expect((await liveSite(property.id)).blocks.map((b) => b.name)).toEqual(['Phòng B'])
    expect(await prisma.siteVersion.count({ where: { propertyId: property.id } })).toBe(2)
    expect((await list(property.id)).status).toBe(200)
  })
})

describe('who may see and restore versions', () => {
  it.each(['RECEPTIONIST', 'USER'] as const)('a %s member gets 403 and no preview', async (role) => {
    const { owner, property, user } = await hotelWith(role)
    signInAs(owner)
    await saveBlocks(property.id, BLOCKS_A)
    const [version] = await versionsOf(property.id)

    signInAs(user)
    expect((await list(property.id)).status).toBe(403)
    expect((await restore(property.id, version.id)).status).toBe(403)
    expect(await loadSiteVersionPreview(property.subdomain, version.id)).toBeNull()
    expect(await prisma.siteVersion.count({ where: { propertyId: property.id } })).toBe(1)
  })

  it.each(['ADMIN', 'MANAGER'] as const)('an %s member lists, previews and restores', async (role) => {
    const { owner, property, user } = await hotelWith(role)
    signInAs(owner)
    await saveBlocks(property.id, BLOCKS_A)
    await age(property.id)
    await saveBlocks(property.id, BLOCKS_B)
    const [, versionA] = await versionsOf(property.id)

    signInAs(user)
    expect((await list(property.id)).body.data.versions).toHaveLength(2)
    const preview = await loadSiteVersionPreview(property.subdomain, versionA.id)
    expect(preview?.snapshot.blocks.map((b) => b.name)).toEqual(BLOCKS_A.map((b) => b.name))
    expect(preview?.version).toMatchObject({ id: versionA.id, by: 'Test User' })
    expect((await restore(property.id, versionA.id)).status).toBe(200)
  })

  it('nobody signed in gets 401 and no preview', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    await saveBlocks(property.id, BLOCKS_A)
    const [version] = await versionsOf(property.id)

    mockAuth.mockResolvedValue(null)
    expect((await list(property.id)).status).toBe(401)
    expect((await restore(property.id, version.id)).status).toBe(401)
    expect(await loadSiteVersionPreview(property.subdomain, version.id)).toBeNull()
  })
})
