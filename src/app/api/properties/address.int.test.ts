/**
 * A property's province and ward (src/lib/vn-admin) through the API, against
 * real Postgres: created and edited with the pickers' codes, a ward of
 * another province refused, and rows saved before July 2025 (a merged
 * province, a district) still shown and editable.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { loadSiteProps } from '@/lib/public-site/site'
import { formatAddress } from '@/lib/vn-admin/address'
import { createTenant, resetDatabase } from '@/test/integration/fixtures'
import { POST as createProperty } from './route'
import { PATCH as patchProperty } from './[id]/route'

const signInAs = (user: { id: string; email: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: user.id, email: user.email } } as never)

let seq = 0
const create = (workspaceId: string, place: Record<string, unknown>) => {
  seq += 1
  return createProperty(
    new NextRequest('http://digistay.test/api/properties', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        name: `Khách sạn ${Date.now()} ${seq}`,
        type: 'HOTEL',
        address: '12 Lý Thái Tổ',
        subdomain: `ks-${Date.now()}-${seq}`,
        ...place,
      }),
    })
  )
}

const patch = (id: string, body: Record<string, unknown>) =>
  patchProperty(new NextRequest(`http://digistay.test/api/properties/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  })

const place = (id: string) =>
  prisma.property.findUniqueOrThrow({
    where: { id },
    select: { address: true, city: true, ward: true, district: true, provinceCode: true, wardCode: true },
  })

beforeEach(async () => {
  await resetDatabase()
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/properties: province and ward', () => {
  it('saves the names and codes of a province and one of its wards', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const res = await create(t.workspace.id, { provinceCode: '01', wardCode: '00070', district: 'Quận Hoàn Kiếm' })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(await place(data.id)).toEqual({
      address: '12 Lý Thái Tổ',
      city: 'Hà Nội',
      ward: 'Phường Hoàn Kiếm',
      // Not taken from the client any more.
      district: null,
      provinceCode: '01',
      wardCode: '00070',
    })
  })

  it('refuses a ward of another province, and creates nothing', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    // 00070 is Phường Hoàn Kiếm, Hà Nội.
    const res = await create(t.workspace.id, { provinceCode: '79', wardCode: '00070' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Phường/xã không thuộc tỉnh/thành phố đã chọn')
    expect(await prisma.property.count({ where: { workspaceId: t.workspace.id } })).toBe(1)
  })

  it('needs one of the 34 provinces', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    for (const body of [{}, { provinceCode: '' }, { provinceCode: '99' }, { city: 'Bình Dương' }]) {
      const res = await create(t.workspace.id, body)
      expect(res.status).toBe(400)
    }
    expect(await prisma.property.count({ where: { workspaceId: t.workspace.id } })).toBe(1)
  })

  it('still takes a province by name from callers without codes', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    const res = await create(t.workspace.id, { city: 'Hue' })
    expect(res.status).toBe(200)
    expect(await place((await res.json()).data.id)).toMatchObject({ city: 'Huế', provinceCode: '46', ward: null })
  })
})

describe('PATCH /api/properties/[id]: province and ward', () => {
  /** A row saved before July 2025: a province merged since, and a district. */
  async function oldRow() {
    const t = await createTenant()
    await prisma.property.update({
      where: { id: t.property.id },
      data: { address: '5 Lê Lợi', city: 'Bình Dương', district: 'Thành phố Dĩ An', ward: null },
    })
    signInAs(t.owner)
    return t
  }

  it('keeps an old address untouched when the form leaves the place alone, and still shows it', async () => {
    const t = await oldRow()
    const res = await patch(t.property.id, { phone: '0901 234 567' })
    expect(res.status).toBe(200)
    expect(await place(t.property.id)).toMatchObject({ city: 'Bình Dương', district: 'Thành phố Dĩ An', ward: null, provinceCode: null })
    // The hotel's site shows street, district (no ward yet), province.
    const site = await loadSiteProps(t.property.id)
    expect(formatAddress(site!.property)).toBe('5 Lê Lợi, Thành phố Dĩ An, Bình Dương')
  })

  it('moves an old address to its new province and ward, dropping the district', async () => {
    const t = await oldRow()
    // Dĩ An is a ward of Hồ Chí Minh since July 2025.
    const res = await patch(t.property.id, { provinceCode: '79', wardCode: '25942' })
    expect(res.status).toBe(200)
    expect(await place(t.property.id)).toEqual({
      address: '5 Lê Lợi',
      city: 'Hồ Chí Minh',
      ward: 'Phường Dĩ An',
      district: null,
      provinceCode: '79',
      wardCode: '25942',
    })
    const site = await loadSiteProps(t.property.id)
    expect(formatAddress(site!.property)).toBe('5 Lê Lợi, Phường Dĩ An, Hồ Chí Minh')
  })

  it('refuses a ward of another province and changes nothing', async () => {
    const t = await oldRow()
    const res = await patch(t.property.id, { provinceCode: '48', wardCode: '25942', phone: '0909' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Phường/xã không thuộc tỉnh/thành phố đã chọn')
    expect(await prisma.property.findUniqueOrThrow({ where: { id: t.property.id } })).toMatchObject({
      city: 'Bình Dương',
      district: 'Thành phố Dĩ An',
      phone: null,
    })
  })

  it("keeps a district while the province stays and no ward is chosen; drops it when the province changes", async () => {
    const t = await createTenant()
    await prisma.property.update({ where: { id: t.property.id }, data: { city: 'Hà Nội', district: 'Quận Hoàn Kiếm' } })
    signInAs(t.owner)
    expect((await patch(t.property.id, { provinceCode: '01', wardCode: null })).status).toBe(200)
    expect(await place(t.property.id)).toMatchObject({ city: 'Hà Nội', provinceCode: '01', district: 'Quận Hoàn Kiếm', ward: null })
    expect((await patch(t.property.id, { provinceCode: '48' })).status).toBe(200)
    expect(await place(t.property.id)).toMatchObject({ city: 'Đà Nẵng', provinceCode: '48', district: null, ward: null })
  })

  it('clears the ward with the province kept', async () => {
    const t = await createTenant()
    signInAs(t.owner)
    expect((await patch(t.property.id, { provinceCode: '48', wardCode: '20410' })).status).toBe(200)
    expect(await place(t.property.id)).toMatchObject({ city: 'Đà Nẵng', ward: 'Phường Hội An', wardCode: '20410' })
    expect((await patch(t.property.id, { provinceCode: '48', wardCode: null })).status).toBe(200)
    expect(await place(t.property.id)).toMatchObject({ city: 'Đà Nẵng', ward: null, wardCode: null })
  })
})
