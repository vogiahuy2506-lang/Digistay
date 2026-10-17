import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
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
      await prisma.$disconnect()
    } catch {
      // ignore
    }
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
}

export default prisma
