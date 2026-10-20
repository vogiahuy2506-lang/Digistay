/**
 * Checks behind /api/health beyond "the database answers":
 *
 * - Schema: every migration shipped with this build (prisma/migrations in
 *   the image) is applied. 20/10/2026 the site ran for hours on a database
 *   that answered SELECT 1 but had no tables, and the health check said ok.
 *   Extra applied migrations are fine: after a rollback the older code runs
 *   on the newer schema (CLAUDE.md, Migration).
 * - Redis: reported, never fatal. The app degrades without it (rate limits
 *   fail open) and a redeploy would not bring it back.
 */
import { readdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/db/redis'

const DEFAULT_DIR = path.join(process.cwd(), 'prisma', 'migrations')
// Applied migrations are never un-applied: once complete, stop asking.
let schemaComplete = false

/** Migration folders shipped with this build, or null when there are none to compare. */
async function shippedMigrations(dir: string) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const names = entries.filter((e) => e.isDirectory()).map((e) => e.name)
    return names.length > 0 ? names : null
  } catch {
    return null
  }
}

/**
 * The shipped migrations the database has not applied (all of them on an
 * empty database); [] when complete; null when the build carries no
 * migrations folder to compare with.
 */
export async function missingMigrations(dir = DEFAULT_DIR): Promise<string[] | null> {
  const useCache = dir === DEFAULT_DIR
  if (useCache && schemaComplete) return []
  const shipped = await shippedMigrations(dir)
  if (!shipped) return null

  const [{ present }] = await prisma.$queryRaw<{ present: boolean }[]>`
    SELECT to_regclass('_prisma_migrations') IS NOT NULL AS present`
  const applied = present
    ? new Set(
        (
          await prisma.$queryRaw<{ migration_name: string }[]>`
            SELECT migration_name FROM _prisma_migrations
            WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
        ).map((r) => r.migration_name)
      )
    : new Set<string>()
  const missing = shipped.filter((name) => !applied.has(name)).sort()
  if (useCache && missing.length === 0) schemaComplete = true
  return missing
}

export async function redisState(timeoutMs = 1000): Promise<'ok' | 'down'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
      }),
    ])
    return pong === 'PONG' ? 'ok' : 'down'
  } catch {
    return 'down'
  } finally {
    clearTimeout(timer)
  }
}
