/**
 * Photo storage against real Postgres, with Cloudinary faked at fetch():
 * who may upload, the folder the server picks, what is refused before
 * anything is sent, the avatar, and a room type's own photos.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { signParams } from '@/lib/cloudinary'
import { POST as upload } from './route'
import { PATCH as avatar } from '../users/me/avatar/route'
import { POST as addPropertyImage } from '../properties/[id]/images/route'
import { POST as addRoomPhoto, PATCH as mainRoomPhoto, DELETE as deleteRoomPhoto } from '../properties/[id]/room-types/[roomTypeId]/images/route'
import { addMemberProperty, createProperty, createRoomType, createTenant, createUser, resetDatabase } from '@/test/integration/fixtures'

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const signInAs = (user: { id: string; email: string | null }) => mockAuth.mockResolvedValue({ user: { id: user.id, email: user.email } })

const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(40).fill(1)]).toString('base64')}`
const CLOUD = 'digistay-test'
const SECRET = 'cloudinary-secret-for-tests'

/** What the fake Cloudinary received, per upload. */
let uploads: { url: string; form: FormData }[] = []

function fakeCloudinary() {
  uploads = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const form = init.body as FormData
      uploads.push({ url, form })
      const folder = String(form.get('folder'))
      const ok = form.get('signature') === signParams({ folder, timestamp: Number(form.get('timestamp')) }, SECRET)
      if (!ok) return new Response(JSON.stringify({ error: { message: 'Invalid Signature' } }), { status: 401 })
      const id = `photo${uploads.length}`
      return new Response(
        JSON.stringify({
          secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/${folder}/${id}.png`,
          public_id: `${folder}/${id}`,
          width: 800,
          height: 600,
          format: 'png',
          bytes: 48,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
  )
}

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const params = <T,>(p: T) => ({ params: Promise.resolve(p) })

beforeEach(async () => {
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD
  process.env.CLOUDINARY_API_KEY = '1234567890'
  process.env.CLOUDINARY_API_SECRET = SECRET
  fakeCloudinary()
  await resetDatabase()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
afterAll(async () => prisma.$disconnect())

describe('POST /api/upload', () => {
  it("stores a property's photo in that workspace's and property's folder, signed", async () => {
    const { owner, workspace, property } = await createTenant()
    signInAs(owner)
    const res = await upload(json('/api/upload', 'POST', { base64: PNG, propertyId: property.id, folder: '../../elsewhere' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.url).toBe(`https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/digistay/${workspace.id}/${property.id}/photo1.png`)
    expect(uploads).toHaveLength(1)
    expect(uploads[0].url).toBe(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`)
    // The browser's `folder` is ignored.
    expect(uploads[0].form.get('folder')).toBe(`digistay/${workspace.id}/${property.id}`)
  })

  it("lets managers upload a property's photos and admins the logo; not receptionists, nor anyone outside the workspace", async () => {
    const manager = await createTenant({ memberRole: 'MANAGER' })
    signInAs(manager.member!)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, propertyId: manager.property.id }))).status).toBe(200)
    // The logo is the workspace's settings: not a manager's.
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, workspaceId: manager.workspace.id }))).status).toBe(403)

    const admin = await createTenant({ memberRole: 'ADMIN' })
    signInAs(admin.member!)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, workspaceId: admin.workspace.id }))).status).toBe(200)

    const receptionist = await createTenant({ memberRole: 'RECEPTIONIST' })
    signInAs(receptionist.member!)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, propertyId: receptionist.property.id }))).status).toBe(403)

    const stranger = await createUser()
    signInAs(stranger)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, propertyId: manager.property.id }))).status).toBe(404)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, workspaceId: manager.workspace.id }))).status).toBe(404)
    expect(uploads).toHaveLength(2)

    mockAuth.mockResolvedValue(null)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG }))).status).toBe(401)
  })

  it('a ticked permission that edits something with photos lets one upload, only at the properties one works on', async () => {
    const menuOnly = await createTenant({ memberRole: 'USER', memberPermissions: ['services_manage'], memberLimited: true })
    await addMemberProperty(menuOnly.workspace.id, menuOnly.member!.id, menuOnly.property.id)
    const other = await createProperty(menuOnly.workspace.id)
    signInAs(menuOnly.member!)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, propertyId: menuOnly.property.id }))).status).toBe(200)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, propertyId: other.id }))).status).toBe(404)

    const frontDesk = await createTenant({ memberRole: 'USER', memberPermissions: ['bookings_view', 'bookings_edit', 'rooms_status'] })
    signInAs(frontDesk.member!)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG, propertyId: frontDesk.property.id }))).status).toBe(403)
    expect(uploads).toHaveLength(1)
  })

  it("with no property or workspace, the user's own folder (a new workspace's logo)", async () => {
    const user = await createUser()
    signInAs(user)
    expect((await upload(json('/api/upload', 'POST', { base64: PNG }))).status).toBe(200)
    expect(uploads[0].form.get('folder')).toBe(`digistay/users/${user.id}`)
  })

  it('refuses what is not a photo before sending anything, and says when no storage is set up', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const html = `data:image/png;base64,${Buffer.from('<html><script>alert(1)</script></html>').toString('base64')}`
    expect((await upload(json('/api/upload', 'POST', { base64: html, propertyId: property.id }))).status).toBe(400)
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}`
    expect((await upload(json('/api/upload', 'POST', { base64: svg, propertyId: property.id }))).status).toBe(400)
    expect(uploads).toHaveLength(0)

    process.env.CLOUDINARY_API_SECRET = 'CHANGE_ME'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await upload(json('/api/upload', 'POST', { base64: PNG, propertyId: property.id }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('Chưa cấu hình nơi lưu ảnh')
    expect(uploads).toHaveLength(0)
  })
})

describe('PATCH /api/users/me/avatar', () => {
  it("stores the photo and makes it the user's avatar (a URL, never the file)", async () => {
    const user = await createUser()
    signInAs(user)
    const res = await avatar(json('/api/users/me/avatar', 'PATCH', { base64: PNG }))
    expect(res.status).toBe(200)
    const { image } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { image: true } })
    expect(image).toBe(`https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/digistay/users/${user.id}/photo1.png`)
  })
})

describe('photo URLs that are stored', () => {
  it('property photos: https only (no data: or javascript:)', async () => {
    const { owner, property } = await createTenant()
    signInAs(owner)
    const add = (url: string) => addPropertyImage(json(`/api/properties/${property.id}/images`, 'POST', { url }), params({ id: property.id }))
    expect((await add('data:image/png;base64,AAAA')).status).toBe(400)
    expect((await add('javascript:alert(1)')).status).toBe(400)
    expect((await add('https://images.example.com/lobby.jpg')).status).toBe(200)
  })
})

describe("a room type's photos", () => {
  it('add (the first is the main one), make another main, delete the main one: the next takes over', async () => {
    const { owner, property } = await createTenant()
    const roomType = await createRoomType(property.id)
    signInAs(owner)
    const p = params({ id: property.id, roomTypeId: roomType.id })
    const base = `/api/properties/${property.id}/room-types/${roomType.id}/images`

    const first = await (await addRoomPhoto(json(base, 'POST', { url: 'https://images.example.com/r1.jpg' }), p)).json()
    const second = await (await addRoomPhoto(json(base, 'POST', { url: 'https://images.example.com/r2.jpg', alt: 'Ban công' }), p)).json()
    expect(first.data.map((i: { isPrimary: boolean }) => i.isPrimary)).toEqual([true])
    expect(second.data.map((i: { url: string; isPrimary: boolean }) => [i.url, i.isPrimary])).toEqual([
      ['https://images.example.com/r1.jpg', true],
      ['https://images.example.com/r2.jpg', false],
    ])

    const r2 = second.data[1].id
    const switched = await (await mainRoomPhoto(json(base, 'PATCH', { imageId: r2 }), p)).json()
    expect(switched.data[0]).toMatchObject({ id: r2, isPrimary: true })
    expect(switched.data.filter((i: { isPrimary: boolean }) => i.isPrimary)).toHaveLength(1)

    const left = await (await deleteRoomPhoto(new NextRequest(`http://localhost${base}?imageId=${r2}`, { method: 'DELETE' }), p)).json()
    expect(left.data).toEqual([expect.objectContaining({ url: 'https://images.example.com/r1.jpg', isPrimary: true })])

    expect((await addRoomPhoto(json(base, 'POST', { url: 'data:image/png;base64,AAAA' }), p)).status).toBe(400)
  })

  it('who manages room types only (managers, not receptionists); never another property’s room type', async () => {
    const tenant = await createTenant({ memberRole: 'MANAGER' })
    const roomType = await createRoomType(tenant.property.id)
    const base = `/api/properties/${tenant.property.id}/room-types/${roomType.id}/images`
    signInAs(tenant.member!)
    expect((await addRoomPhoto(json(base, 'POST', { url: 'https://images.example.com/r.jpg' }), params({ id: tenant.property.id, roomTypeId: roomType.id }))).status).toBe(200)
    await prisma.roomTypeImage.deleteMany()

    const desk = await createTenant({ memberRole: 'RECEPTIONIST' })
    const deskRoomType = await createRoomType(desk.property.id)
    signInAs(desk.member!)
    expect((await addRoomPhoto(json(base, 'POST', { url: 'https://images.example.com/r.jpg' }), params({ id: desk.property.id, roomTypeId: deskRoomType.id }))).status).toBe(403)

    const other = await createTenant()
    signInAs(other.owner)
    // Their own property id in the path, someone else's room type.
    expect((await addRoomPhoto(json(base, 'POST', { url: 'https://images.example.com/r.jpg' }), params({ id: other.property.id, roomTypeId: roomType.id }))).status).toBe(404)
    expect(await prisma.roomTypeImage.count()).toBe(0)
  })
})
