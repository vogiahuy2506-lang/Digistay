import { describe, it, expect } from 'vitest'
import { depositAccountIdFrom, effectiveDepositMode, type DepositModeRows } from './deposit-mode'

/** How guests pay the deposit (deposit-mode.ts): the hotel's choice, with its defaults and fallbacks. */
const rows = (over: Partial<DepositModeRows> = {}): DepositModeRows => ({
  depositMode: null,
  depositAccountId: null,
  payos: null,
  bankAccounts: [{ id: 'oldest' }, { id: 'newer' }],
  ...over,
})
const connected = { webhookConfirmedAt: new Date() }

describe('effectiveDepositMode', () => {
  it('defaults to PayOS when it is connected, else to manual transfers', () => {
    expect(effectiveDepositMode(rows({ payos: connected }))).toBe('PAYOS')
    expect(effectiveDepositMode(rows())).toBe('MANUAL')
    // Keys saved but PayOS never confirmed the webhook: not connected.
    expect(effectiveDepositMode(rows({ payos: { webhookConfirmedAt: null } }))).toBe('MANUAL')
  })

  it("follows the hotel's choice: manual even with PayOS connected", () => {
    expect(effectiveDepositMode(rows({ payos: connected, depositMode: 'MANUAL' }))).toBe('MANUAL')
    expect(effectiveDepositMode(rows({ payos: connected, depositMode: 'PAYOS' }))).toBe('PAYOS')
  })

  it('PayOS chosen but disconnected since: manual transfers rather than no deposit', () => {
    expect(effectiveDepositMode(rows({ depositMode: 'PAYOS' }))).toBe('MANUAL')
  })

  it('manual without any account to receive the money: no online deposit', () => {
    expect(effectiveDepositMode(rows({ bankAccounts: [] }))).toBeNull()
    expect(effectiveDepositMode(rows({ bankAccounts: [], depositMode: 'PAYOS' }))).toBeNull()
    expect(effectiveDepositMode(rows({ bankAccounts: [], payos: connected }))).toBe('PAYOS')
  })
})

describe('depositAccountIdFrom', () => {
  it('the chosen account while it is active with QR, else the oldest', () => {
    expect(depositAccountIdFrom(rows({ depositAccountId: 'newer' }))).toBe('newer')
    expect(depositAccountIdFrom(rows({ depositAccountId: 'switched-off' }))).toBe('oldest')
    expect(depositAccountIdFrom(rows())).toBe('oldest')
    expect(depositAccountIdFrom(rows({ bankAccounts: [] }))).toBeNull()
  })
})
