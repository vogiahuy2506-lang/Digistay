'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
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
  Home,
  ClipboardList,
  Wallet,
  Building,
  UserCog,
  Shield,
  Star,
} from 'lucide-react'
import { Avatar, Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'

// Role types
type WorkspaceRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'
type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

// Navigation item type
interface NavItem {
  name: string
  href: string
  icon: any
  roles: WorkspaceRole[]
  badge?: string
  children?: NavItem[]
}

// Main navigation structure
const mainNavigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'],
  },
  {
    name: 'Cơ sở',
    href: '/properties',
    icon: Building2,
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'],
  },
  {
    name: 'Hạng Phòng',
    href: '/properties/room-types',
    icon: Bed,
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  },
  {
    name: 'Đặt Phòng',
    href: '/bookings',
    icon: BookOpen,
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'USER'],
    badge: 'new',
  },
  {
    name: 'Lịch Phòng',
    href: '/calendar',
    icon: Calendar,
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  },
  {
    name: 'Walk-in',
    href: '/bookings/new',
    icon: ClipboardList,
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  },
  {
    name: 'Website Builder',
    href: '/website',
    icon: Globe,
    roles: ['ADMIN', 'MANAGER'],
  },
]

const financeNavigation: NavItem[] = [
  {
    name: 'Thanh Toán',
    href: '/payments',
    icon: CreditCard,
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  },
  {
    name: 'Hóa Đơn',
    href: '/invoices',
    icon: FileText,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    name: 'Báo Cáo Doanh Thu',
    href: '/reports',
    icon: BarChart3,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    name: 'Sổ Quay',
    href: '/reports/daily',
    icon: Wallet,
    roles: ['ADMIN', 'RECEPTIONIST'],
  },
]

const managementNavigation: NavItem[] = [
  {
    name: 'Thành Viên',
    href: '/members',
    icon: Users,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    name: 'Tài Khoản Ngân Hàng',
    href: '/bank-accounts',
    icon: Building,
    roles: ['ADMIN'],
  },
  {
    name: 'Tiện Ích & Dịch Vụ',
    href: '/services',
    icon: Star,
    roles: ['ADMIN', 'MANAGER'],
  },
]

interface Workspace {
  id: string
  name: string
  slug: string
  role?: WorkspaceRole
}

interface SidebarProps {
  workspaceName?: string
  workspaceId?: string
  workspaceRole?: WorkspaceRole
  userName?: string
  userEmail?: string
  userImage?: string
  userRole?: UserRole
}

export function Sidebar({ 
  workspaceName = 'Workspace',
  workspaceId,
  workspaceRole = 'USER',
  userName,
  userEmail,
  userImage,
  userRole = 'USER',
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    main: true,
    finance: true,
    management: true,
    settings: false,
  })

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces')
      const data = await res.json()
      if (data.success) {
        setWorkspaces(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err)
    }
  }

  const buildHref = (baseHref: string) => {
    if (workspaceId && !baseHref.includes('workspace=')) {
      const separator = baseHref.includes('?') ? '&' : '?'
      return `${baseHref}${separator}workspace=${workspaceId}`
    }
    return baseHref
  }

  const handleWorkspaceChange = (wsId: string) => {
    document.cookie = `selectedWorkspace=${wsId}; path=/; max-age=${30 * 24 * 60 * 60}`
    router.refresh()
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const canAccess = (roles: WorkspaceRole[]) => {
    // Super admin can access everything
    if (userRole === 'SUPER_ADMIN') return true
    return roles.includes(workspaceRole)
  }

  const renderNavItem = (item: NavItem) => {
    // Active if exact match OR direct child (only 1 path segment deeper)
    // Don't highlight parent when viewing a child page
    const isChildRoute = pathname.startsWith(item.href + '/') && 
      pathname.slice(item.href.length + 1).split('/').length === 1
    const isActive = pathname === item.href || isChildRoute
    const hasAccess = canAccess(item.roles)
    
    if (!hasAccess) return null

    return (
      <Link
        key={item.name}
        href={buildHref(item.href)}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-white'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <item.icon className="w-5 h-5" />
        <span className="flex-1">{item.name}</span>
        {item.badge && (
          <span className={cn(
            'px-2 py-0.5 text-xs rounded-full',
            isActive ? 'bg-white/20 text-white' : 'bg-primary text-white'
          )}>
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  const renderSection = (title: string, key: string, items: NavItem[]) => {
    const visibleItems = items.filter(item => canAccess(item.roles))
    if (visibleItems.length === 0) return null

    return (
      <div className="mb-4">
        <button
          onClick={() => toggleSection(key)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
        >
          <span>{title}</span>
          <ChevronRight className={cn(
            'w-4 h-4 transition-transform',
            expandedSections[key] && 'rotate-90'
          )} />
        </button>
        {expandedSections[key] && (
          <div className="space-y-1 mt-1">
            {items.map(renderNavItem)}
          </div>
        )}
      </div>
    )
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

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200 h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2">
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
      <div className="px-3 py-3 border-b border-gray-100">
        <Dropdown
          trigger={
            <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-medium">
                  {workspaceName?.charAt(0) || 'W'}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-900 block truncate">
                    {workspaceName || 'Chọn Workspace'}
                  </span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    getRoleBadge(workspaceRole).color
                  )}>
                    {getRoleBadge(workspaceRole).label}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
            </button>
          }
          align="left"
        >
          {workspaces.map((ws) => (
            <DropdownItem 
              key={ws.id}
              onClick={() => handleWorkspaceChange(ws.id)}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-xs font-medium">
                  {ws.name.charAt(0)}
                </div>
                <span className="flex-1">{ws.name}</span>
                {ws.id === workspaceId && <span className="text-primary">✓</span>}
              </div>
            </DropdownItem>
          ))}
          <DropdownDivider />
          <Link href="/workspaces/new">
            <DropdownItem>
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Tạo Workspace mới
              </span>
            </DropdownItem>
          </Link>
        </Dropdown>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Quản lý */}
        {renderSection('Quản lý', 'main', mainNavigation)}
        
        {/* Tài chính */}
        {renderSection('Tài chính', 'finance', financeNavigation)}
        
        {/* Quản trị */}
        {renderSection('Quản trị', 'management', managementNavigation)}
      </nav>

      {/* Quick Stats */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-white rounded-lg border border-gray-100">
            <p className="text-[10px] text-gray-500">Phòng trống</p>
            <p className="text-sm font-semibold text-green-600">--</p>
          </div>
          <div className="p-2 bg-white rounded-lg border border-gray-100">
            <p className="text-[10px] text-gray-500">Đặt hôm nay</p>
            <p className="text-sm font-semibold text-blue-600">--</p>
          </div>
        </div>
      </div>

      {/* User section */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <Avatar src={userImage} name={userName || 'User'} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {userName || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {userEmail || 'user@example.com'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            className="flex-1 flex items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
            title="Thông báo"
          >
            <Bell className="w-4 h-4 text-gray-400" />
          </button>
          <form action="/api/auth/signout" method="POST" className="flex-1">
            <button
              type="submit"
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-red-50 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4 text-gray-400 hover:text-red-500" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

interface HeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('p-6 max-w-7xl mx-auto', className)}>
      {children}
    </div>
  )
}
