/**
 * The hotel's restaurant menu API against real Postgres: who manages the
 * hotel's services (the owner, ADMIN, MANAGER, or services_manage ticked)
 * adds, changes, reorders and deletes dishes; every member who works at the
 * hotel reads them; nobody else learns the menu exists. The site loads the
 * dishes on sale, in menu order, in the visitor's language.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { WorkspaceRole } from '@prisma/client'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { loadSiteProps, localizeSiteProps } from '@/lib/public-site/site'
import { addMemberProperty, createProperty, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'
import { GET, POST, PUT } from './route'
import { DELETE, PATCH } from './[itemId]/route'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string }) => mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/properties/x/menu', {
    method,
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
const at = (id: string) => ({ params: Promise.resolve({ id }) })
const atItem = (id: string, itemId: string) => ({ params: Promise.resolve({ id, itemId }) })

const list = (propertyId: string) => GET(req('GET'), at(propertyId))
const add = (propertyId: string, body: Record<string, unknown>) => POST(req('POST', body), at(propertyId))
const change = (propertyId: string, itemId: string, body: Record<string, unknown>) => PATCH(req('PATCH', body), atItem(propertyId, itemId))
const remove = (propertyId: string, itemId: string) => DELETE(req('DELETE'), atItem(propertyId, itemId))
const reorder = (propertyId: string, order: string[]) => PUT(req('PUT', { order }), at(propertyId))

async function hotelWith(role: WorkspaceRole) {
  const tenant = await createTenant()
  const user = await createUser()
  await prisma.workspaceMember.create({ data: { workspaceId: tenant.workspace.id, userId: user.id, role } })
  return { ...tenant, user }
}

const dish = (propertyId: string, name: string, data: Record<string, unknown> = {}) =>
  prisma.menuItem.create({ data: { propertyId, name, price: 50_000, ...data } })

beforeEach(resetDatabase)
afterAll(() => prisma.$disconnect())

describe('restaurant menu API', () => {
  it('the owner adds, lists, changes and deletes dishes', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)

    const created = await add(property.id, {
      name: '  Phở bò ',
      price: 65_000,
      category: 'Món chính',
      description: '',
      imageUrl: 'https://res.cloudinary.com/demo/pho.jpg',
      translations: { en: { name: 'Beef pho', category: 'Mains', description: '' } },
    })
    expect(created.status).toBe(200)
    const pho = (await created.json()).data
    expect(pho).toMatchObject({
      name: 'Phở bò',
      price: 65_000,
      category: 'Món chính',
      description: null,
      isAvailable: true,
      sortOrder: 0,
      translations: { en: { name: 'Beef pho', category: 'Mains' } },
    })
    // A new dish goes last.
    const tea = (await (await add(property.id, { name: 'Trà đá', price: 0, category: 'Đồ uống' })).json()).data
    expect(tea.sortOrder).toBe(1)

    const listed = await list(property.id)
    expect(listed.status).toBe(200)
    expect((await listed.json()).data.map((i: { name: string }) => i.name)).toEqual(['Phở bò', 'Trà đá'])

    const changed = await change(property.id, pho.id, {
      price: 70_000,
      isAvailable: false,
      imageUrl: '',
      category: '  ',
      translations: { en: { description: 'With herbs' } },
    })
    expect(changed.status).toBe(200)
    expect(await prisma.menuItem.findUnique({ where: { id: pho.id } })).toMatchObject({
      name: 'Phở bò',
      price: 70_000,
      isAvailable: false,
      imageUrl: null,
      category: null,
      // The English texts not sent stay.
      translations: { en: { name: 'Beef pho', category: 'Mains', description: 'With herbs' } },
    })

    expect((await remove(property.id, pho.id)).status).toBe(200)
    expect(await prisma.menuItem.findMany({ where: { propertyId: property.id }, select: { name: true } })).toEqual([{ name: 'Trà đá' }])
    expect((await remove(property.id, pho.id)).status).toBe(404)
  })

  it.each(['ADMIN', 'MANAGER'] as const)('an %s member changes the menu', async (role) => {
    const { property, user } = await hotelWith(role)
    signInAs(user)

    const res = await add(property.id, { name: 'Cơm tấm', price: 45_000 })
    expect(res.status).toBe(200)
    const { id } = (await res.json()).data
    expect((await change(property.id, id, { name: 'Cơm tấm sườn' })).status).toBe(200)
    expect((await reorder(property.id, [id])).status).toBe(200)
    expect((await remove(property.id, id)).status).toBe(200)
  })

  it.each(['RECEPTIONIST', 'USER'] as const)('a %s member reads the menu but cannot change it', async (role) => {
    const { property, user } = await hotelWith(role)
    const pho = await dish(property.id, 'Phở bò')
    const tea = await dish(property.id, 'Trà đá', { sortOrder: 1 })
    signInAs(user)

    const listed = await list(property.id)
    expect(listed.status).toBe(200)
    expect((await listed.json()).data).toHaveLength(2)

    expect((await add(property.id, { name: 'Cơm tấm', price: 45_000 })).status).toBe(403)
    expect((await change(property.id, pho.id, { price: 1 })).status).toBe(403)
    expect((await reorder(property.id, [tea.id, pho.id])).status).toBe(403)
    expect((await remove(property.id, pho.id)).status).toBe(403)

    expect(await prisma.menuItem.findMany({ orderBy: { sortOrder: 'asc' }, select: { name: true, price: true, sortOrder: true } })).toEqual([
      { name: 'Phở bò', price: 50_000, sortOrder: 0 },
      { name: 'Trà đá', price: 50_000, sortOrder: 1 },
    ])
  })

  it('services_manage ticked changes the menu; a set without it only reads', async () => {
    const cook = await createTenant({ memberRole: 'USER', memberPermissions: ['services_manage'] })
    signInAs(cook.member!)
    expect((await add(cook.property.id, { name: 'Cơm tấm', price: 45_000 })).status).toBe(200)

    const editor = await createTenant({ memberRole: 'USER', memberPermissions: ['property_edit', 'room_types_manage', 'website_manage'] })
    await dish(editor.property.id, 'Phở bò')
    signInAs(editor.member!)
    expect((await list(editor.property.id)).status).toBe(200)
    expect((await add(editor.property.id, { name: 'Cơm tấm', price: 45_000 })).status).toBe(403)
    expect(await prisma.menuItem.count({ where: { propertyId: editor.property.id } })).toBe(1)
  })

  it('a member limited to another hotel of the workspace is told nothing exists', async () => {
    const { workspace, property, member } = await createTenant({ memberRole: 'MANAGER', memberLimited: true })
    const other = await createProperty(workspace.id)
    await addMemberProperty(workspace.id, member!.id, other.id)
    const pho = await dish(property.id, 'Phở bò')
    signInAs(member!)

    expect((await list(property.id)).status).toBe(404)
    expect((await add(property.id, { name: 'Cơm tấm', price: 1 })).status).toBe(404)
    expect((await change(property.id, pho.id, { price: 1 })).status).toBe(404)
    expect((await list(other.id)).status).toBe(200)
    expect(await prisma.menuItem.findMany({ select: { name: true, price: true } })).toEqual([{ name: 'Phở bò', price: 50_000 }])
  })

  it('another workspace can neither read nor change the menu, and is told nothing exists', async () => {
    const hotelA = await createTenant()
    const hotelB = await createTenant()
    const pho = await dish(hotelA.property.id, 'Phở bò')
    signInAs(hotelB.owner)

    expect((await list(hotelA.property.id)).status).toBe(404)
    expect((await add(hotelA.property.id, { name: 'Cơm tấm', price: 1 })).status).toBe(404)
    expect((await change(hotelA.property.id, pho.id, { price: 1 })).status).toBe(404)
    expect((await reorder(hotelA.property.id, [pho.id])).status).toBe(404)
    expect((await remove(hotelA.property.id, pho.id)).status).toBe(404)
    // Its own hotel's URL with the other hotel's dish: not found either.
    expect((await change(hotelB.property.id, pho.id, { price: 1 })).status).toBe(404)
    expect((await remove(hotelB.property.id, pho.id)).status).toBe(404)

    expect(await prisma.menuItem.findMany({ select: { name: true, price: true, propertyId: true } })).toEqual([
      { name: 'Phở bò', price: 50_000, propertyId: hotelA.property.id },
    ])
    // A stranger signed in as no one at all.
    mockAuth.mockResolvedValue(null)
    expect((await list(hotelA.property.id)).status).toBe(401)
  })

  it('refuses a bad name, price or photo', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)

    for (const body of [
      { name: '', price: 1 },
      { name: '   ', price: 1 },
      { name: 'x'.repeat(121), price: 1 },
      { name: 'Phở', price: -1 },
      { name: 'Phở', price: '65000' },
      { name: 'Phở' },
      { name: 'Phở', price: 1, imageUrl: 'data:image/png;base64,iVBORw0KGgo=' },
      { name: 'Phở', price: 1, imageUrl: 'javascript:alert(1)' },
      { name: 'Phở', price: 1, imageUrl: '//evil.example/x.jpg' },
      { name: 'Phở', price: 1, translations: { en: { name: 'Pho', price: 'x' } } },
    ]) {
      const res = await add(property.id, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect((await res.json()).error).toEqual(expect.any(String))
    }
    expect(await prisma.menuItem.count()).toBe(0)

    // The longest name and a file of our upload route are fine.
    expect((await add(property.id, { name: 'x'.repeat(120), price: 0, imageUrl: '/api/upload/menu/pho.webp' })).status).toBe(200)
  })

  it('stores a new order of the whole menu, and refuses one made from a stale list', async () => {
    const { owner, property } = await createTenant()
    const other = await createTenant()
    const a = await dish(property.id, 'A')
    const b = await dish(property.id, 'B')
    const c = await dish(property.id, 'C')
    const foreign = await dish(other.property.id, 'X')
    signInAs(owner)

    expect((await reorder(property.id, [c.id, a.id, b.id])).status).toBe(200)
    const order = async () =>
      (await prisma.menuItem.findMany({ where: { propertyId: property.id }, orderBy: { sortOrder: 'asc' }, select: { name: true } })).map((i) => i.name)
    expect(await order()).toEqual(['C', 'A', 'B'])

    // Missing a dish, naming another hotel's, or one twice: nothing changes.
    expect((await reorder(property.id, [a.id, b.id])).status).toBe(409)
    expect((await reorder(property.id, [a.id, b.id, foreign.id])).status).toBe(409)
    expect((await reorder(property.id, [a.id, a.id, b.id])).status).toBe(400)
    expect(await order()).toEqual(['C', 'A', 'B'])
    expect((await prisma.menuItem.findUnique({ where: { id: foreign.id } }))!.sortOrder).toBe(0)
  })
})

describe('restaurant menu on the site', () => {
  it('shows the dishes on sale in menu order, in English where the hotel wrote it', async () => {
    const { property } = await createTenant()
    await dish(property.id, 'Trà đá', { sortOrder: 2, category: 'Đồ uống' })
    await dish(property.id, 'Phở bò', { sortOrder: 0, category: 'Món chính', translations: { en: { name: 'Beef pho', category: 'Mains' } } })
    await dish(property.id, 'Cơm tấm', { sortOrder: 1, category: 'món chính' })
    await dish(property.id, 'Hết món', { sortOrder: 3, isAvailable: false })

    const site = (await loadSiteProps(property.id))!
    expect(site.menuItems.map((i) => [i.name, i.category])).toEqual([
      ['Phở bò', 'Món chính'],
      ['Cơm tấm', 'món chính'],
      ['Trà đá', 'Đồ uống'],
    ])
    const en = localizeSiteProps(site, 'en', (_slug, name) => name)
    expect(en.menuItems.map((i) => [i.name, i.category])).toEqual([
      ['Beef pho', 'Mains'],
      ['Cơm tấm', 'Mains'],
      ['Trà đá', 'Đồ uống'],
    ])
  })
})
