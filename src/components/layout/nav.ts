import { routes } from '@/lib/utils/routes'

export type WorkspaceRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'

/** A menu entry's label: dash.common.nav.<key> in messages/dash/<locale>/common.json. */
export type NavKey =
  | 'overview'
  | 'properties'
  | 'bookings'
  | 'calendar'
  | 'walkIn'
  | 'rooms'
  | 'services'
  | 'payments'
  | 'invoices'
  | 'reports'
  | 'cashbook'
  | 'bankAccounts'
  | 'policies'
  | 'website'
  | 'members'
  | 'settings'

export interface NavItem {
  key: NavKey
  href: string
  roles: WorkspaceRole[]
}

const everyone: WorkspaceRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER']
const staff: WorkspaceRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST']
const managers: WorkspaceRole[] = ['ADMIN', 'MANAGER']

/** Main menu: the property's pages when inside one, else the workspace's. */
export function primaryNav(slug: string, propertyId?: string): NavItem[] {
  if (!propertyId) {
    return [
      { key: 'overview', href: routes.workspace(slug), roles: everyone },
      { key: 'properties', href: routes.properties(slug), roles: everyone },
    ]
  }
  const id = propertyId
  return [
    { key: 'overview', href: routes.property(slug, id), roles: everyone },
    { key: 'bookings', href: routes.propertyBookings(slug, id), roles: everyone },
    { key: 'calendar', href: routes.propertyCalendar(slug, id), roles: staff },
    { key: 'walkIn', href: routes.propertyBookingNew(slug, id), roles: staff },
    { key: 'rooms', href: routes.propertyRooms(slug, id), roles: staff },
    { key: 'services', href: routes.propertyServices(slug, id), roles: managers },
    { key: 'payments', href: routes.propertyPayments(slug, id), roles: staff },
    { key: 'invoices', href: routes.propertyInvoices(slug, id), roles: managers },
    { key: 'reports', href: routes.propertyReports(slug, id), roles: managers },
    { key: 'cashbook', href: routes.propertyDailyReport(slug, id), roles: ['ADMIN', 'RECEPTIONIST'] },
    { key: 'bankAccounts', href: routes.propertyBankAccounts(slug, id), roles: ['ADMIN'] },
    { key: 'policies', href: routes.propertyPolicies(slug, id), roles: managers },
    { key: 'website', href: routes.propertyWebsite(slug, id), roles: managers },
  ]
}

/** Workspace-wide links under the divider. */
export function workspaceNav(slug: string): NavItem[] {
  return [
    { key: 'members', href: routes.members(slug), roles: managers },
    { key: 'settings', href: routes.settings(slug), roles: ['ADMIN'] },
  ]
}

/**
 * The menu entry for `pathname`: the longest href that equals it or is a
 * parent of it, so a booking's detail page still lights up "Đặt phòng" while
 * /bookings/new lights up "Walk-in" only.
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
