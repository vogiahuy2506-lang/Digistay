/**
 * How a guest pays the online deposit (product owner, 27/10/2026): the hotel
 * chooses, per property (Property.depositMode):
 *
 * - MANUAL: a VietQR to the hotel's own bank account or MoMo wallet
 *   (Property.depositAccountId, else its oldest active QR account). The guest
 *   says "Tôi đã chuyển khoản", staff confirm when the money is in
 *   (manual-deposit.ts).
 * - PAYOS: the hotel's PayOS account (payos.ts); the webhook confirms it.
 *
 * Not chosen (null): PAYOS when PayOS is connected, else MANUAL, so hotels
 * that connected PayOS before this keep it. PAYOS can only be chosen with
 * PayOS connected; if it is disconnected later, deposits fall back to MANUAL
 * rather than stopping. MANUAL without any receiving account takes no
 * deposit (the hotel calls the guest, as before).
 */
import type { DepositPaymentMode, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type Db = Prisma.TransactionClient | typeof prisma

export type DepositMode = DepositPaymentMode

/** What decides the mode, as loaded with DEPOSIT_MODE_SELECT. */
export interface DepositModeRows {
  depositMode: DepositMode | null
  depositAccountId: string | null
  payos: { webhookConfirmedAt: Date | null } | null
  /** active accounts with QR, oldest first */
  bankAccounts: { id: string }[]
}

/** Spread into a Property select to decide the mode from one query. */
export const DEPOSIT_MODE_SELECT = {
  depositMode: true,
  depositAccountId: true,
  payos: { select: { webhookConfirmedAt: true } },
  bankAccounts: { where: { isActive: true, qrEnabled: true }, orderBy: { createdAt: 'asc' }, select: { id: true } },
} satisfies Prisma.PropertySelect

/** The receiving account a manual QR names: the chosen one if still active with QR, else the oldest. */
export function depositAccountIdFrom(rows: Pick<DepositModeRows, 'depositAccountId' | 'bankAccounts'>): string | null {
  const ids = rows.bankAccounts.map((a) => a.id)
  if (rows.depositAccountId && ids.includes(rows.depositAccountId)) return rows.depositAccountId
  return ids[0] ?? null
}

/** How guests pay now: PAYOS, MANUAL, or null (no way to take a deposit online). */
export function effectiveDepositMode(rows: DepositModeRows): DepositMode | null {
  const payos = Boolean(rows.payos?.webhookConfirmedAt)
  const chosen = rows.depositMode ?? (payos ? 'PAYOS' : 'MANUAL')
  if (chosen === 'PAYOS' && payos) return 'PAYOS'
  return depositAccountIdFrom(rows) ? 'MANUAL' : null
}

export interface DepositSettings {
  /** what the hotel chose; null: never chosen (the default applies) */
  mode: DepositMode | null
  /** what guests get now (see effectiveDepositMode) */
  effectiveMode: DepositMode | null
  payosConnected: boolean
  /** the account the manual QR names now */
  accountId: string | null
  /** Policy.onlineDepositPercent: 0 = no online deposit at all */
  percent: number
  deadlineMinutes: number
}

export async function depositSettingsOf(propertyId: string, db: Db = prisma): Promise<DepositSettings | null> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { ...DEPOSIT_MODE_SELECT, policy: { select: { onlineDepositPercent: true, depositDeadlineMinutes: true } } },
  })
  if (!property) return null
  return {
    mode: property.depositMode,
    effectiveMode: effectiveDepositMode(property),
    payosConnected: Boolean(property.payos?.webhookConfirmedAt),
    accountId: depositAccountIdFrom(property),
    percent: property.policy?.onlineDepositPercent ?? 0,
    deadlineMinutes: property.policy?.depositDeadlineMinutes ?? 0,
  }
}
