'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ChevronLeft,
  ChevronRight,
  Command,
  CreditCard,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Receipt,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Ticket,
  Users,
  X,
  User,
} from 'lucide-react'
import { Logo } from '@/components/marketing/Logo'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/layout/theme-root'
import { useLanguageSwitch } from '@/components/layout/language-switch'
import { Modal, ModalBody, ModalHeader, Input } from '@/components/ui'

interface NavItemDef {
  href: string
  key: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  badge?: string
}

interface NavGroupDef {
  groupKey: string
  items: NavItemDef[]
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    groupKey: 'platform',
    items: [
      { href: '/admin', key: 'overview', icon: LayoutDashboard },
      { href: '/admin/orders', key: 'orders', icon: Receipt },
    ],
  },
  {
    groupKey: 'billing',
    items: [
      { href: '/admin/plans', key: 'plans', icon: CreditCard, badge: 'VIP' },
      { href: '/admin/vouchers', key: 'vouchers', icon: Ticket },
    ],
  },
  {
    groupKey: 'system',
    items: [
      { href: '/admin/platform-settings', key: 'platformSettings', icon: Settings, badge: 'API' },
      { href: '/admin/system', key: 'system', icon: Server },
    ],
  },
  {
    groupKey: 'security',
    items: [
      { href: '/admin/security', key: 'security', icon: ShieldAlert },
      { href: '/admin/team', key: 'team', icon: Users },
      { href: '/admin/activity', key: 'activity', icon: History },
    ],
  },
]

