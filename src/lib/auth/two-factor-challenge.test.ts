import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { issueChallenge, readChallenge } from './two-factor-challenge'

const originalSecret = process.env.NEXTAUTH_SECRET
const NOW = 1_800_000_000_000

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-for-challenges'
})
afterAll(() => {
  if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET
  else process.env.NEXTAUTH_SECRET = originalSecret
})

describe('two-factor challenge', () => {
  it('round-trips the user and how the first factor was given', () => {
    expect(readChallenge(issueChallenge('user_1', 'password', NOW), NOW)).toEqual({
      userId: 'user_1',
      method: 'password',
      issuedAt: NOW,
    })
    expect(readChallenge(issueChallenge('user_1', 'google', NOW), NOW)?.method).toBe('google')
  })

  it('expires after 5 minutes and refuses one issued in the future', () => {
    const token = issueChallenge('user_1', 'password', NOW)
    expect(readChallenge(token, NOW + 5 * 60 * 1000)).not.toBeNull()
    expect(readChallenge(token, NOW + 5 * 60 * 1000 + 1)).toBeNull()
    expect(readChallenge(issueChallenge('user_1', 'password', NOW + 2 * 60 * 1000), NOW)).toBeNull()
  })

  it('refuses a changed payload, a foreign signature and malformed input', () => {
    const [prefix, , signature] = issueChallenge('user_1', 'password', NOW).split('.')
    const otherUser = Buffer.from(JSON.stringify({ u: 'user_2', m: 'password', iat: NOW })).toString('base64url')
    expect(readChallenge(`${prefix}.${otherUser}.${signature}`, NOW)).toBeNull()

    const token = issueChallenge('user_1', 'password', NOW)
    process.env.NEXTAUTH_SECRET = 'a-different-deployment-secret'
    expect(readChallenge(token, NOW)).toBeNull()

    for (const bad of [undefined, 42, '', 'tfc1', `x${token}`, `${token}.extra`, token.replace('tfc1', 'tfc2')]) {
      expect(readChallenge(bad, NOW)).toBeNull()
    }
  })
})
