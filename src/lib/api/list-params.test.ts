import { describe, it, expect } from 'vitest'
import { MAX_PAGE_SIZE, dayParam, enumParam, pageParams, paginationOf, searchParam } from './list-params'

const qs = (s: string) => new URLSearchParams(s)

describe('list parameters', () => {
  it('pages: defaults, a capped size, nonsense falls back', () => {
    expect(pageParams(qs(''))).toEqual({ page: 1, limit: 50, skip: 0 })
    expect(pageParams(qs('page=3&limit=20'))).toEqual({ page: 3, limit: 20, skip: 40 })
    expect(pageParams(qs('limit=100000')).limit).toBe(MAX_PAGE_SIZE)
    expect(pageParams(qs('page=-2&limit=abc'))).toEqual({ page: 1, limit: 50, skip: 0 })
    expect(paginationOf(2, 20, 41)).toEqual({ page: 2, limit: 20, total: 41, totalPages: 3 })
    expect(paginationOf(1, 20, 0).totalPages).toBe(1)
  })

  it('enums: absent, valid, invalid', () => {
    const allowed = ['PAID', 'PENDING'] as const
    expect(enumParam(null, allowed)).toBeUndefined()
    expect(enumParam('PAID', allowed)).toBe('PAID')
    expect(enumParam('paid; DROP', allowed)).toBeNull()
  })

  it('days are whole days in Vietnam time', () => {
    expect(dayParam('2026-10-20', 'from')!.toISOString()).toBe('2026-10-19T17:00:00.000Z')
    expect(dayParam('2026-10-20', 'to')!.toISOString()).toBe('2026-10-20T16:59:59.999Z')
    expect(dayParam(null, 'from')).toBeUndefined()
    expect(dayParam('20/10/2026', 'from')).toBeNull()
    expect(dayParam('2026-13-45', 'to')).toBeNull()
  })

  it('search is trimmed and bounded', () => {
    expect(searchParam(qs('q=%20%20DS123%20'))).toBe('DS123')
    expect(searchParam(qs(`q=${'x'.repeat(500)}`))).toHaveLength(100)
  })
})
