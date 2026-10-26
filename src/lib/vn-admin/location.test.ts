/**
 * A property's province and ward as the API takes them (POST /api/properties,
 * PATCH /api/properties/[id]); the routes themselves run against Postgres in
 * src/app/api/properties/address.int.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { createPropertySchema, updatePropertySchema } from '@/lib/validations'
import { locationColumns, resolveLocation } from './location'

describe('resolveLocation', () => {
  it('takes a province and one of its wards by code, with their names', () => {
    expect(resolveLocation({ provinceCode: '01', wardCode: '00004' })).toEqual({
      ok: true,
      location: { city: 'Hà Nội', provinceCode: '01', ward: 'Phường Ba Đình', wardCode: '00004' },
    })
  })

  it('refuses a ward of another province', () => {
    // 00004 is Phường Ba Đình, Hà Nội.
    expect(resolveLocation({ provinceCode: '79', wardCode: '00004' })).toEqual({
      ok: false,
      error: 'Phường/xã không thuộc tỉnh/thành phố đã chọn',
    })
  })

  it('refuses an unknown province and asks for a missing one', () => {
    expect(resolveLocation({ provinceCode: '99' })).toEqual({ ok: false, error: 'Tỉnh/thành phố không có trong danh sách' })
    expect(resolveLocation({ provinceCode: '' })).toEqual({ ok: false, error: 'Vui lòng chọn tỉnh/thành phố' })
    expect(resolveLocation({ city: '  ' })).toEqual({ ok: false, error: 'Vui lòng chọn tỉnh/thành phố' })
  })

  it('takes a province by name, but only one of the 34', () => {
    expect(resolveLocation({ city: 'Hue' })).toEqual({
      ok: true,
      location: { city: 'Huế', provinceCode: '46', ward: null, wardCode: null },
    })
    expect(resolveLocation({ city: 'Bình Dương' })).toEqual({ ok: false, error: 'Tỉnh/thành phố không có trong danh sách' })
    // The code wins over a name sent with it.
    expect(resolveLocation({ provinceCode: '48', city: 'Hà Nội' })).toMatchObject({ location: { city: 'Đà Nẵng' } })
  })

  it('leaves the location alone when none is sent, and needs the province with a ward', () => {
    expect(resolveLocation({})).toEqual({ ok: true, location: null })
    expect(resolveLocation({ wardCode: '00004' })).toEqual({ ok: false, error: 'Vui lòng chọn tỉnh/thành phố' })
    expect(resolveLocation({ wardCode: null })).toEqual({ ok: false, error: 'Vui lòng chọn tỉnh/thành phố' })
  })

  it('takes no ward as none', () => {
    for (const wardCode of [null, '', undefined]) {
      expect(resolveLocation({ provinceCode: '01', wardCode })).toMatchObject({ location: { ward: null, wardCode: null } })
    }
  })
})

describe('locationColumns', () => {
  const hanoi = { city: 'Hà Nội', provinceCode: '01', ward: null, wardCode: null }
  const baDinh = { ...hanoi, ward: 'Phường Ba Đình', wardCode: '00004' }

  it("keeps an older row's district while the province stays and no ward replaces it", () => {
    expect(locationColumns(hanoi, { city: 'Hà Nội', provinceCode: null })).toEqual(hanoi)
    expect(locationColumns(hanoi, { city: 'Thành phố Hà Nội', provinceCode: '01' })).toEqual(hanoi)
  })

  it('drops the district once a ward is chosen or the province changes', () => {
    expect(locationColumns(baDinh, { city: 'Hà Nội', provinceCode: null })).toEqual({ ...baDinh, district: null })
    expect(locationColumns(hanoi, { city: 'Bình Dương', provinceCode: null })).toEqual({ ...hanoi, district: null })
    expect(locationColumns(hanoi)).toEqual({ ...hanoi, district: null })
  })
})

describe('the property schemas', () => {
  const base = { name: 'Khách sạn Sen', type: 'HOTEL', address: '12 Lê Lợi', subdomain: 'khach-san-sen' }

  it('take the codes and never a district or a ward name from the client', () => {
    const parsed = createPropertySchema.parse({ ...base, provinceCode: '01', wardCode: '00004', district: 'Quận 1', ward: 'Phường X' })
    expect(parsed).toMatchObject({ provinceCode: '01', wardCode: '00004' })
    expect(parsed).not.toHaveProperty('district')
    expect(parsed).not.toHaveProperty('ward')
    expect(updatePropertySchema.parse({ wardCode: null })).toEqual({ wardCode: null })
  })
})
