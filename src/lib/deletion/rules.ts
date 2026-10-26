/**
 * Deleting a property or a workspace (product owner, 2026-10-27), without the
 * database:
 *
 * - Only the workspace's owner deletes or restores, after typing the name.
 * - A deletion is soft: the row gets deletedAt and disappears from the app at
 *   once (src/lib/db/soft-delete.ts). For RESTORE_DAYS the owner can bring it
 *   back as it was; then /api/internal/purge-deleted removes it for good.
 * - Refused while guests are staying or booked for later: checked in, or a
 *   booking still pending / confirmed whose check-out is today or later.
 * - A workspace's paid plan keeps running while it is deleted (no refund, its
 *   end date does not move when restored).
 */
import type { Prisma } from '@prisma/client'

export const RESTORE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** When a row deleted at `deletedAt` is removed for good (and can no longer be restored). */
export function purgeAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + RESTORE_DAYS * DAY_MS)
}

/** Rows deleted before this instant are due for the purge. */
export function purgeCutoff(now = new Date()): Date {
  return new Date(now.getTime() - RESTORE_DAYS * DAY_MS)
}

export function canRestore(deletedAt: Date, now = new Date()): boolean {
  return now.getTime() < purgeAt(deletedAt).getTime()
}

/** Whole days left to restore, rounded up (a row deleted a minute ago has 30); 0 once the time is up. */
export function restoreDaysLeft(deletedAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((purgeAt(deletedAt).getTime() - now.getTime()) / DAY_MS))
}

/** The same text for the name check: Unicode NFC (phones may type decomposed accents), spaces collapsed. */
function normalizeName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi')
}

/**
 * Whether what the owner typed is the name. Letter case does not count (a
 * phone capitalises the first letter on its own); accents and every word do.
 */
export function sameName(typed: unknown, name: string): boolean {
  if (typeof typed !== 'string') return false
  const want = normalizeName(name)
  return want.length > 0 && normalizeName(typed) === want
}

/** The first instant of today in Vietnam (UTC+7, no DST). */
export function vietnamDayStart(now = new Date()): Date {
  const vn = new Date(now.getTime() + 7 * 3600_000)
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600_000)
}

/**
 * The bookings that block a deletion: guests checked in (even past their
 * check-out day: they are still there), and bookings pending or confirmed
 * whose check-out is today or later. Checked out, cancelled and no-show ones
 * do not count.
 */
export function guestsBookedWhere(now = new Date()): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: 'CHECKED_IN' },
      { status: { in: ['PENDING', 'CONFIRMED'] }, checkOutDate: { gte: vietnamDayStart(now) } },
    ],
  }
}
