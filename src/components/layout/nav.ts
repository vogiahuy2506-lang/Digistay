import { routes } from '@/lib/utils/routes'

export type WorkspaceRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'

export interface NavItem {
  name: string
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
      { name: 'Tổng quan', href: routes.workspace(slug), roles: everyone },
      { name: 'Cơ sở', href: routes.properties(slug), roles: everyone },
    ]
  }
  const id = propertyId
  return [
    { name: 'Tổng quan', href: routes.property(slug, id), roles: everyone },
    { name: 'Đặt phòng', href: routes.propertyBookings(slug, id), roles: everyone },
    { name: 'Lịch phòng', href: routes.propertyCalendar(slug, id), roles: staff },
    { name: 'Walk-in', href: routes.propertyBookingNew(slug, id), roles: staff },
    { name: 'Hạng phòng', href: routes.propertyRooms(slug, id), roles: staff },
    { name: 'Dịch vụ', href: routes.propertyServices(slug, id), roles: managers },
    { name: 'Thanh toán', href: routes.propertyPayments(slug, id), roles: staff },
    { name: 'Hóa đơn', href: routes.propertyInvoices(slug, id), roles: managers },
    { name: 'Báo cáo', href: routes.propertyReports(slug, id), roles: managers },
    { name: 'Sổ quay', href: routes.propertyDailyReport(slug, id), roles: ['ADMIN', 'RECEPTIONIST'] },
    { name: 'Ngân hàng', href: routes.propertyBankAccounts(slug, id), roles: ['ADMIN'] },
    { name: 'Chính sách', href: routes.propertyPolicies(slug, id), roles: managers },
    { name: 'Website khách sạn', href: routes.propertyWebsite(slug, id), roles: managers },
  ]
}

/** Workspace-wide links under the divider. */
export function workspaceNav(slug: string): NavItem[] {
  return [
    { name: 'Thành viên', href: routes.members(slug), roles: managers },
    { name: 'Cài đặt', href: routes.settings(slug), roles: ['ADMIN'] },
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

export const roleLabels: Record<WorkspaceRole, string> = {
  ADMIN: 'Chủ sở hữu',
  MANAGER: 'Quản lý',
  RECEPTIONIST: 'Lễ tân',
  USER: 'Nhân viên',
}
