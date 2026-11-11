import { prisma } from '@/lib/db'

/**
 * Checks if an IP address is currently active in the blacklist.
 */
export async function isIpBlacklisted(ip: string): Promise<boolean> {
  if (!ip) return false

  try {
    const row = await prisma.ipBlacklist.findUnique({
      where: { ipAddress: ip },
      select: { isActive: true, expiresAt: true },
    })

    if (!row || !row.isActive) return false

    // Check expiration if set
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      return false
    }

    return true
  } catch {
    // Fail open in case of DB glitch
    return false
  }
}

/**
 * Records an attempt or violation for an IP.
 */
export async function recordIpViolation(ip: string, reason: string): Promise<void> {
  if (!ip) return

  try {
    await prisma.ipBlacklist.upsert({
      where: { ipAddress: ip },
      create: {
        ipAddress: ip,
        reason,
        attemptCount: 1,
        isActive: true,
      },
      update: {
        attemptCount: { increment: 1 },
        reason,
        isActive: true,
      },
    })
  } catch {
    // Non-fatal
  }
}

/**
 * Checks if a subdomain is reserved in database.
 */
export async function isCustomReservedSubdomain(subdomain: string): Promise<boolean> {
  if (!subdomain) return false

  try {
    const row = await prisma.reservedSubdomain.findUnique({
      where: { subdomain: subdomain.toLowerCase() },
      select: { id: true },
    })
    return !!row
  } catch {
    return false
  }
}
