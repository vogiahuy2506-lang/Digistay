import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import vi from '../../../messages/vi.json'
import en from '../../../messages/en.json'
import { registerSchema } from '@/lib/validations'
import { AUTH_ERROR_KEYS, LOGIN_ERRORS, TWO_FACTOR_ERRORS } from './error-messages'

const API = path.join(__dirname, '../../app/api/auth')

/** Every string literal an /api/auth route returns as `error: '…'` or tooManyRequests('…'). */
function routeMessages(): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'route.ts') files.push(full)
    }
  }
  walk(API)
  const found = new Set<string>()
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    for (const m of src.matchAll(/(?:^|[{,])\s*error:\s*(?:[\w.?]+\s*\|\|\s*)?'([^'\n]+)'/gm)) found.add(m[1])
    for (const m of src.matchAll(/tooManyRequests\(\s*'([^'\n]+)'/g)) found.add(m[1])
  }
  return [...found]
}

const lookup = (tree: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree)

describe('auth error messages', () => {
  it('knows every message the /api/auth routes return', () => {
    const messages = routeMessages()
    expect(messages.length).toBeGreaterThan(10)
    expect(messages.filter((m) => !(m in AUTH_ERROR_KEYS))).toEqual([])
  })

  it('knows the sign-in and sign-up schema messages', () => {
    const parsed = registerSchema.safeParse({ name: 'a', username: 'a!', email: 'x', password: '1' })
    expect(parsed.success).toBe(false)
    const issues = parsed.success ? [] : parsed.error.errors.map((e) => e.message)
    issues.push(...Object.values(LOGIN_ERRORS), TWO_FACTOR_ERRORS.invalidCode, TWO_FACTOR_ERRORS.locked, TWO_FACTOR_ERRORS.expired)
    expect(issues.filter((m) => !(m in AUTH_ERROR_KEYS))).toEqual([])
  })

  it.each([['vi', vi], ['en', en]] as const)('%s has a text for every key', (_, messages) => {
    for (const key of new Set(Object.values(AUTH_ERROR_KEYS))) {
      expect(typeof lookup((messages as { auth: unknown }).auth, key), key).toBe('string')
    }
  })
})
