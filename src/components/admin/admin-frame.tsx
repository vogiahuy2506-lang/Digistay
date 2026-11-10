'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
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
  ShieldCheck,
  Sun,
  Ticket,
  X,
  Zap,
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
      { href: '/admin/plans', key: 'plans', icon: CreditCard },
      { href: '/admin/vouchers', key: 'vouchers', icon: Ticket },
    ],
  },
  {
    groupKey: 'system',
    items: [
      { href: '/admin/system', key: 'system', icon: Server },
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
      { title: 'Sức khỏe Hệ thống, Redis, Postgres & Cronjobs', href: '/admin/system', icon: Server, category: 'Hạ tầng' },
      { title: 'Nhật ký Hoạt động & Kiểm toán (Audit Log)', href: '/admin/activity', icon: History, category: 'Bảo mật' },
      { title: 'Quản lý Khách hàng & Workspace', href: '/admin/customers', icon: Building2, category: 'Khách hàng' },
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
          'hidden md:flex flex-col border-r border-line bg-panel/90 backdrop-blur sticky top-0 h-screen transition-all duration-200 z-40',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-line shrink-0">
          <Link
            href="/admin"
            className={cn('flex items-center gap-2.5 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-acc rounded-ctl', isCollapsed && 'justify-center w-full')}
          >
            <Logo size="sm" />
            {!isCollapsed && (
              <span className="font-bold text-sm tracking-tight text-fg truncate">
                DIGISTAY
              </span>
            )}
          </Link>
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="p-1 rounded-ctl text-muted hover:text-fg hover:bg-fg/5 transition-colors"
              title="Thu gọn thanh điều hướng"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Superadmin Badge Pill */}
        <div className="p-3 border-b border-line shrink-0">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-acc/30 bg-acc/10 py-1.5 text-xs font-semibold text-acc transition-all',
              isCollapsed ? 'justify-center px-1' : 'px-3'
            )}
            title="Super Admin Platform Console"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!isCollapsed && <span className="tracking-wide uppercase text-[11px]">SUPER ADMIN</span>}
          </div>
        </div>

        {/* Navigation Items (Grouped) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupKey} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[10px] font-semibold text-muted tracking-wider uppercase mb-1.5">
                  {t(`groups.${group.groupKey}`)}
                </p>
              )}
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
                          'flex items-center gap-3 rounded-ctl px-3 py-2 text-xs font-medium transition-all group relative',
                          active
                            ? 'bg-acc text-acc-fg font-semibold shadow-xs'
                            : 'text-muted hover:text-fg hover:bg-fg/5',
                          isCollapsed && 'justify-center px-2 py-2.5'
                        )}
                        title={isCollapsed ? t(`nav.${item.key}`) : undefined}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-105', active ? 'text-acc-fg' : 'text-muted group-hover:text-fg')} aria-hidden="true" />
                        {!isCollapsed && <span className="truncate">{t(`nav.${item.key}`)}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t border-line space-y-2 shrink-0 bg-fg/[0.01]">
          {isCollapsed ? (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="w-full flex items-center justify-center p-2 rounded-ctl text-muted hover:text-fg hover:bg-fg/5 transition-colors"
              title="Mở rộng thanh điều hướng"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {/* Theme & Language Bar */}
              <div className="flex items-center justify-between px-1">
                {theme && (
                  <button
                    type="button"
                    aria-label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
                    title={dark ? 'Chế độ sáng' : 'Chế độ tối'}
                    onClick={() => theme.setPreference(dark ? 'light' : 'dark')}
                    className="flex h-7 w-7 items-center justify-center rounded-ctl border border-line text-muted transition-colors hover:bg-fg/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                  >
                    {dark ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                )}

                <div role="group" aria-label="Language switch" className="flex gap-0.5 rounded-ctl border border-line p-0.5">
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
                        'h-6 rounded-[3px] px-1.5 text-[11px] font-semibold uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
                        language.locale === l ? 'bg-ink text-on-ink' : 'text-muted hover:text-fg',
                        language.pending && 'cursor-wait opacity-60'
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Escape back to Workspace */}
              <Link
                href="/workspaces"
                className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-ctl border border-line bg-panel hover:bg-fg/5 text-xs font-medium text-muted hover:text-fg transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate">{t('back')}</span>
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
              className="p-1.5 rounded-ctl border border-line text-muted hover:text-fg"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Logo size="sm" />
          </div>

          {/* Universal Search Bar Trigger */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-ctl border border-line bg-fg/[0.03] text-muted hover:text-fg hover:border-acc/40 transition-colors w-64 md:w-80 text-xs text-left"
          >
            <Search className="w-3.5 h-3.5 shrink-0 text-muted" />
            <span className="truncate flex-1">{t('searchPlaceholder')}</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-line bg-panel text-[10px] font-mono font-medium text-muted">
              Ctrl K
            </kbd>
          </button>

          {/* Right Status & Actions */}
          <div className="flex items-center gap-3">
            {/* System Health Badge */}
            <Link
              href="/admin/system"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              title="Xem sức khỏe hạ tầng hệ thống"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">{t('systemHealthy')}</span>
            </Link>

            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden p-2 rounded-ctl border border-line text-muted hover:text-fg"
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

      {/* 3. Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-page border-r border-line h-full flex flex-col p-4 z-10 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <Logo size="sm" />
                <span className="font-bold text-sm text-fg">DIGISTAY ADMIN</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-ctl text-muted hover:text-fg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {NAV_GROUPS.map((group) => (
                <div key={group.groupKey} className="space-y-1">
                  <p className="px-3 text-[10px] font-semibold text-muted tracking-wider uppercase mb-1">
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
                              'flex items-center gap-3 rounded-ctl px-3 py-2 text-xs font-medium transition-colors',
                              active
                                ? 'bg-acc text-acc-fg font-semibold'
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

            <div className="pt-4 border-t border-line space-y-3">
              <Link
                href="/workspaces"
                className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-ctl border border-line bg-panel text-xs font-medium text-muted hover:text-fg"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t('back')}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4. Universal Search Command Palette Modal */}
      <Modal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} size="md">
        <ModalHeader className="border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Command className="w-4 h-4 text-acc" />
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
                    className="w-full flex items-center justify-between p-2.5 rounded-ctl hover:bg-fg/5 text-left text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-muted group-hover:text-acc transition-colors" />
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
