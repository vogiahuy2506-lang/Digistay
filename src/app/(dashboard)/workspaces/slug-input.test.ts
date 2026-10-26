import { describe, it, expect } from 'vitest'
import { cleanSlugInput, finishSlugInput, onNameTyped, onSlugTyped, slugFromName, type SlugState } from './slug-input'

/** Types `text` into the name field one character at a time, as a person does. */
function typeName(text: string, start: SlugState, max = 50): SlugState {
  let state = start
  for (let i = 1; i <= text.length; i++) state = onNameTyped(text.slice(0, i), state, max)
  return state
}

describe('slugFromName', () => {
  it('reads Vietnamese letters, đ and Đ included', () => {
    expect(slugFromName('Khách sạn Đồi Thông', 50)).toBe('khach-san-doi-thong')
    expect(slugFromName('QA Homestay Đà Lạt', 50)).toBe('qa-homestay-da-lat')
    expect(slugFromName('Nhà nghỉ đường Ngô Quyền', 50)).toBe('nha-nghi-duong-ngo-quyen')
  })

  it('cuts to the limit without a dash at the end', () => {
    expect(slugFromName('Khách sạn Đồi Thông', 10)).toBe('khach-san')
  })
})

describe('the slug following the name', () => {
  it('follows every key typed in the name, not only the first one', () => {
    expect(typeName('Khách sạn Đồi Thông', { slug: '', slugEdited: false })).toEqual({
      slug: 'khach-san-doi-thong',
      slugEdited: false,
    })
  })

  it('stops following once the slug is edited, and follows again when it is emptied', () => {
    let state = typeName('Đồi Thông', { slug: '', slugEdited: false })
    state = onSlugTyped('doi-thong-da-lat', 50)
    expect(typeName('Khách sạn Đồi Thông', state)).toEqual({ slug: 'doi-thong-da-lat', slugEdited: true })

    state = onSlugTyped('', 50)
    expect(typeName('Khách sạn Đồi Thông', state).slug).toBe('khach-san-doi-thong')
  })

  it('returns only the slug keys, so spreading it over a form keeps the new name', () => {
    const form = { name: 'Tên cũ', slug: 'ten-cu', slugEdited: true }
    expect({ ...form, name: 'Tên mới', ...onNameTyped('Tên mới', form, 50) }).toEqual({
      name: 'Tên mới',
      slug: 'ten-cu',
      slugEdited: true,
    })
  })
})

describe('cleanSlugInput', () => {
  it('keeps a dash being typed, so "an-nam" can be typed letter by letter', () => {
    let value = ''
    for (const key of 'an-nam') value = cleanSlugInput(value + key, 50)
    expect(value).toBe('an-nam')
  })

  it('turns accents, đ, spaces and capitals into a valid slug', () => {
    expect(cleanSlugInput('Đồi Thông  Hotel', 50)).toBe('doi-thong-hotel')
    expect(cleanSlugInput('--abc', 50)).toBe('abc')
    expect(cleanSlugInput('abcdef', 3)).toBe('abc')
  })

  it('drops the dashes at the ends before sending', () => {
    expect(finishSlugInput('an-nam-')).toBe('an-nam')
  })
})
