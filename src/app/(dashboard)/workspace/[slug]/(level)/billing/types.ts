import type { Plan, PlanId } from '@/lib/marketing/plans'
import type { PaymentView } from '@/lib/billing/view'
import type { BuyerDraft } from './invoice-form'

export type Billing = 'MONTH' | 'YEAR'
export type State = 'trial' | 'active' | 'grace' | 'locked'
export type LimitKey = 'properties' | 'rooms' | 'staff' | 'invoices'
export type ChangeKind = 'new' | 'renew' | 'upgrade' | 'downgrade'

/** What buying a plan would do now (src/lib/billing/period.ts planChange), as GET subscription sends it. */
export interface ChangeView {
  kind: ChangeKind
  startsAt: string
  endsAt: string
  lostDays: number
  blocked: 'RENEW_TOO_EARLY' | 'YEARLY_TO_MONTHLY' | 'CHANGE_SCHEDULED' | null
  blockedReason: string | null
  renewFrom: string | null
}

export interface BillingData {
  workspace: { id: string; name: string; slug: string }
  subscription: {
    plan: PlanId
    billing: Billing | null
    trial: boolean
    periodStart: string
    periodEnd: string
    state: State
    daysLeft: number
    graceDaysLeft: number
    locksAt: string
    renewWindowDays: number
  }
  scheduled: { plan: PlanId; billing: Billing; startsAt: string; endsAt: string | null } | null
  changes: Record<PlanId, Record<Billing, ChangeView>>
  limits: Record<LimitKey, number>
  usage: Record<LimitKey, number>
  /** src/lib/billing/overage.ts overageView */
  overage: {
    since: string | null
    locksAt: string | null
    over: Partial<Record<'properties' | 'rooms' | 'staff', { used: number; limit: number }>>
    locked: {
      properties: { id: string; name: string }[]
      roomTypes: { id: string; name: string; propertyName: string; rooms: number }[]
      members: { userId: string; name: string | null; email: string }[]
    }
  }
  plans: Plan[]
  yearlyMonths: number
  checkoutReady: boolean
  /** null until Digistay issues e-invoices (src/lib/billing/einvoice.ts) */
  einvoice: { vat: string; email: string | null; lastBuyer: Partial<BuyerDraft> | null } | null
  pending: PaymentView | null
  payments: PaymentView[]
}

/** 26/10/2026 (Vietnam time, written by hand: Intl dates differ between Node and browsers). */
export function vnDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

export const planName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)
