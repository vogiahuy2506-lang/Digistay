import { PrismaClient } from '@prisma/client'
import { hideDeleted } from './soft-delete'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaWithDeleted: PrismaClient | undefined
}

// Ensure the pooled URL has the params Neon pooler requires
// to avoid "Error { kind: Closed }" when the pooler drops idle sockets.
function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url
  // Only append if not already present
  const hasPgbouncer = /[?&]pgbouncer=/.test(url)
  if (hasPgbouncer) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}pgbouncer=true&connect_timeout=10&pool_timeout=10&socket_timeout=10`
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

function createPrismaClient() {
  return new PrismaClient({
    // Avoid "query" log in dev by default — it spams the terminal and is
    // responsible for most of the "Closed" warnings (we see them right
    // after every query). Set DEBUG_PRISMA=1 to re-enable.
    log:
      process.env.DEBUG_PRISMA === '1'
        ? ['query', 'error', 'warn']
        : process.env.NODE_ENV === 'production'
        ? ['error']
        : ['error', 'warn'],
    datasources: databaseUrl
      ? { db: { url: databaseUrl } }
      : undefined,
  })
}

/**
 * Sees soft-deleted properties and workspaces (src/lib/db/soft-delete.ts):
 * only for the deletion code itself and the checks that a subdomain, slug or
 * custom domain is free (they stay taken for the 30 days a restore is possible).
 */
export const prismaWithDeleted = globalForPrisma.prismaWithDeleted ?? createPrismaClient()

/**
 * The app's client: reads never see soft-deleted properties and workspaces, nor
 * what belongs to them. The extension only rewrites query arguments, so the
 * client keeps PrismaClient's type (and the extended one is what runs in
 * $transaction callbacks too).
 */
export const prisma = globalForPrisma.prisma ?? (prismaWithDeleted.$extends(hideDeleted) as unknown as PrismaClient)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaWithDeleted = prismaWithDeleted
  globalForPrisma.prisma = prisma
}

// Graceful shutdown so the dev server / serverless host can recycle the
// pool cleanly without leaving dangling connections that come back as
// "Closed" on the next request.
if (process.env.NODE_ENV !== 'production') {
  const shutdown = async (signal: string) => {
    try {
      // eslint-disable-next-line no-console
      console.log(`[prisma] received ${signal}, disconnecting...`)
      await prismaWithDeleted.$disconnect()
    } catch {
      // ignore
    }
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
}

export default prisma
