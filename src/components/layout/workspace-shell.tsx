'use client'

import Link from 'next/link'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { useProperty } from '@/lib/hooks/use-property'
import { Avatar, Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import {
  LayoutDashboard,
  Building2,
  Bed,
  Calendar,
  BookOpen,
  CreditCard,
  FileText,
  BarChart3,
  Users,
  Globe,
  LogOut,
  ChevronDown,
  Bell,
  Plus,
  ChevronRight,
  Wallet,
  Shield,
  Star,
  ArrowLeft,
  Hotel,
  CheckSquare,
  Banknote,
} from 'lucide-react'

type WorkspaceRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'

interface NavItem {
  name: string
  href: string
  icon: any
  roles: WorkspaceRole[]
  badge?: string
}

interface WorkspaceShellProps {
  workspace: {
    id: string
    name: string
    slug: string
    role: WorkspaceRole
  }
  workspaces: { id: string; name: string; slug: string; role: WorkspaceRole }[]
  userName?: string
  userEmail?: string
  userImage?: string
  children: React.ReactNode
}

export function WorkspaceShell({
  workspace,
  workspaces,
  userName,
  userEmail,
  userImage,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams<{ slug: string; id?: string }>()
  const slug = params.slug
  const propertyIdFromUrl = params.id

  // Only fetch property context if URL has [id] param
  const { property } = useProperty()

  // Determine if we're on a property-scoped route
  const isInProperty = !!propertyIdFromUrl

  // Navigation when at workspace level (no property selected)
  const workspaceNav: NavItem[] = [
    { name: 'Tổng quan', href: routes.workspace(slug), icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'] },
    { name: 'Cơ sở', href: routes.properties(slug), icon: Building2, roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'] },
    { name: 'Thành viên', href: routes.members(slug), icon: Users, roles: ['ADMIN', 'MANAGER'] },
  ]

  // Navigation when inside a property
  const propertyNav: NavItem[] = propertyIdFromUrl
    ? [
        {
          name: 'Tổng quan',
          href: routes.property(slug, propertyIdFromUrl),
          icon: LayoutDashboard,
          roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'],
        },
        {
          name: 'Hạng phòng',
          href: routes.propertyRooms(slug, propertyIdFromUrl),
          icon: Bed,
          roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
        },
        {
          name: 'Đặt phòng',
          href: routes.propertyBookings(slug, propertyIdFromUrl),
          icon: BookOpen,
          roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'],
          badge: 'new',
        },
        {
          name: 'Lịch phòng',
          href: routes.propertyCalendar(slug, propertyIdFromUrl),
          icon: Calendar,
          roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
        },
        {
          name: 'Walk-in',
          href: routes.propertyBookingNew(slug, propertyIdFromUrl),
          icon: Plus,
          roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
        },
        {
          name: 'Thanh toán',
          href: routes.propertyPayments(slug, propertyIdFromUrl),
          icon: CreditCard,
          roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
        },
        {
          name: 'Hóa đơn',
          href: routes.propertyInvoices(slug, propertyIdFromUrl),
          icon: FileText,
          roles: ['ADMIN', 'MANAGER'],
        },
        {
          name: 'Báo cáo',
          href: routes.propertyReports(slug, propertyIdFromUrl),
          icon: BarChart3,
          roles: ['ADMIN', 'MANAGER'],
        },
        {
          name: 'Sổ quay',
          href: routes.propertyDailyReport(slug, propertyIdFromUrl),
          icon: Wallet,
          roles: ['ADMIN', 'RECEPTIONIST'],
        },
        {
          name: 'Ngân hàng',
          href: routes.propertyBankAccounts(slug, propertyIdFromUrl),
          icon: Banknote,
          roles: ['ADMIN'],
        },
        {
          name: 'Dịch vụ',
          href: routes.propertyServices(slug, propertyIdFromUrl),
          icon: Star,
          roles: ['ADMIN', 'MANAGER'],
        },
        {
          name: 'Website',
          href: routes.propertyWebsite(slug, propertyIdFromUrl),
          icon: Globe,
          roles: ['ADMIN', 'MANAGER'],
        },
      ]
    : []

  const nav = isInProperty ? propertyNav : workspaceNav

  const handleWorkspaceChange = (newSlug: string) => {
    router.push(routes.workspace(newSlug))
  }

  const getRoleBadge = (role: WorkspaceRole) => {
    const badges: Record<WorkspaceRole, { label: string; color: string }> = {
      ADMIN: { label: 'Chủ sở hữu', color: 'bg-purple-100 text-purple-700' },
      MANAGER: { label: 'Quản lý', color: 'bg-blue-100 text-blue-700' },
      RECEPTIONIST: { label: 'Lễ tân', color: 'bg-green-100 text-green-700' },
      USER: { label: 'Nhân viên', color: 'bg-gray-100 text-gray-700' },
    }
    return badges[role] || badges.USER
  }

  const canAccess = (roles: WorkspaceRole[]) => roles.includes(workspace.role)

  const renderNavItem = (item: NavItem) => {
    if (!canAccess(item.roles)) return null
    const isActive = pathname === item.href
    return (
      <Link
        key={item.name}
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        <span className="flex-1">{item.name}</span>
        {item.badge && (
          <span
            className={cn(
              'px-2 py-0.5 text-xs rounded-full',
              isActive ? 'bg-white/20 text-white' : 'bg-primary text-white'
            )}
          >
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  const role = getRoleBadge(workspace.role)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0 shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100 shrink-0">
          <Link href={routes.workspace(slug)} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <div>
              <span className="font-semibold text-gray-900">Digistay</span>
              <span className="block text-[10px] text-gray-400 -mt-0.5">Hotel Management</span>
            </div>
          </Link>
        </div>

        {/* Workspace selector */}
        <div className="px-3 py-3 border-b border-gray-100 shrink-0">
          <Dropdown
            trigger={
              <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-medium shrink-0">
                    {workspace.name.charAt(0)}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-900 block truncate">
                      {workspace.name}
                    </span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', role.color)}>
                      {role.label}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-1 shrink-0" />
              </button>
            }
            align="left"
          >
            {workspaces.map((ws) => (
              <DropdownItem key={ws.id} onClick={() => handleWorkspaceChange(ws.slug)}>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-xs font-medium">
                    {ws.name.charAt(0)}
                  </div>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.slug === workspace.slug && <span className="text-primary">✓</span>}
                </div>
              </DropdownItem>
            ))}
            <DropdownDivider />
            <Link href={routes.workspaces()}>
              <DropdownItem>
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Tất cả Workspace
                </span>
              </DropdownItem>
            </Link>
          </Dropdown>
        </div>

        {/* Property context bar (only inside a property) */}
        {isInProperty && property && (
          <div className="px-3 py-3 border-b border-gray-100 bg-blue-50/50 shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5 px-1">
              Đang quản lý
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-blue-100">
              <div className="w-7 h-7 rounded bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Hotel className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900 truncate">{property.name}</p>
                <p className="text-[10px] text-gray-500">{property.subdomain}.digistay.vn</p>
              </div>
            </div>
            <Link
              href={routes.properties(slug)}
              className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline px-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Đổi cơ sở
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            {nav.map(renderNavItem)}
          </div>
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <Avatar src={userImage} name={userName || 'User'} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{userName || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="flex-1 flex items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Thông báo"
              aria-label="Thông báo"
            >
              <Bell className="w-4 h-4 text-gray-400" />
            </button>
            <form action="/api/auth/signout" method="POST" className="flex-1">
              <button
                type="submit"
                className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-red-50 transition-colors"
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <LogOut className="w-4 h-4 text-gray-400 hover:text-red-500" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  )
}
