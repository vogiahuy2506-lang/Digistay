'use client'

import Link from 'next/link'
import * as React from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarCheck,
  ChevronDown,
  ConciergeBell,
  CreditCard,
  Globe,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  ScrollText,
  Settings,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { useProperty, type PropertyContext } from '@/lib/hooks/use-property'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { useDialogBehavior } from '@/components/ui/dialog-behavior'
import { AccountMenu } from './account-menu'
import { NotificationBell } from './notification-bell'
import { NAV_GROUPS, activeHref, primaryNav, workspaceNav, type NavItem, type NavKey, type WorkspaceRole } from './nav'

/** One icon per menu entry, so the grouped menu reads at a glance. */
const NAV_ICONS: Record<NavKey, LucideIcon> = {
  overview: LayoutDashboard,
  properties: Building2,
  bookings: CalendarCheck,
  rooms: BedDouble,
  services: ConciergeBell,
  menu: UtensilsCrossed,
  payments: CreditCard,
  invoices: Receipt,
  reports: BarChart3,
  cashbook: Wallet,
  bankAccounts: Landmark,
  policies: ScrollText,
  website: Globe,
  members: UsersRound,
  billing: Package,
  settings: Settings,
}
import { useDocumentTitle } from './document-title'
import { Logo } from '@/components/marketing/Logo'

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

/**
 * Dashboard frame (redesign 4a): a 240 px sidebar from `lg` up; below that a
 * top bar whose menu button opens the same sidebar as a drawer.
 */
/**
 * Whose menu the sidebar shows: the property in the URL; on the workspace's
 * own pages (members, plan, settings) the one opened last, so going there
 * from a property keeps its menu (kept in this browser for a reload); none
 * on the property list and the new-property form.
 */
function useSidebarPropertyId(slug: string, pathname: string): string | undefined {
  const routeId = useParams<{ id?: string }>().id
  const key = `ds-last-property:${slug}`
  const [last, setLast] = React.useState<string | undefined>(routeId)
  React.useEffect(() => {
    try {
      if (routeId) {
        setLast(routeId)
        localStorage.setItem(key, routeId)
      } else if (!last) {
        setLast(localStorage.getItem(key) ?? undefined)
      }
    } catch {}
  }, [routeId, key, last])
  if (routeId) return routeId
  const home = routes.workspace(slug)
  if (pathname === home || pathname.startsWith(`${home}/properties`)) return undefined
  return last
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  const t = useTranslations('dash.common.nav')
  const pathname = usePathname()
  const sidebarPropertyId = useSidebarPropertyId(props.workspace.slug, pathname)
  const { property, error: propertyError } = useProperty(sidebarPropertyId)
  // A remembered property that is gone (deleted, no access): the workspace's menu.
  const propertyId = sidebarPropertyId && !propertyError ? sidebarPropertyId : undefined
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const drawerRef = React.useRef<HTMLDivElement>(null)
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), [])
  useDialogBehavior(drawerRef, drawerOpen, { onEscape: closeDrawer, modal: true })

  // Following a link in the drawer closes it.
  React.useEffect(() => setDrawerOpen(false), [pathname])

  return (
    <div className="lg:flex min-h-screen">
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-line bg-page [&:has([data-bell-open])]:z-[45]">
        <SidebarContent {...props} pathname={pathname} property={property} propertyId={propertyId} />
      </aside>

      <header className="lg:hidden sticky top-0 z-30 [&:has([data-bell-open])]:z-[45] flex items-center gap-2 h-14 px-2 border-b border-line bg-page/95 backdrop-blur">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t('openMenu')}
          aria-expanded={drawerOpen}
          className="w-11 h-11 rounded-ctl flex items-center justify-center text-fg hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <Brand slug={props.workspace.slug} />
        <div className="ml-auto pr-1">
          <NotificationBell />
        </div>
      </header>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('drawer')}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-page border-r border-line animate-drawer-in motion-reduce:animate-none focus:outline-none"
          >
            <button
              type="button"
              onClick={closeDrawer}
              aria-label={t('closeMenu')}
              className="absolute top-3 right-3 w-9 h-9 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <SidebarContent {...props} pathname={pathname} property={property} propertyId={propertyId} />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">{props.children}</main>
    </div>
  )
}

function Brand({ slug }: { slug: string }) {
  return (
    <Link
      href={routes.workspace(slug)}
      className="inline-flex items-center h-9 px-1 rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
    >
      <Logo size="sm" />
    </Link>
  )
}

