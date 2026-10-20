/**
 * Wiring of two-factor sign-in into next-auth (Part 4f): the logic is
 * tested in two-factor.int.test.ts; this checks that authOptions calls it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  user: { id: 'user_1', email: 'a@example.com', name: 'A', image: null, role: 'USER' },
  authorizeWithPassword: vi.fn(),
  requireSecondFactorIfEnabled: vi.fn(),
  authorizeWithSecondFactor: vi.fn(),
  googleSignInGate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('./session-revocation', () => ({ isSessionRevoked: vi.fn(), SessionRevokedError: class extends Error {} }))
vi.mock('./credentials', () => ({ authorizeWithPassword: h.authorizeWithPassword }))
vi.mock('./two-factor', () => ({ requireSecondFactorIfEnabled: h.requireSecondFactorIfEnabled }))
vi.mock('./two-factor-login', () => ({
  authorizeWithSecondFactor: h.authorizeWithSecondFactor,
  googleSignInGate: h.googleSignInGate,
}))

import { authOptions } from './index'

type Authorize = (credentials: Record<string, string>, req: { headers: Record<string, string> }) => Promise<unknown>
// A custom id lives in .options until next-auth merges it at runtime.
function provider(id: string) {
  const found = authOptions.providers.find(
    (p) => ((p as { options?: { id?: string } }).options?.id ?? p.id) === id
  ) as unknown as { options: { authorize: Authorize } }
  expect(found).toBeDefined()
  return found.options.authorize
}
const signIn = authOptions.callbacks!.signIn! as unknown as (args: object) => Promise<unknown>

beforeEach(() => {
  vi.clearAllMocks()
  h.authorizeWithPassword.mockResolvedValue(h.user)
})

describe('authOptions and two-factor sign-in', () => {
  it('a right password still needs the second factor before a session', async () => {
    h.requireSecondFactorIfEnabled.mockRejectedValue(new Error('TWO_FACTOR_REQUIRED:tfc1.x.y'))
    await expect(provider('credentials')({ username: 'a', password: 'b' }, { headers: {} })).rejects.toThrow(
      'TWO_FACTOR_REQUIRED:'
    )
    expect(h.requireSecondFactorIfEnabled).toHaveBeenCalledWith('user_1', 'password')

    h.requireSecondFactorIfEnabled.mockResolvedValue(undefined)
    await expect(provider('credentials')({ username: 'a', password: 'b' }, { headers: {} })).resolves.toBe(h.user)
  })

  it('the two-factor provider signs in only through authorizeWithSecondFactor', async () => {
    h.authorizeWithSecondFactor.mockResolvedValue(h.user)
    const credentials = { challenge: 'tfc1.x.y', code: '123456' }
    await expect(provider('two-factor')(credentials, { headers: { 'x-real-ip': '1.2.3.4' } })).resolves.toBe(h.user)
    expect(h.authorizeWithSecondFactor).toHaveBeenCalledWith(credentials, { 'x-real-ip': '1.2.3.4' })
  })

  it('Google goes through the gate; other providers do not', async () => {
    h.googleSignInGate.mockResolvedValue('/login?twoFactor=tfc1.x.y')
    const account = { provider: 'google', providerAccountId: 'sub' }
    await expect(signIn({ user: { email: 'a@example.com' }, account })).resolves.toBe('/login?twoFactor=tfc1.x.y')
    expect(h.googleSignInGate).toHaveBeenCalledWith(account, 'a@example.com')

    await expect(signIn({ user: h.user, account: { provider: 'two-factor' } })).resolves.toBe(true)
    expect(h.googleSignInGate).toHaveBeenCalledTimes(1)
  })
})
