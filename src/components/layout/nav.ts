import { routes } from '@/lib/utils/routes'

export type WorkspaceRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'

/** A menu entry's label: dash.common.nav.<key> in messages/dash/<locale>/common.json. */
export type NavKey =
  | 'overview'
  | 'properties'
  | 'bookings'
  | 'calendar'
  | 'rooms'
  | 'services'
  | 'menu'
  | 'payments'
  | 'invoices'
  | 'reports'
  | 'cashbook'
  | 'bankAccounts'
  | 'policies'
  | 'website'
  | 'members'
  | 'settings'

/** The sidebar's sections, in order; 'main' has no heading (dash.common.nav.groups.<group>). */
export const NAV_GROUPS = ['main', 'operations', 'property', 'finance', 'workspace'] as const
export type NavGroup = (typeof NAV_GROUPS)[number]

export interface NavItem {
  key: NavKey
  href: string
  roles: WorkspaceRole[]
  group: NavGroup
}

const everyone: WorkspaceRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER']
const staff: WorkspaceRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST']
const managers: WorkspaceRole[] = ['ADMIN', 'MANAGER']

/** Main menu: the property's pages when inside one, else the workspace's. */
export function primaryNav(slug: string, propertyId?: string): NavItem[] {
  if (!propertyId) {
    // The workspace home lists the properties, so there is no second
    // "Cơ sở" entry to walk to.
    return [{ key: 'properties', href: routes.workspace(slug), roles: everyone, group: 'main' }]
  }
  const id = propertyId
  // Grouped like the work: the day at the desk, what the hotel sells, the money.
  return [
    { key: 'overview', href: routes.property(slug, id), roles: everyone, group: 'main' },
    { key: 'bookings', href: routes.propertyBookings(slug, id), roles: everyone, group: 'operations' },
    { key: 'calendar', href: routes.propertyCalendar(slug, id), roles: staff, group: 'operations' },
    { key: 'rooms', href: routes.propertyRooms(slug, id), roles: staff, group: 'property' },
    { key: 'services', href: routes.propertyServices(slug, id), roles: managers, group: 'property' },
    { key: 'menu', href: routes.propertyMenu(slug, id), roles: managers, group: 'property' },
    { key: 'policies', href: routes.propertyPolicies(slug, id), roles: managers, group: 'property' },
    { key: 'website', href: routes.propertyWebsite(slug, id), roles: managers, group: 'property' },
    { key: 'payments', href: routes.propertyPayments(slug, id), roles: staff, group: 'finance' },
    { key: 'invoices', href: routes.propertyInvoices(slug, id), roles: managers, group: 'finance' },
    { key: 'cashbook', href: routes.propertyDailyReport(slug, id), roles: ['ADMIN', 'RECEPTIONIST'], group: 'finance' },
    { key: 'reports', href: routes.propertyReports(slug, id), roles: managers, group: 'finance' },
    { key: 'bankAccounts', href: routes.propertyBankAccounts(slug, id), roles: ['ADMIN'], group: 'finance' },
  ]
}

/** Workspace-wide links under the divider. */
export function workspaceNav(slug: string): NavItem[] {
  return [
    { key: 'members', href: routes.members(slug), roles: managers, group: 'workspace' },
    { key: 'settings', href: routes.settings(slug), roles: ['ADMIN'], group: 'workspace' },
  ]
}

/**
 * The menu entry for `pathname`: the longest href that equals it or is a
 * parent of it, so a booking's detail page and the new-booking page
 * (/bookings/new: walk-ins and phone bookings) light up "Đặt phòng".
 */
export function activeHref(pathname: string, items: NavItem[]): string | undefined {
  let best: string | undefined
  for (const { href } of items) {
    if ((pathname === href || pathname.startsWith(`${href}/`)) && (!best || href.length > best.length)) best = href
  }
  return best
}

/** Vietnamese role names, for code without a translator; pages use useDashLabels().role. */
export const roleLabels: Record<WorkspaceRole, string> = {
  ADMIN: 'Chủ sở hữu',
  MANAGER: 'Quản lý',
  RECEPTIONIST: 'Lễ tân',
  USER: 'Nhân viên',
}
