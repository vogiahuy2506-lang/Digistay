import { describe, it, expect } from 'vitest'
import { RECOVERY_CODE_COUNT, generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from './recovery-codes'

describe('recovery codes', () => {
  it('generates distinct XXXX-XXXX-XXXX codes without look-alike characters', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
  })

  it('accepts the code however it is typed', () => {
    const [code] = generateRecoveryCodes(1)
    const normalized = code.replace(/-/g, '')
    expect(normalizeRecoveryCode(code)).toBe(normalized)
    expect(normalizeRecoveryCode(` ${code.toLowerCase()} `)).toBe(normalized)
    expect(normalizeRecoveryCode(normalized.match(/.{3}/g)!.join(' '))).toBe(normalized)
  })

  it('rejects what cannot be a recovery code, including a 6-digit app code', () => {
    for (const input of ['123456', 'ABCD-EFGH-JKM', 'ABCD-EFGH-JKMNP', 'ABCD-EFGH-JK0N', 'ABCD-EFGH-JKIN', 'ABCD-EFGH-JKLN', ''])
      expect(normalizeRecoveryCode(input)).toBeNull()
  })

  it('hashes deterministically, never to the code itself', () => {
    const [code] = generateRecoveryCodes(1)
    const normalized = normalizeRecoveryCode(code)!
    expect(hashRecoveryCode(normalized)).toBe(hashRecoveryCode(normalizeRecoveryCode(code.toLowerCase())!))
    expect(hashRecoveryCode(normalized)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashRecoveryCode(normalized)).not.toContain(normalized)
  })
})
