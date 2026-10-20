/**
 * OAuth tokens never reach Postgres (Part 4e): the adapter strips them, and
 * migration 20261019170000_clear_oauth_tokens clears the ones stored before.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/db'
import { createUser, resetDatabase } from '@/test/integration/fixtures'
import { createAuthAdapter } from './adapter'

const TOKENS = { access_token: 'ya29.access', refresh_token: '1//refresh', id_token: 'eyJ.id.token' }

beforeEach(() => resetDatabase())
afterAll(() => prisma.$disconnect())

describe('OAuth tokens in accounts (Postgres)', () => {
  it('links a Google account without its tokens', async () => {
    const user = await createUser()
    await createAuthAdapter(prisma).linkAccount({
      userId: user.id,
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'google-sub-1',
      ...TOKENS,
      expires_at: 1_800_000_000,
      token_type: 'bearer',
      scope: 'openid email profile',
    })

    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } })
    expect(account).toMatchObject({
      provider: 'google',
      providerAccountId: 'google-sub-1',
      access_token: null,
      refresh_token: null,
      id_token: null,
    })
  })

  it('the migration clears tokens stored before it', async () => {
    const user = await createUser()
    await prisma.account.create({
      data: { userId: user.id, type: 'oauth', provider: 'google', providerAccountId: 'old', ...TOKENS },
    })

    const sql = readFileSync(
      path.join(process.cwd(), 'prisma/migrations/20261019170000_clear_oauth_tokens/migration.sql'),
      'utf8'
    )
    await prisma.$executeRawUnsafe(sql)

    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } })
    expect(account).toMatchObject({ access_token: null, refresh_token: null, id_token: null, providerAccountId: 'old' })
  })
})
