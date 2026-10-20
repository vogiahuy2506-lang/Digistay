/**
 * Every abuse limit in one place (agreed 2026-10-19). Windows in seconds.
 * Login counters count failures only; the others count every request
 * unless noted.
 */
import type { Limit } from './rate-limit'

const MIN = 60

export const LIMITS = {
  /** Failed logins for one login name from one IP. */
  loginNameIp: { name: 'login-name-ip', limit: 10, windowSec: 15 * MIN },
  /** Failed logins from one IP, any login name (spraying many accounts). */
  loginIp: { name: 'login-ip', limit: 50, windowSec: 15 * MIN },
  /** Failed logins on one account from anywhere; reaching it locks the account. */
  accountFailures: { name: 'login-account', limit: 5, windowSec: 30 * MIN },

  otpSendIp: { name: 'otp-send-ip', limit: 10, windowSec: 15 * MIN },
  registerIp: { name: 'register-ip', limit: 5, windowSec: 60 * MIN },
  /** Wrong codes from one IP, across emails (failures only). */
  otpVerifyIp: { name: 'otp-verify-ip', limit: 20, windowSec: 15 * MIN },
  /** Wrong current password when changing password/email, per user (failures only). */
  passwordCheckUser: { name: 'password-check-user', limit: 5, windowSec: 15 * MIN },
  roomLockIp: { name: 'room-lock-ip', limit: 30, windowSec: 10 * MIN },
  /** Wrong two-factor codes at sign-in from one IP, across accounts (failures only). */
  twoFactorVerifyIp: { name: '2fa-verify-ip', limit: 20, windowSec: 15 * MIN },
  /** Wrong codes while turning two-factor on, per user (failures only). */
  twoFactorSetupUser: { name: '2fa-setup-user', limit: 10, windowSec: 15 * MIN },
  /** PayOS webhooks from one IP (generous: PayOS sends from few addresses). */
  payosWebhookIp: { name: 'payos-webhook-ip', limit: 600, windowSec: 10 * MIN },
} satisfies Record<string, Limit>

/** Wrong two-factor codes on one account before it is locked (kept in Postgres, see two-factor.ts). */
export const TWO_FACTOR_LOCK_AFTER = 5
export const TWO_FACTOR_LOCK_SEC = 15 * MIN

/** How long an account stays locked after LIMITS.accountFailures. */
export const ACCOUNT_LOCK_SEC = 30 * MIN
