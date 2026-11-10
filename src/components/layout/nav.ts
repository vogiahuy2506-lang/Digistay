import { routes } from '@/lib/utils/routes'
import type { Permission } from '@/lib/auth/permissions'

export type WorkspaceRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'

/** A menu entry's label: dash.common.nav.<key> in messages/dash/<locale>/common.json. */
export type NavKey =
  | 'overview'
  | 'properties'
  | 'bookings'
  | 'rooms'
  | 'services'
  | 'menu'
  | 'payments'
  | 'invoices'
  | 'reports'
  | 'cashbook'
  | 'bankAccounts'
  | 'propertySettings'
  | 'policies'
  | 'coupons'
  | 'channels'
  | 'customers'
  | 'leads'
  | 'blog'
  | 'website'
  | 'members'
  | 'billing'
  | 'settings'

/** The sidebar's sections, in order; 'main' has no heading (dash.common.nav.groups.<group>). */
export const NAV_GROUPS = [
  'main',
  'operations',
  'property',
  'marketing',
  'finance',
  'hotelSettings',
  'workspace',
] as const
export type NavGroup = (typeof NAV_GROUPS)[number]

export interface NavItem {
  key: NavKey
  href: string
  /** Shown to who has one of these (src/lib/auth/permissions.ts); null: anyone in the workspace. */
  can: Permission[] | null
  group: NavGroup
  /** Other pages of this entry, by path: they light it up and title the tab with it. */
  also?: string[]
}

/** Main menu: the property's pages when inside one, else the workspace's. */
export function primaryNav(slug: string, propertyId?: string): NavItem[] {
  if (!propertyId) {
    // The workspace home lists the properties, so there is no second
    // "Cơ sở" entry to walk to.
    return [{ key: 'properties', href: routes.workspace(slug), can: null, group: 'main' }]
  }
  const id = propertyId
  // Grouped logically: Front desk/daily ops, Rooms & services, Sales & marketing, Finance, Hotel settings.
  return [
    { key: 'overview', href: routes.property(slug, id), can: null, group: 'main' },
    // One entry for the bookings and their calendar: the pages switch between the list,
    // the month and the room plan (src/components/bookings/bookings-views.tsx).
    {
      key: 'bookings',
      href: routes.propertyBookings(slug, id),
      also: [routes.propertyCalendar(slug, id)],
      can: ['bookings_view'],
      group: 'operations',
    },
    {
      key: 'customers',
      href: routes.propertyCustomers(slug, id),
      can: ['bookings_edit'],
      group: 'operations',
    },
    { key: 'rooms', href: routes.propertyRooms(slug, id), can: ['rooms_manage', 'rooms_status'], group: 'property' },
    { key: 'services', href: routes.propertyServices(slug, id), can: ['services_manage'], group: 'property' },
    { key: 'menu', href: routes.propertyMenu(slug, id), can: ['services_manage'], group: 'property' },
    { key: 'channels', href: routes.propertyChannels(slug, id), can: ['property_edit'], group: 'marketing' },
    { key: 'website', href: routes.propertyWebsite(slug, id), can: ['website_manage'], group: 'marketing' },
    { key: 'coupons', href: routes.propertyCoupons(slug, id), can: ['property_edit'], group: 'marketing' },
    { key: 'leads', href: routes.propertyLeads(slug, id), can: ['property_edit'], group: 'marketing' },
    {
      key: 'blog',
      href: routes.propertyBlog(slug, id),
      also: [routes.propertyBlogNew(slug, id)],
      can: ['property_edit'],
      group: 'marketing',
    },
    { key: 'payments', href: routes.propertyPayments(slug, id), can: ['payments_manage'], group: 'finance' },
    { key: 'cashbook', href: routes.propertyDailyReport(slug, id), can: ['cashbook_view'], group: 'finance' },
    { key: 'reports', href: routes.propertyReports(slug, id), can: ['revenue_view'], group: 'finance' },
    { key: 'propertySettings', href: routes.propertySettings(slug, id), can: ['property_edit'], group: 'hotelSettings' },
    { key: 'policies', href: routes.propertyPolicies(slug, id), can: ['property_edit'], group: 'hotelSettings' },
    { key: 'bankAccounts', href: routes.propertyBankAccounts(slug, id), can: ['payment_settings'], group: 'hotelSettings' },
  ]
}

/** Workspace-wide links under the divider. */
export function workspaceNav(slug: string): NavItem[] {
  return [
    { key: 'members', href: routes.members(slug), can: ['members_manage'], group: 'workspace' },
    { key: 'billing', href: routes.billing(slug), can: ['billing_manage'], group: 'workspace' },
    { key: 'settings', href: routes.settings(slug), can: ['workspace_settings'], group: 'workspace' },
  ]
}

/**
 * The menu entry for `pathname` (its href): the one with the longest path,
 * its href or one of its `also`, that equals it or is a parent of it, so a
 * booking's detail page, the new-booking page (/bookings/new: walk-ins and
 * phone bookings) and the calendar light up "Đặt phòng".
 */
export function activeHref(pathname: string, items: NavItem[]): string | undefined {
  let best: { href: string; length: number } | undefined
  for (const item of items) {
    for (const path of [item.href, ...(item.also ?? [])]) {
      if ((pathname === path || pathname.startsWith(`${path}/`)) && (!best || path.length > best.length)) {
        best = { href: item.href, length: path.length }
      }
    }
  }
  return best?.href
}

/** Vietnamese role names, for code without a translator; pages use useDashLabels().role. */
export const roleLabels: Record<WorkspaceRole, string> = {
  ADMIN: 'Quản trị',
  MANAGER: 'Quản lý',
  RECEPTIONIST: 'Lễ tân',
  USER: 'Nhân viên',
}
