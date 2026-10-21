/**
 * The hotel's English texts (`translations.en`) saved by the dashboard's
 * forms, against real Postgres: set, kept when a form doesn't send them,
 * removed when blanked.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn(), authOptions: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { auth } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { POST as createService } from './extra-services/route'
import { PATCH as patchService } from './extra-services/[id]/route'
import { PATCH as patchPolicy } from './properties/[id]/policy/route'
import { PATCH as patchProperty } from './properties/[id]/route'
import { PUT as putRoomType } from './room-types/[id]/route'
import { PUT as putSettings } from './website/settings/route'
import { createRoomType, createTenant, resetDatabase } from '@/test/integration/fixtures'

function signInAs(user: { id: string; email: string }) {
  const session = { user: { id: user.id, email: user.email } }
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session)
  ;(getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session)
}

function req(url: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('English texts of a hotel', () => {
  it('services: created with a category and an English name, then edited', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const created = await createService(
      req('/api/extra-services', 'POST', {
        propertyId: property.id,
        name: 'Đưa đón sân bay',
        category: 'transport',
        price: 150_000,
        translations: { en: { name: ' Airport pickup ', description: '' } },
      })
    )
    expect(created.status).toBe(200)
    const { data } = await created.json()
    expect(data).toMatchObject({ category: 'transport', translations: { en: { name: 'Airport pickup' } } })

    const res = await patchService(
      req(`/api/extra-services/${data.id}`, 'PATCH', { price: 200_000, translations: { en: { description: 'One way' } } }),
      params(data.id)
    )
    expect(res.status).toBe(200)
    const row = await prisma.extraService.findUniqueOrThrow({ where: { id: data.id } })
    expect(row.price).toBe(200_000)
    expect(row.translations).toEqual({ en: { name: 'Airport pickup', description: 'One way' } })
  })

  it('policy: kept when the form sends none, removed when blanked', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const url = `/api/properties/${property.id}/policy`
    expect((await patchPolicy(req(url, 'PATCH', { translations: { en: { cancellationPolicy: 'Free until 48h' } } }), params(property.id))).status).toBe(200)
    expect((await patchPolicy(req(url, 'PATCH', { checkInTime: '15:00', translations: null }), params(property.id))).status).toBe(200)
    let policy = await prisma.policy.findUniqueOrThrow({ where: { propertyId: property.id } })
    expect(policy.checkInTime).toBe('15:00')
    expect(policy.translations).toEqual({ en: { cancellationPolicy: 'Free until 48h' } })

    await patchPolicy(req(url, 'PATCH', { translations: { en: { cancellationPolicy: '  ', additionalRules: '' } } }), params(property.id))
    policy = await prisma.policy.findUniqueOrThrow({ where: { propertyId: property.id } })
    expect(policy.translations).toBeNull()
  })

  it('property description and room type name in English', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const prop = await patchProperty(
      req(`/api/properties/${property.id}`, 'PATCH', { description: 'Khách sạn nhỏ', translations: { en: { description: 'A small hotel' } } }),
      params(property.id)
    )
    expect(prop.status).toBe(200)
    expect((await prisma.property.findUniqueOrThrow({ where: { id: property.id } })).translations).toEqual({ en: { description: 'A small hotel' } })

    const room = await createRoomType(property.id, { name: 'Phòng đôi' })
    // The rooms page sends numbers; the English texts ride along.
    const res = await putRoomType(
      req(`/api/room-types/${room.id}`, 'PUT', { name: 'Phòng đôi', maxAdults: 2, area: 25, translations: { en: { name: 'Double room', description: '' } } }),
      params(room.id)
    )
    expect(res.status).toBe(200)
    const row = await prisma.roomType.findUniqueOrThrow({ where: { id: room.id } })
    expect(row.area).toBe(25)
    expect(row.translations).toEqual({ en: { name: 'Double room' } })
  })

  it('refuses fields that have no English version', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const res = await patchPolicy(
      req(`/api/properties/${property.id}/policy`, 'PATCH', { translations: { en: { checkInTime: '14:00' } } }),
      params(property.id)
    )
    expect(res.status).toBe(400)
  })

  it('website SEO texts in English', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const res = await putSettings(
      req('/api/website/settings', 'PUT', {
        propertyId: property.id,
        settings: { metaTitle: 'Khách sạn', translations: { en: { metaTitle: 'The hotel', metaDescription: '' } } },
      })
    )
    expect(res.status).toBe(200)
    const settings = await prisma.websiteSettings.findUniqueOrThrow({ where: { propertyId: property.id } })
    expect(settings.translations).toEqual({ en: { metaTitle: 'The hotel' } })
  })
})
