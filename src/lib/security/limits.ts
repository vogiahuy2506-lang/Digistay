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
  /** Invitations one user sends: each emails any address through Digistay's mail server. */
  invitationSendUser: { name: 'invite-send-user', limit: 30, windowSec: 60 * MIN },
  /** Email-change confirmations one user requests: each emails the new address. */
  emailChangeSendUser: { name: 'email-change-send-user', limit: 5, windowSec: 60 * MIN },
  roomLockIp: { name: 'room-lock-ip', limit: 30, windowSec: 10 * MIN },
  /** Bookings guests place on hotel sites from one IP (each holds a room). */
  guestBookingIp: { name: 'guest-booking-ip', limit: 5, windowSec: 60 * MIN },
  /** Bookings for one guest email: each emails that address a confirmation. */
  guestBookingEmail: { name: 'guest-booking-email', limit: 3, windowSec: 60 * MIN },
  /** Contact form requests from one IP: each emails the Digistay team (src/lib/marketing/contact.ts). */
  contactIp: { name: 'contact-ip', limit: 5, windowSec: 60 * MIN },
  /** Photos one user stores (POST /api/upload, users/me/avatar): each uses the shared Cloudinary account. */
  uploadUser: { name: 'upload-user', limit: 120, windowSec: 60 * MIN },
  /** The deposit page asking whether the money is in (it polls every few seconds while open). */
  depositStatusIp: { name: 'deposit-status-ip', limit: 600, windowSec: 10 * MIN },
  /** "Pay the deposit again" from one IP: each may create a PayOS link on the hotel's account. */
  depositRetryIp: { name: 'deposit-retry-ip', limit: 10, windowSec: 10 * MIN },
  /** Tax-code lookups from one IP (invoice forms; each asks VietQR unless cached, src/lib/einvoice/tax-lookup.ts). */
  taxLookupIp: { name: 'tax-lookup-ip', limit: 60, windowSec: 10 * MIN },
  /** Wrong two-factor codes at sign-in from one IP, across accounts (failures only). */
  twoFactorVerifyIp: { name: '2fa-verify-ip', limit: 20, windowSec: 15 * MIN },
  /** Wrong codes while turning two-factor on, per user (failures only). */
  twoFactorSetupUser: { name: '2fa-setup-user', limit: 10, windowSec: 15 * MIN },
  /** PayOS webhooks from one IP (generous: PayOS sends from few addresses). */
  payosWebhookIp: { name: 'payos-webhook-ip', limit: 600, windowSec: 10 * MIN },
  /** Mắt Bão tax-office status callbacks from one IP. */
  einvoiceWebhookIp: { name: 'einvoice-webhook-ip', limit: 600, windowSec: 10 * MIN },
} satisfies Record<string, Limit>

/** Wrong two-factor codes on one account before it is locked (kept in Postgres, see two-factor.ts). */
export const TWO_FACTOR_LOCK_AFTER = 5
export const TWO_FACTOR_LOCK_SEC = 15 * MIN

/** How long an account stays locked after LIMITS.accountFailures. */
export const ACCOUNT_LOCK_SEC = 30 * MIN
