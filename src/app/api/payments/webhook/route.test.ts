/**
 * The VietQR webhook is disabled: POST always 404s and PUT no longer exists.
 * If someone re-enables this route without a signature check, this fails.
 */
import { describe, it, expect } from 'vitest'
import * as route from './route'

describe('POST /api/payments/webhook (disabled)', () => {
  it('returns 404 for a forged "payment.success" payload', async () => {
    const res = await route.POST()
    expect(res.status).toBe(404)
  })

  it('no longer exports PUT (unauthenticated mark-as-PAID)', () => {
    expect('PUT' in route).toBe(false)
  })

  it('exports only POST', () => {
    expect(Object.keys(route)).toEqual(['POST'])
  })
})
