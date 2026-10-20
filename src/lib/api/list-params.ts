/**
 * Query parameters of list endpoints: a capped page size (a client asking
 * for limit=100000 must not load a table), enums and dates that are
 * refused with a 400 instead of reaching Prisma and coming back as a 500.
 */
import { NextResponse } from 'next/server'

export const MAX_PAGE_SIZE = 100

function positiveInt(value: string | null, fallback: number) {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function pageParams(params: URLSearchParams, defaultLimit = 50) {
  const page = positiveInt(params.get('page'), 1)
  const limit = Math.min(positiveInt(params.get('limit'), defaultLimit), MAX_PAGE_SIZE)
  return { page, limit, skip: (page - 1) * limit }
}

export const paginationOf = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
})

/** The value if it is one of `allowed`; undefined when absent; null when invalid. */
export function enumParam<T extends string>(value: string | null, allowed: readonly T[]): T | undefined | null {
  if (!value) return undefined
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/**
 * yyyy-mm-dd as a day in Vietnam time: `from` is its first instant, `to`
 * its last. undefined when absent; null when not a date.
 */
export function dayParam(value: string | null, edge: 'from' | 'to'): Date | undefined | null {
  if (!value) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T${edge === 'from' ? '00:00:00.000' : '23:59:59.999'}+07:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Search text: trimmed, at most 100 characters. */
export const searchParam = (params: URLSearchParams) => (params.get('q') ?? '').trim().slice(0, 100)

export const badParam = (message: string) => NextResponse.json({ success: false, error: message }, { status: 400 })
