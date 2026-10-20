import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createAuthAdapter, OAUTH_TOKEN_FIELDS } from './adapter'

describe('createAuthAdapter', () => {
  it('links the account without storing OAuth tokens', async () => {
    const create = vi.fn(async ({ data }) => data)
    const adapter = createAuthAdapter({ account: { create } } as unknown as PrismaClient)

    await adapter.linkAccount({
      userId: 'user_1',
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'google-sub-1',
      access_token: 'ya29.access',
      refresh_token: '1//refresh',
      id_token: 'eyJ.id.token',
      expires_at: 1_800_000_000,
      token_type: 'bearer',
      scope: 'openid email profile',
    })

    const data = create.mock.calls[0][0].data
    for (const field of OAUTH_TOKEN_FIELDS) expect(data).not.toHaveProperty(field)
    expect(data).toMatchObject({ userId: 'user_1', provider: 'google', providerAccountId: 'google-sub-1' })
  })
})
