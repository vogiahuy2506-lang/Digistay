/**
 * NextAuth's Prisma adapter without the OAuth tokens (Part 4e). Google is
 * only used to sign in; the app never calls a Google API, so the access,
 * refresh and ID tokens the adapter would keep in `accounts` are unused
 * data that could only leak. next-auth v4 writes them in linkAccount and
 * never updates an existing account, so stripping them here is enough.
 */
import { PrismaAdapter } from '@auth/prisma-adapter'
import type { PrismaClient } from '@prisma/client'

export const OAUTH_TOKEN_FIELDS = ['access_token', 'refresh_token', 'id_token'] as const

export function createAuthAdapter(prisma: PrismaClient) {
  const adapter = PrismaAdapter(prisma)
  const linkAccount = adapter.linkAccount!
  return {
    ...adapter,
    linkAccount(account: Parameters<typeof linkAccount>[0]) {
      const stored = { ...account }
      for (const field of OAUTH_TOKEN_FIELDS) delete stored[field]
      return linkAccount(stored)
    },
  }
}
