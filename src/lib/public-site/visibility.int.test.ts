/**
 * Who sees a hotel's site (src/lib/public-site/visibility.ts) against real
 * Postgres: guests only once it is published; before that only signed-in
 * members of its workspace, as a preview. The site's pages and
 * GET /api/properties/public follow the same rule.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const session = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session.current) }))

import { prisma } from '@/lib/db'
import { createTenant, createUser, publishSite, resetDatabase } from '@/test/integration/fixtures'
import { loadVisibleSite } from './visibility'
import { GET as publicProperty } from '@/app/api/properties/public/route'

const signInAs = (user: { id: string; email: string } | null) => {
  session.current = user ? { user: { id: user.id, email: user.email } } : null
}
const apiStatus = async (subdomain: string) =>
  (await publicProperty(new NextRequest(`http://localhost/api/properties/public?subdomain=${subdomain}`))).status

beforeEach(async () => {
  await resetDatabase()
  signInAs(null)
})
afterAll(() => prisma.$disconnect())

describe('hotel site visibility', () => {
  it('an unpublished site is hidden from guests and from other users, and a preview for its members', async () => {
    const { owner, property, member } = await createTenant({ memberRole: 'RECEPTIONIST' })
    const sub = property.subdomain!

    expect(await loadVisibleSite(sub)).toBeNull()
    expect(await apiStatus(sub)).toBe(404)

    signInAs(await createUser()) // signed in, but not this hotel's
    expect(await loadVisibleSite(sub)).toBeNull()
    expect(await apiStatus(sub)).toBe(404)

    for (const user of [owner, member!]) {
      signInAs(user)
      expect(await loadVisibleSite(sub)).toEqual({ propertyId: property.id, preview: true })
      expect(await apiStatus(sub)).toBe(200)
    }
  })

  it('a published site is public; unpublishing or deactivating hides it at once', async () => {
    const { property } = await createTenant()
    const sub = property.subdomain!
    await publishSite(property.id)

    expect(await loadVisibleSite(sub)).toEqual({ propertyId: property.id, preview: false })
    const res = await publicProperty(new NextRequest(`http://localhost/api/properties/public?subdomain=${sub}`))
    expect(res.status).toBe(200)
    const { data } = await res.json()
    // The visibility fields are read, not sent.
    expect(data).not.toHaveProperty('workspaceId')
    expect(data).not.toHaveProperty('websiteSettings')

    await prisma.websiteSettings.update({ where: { propertyId: property.id }, data: { isPublished: false } })
    expect(await loadVisibleSite(sub)).toBeNull()

    await publishSite(property.id)
    await prisma.property.update({ where: { id: property.id }, data: { isActive: false } })
    expect(await loadVisibleSite(sub)).toBeNull()
    expect(await apiStatus(sub)).toBe(404)
  })
})
