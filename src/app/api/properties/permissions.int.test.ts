/**
 * Setting a property up by permission (src/lib/auth/permissions.ts), against
 * real Postgres: a member's ticked set decides what they may change, and a
 * member limited to some properties neither sees nor reaches the others,
 * but works on a property they create.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const session = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session.current), authOptions: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }))

import { prisma } from '@/lib/db'
import { addMemberProperty, createProperty, createTenant, resetDatabase } from '@/test/integration/fixtures'
import { GET as listProperties, POST as createPropertyRoute } from './route'
import { GET as getProperty, PATCH as patchProperty } from './[id]/route'
import { PATCH as patchPolicy } from './[id]/policy/route'
import { POST as addPricing } from './[id]/pricing/route'
import { POST as addNestedRoomType } from './[id]/room-types/route'
import { GET as listRoomTypes, POST as addRoomType } from '../room-types/route'
import { GET as listServices, POST as addService } from '../extra-services/route'
import { GET as getSettings, PUT as putSettings } from '../website/settings/route'

const signInAs = (user: { id: string; email: string }) => {
  session.current = { user: { id: user.id, email: user.email } }
}
const req = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
const at = (id: string) => ({ params: Promise.resolve({ id }) })

const rename = (propertyId: string, name: string) => patchProperty(req(`/api/properties/${propertyId}`, 'PATCH', { name }), at(propertyId))
const read = (propertyId: string) => getProperty(req(`/api/properties/${propertyId}`), at(propertyId))
const roomType = { name: 'Phòng đôi', bedType: 'DOUBLE', totalRooms: 2, baseOccupancy: 2, maxOccupancy: 2, maxAdults: 2, maxChildren: 0 }
const listed = async (url: string) => {
  const res = await listProperties(req(url))
  expect(res.status).toBe(200)
  return ((await res.json()).data as { id: string }[]).map((p) => p.id).sort()
}

beforeEach(async () => {
  session.current = null
  await resetDatabase()
})
afterAll(() => prisma.$disconnect())

describe('a ticked set of permissions', () => {
  it('property_edit without room_types_manage: edits the property, adds no room type nor price', async () => {
    const { property, member } = await createTenant({ memberRole: 'USER', memberPermissions: ['property_edit'] })
    signInAs(member!)

    expect((await rename(property.id, 'Khách sạn mới')).status).toBe(200)
    expect((await prisma.property.findUniqueOrThrow({ where: { id: property.id } })).name).toBe('Khách sạn mới')
    expect((await patchPolicy(req('/x', 'PATCH', { checkInTime: '15:00' }), at(property.id))).status).toBe(200)

    expect((await addNestedRoomType(req('/x', 'POST', roomType), at(property.id))).status).toBe(403)
    expect((await addRoomType(req('/api/room-types', 'POST', { propertyId: property.id, ...roomType }))).status).toBe(404)
    expect((await addPricing(req('/x', 'POST', { name: 'Hè', weekdayPrice: 1, weekendPrice: 1 }), at(property.id))).status).toBe(403)
    expect(await prisma.roomType.count()).toBe(0)
    expect(await prisma.pricingConfig.count()).toBe(0)
  })

  it('room_types_manage without property_edit: adds room types, does not edit the property', async () => {
    const { property, member } = await createTenant({ memberRole: 'USER', memberPermissions: ['room_types_manage'] })
    signInAs(member!)

    expect((await addRoomType(req('/api/room-types', 'POST', { propertyId: property.id, ...roomType }))).status).toBe(201)
    expect((await rename(property.id, 'Khách sạn mới')).status).toBe(403)
    expect((await patchPolicy(req('/x', 'PATCH', { checkInTime: '15:00' }), at(property.id))).status).toBe(403)
    expect((await prisma.property.findUniqueOrThrow({ where: { id: property.id } })).name).toBe(property.name)
    // Reading needs no permission.
    expect((await read(property.id)).status).toBe(200)
  })

  it('services_manage: adds a service, nothing else', async () => {
    const { property, member } = await createTenant({ memberRole: 'USER', memberPermissions: ['services_manage'] })
    signInAs(member!)

    const service = { propertyId: property.id, name: 'Đưa đón sân bay', price: 200_000 }
    expect((await addService(req('/api/extra-services', 'POST', service))).status).toBe(200)
    expect((await rename(property.id, 'Khách sạn mới')).status).toBe(403)

    // A preset without it (a receptionist) reads the services but adds none.
    const desk = await createTenant({ memberRole: 'RECEPTIONIST' })
    signInAs(desk.member!)
    expect((await listServices(req(`/api/extra-services?propertyId=${desk.property.id}`))).status).toBe(200)
    expect((await addService(req('/api/extra-services', 'POST', { ...service, propertyId: desk.property.id }))).status).toBe(403)
  })

  it('website_manage gates saving the website settings; reading them needs none', async () => {
    const editor = await createTenant({ memberRole: 'USER', memberPermissions: ['website_manage'] })
    signInAs(editor.member!)
    const publish = (propertyId: string) =>
      putSettings(req('/api/website/settings', 'PUT', { propertyId, settings: { isPublished: true } }))
    expect((await publish(editor.property.id)).status).toBe(200)
    expect(await prisma.websiteSettings.findUnique({ where: { propertyId: editor.property.id } })).toMatchObject({ isPublished: true })

    const others = await createTenant({
      memberRole: 'USER',
      memberPermissions: ['property_edit', 'room_types_manage', 'services_manage'],
    })
    signInAs(others.member!)
    expect((await publish(others.property.id)).status).toBe(403)
    expect(await prisma.websiteSettings.count({ where: { propertyId: others.property.id, isPublished: true } })).toBe(0)
    expect((await getSettings(req(`/api/website/settings?propertyId=${others.property.id}`))).status).toBe(200)
  })
})

describe('a member limited to some properties', () => {
  it('does not see the others in the list, and they are not found', async () => {
    const { workspace, property: a, member } = await createTenant({ memberRole: 'MANAGER', memberLimited: true })
    await addMemberProperty(workspace.id, member!.id, a.id)
    const b = await createProperty(workspace.id)
    signInAs(member!)

    expect(await listed('/api/properties')).toEqual([a.id])
    expect(await listed(`/api/properties?workspaceId=${workspace.id}`)).toEqual([a.id])

    expect((await read(a.id)).status).toBe(200)
    expect((await rename(a.id, 'A mới')).status).toBe(200)
    expect((await read(b.id)).status).toBe(404)
    const refused = await rename(b.id, 'B mới')
    expect(refused.status).toBe(404)
    expect((await refused.json()).error).toBe('Không tìm thấy cơ sở')
    expect((await prisma.property.findUniqueOrThrow({ where: { id: b.id } })).name).toBe(b.name)

    // Nor anything set up at B.
    expect((await listRoomTypes(req(`/api/room-types?propertyId=${b.id}`))).status).toBe(404)
    expect((await addRoomType(req('/api/room-types', 'POST', { propertyId: b.id, ...roomType }))).status).toBe(404)
    expect((await listServices(req(`/api/extra-services?propertyId=${b.id}`))).status).toBe(403)
    expect((await patchPolicy(req('/x', 'PATCH', { checkInTime: '15:00' }), at(b.id))).status).toBe(403)
    expect((await putSettings(req('/api/website/settings', 'PUT', { propertyId: b.id, settings: { isPublished: true } }))).status).toBe(403)
    expect(await prisma.roomType.count({ where: { propertyId: b.id } })).toBe(0)

    // The owner sees both.
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: workspace.ownerId } })
    signInAs({ id: owner.id, email: owner.email! })
    expect(await listed('/api/properties')).toEqual([a.id, b.id].sort())
  })

  it('with properties_create, works on the property they create', async () => {
    const { workspace, property: a, member } = await createTenant({
      memberRole: 'USER',
      memberPermissions: ['properties_create', 'property_edit'],
      memberLimited: true,
    })
    await addMemberProperty(workspace.id, member!.id, a.id)
    signInAs(member!)

    const res = await createPropertyRoute(
      req('/api/properties', 'POST', {
        workspaceId: workspace.id,
        name: 'Cơ sở Huế',
        type: 'HOTEL',
        address: '9 Test Street',
        city: 'Hue',
        subdomain: `co-so-hue-${Date.now()}`,
      })
    )
    expect(res.status).toBe(200)
    const created = (await res.json()).data as { id: string }

    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: member!.id } },
      include: { properties: { select: { propertyId: true } } },
    })
    expect(membership.allProperties).toBe(false)
    expect(membership.properties.map((p) => p.propertyId).sort()).toEqual([a.id, created.id].sort())

    expect(await listed('/api/properties')).toEqual([a.id, created.id].sort())
    expect((await read(created.id)).status).toBe(200)
    expect((await rename(created.id, 'Cơ sở Huế 2')).status).toBe(200)
  })

  it('without properties_create, adds no property', async () => {
    const { workspace, member } = await createTenant({ memberRole: 'USER', memberPermissions: ['property_edit'] })
    signInAs(member!)

    const res = await createPropertyRoute(
      req('/api/properties', 'POST', { workspaceId: workspace.id, name: 'Cơ sở Huế', type: 'HOTEL', address: '9 Test Street', city: 'Hue', subdomain: `hue-${Date.now()}` })
    )
    expect(res.status).toBe(403)
    expect(await prisma.property.count({ where: { workspaceId: workspace.id } })).toBe(1)
  })
})