/** The modern enterprise SaaS operator frame: Fixed Sidebar, Topbar with Universal Search, System Status, and Theme/Language controls. */
export function AdminFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dash.admin.frame') as any
  const pathname = usePathname()
  const router = useRouter()
  const theme = useTheme()
  const language = useLanguageSwitch()
  const dark = theme?.preference === 'dark'

  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Handle Ctrl+K shortcut for Universal Search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close mobile menu on path navigation
  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Search items list for Quick Palette
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    const allItems: { title: string; href: string; icon: any; category: string }[] = [
      { title: 'Dashboard Tổng quan & Tăng trưởng', href: '/admin', icon: LayoutDashboard, category: 'Nền tảng' },
      { title: 'Quản lý Đơn hàng thanh toán gói cước', href: '/admin/orders', icon: Receipt, category: 'Kinh doanh' },
      { title: 'Quản lý Gói cước & Tạo gói Tùy chỉnh (Custom Plans)', href: '/admin/plans', icon: CreditCard, category: 'Gói cước' },
      { title: 'Chiến dịch Voucher & Mã giảm giá', href: '/admin/vouchers', icon: Ticket, category: 'Khuyến mãi' },
      { title: 'Cấu hình Nền tảng Toàn cầu (PayOS, Mắt Bão, Gemini, SMTP)', href: '/admin/platform-settings', icon: Settings, category: 'Cấu hình' },
      { title: 'Sức khỏe Hạ tầng, VPS, Redis, Postgres & Cronjobs', href: '/admin/system', icon: Server, category: 'Hạ tầng' },
      { title: 'Bảo mật, Tường lửa & IP Blacklist', href: '/admin/security', icon: ShieldAlert, category: 'Bảo mật' },
      { title: 'Đội ngũ Quản trị Cấp cao & Phân quyền RBAC', href: '/admin/team', icon: Users, category: 'Nhân sự' },
      { title: 'Nhật ký Hoạt động & Kiểm toán (Audit Log)', href: '/admin/activity', icon: History, category: 'Bảo mật' },
    ]
    return allItems.filter(
      (item) => item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.href.includes(q)
    )
  }, [searchQuery])

  return (
    <div className="min-h-screen bg-page text-fg flex">
      {/* 1. Desktop Fixed Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-line bg-panel sticky top-0 h-screen transition-all duration-200 z-40 select-none',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-line shrink-0">
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-2 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-acc rounded-ctl',
              isCollapsed && 'justify-center w-full'
            )}
            title="Digistay Platform Console"
          >
            {isCollapsed ? (
              <Image src="/icon.png" alt="Digistay" width={28} height={28} className="h-7 w-7 rounded-lg" />
            ) : (
              <div className="flex items-center gap-2">
                <Logo size="sm" />
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                  CONSOLE
                </span>
              </div>
            )}
          </Link>

          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-ctl text-muted hover:text-fg hover:bg-fg/5 transition-colors"
              title="Thu gọn sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Super Admin Status Banner */}
        <div className="p-3 border-b border-line shrink-0">
          {isCollapsed ? (
            <div
              className="flex justify-center p-2 rounded-lg border border-primary/20 bg-primary/5 text-primary"
              title="Super Admin - Quản trị toàn sàn"
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-fg/[0.03] p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-fg">SUPER ADMIN</span>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                  </div>
                  <p className="text-[10px] text-muted truncate">Quản trị toàn nền tảng</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items (Grouped) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupKey} className="space-y-1">
              {!isCollapsed && (
                <p className="px-2.5 text-[10px] font-bold text-muted/80 tracking-wider uppercase mb-1.5">
                  {t(`groups.${group.groupKey}`)}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    item.href === '/admin'
                      ? pathname === '/admin'
                      : pathname === item.href || pathname?.startsWith(`${item.href}/`)
                  const Icon = item.icon

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-all group relative',
                          active
                            ? 'bg-primary/10 text-primary font-semibold shadow-xs border-l-2 border-primary pl-2'
                            : 'text-muted hover:text-fg hover:bg-fg/5',
                          isCollapsed && 'justify-center px-2 py-2.5 border-l-0 pl-2'
                        )}
                        title={isCollapsed ? t(`nav.${item.key}`) : undefined}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform group-hover:scale-110',
                              active ? 'text-primary' : 'text-muted group-hover:text-fg'
                            )}
                            aria-hidden="true"
                          />
                          {!isCollapsed && <span className="truncate">{t(`nav.${item.key}`)}</span>}
                        </div>

                        {!isCollapsed && item.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Sidebar Footer Controls (NO Back to workspace) */}
        <div className="p-3 border-t border-line shrink-0 bg-fg/[0.01] space-y-2.5">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="w-full flex items-center justify-center p-2 rounded-lg text-muted hover:text-fg hover:bg-fg/5 transition-colors"
                title="Mở rộng thanh điều hướng"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {theme && (
                <button
                  type="button"
                  aria-label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
                  title={dark ? 'Chế độ sáng' : 'Chế độ tối'}
                  onClick={() => theme.setPreference(dark ? 'light' : 'dark')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-fg/5 hover:text-fg"
                >
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Theme & Language Controls */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  {theme && (
                    <button
                      type="button"
                      aria-label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
                      title={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
                      onClick={() => theme.setPreference(dark ? 'light' : 'dark')}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-fg/5 hover:text-fg"
                    >
                      {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <span className="text-[11px] text-muted font-medium">Giao diện</span>
                </div>

                <div role="group" aria-label="Language switch" className="flex gap-0.5 rounded-lg border border-line p-0.5">
                  {(['vi', 'en'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      lang={l}
                      aria-pressed={language.locale === l}
                      aria-disabled={language.pending || undefined}
                      onClick={() => {
                        if (language.locale !== l && !language.pending) language.switchLanguage()
                      }}
                      className={cn(
                        'h-6 rounded-[4px] px-1.5 text-[10px] font-bold uppercase transition-colors',
                        language.locale === l ? 'bg-primary text-white' : 'text-muted hover:text-fg',
                        language.pending && 'cursor-wait opacity-60'
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Link */}
              <Link
                href="/profile"
                className="flex items-center gap-2.5 w-full p-2 rounded-lg border border-line bg-fg/[0.02] hover:bg-fg/5 text-xs text-muted hover:text-fg transition-colors"
                title="Hồ sơ tài khoản Super Admin"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fg/10 text-fg">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 truncate text-left">
                  <span className="block text-[11px] font-medium text-fg truncate">Hồ sơ Quản trị viên</span>
                  <span className="block text-[10px] text-muted truncate">Cài đặt & Xác thực 2FA</span>
                </div>
              </Link>
            </>
          )}
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur h-16 flex items-center justify-between px-4 sm:px-8 shrink-0">
          {/* Mobile Hamburger + Title */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-ctl border border-line text-muted hover:text-fg hover:bg-fg/5"
              aria-label="Mở menu quản trị"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Logo size="sm" />
          </div>

          {/* Desktop Search Trigger */}
          <div className="hidden sm:flex items-center">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-3 px-3.5 py-1.5 rounded-lg border border-line bg-panel hover:bg-fg/5 text-xs text-muted transition-all shadow-2xs group"
            >
              <Search className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
              <span>{t('searchPlaceholder')}</span>
              <kbd className="inline-flex items-center gap-0.5 rounded border border-line bg-fg/5 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Header Right Status Indicator */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/system"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-panel text-xs text-muted hover:text-fg hover:border-emerald-500/40 transition-colors shadow-2xs"
              title="Xem sức khỏe hạ tầng hệ thống"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline font-medium text-fg">{t('systemHealthy')}</span>
            </Link>

            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden p-2 rounded-lg border border-line text-muted hover:text-fg"
              title="Tìm kiếm"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-x-hidden">
          {children}
        </div>
      </div>

      {/* 3. Mobile Navigation Drawer (NO Back to workspace) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-panel border-r border-line h-full flex flex-col p-4 z-10 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <Logo size="sm" />
                <span className="font-bold text-xs text-primary px-1.5 py-0.5 rounded bg-primary/10">CONSOLE</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-fg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {NAV_GROUPS.map((group) => (
                <div key={group.groupKey} className="space-y-1">
                  <p className="px-3 text-[10px] font-bold text-muted/80 tracking-wider uppercase mb-1">
                    {t(`groups.${group.groupKey}`)}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const active =
                        item.href === '/admin'
                          ? pathname === '/admin'
                          : pathname === item.href || pathname?.startsWith(`${item.href}/`)
                      const Icon = item.icon
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                              active
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-muted hover:text-fg hover:bg-fg/5'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{t(`nav.${item.key}`)}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-line">
              <Link
                href="/profile"
                className="flex items-center gap-2 w-full p-2 rounded-lg border border-line bg-fg/[0.02] text-xs text-muted hover:text-fg"
              >
                <User className="h-4 w-4" />
                <span>Hồ sơ Quản trị viên</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4. Universal Search Command Palette Modal */}
      <Modal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} size="md">
        <ModalHeader className="border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Command className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-fg">Tìm kiếm nhanh toàn hệ thống</h3>
          </div>
        </ModalHeader>
        <ModalBody className="py-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập tên trang, gói cước, voucher, hệ thống..."
              className="pl-9 text-xs"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 pt-1">
            {searchResults.length > 0 ? (
              searchResults.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      setIsSearchOpen(false)
                      router.push(item.href)
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-fg/5 text-left text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                      <span className="font-medium text-fg">{item.title}</span>
                    </div>
                    <span className="text-[10px] text-muted font-mono bg-fg/5 px-2 py-0.5 rounded border border-line">
                      {item.category}
                    </span>
                  </button>
                )
              })
            ) : searchQuery.trim() ? (
              <p className="text-center py-6 text-xs text-muted">Không tìm thấy kết quả phù hợp</p>
            ) : (
              <div className="text-center py-6 space-y-1 text-xs text-muted">
                <p>Gõ từ khóa để tìm kiếm nhanh các trang quản trị nền tảng</p>
                <p className="text-[11px] text-muted/70">Mẹo: Bấm phím <strong>ESC</strong> để đóng</p>
              </div>
            )}
          </div>
        </ModalBody>
      </Modal>
    </div>
  )
}