function SidebarContent({
  workspace,
  workspaces,
  userName,
  userEmail,
  userImage,
  pathname,
  property,
  propertyId,
}: WorkspaceShellProps & { pathname: string; property: PropertyContext | null; propertyId: string | undefined }) {
  const t = useTranslations('dash.common.nav')
  const labels = useDashLabels()
  const router = useRouter()
  const params = useParams<{ slug: string; id?: string }>()
  const slug = params.slug ?? workspace.slug

  const allowed = (item: NavItem) => item.roles.includes(workspace.role)
  const main = primaryNav(slug, propertyId).filter(allowed)
  const bottom = workspaceNav(slug).filter(allowed)
  const current = activeHref(pathname, [...main, ...bottom])
  // The tab's title: "Đặt phòng · Khách sạn Demo Hà Nội · Digistay" (both
  // sidebars render this; the same title twice changes nothing). From every
  // entry, not only the role's: a page opened by its URL still says what it is.
  const every = [...primaryNav(slug, propertyId), ...workspaceNav(slug)]
  const page = every.find((item) => item.href === activeHref(pathname, every))
  // A property's page names the property; the workspace's own pages the workspace.
  useDocumentTitle([page && t(page.key), params.id ? property?.name : workspace.name])

  // The menu scrolls when the window is short: a fade over its last visible
  // items says there is more below, above the account block.
  const navRef = React.useRef<HTMLElement>(null)
  const [more, setMore] = React.useState(false)
  React.useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const update = () => setMore(nav.scrollTop + nav.clientHeight < nav.scrollHeight - 4)
    update()
    nav.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(nav)
    return () => {
      nav.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  const renderItem = (item: NavItem) => {
    const active = item.href === current
    const Icon = NAV_ICONS[item.key]
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 h-10 lg:h-8 px-3 rounded-ctl text-sm transition-colors duration-160',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
          active ? 'bg-acc-soft text-acc font-medium' : 'text-fg/80 hover:text-fg hover:bg-fg/5'
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-acc' : 'text-muted')} aria-hidden="true" />
        <span className="truncate">{t(item.key)}</span>
      </Link>
    )
  }
  // Both sidebars (desk, phone drawer) draw this: ids of their own for the section headings.
  const groupId = React.useId()
  // The entries by section (nav.ts NAV_GROUPS); a section the role sees nothing of is left out.
  const sections = NAV_GROUPS.map((group) => ({ group, items: [...main, ...bottom].filter((item) => item.group === group) })).filter(
    (section) => section.items.length > 0
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-3 pb-2 shrink-0 flex items-center justify-between">
        <Brand slug={slug} />
        {/* On phones the top bar has it; the drawer's close button sits here. */}
        <div className="hidden lg:block">
          <NotificationBell align="left" />
        </div>
      </div>

      {/* Context switcher: the hotel being managed, or the workspace. */}
      <div className="px-3 pb-2 shrink-0">
        <Dropdown
          align="left"
          className="w-full"
          trigger={
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-box border border-line bg-panel text-left hover:border-muted transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg truncate">
                  {propertyId ? property?.name ?? '…' : workspace.name}
                </span>
                <span className="block text-xs text-muted truncate">
                  {propertyId
                    ? property
                      ? `${property.subdomain}.digistay.vn`
                      : ''
                    : labels.role(workspace.role)}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            </button>
          }
        >
          {/* Dropdown clones each direct child, so no fragments here. */}
          {propertyId && <DropdownItem onClick={() => router.push(routes.workspace(slug))}>{t('switchProperty')}</DropdownItem>}
          {propertyId && <DropdownDivider />}
          {workspaces.map((ws) => (
            <DropdownItem key={ws.id} onClick={() => router.push(routes.workspace(ws.slug))}>
              <span className="flex-1 truncate">{ws.name}</span>
              {ws.slug === workspace.slug && <span className="text-acc" aria-label={t('current')}>✓</span>}
            </DropdownItem>
          ))}
          <DropdownDivider />
          <DropdownItem onClick={() => router.push(routes.workspaces())}>{t('allWorkspaces')}</DropdownItem>
        </Dropdown>
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col">
        <nav ref={navRef} aria-label={t('main')} className="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
          {sections.map(({ group, items }) =>
            group === 'main' ? (
              <div key={group} className="space-y-0.5">
                {items.map(renderItem)}
              </div>
            ) : (
              <div key={group} role="group" aria-labelledby={`${groupId}-${group}`} className="mt-3">
                <p id={`${groupId}-${group}`} className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                  {t(`groups.${group}`)}
                </p>
                <div className="space-y-0.5">{items.map(renderItem)}</div>
              </div>
            )
          )}
        </nav>
        {more && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-center bg-gradient-to-t from-page via-page/80 to-transparent pb-0.5"
          >
            <ChevronDown className="h-4 w-4 text-muted" />
          </div>
        )}
      </div>

      <UserBlock name={userName} email={userEmail} image={userImage} role={workspace.role} />
    </div>
  )
}

/**
 * The foot of the sidebar: the user, whose row opens the account menu
 * (profile, theme, language, sign out) upwards.
 */
function UserBlock({ name, email, image, role }: { name?: string; email?: string; image?: string; role: WorkspaceRole }) {
  const labels = useDashLabels()

  return (
    <div className="shrink-0 border-t border-line px-3 py-2">
      {/* signOut() sends NextAuth's CSRF token; the old bare form POST had none,
          so NextAuth ignored it and the session survived. */}
      <AccountMenu
        variant="sidebar"
        name={name}
        email={email}
        image={image}
        detail={labels.role(role)}
        onSignOut={() => signOut({ callbackUrl: '/login' })}
      />
    </div>
  )
}
