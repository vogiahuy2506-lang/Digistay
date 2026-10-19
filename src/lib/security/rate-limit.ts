/**
 * Fixed-window abuse limits stored in Redis, so they survive restarts and
 * are shared by every app instance.
 *
 * Two kinds of counters:
 * - hit():            counts every request (e.g. "5 sign-ups per hour per IP").
 * - recordFailure():  counts only failures; isBlocked() checks it. Used where
 *                     legitimate repeats are normal (logins from one office).
 *
 * Fail-open: if Redis errors, the request is allowed and the error logged,
 * so a Redis outage does not lock every user out (decision 2026-10-19).
 *
 * Only apply these to specific endpoints. Founder AI once limited a whole
 * auth router, which counted session refreshes and logged out everyone
 * sharing an office IP.
 */
import { NextResponse } from 'next/server'
import { redis } from '@/lib/db/redis'

export interface Limit {
  /** Key namespace, e.g. 'login-ip'. */
  name: string
  limit: number
  windowSec: number
}

/** The subset of the ioredis client used here (a fake in tests). */
export interface LimitStore {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  get(key: string): Promise<string | null>
  del(key: string): Promise<number>
  ttl(key: string): Promise<number>
}

const defaultStore = redis as unknown as LimitStore

export interface LimitResult {
  allowed: boolean
  retryAfterSec: number
}

const ALLOW: LimitResult = { allowed: true, retryAfterSec: 0 }

/** Keys may contain emails/usernames: normalize and bound their length. */
function keyFor(limit: Limit, id: string): string {
  return `rl:${limit.name}:${id.trim().toLowerCase().slice(0, 200)}`
}

async function retryAfter(store: LimitStore, key: string, fallback: number): Promise<number> {
  const ttl = await store.ttl(key)
  return ttl > 0 ? ttl : fallback
}

async function increment(store: LimitStore, key: string, windowSec: number): Promise<number> {
  const count = await store.incr(key)
  if (count === 1) await store.expire(key, windowSec)
  return count
}

function failOpen(limit: Limit, error: unknown): LimitResult {
  console.error(`[rate-limit] ${limit.name}: Redis error, allowing request:`, error)
  return ALLOW
}

/** Counts this request; refuses it once the window's count exceeds the limit. */
export async function hit(limit: Limit, id: string, store: LimitStore = defaultStore): Promise<LimitResult> {
  try {
    const key = keyFor(limit, id)
    const count = await increment(store, key, limit.windowSec)
    if (count <= limit.limit) return ALLOW
    return { allowed: false, retryAfterSec: await retryAfter(store, key, limit.windowSec) }
  } catch (error) {
    return failOpen(limit, error)
  }
}

/** True once recordFailure() has been called `limit` times in the window. */
export async function isBlocked(limit: Limit, id: string, store: LimitStore = defaultStore): Promise<LimitResult> {
  try {
    const key = keyFor(limit, id)
    const count = Number((await store.get(key)) ?? 0)
    if (count < limit.limit) return ALLOW
    return { allowed: false, retryAfterSec: await retryAfter(store, key, limit.windowSec) }
  } catch (error) {
    return failOpen(limit, error)
  }
}

/** Records one failure; returns the count in the current window (0 on Redis error). */
export async function recordFailure(limit: Limit, id: string, store: LimitStore = defaultStore): Promise<number> {
  try {
    return await increment(store, keyFor(limit, id), limit.windowSec)
  } catch (error) {
    failOpen(limit, error)
    return 0
  }
}

export async function clearLimit(limit: Limit, id: string, store: LimitStore = defaultStore): Promise<void> {
  try {
    await store.del(keyFor(limit, id))
  } catch (error) {
    failOpen(limit, error)
  }
}

/** Standard 429 response with Retry-After. */
export function tooManyRequests(message: string, retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { success: false, error: message, retryAfterSec },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSec)) } }
  )
}
