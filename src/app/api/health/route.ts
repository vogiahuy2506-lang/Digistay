import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { assertKeysConfigured } from '@/lib/security/secret-box'
import { missingMigrations, redisState } from '@/lib/ops/health-checks'

// Must run on every request: a statically rendered health check would
// report the build-time result forever.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET /api/health — public, for deploys and uptime checks.
 *
 * `version` is the git SHA baked into the image (APP_VERSION build arg), so
 * docker/deploy.sh can confirm the NEW container is the one answering.
 * A missing or malformed DATA_ENCRYPTION_KEYS also fails it, so that deploy
 * rolls back instead of locking out two-factor users; so does a database
 * missing a migration of this build (src/lib/ops/health-checks.ts). The
 * reason is logged. Errors are never detailed here: this endpoint is public.
 * `redis` is reported for uptime checks but never fails it.
 */
export async function GET() {
  const version = process.env.APP_VERSION || 'dev'
  try {
    await prisma.$queryRaw`SELECT 1`
    assertKeysConfigured()
    const missing = await missingMigrations()
    if (missing?.length) {
      throw new Error(`the database lacks ${missing.length} migration(s) of this build, e.g. ${missing[0]}`)
    }
    return NextResponse.json({ status: 'ok', version, redis: await redisState() }, { headers: NO_STORE })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({ status: 'error', version }, { status: 503, headers: NO_STORE })
  }
}
