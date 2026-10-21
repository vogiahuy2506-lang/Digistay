/**
 * Digistay's plans, as the home and pricing pages show them.
 *
 * SAMPLE CONTENT: Digistay has not launched, and the names, prices, limits,
 * add-ons and which plan has what are not decided yet. The app has no plans
 * of its own and enforces none of these limits. Change them here (numbers)
 * and in messages/*.json under marketing.plans / marketing.pricing (words).
 */

export const PLAN_IDS = ['starter', 'growth', 'business'] as const
export type PlanId = (typeof PLAN_IDS)[number]

export interface Plan {
  id: PlanId
  /** VND a month, before VAT. */
  price: number
  properties: number
  rooms: number
  staff: number
  /** Mắt Bão e-invoices included a month; 0 = not in this plan. */
  invoices: number
}

export const PLANS: Plan[] = [
  { id: 'starter', price: 990_000, properties: 1, rooms: 15, staff: 3, invoices: 0 },
  { id: 'growth', price: 1_990_000, properties: 3, rooms: 60, staff: 10, invoices: 100 },
  { id: 'business', price: 4_990_000, properties: 10, rooms: 300, staff: 30, invoices: 500 },
]

export const ADDON_IDS = ['property', 'staff', 'domain', 'invoices'] as const
export type AddonId = (typeof ADDON_IDS)[number]

/** VND per unit (the unit is in the messages: a property a month, a year...). */
export const ADDON_PRICES: Record<AddonId, number> = {
  property: 490_000,
  staff: 49_000,
  domain: 290_000,
  invoices: 150_000,
}

/** A cell of the comparison table: in the plan or not, or the plan's own limit. */
export type Cell = boolean | 'invoices' | 'properties'

const all: Record<PlanId, Cell> = { starter: true, growth: true, business: true }
const notStarter: Record<PlanId, Cell> = { starter: false, growth: true, business: true }

export const COMPARE = [
  {
    group: 'site',
    rows: [
      { id: 'builder', cells: all },
      { id: 'subdomain', cells: all },
      { id: 'customDomain', cells: notStarter },
      { id: 'english', cells: all },
    ],
  },
  {
    group: 'booking',
    rows: [
      { id: 'pricing', cells: all },
      { id: 'deposit', cells: all },
      { id: 'reconcile', cells: notStarter },
    ],
  },
  {
    group: 'operations',
    rows: [
      { id: 'bookings', cells: all },
      { id: 'walkIn', cells: all },
      { id: 'checkInOut', cells: all },
    ],
  },
  {
    group: 'money',
    rows: [
      { id: 'einvoice', cells: { starter: false, growth: 'invoices', business: 'invoices' } },
      { id: 'revenue', cells: all },
      { id: 'cashbook', cells: all },
    ],
  },
  {
    group: 'account',
    rows: [
      { id: 'properties', cells: { starter: false, growth: 'properties', business: 'properties' } },
      { id: 'roles', cells: all },
      { id: 'twoFactor', cells: all },
      { id: 'darkMode', cells: all },
    ],
  },
] as const satisfies readonly { group: string; rows: readonly { id: string; cells: Record<PlanId, Cell> }[] }[]
