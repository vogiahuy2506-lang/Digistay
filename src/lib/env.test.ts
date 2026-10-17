/**
 * Tests for the zod-backed env loader.
 *
 * The env module reads `process.env` at import time, so we can only
 * load it once per test. To exercise the failure path we use
 * `vi.resetModules()` + a tweaked `process.env` to force a re-import.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalEnv = { ...process.env }

function setRequiredEnv() {
  const env = process.env as Record<string, string | undefined>
  env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
  env.NEXTAUTH_URL = 'http://localhost:3000'
  env.NEXTAUTH_SECRET = 'a'.repeat(32)
  env.NODE_ENV = 'test'
}

beforeEach(() => {
  // Restore a clean env before each test, then re-apply required keys.
  // Cast to `any` because TS treats `process.env.NODE_ENV` as readonly
  // and the test intentionally mutates it.
  ;(process.env as Record<string, string | undefined>) = {
    ...originalEnv as Record<string, string | undefined>,
  }
  setRequiredEnv()
  vi.resetModules()
})

afterEach(() => {
  ;(process.env as Record<string, string | undefined>) = originalEnv as Record<string, string | undefined>
  vi.resetModules()
})

describe('env validation', () => {
  it('parses a complete env successfully', async () => {
    const { env } = await import('./env')
    expect(env.DATABASE_URL).toBe(process.env.DATABASE_URL)
    expect(env.NEXTAUTH_URL).toBe('http://localhost:3000')
    expect(env.NODE_ENV).toBe('test')
  })

  it('throws when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL
    await expect(import('./env')).rejects.toThrow(
      /Environment validation failed/
    )
  })

  it('throws when NEXTAUTH_SECRET is shorter than 16 chars', async () => {
    process.env.NEXTAUTH_SECRET = 'short'
    await expect(import('./env')).rejects.toThrow(
      /NEXTAUTH_SECRET must be at least 16 characters/
    )
  })

  it('throws when NEXTAUTH_URL is not a valid URL', async () => {
    process.env.NEXTAUTH_URL = 'not-a-url'
    await expect(import('./env')).rejects.toThrow(
      /NEXTAUTH_URL must be a valid URL/
    )
  })

  it('rejects an unknown NODE_ENV value', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'staging'
    await expect(import('./env')).rejects.toThrow()
  })

  it('treats REDIS_URL as optional and leaves it undefined when absent', async () => {
    delete process.env.REDIS_URL
    const { env } = await import('./env')
    expect(env.REDIS_URL).toBeUndefined()
  })
})
