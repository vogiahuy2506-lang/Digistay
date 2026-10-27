'use client'

import Image from 'next/image'
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
  House,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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
import {
  SIDEBAR_DEFAULT,
  SIDEBAR_FOLD_AT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  SIDEBAR_RAIL,
  clampSidebarWidth,
  foldsSidebar,
  saveSidebarPref,
  type SidebarPref,
} from '@/lib/sidebar'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { useDialogBehavior } from '@/components/ui/dialog-behavior'
import { AccountMenu } from './account-menu'
import { NotificationBell } from './notification-bell'
import { NAV_GROUPS, activeHref, primaryNav, workspaceNav, type NavGroup, type NavItem, type NavKey, type WorkspaceRole } from './nav'

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
import { accessCan, useWorkspaceAccess } from './workspace-context'
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
  /** The width and fold the user left the sidebar at (the ds-sidebar cookie, src/lib/sidebar.ts). */
  sidebar: SidebarPref
  children: React.ReactNode
}

type SidebarProps = Omit<WorkspaceShellProps, 'children' | 'sidebar'> & {
  pathname: string
  property: PropertyContext | null
  propertyId: string | undefined
}

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

/**
 * The desk sidebar's width: the user's (dragged by its edge, kept in a
 * cookie), or the rail of icons when folded. Pages that need the room
 * (foldsSidebar: the website builder) fold it while open; opening it
 * there lasts until the user leaves the page and is not kept.
 */
function useSidebarSize(initial: SidebarPref, pathname: string) {
  const [pref, setPref] = React.useState(initial)
  const [here, setHere] = React.useState<{ path: string; collapsed: boolean } | null>(null)
  // While the edge is dragged: the width under the pointer, not saved yet.
  const [drag, setDrag] = React.useState<SidebarPref | null>(null)
  const folds = foldsSidebar(pathname)
  // Leaving the page ends it: back there, the sidebar folds again.
  React.useEffect(() => {
    setHere((current) => (current && current.path !== pathname ? null : current))
  }, [pathname])
  const collapsed = drag ? drag.collapsed : here?.path === pathname ? here.collapsed : folds || pref.collapsed
  const width = collapsed ? SIDEBAR_RAIL : (drag?.width ?? pref.width)

  const commit = (next: SidebarPref) => {
    // A page that folds the sidebar keeps the width the user gives it, not its fold.
    const saved = { width: clampSidebarWidth(next.width), collapsed: folds ? pref.collapsed : next.collapsed }
    if (saved.width !== pref.width || saved.collapsed !== pref.collapsed) {
      setPref(saved)
      saveSidebarPref(saved)
    }
    if (folds) setHere({ path: pathname, collapsed: next.collapsed })
  }

  // The width eases when it changes at once (fold, open, a page that folds
  // it); meanwhile the content is clipped, so an opening sidebar's labels do
  // not spill over the page. Not while dragging: the edge follows the pointer.
  const [clip, setClip] = React.useState(false)
  const shown = React.useRef(width)
  React.useLayoutEffect(() => {
    if (shown.current !== width && !drag) setClip(true)
    shown.current = width
  }, [width, drag])
  React.useEffect(() => {
    if (!clip) return
    const timer = window.setTimeout(() => setClip(false), 220)
    return () => window.clearTimeout(timer)
  }, [clip, width])

  const startDrag = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const from = collapsed ? SIDEBAR_RAIL : pref.width
    let last: SidebarPref = { width: pref.width, collapsed }
    const move = (e: PointerEvent) => {
      const raw = from + e.clientX - startX
      // Narrower than the fold point folds it; the open width it had before the drag is kept for later.
      last = raw < SIDEBAR_FOLD_AT ? { width: pref.width, collapsed: true } : { width: clampSidebarWidth(raw), collapsed: false }
      setDrag(last)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      document.documentElement.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      setDrag(null)
      commit(last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    // The resize cursor and no text selection across the page while dragging.
    document.documentElement.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    setDrag(last)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = 16
    let next: SidebarPref | null = null
    if (event.key === 'ArrowRight') next = { width: collapsed ? pref.width : pref.width + step, collapsed: false }
    else if (event.key === 'ArrowLeft' && !collapsed)
      next = pref.width - step < SIDEBAR_MIN ? { width: pref.width, collapsed: true } : { width: pref.width - step, collapsed: false }
    else if (event.key === 'Home') next = { width: SIDEBAR_MIN, collapsed: false }
    else if (event.key === 'End') next = { width: SIDEBAR_MAX, collapsed: false }
    else if (event.key === 'Enter' || event.key === ' ') next = { width: pref.width, collapsed: !collapsed }
    if (!next) return
    event.preventDefault()
    commit(next)
  }

  return {
    collapsed,
    width,
    dragging: !!drag,
    clip,
    setCollapsed: (value: boolean) => commit({ width: pref.width, collapsed: value }),
    handle: {
      onPointerDown: startDrag,
      onKeyDown,
      // Double-click: back to the usual width.
      onDoubleClick: () => commit({ width: SIDEBAR_DEFAULT, collapsed: false }),
    },
  }
}

/**
 * Dashboard frame: from `lg` up the sidebar, which the user can fold to a
 * rail of icons and widen or narrow by its edge; below that a top bar
 * whose menu button opens the same sidebar as a drawer.
 */
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
  const size = useSidebarSize(props.sidebar, pathname)

  // Following a link in the drawer closes it.
  React.useEffect(() => setDrawerOpen(false), [pathname])

  const sidebar: SidebarProps = {
    workspace: props.workspace,
    workspaces: props.workspaces,
    userName: props.userName,
    userEmail: props.userEmail,
    userImage: props.userImage,
    pathname,
    property,
    propertyId,
  }

  return (
    <div className="lg:flex min-h-screen">
      <aside
        style={{ width: size.width }}
        className={cn(
          'hidden lg:flex flex-col shrink-0 h-screen sticky top-0 border-r border-line bg-page',
          // Lifted above the page while something of its own spills over it: the bell, a menu, a rail label.
          '[&:has([data-bell-open])]:z-[45] [&:has([role=menu])]:z-[45] [&:has([data-rail-tip])]:z-[45]',
          !size.dragging && 'transition-[width] duration-200 ease-out motion-reduce:transition-none',
          size.clip && 'overflow-hidden'
        )}
      >
        {size.collapsed ? (
          <SidebarRail {...sidebar} onExpand={() => size.setCollapsed(false)} />
        ) : (
          <SidebarContent {...sidebar} onCollapse={() => size.setCollapsed(true)} />
        )}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('resize')}
          aria-valuemin={SIDEBAR_RAIL}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={size.width}
          tabIndex={0}
          title={t('resizeHint')}
          {...size.handle}
          className="group/resize absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none focus:outline-none"
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors duration-160',
              size.dragging ? 'bg-acc' : 'bg-transparent group-hover/resize:bg-acc/50 group-focus-visible/resize:bg-acc'
            )}
          />
        </div>
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
        <div className="ml-auto pr-1 flex items-center">
          <HomeLink className="w-9 h-9" />
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
            <SidebarContent {...sidebar} />
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

const iconButton =
  'rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'

/** Digistay's home page (the public site), out of the workspace. */
function HomeLink({ className, ...tip }: { className: string } & Partial<TipHandlers>) {
  const t = useTranslations('dash.common.nav')
  return (
    <Link href="/" aria-label={t('home')} title={tip.onMouseEnter ? undefined : t('home')} className={cn(iconButton, className)} {...tip}>
      <House className="w-4 h-4" aria-hidden="true" />
    </Link>
  )
}

/**
 * The menu entries the user may open, by section, and the tab's title:
 * shared by the open sidebar and the rail.
 */
function useSidebarNav({ workspace, pathname, property, propertyId }: SidebarProps) {
  const t = useTranslations('dash.common.nav')
  const params = useParams<{ slug: string; id?: string }>()
  const slug = params.slug ?? workspace.slug

  const access = useWorkspaceAccess()
  // The menu of the property shown: a member limited to some properties sees its entries there only.
  const allowed = (item: NavItem) => !item.can || item.can.some((p) => accessCan(access, p, propertyId))
  const main = primaryNav(slug, propertyId).filter(allowed)
  const bottom = workspaceNav(slug).filter(allowed)
  const current = activeHref(pathname, [...main, ...bottom])
  // The tab's title: "Đặt phòng · Khách sạn Demo Hà Nội · Digistay" (both
  // sidebars render this; the same title twice changes nothing). From every
  // entry, not only the allowed ones: a page opened by its URL still says what it is.
  const every = [...primaryNav(slug, propertyId), ...workspaceNav(slug)]
  const page = every.find((item) => item.href === activeHref(pathname, every))
  // A property's page names the property; the workspace's own pages the workspace.
  useDocumentTitle([page && t(page.key), params.id ? property?.name : workspace.name])

  // The entries by section (nav.ts NAV_GROUPS); a section the role sees nothing of is left out.
  const sections: { group: NavGroup; items: NavItem[] }[] = NAV_GROUPS.map((group) => ({
    group,
    items: [...main, ...bottom].filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0)

  return { slug, access, current, sections }
}

/** The context switcher's entries: the property list, the workspaces. */
function useSwitcherItems({ slug, propertyId, workspaces, workspace }: { slug: string; propertyId?: string } & Pick<SidebarProps, 'workspaces' | 'workspace'>) {
  const t = useTranslations('dash.common.nav')
  const router = useRouter()
  // Dropdown clones each direct child, so a flat list, no fragments.
  return [
    propertyId ? <DropdownItem key="switch" onClick={() => router.push(routes.workspace(slug))}>{t('switchProperty')}</DropdownItem> : null,
    propertyId ? <DropdownDivider key="switch-divider" /> : null,
    ...workspaces.map((ws) => (
      <DropdownItem key={ws.id} onClick={() => router.push(routes.workspace(ws.slug))}>
        <span className="flex-1 truncate">{ws.name}</span>
        {ws.slug === workspace.slug && <span className="text-acc" aria-label={t('current')}>✓</span>}
      </DropdownItem>
    )),
    <DropdownDivider key="all-divider" />,
    <DropdownItem key="all" onClick={() => router.push(routes.workspaces())}>{t('allWorkspaces')}</DropdownItem>,
  ]
}

function SidebarContent(props: SidebarProps & { onCollapse?: () => void }) {
  const { workspace, workspaces, userName, userEmail, userImage, property, propertyId, onCollapse } = props
  const t = useTranslations('dash.common.nav')
  const labels = useDashLabels()
  const { slug, access, current, sections } = useSidebarNav(props)
  const switcher = useSwitcherItems({ slug, propertyId, workspaces, workspace })

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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-3 pb-2 shrink-0 flex items-center justify-between gap-1">
        <Brand slug={slug} />
        {/* On phones the top bar has these; the drawer's close button sits here. */}
        <div className="hidden lg:flex items-center">
          <HomeLink className="w-8 h-8" />
          <NotificationBell align="left" buttonClassName="w-8 h-8" />
          {onCollapse && (
            <button type="button" onClick={onCollapse} aria-label={t('collapse')} title={t('collapse')} className={cn(iconButton, 'w-8 h-8')}>
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
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
                    : labels.role(access?.isOwner ? 'OWNER' : workspace.role)}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            </button>
          }
        >
          {switcher}
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

      <UserBlock name={userName} email={userEmail} image={userImage} role={access?.isOwner ? 'OWNER' : workspace.role} />
    </div>
  )
}

interface TipHandlers {
  onMouseEnter: (event: React.MouseEvent<HTMLElement>) => void
  onMouseLeave: () => void
  onFocus: (event: React.FocusEvent<HTMLElement>) => void
  onBlur: () => void
  onMouseDown: () => void
}

/**
 * The folded sidebar: the same entries as icons, each named in a label at
 * its right on hover or focus (drawn fixed, so the scrolling menu does not
 * clip it), the switcher and the account behind their own buttons.
 */
function SidebarRail(props: SidebarProps & { onExpand: () => void }) {
  const { workspace, workspaces, userName, userEmail, userImage, property, propertyId, onExpand } = props
  const t = useTranslations('dash.common.nav')
  const labels = useDashLabels()
  const { slug, access, current, sections } = useSidebarNav(props)
  const switcher = useSwitcherItems({ slug, propertyId, workspaces, workspace })
  const [tip, setTip] = React.useState<{ label: string; top: number } | null>(null)

  const tipFor = (label: string): TipHandlers => {
    const show = (el: HTMLElement) => {
      const box = el.getBoundingClientRect()
      setTip({ label, top: box.top + box.height / 2 })
    }
    return {
      onMouseEnter: (e) => show(e.currentTarget),
      onMouseLeave: () => setTip(null),
      // Keyboard focus only: a click focuses too, and the label would come back over an opening menu.
      onFocus: (e) => {
        if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget)
      },
      onBlur: () => setTip(null),
      onMouseDown: () => setTip(null),
    }
  }

  // relative: holds each sr-only name inside the scrolling menu, or the names below the fold stretch the page.
  const railItem =
    'relative w-10 h-10 shrink-0 rounded-ctl flex items-center justify-center transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
  const context = propertyId ? property?.name ?? '…' : workspace.name

  return (
    <div className="flex flex-col h-full min-h-0 items-center">
      <div className="pt-3 pb-1 shrink-0 flex flex-col items-center gap-1">
        <Link href={routes.workspace(slug)} className={cn(railItem, 'mb-1')} {...tipFor(workspace.name)}>
          <Image src="/icon.png" alt="Digistay" width={512} height={512} className="h-[26px] w-[26px]" />
        </Link>
        <button type="button" onClick={onExpand} aria-label={t('expand')} className={cn(railItem, 'text-muted hover:text-fg hover:bg-fg/5')} {...tipFor(t('expand'))}>
          <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
        </button>
        <HomeLink className="w-10 h-10" {...tipFor(t('home'))} />
        <NotificationBell align="left" buttonClassName="w-10 h-10" />
      </div>

      <div className="py-2 shrink-0">
        <Dropdown
          align="left"
          className="w-64"
          trigger={
            <button
              type="button"
              aria-label={context}
              className={cn(railItem, 'border border-line bg-panel text-muted hover:border-muted hover:text-fg')}
              {...tipFor(
                propertyId && property ? `${property.name} · ${property.subdomain}.digistay.vn` : `${workspace.name} · ${labels.role(access?.isOwner ? 'OWNER' : workspace.role)}`
              )}
            >
              <Building2 className="w-4 h-4" aria-hidden="true" />
            </button>
          }
        >
          {switcher}
        </Dropdown>
      </div>

      <nav
        aria-label={t('main')}
        onScroll={() => setTip(null)}
        className="flex-1 min-h-0 w-full overflow-y-auto pb-2 flex flex-col items-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map(({ group, items }, index) => (
          <div key={group} role={group === 'main' ? undefined : 'group'} aria-label={group === 'main' ? undefined : t(`groups.${group}`)} className="flex flex-col items-center gap-0.5">
            {index > 0 && <div aria-hidden="true" className="my-1.5 h-px w-6 bg-line" />}
            {items.map((item) => {
              const active = item.href === current
              const Icon = NAV_ICONS[item.key]
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(railItem, active ? 'bg-acc-soft text-acc' : 'text-muted hover:text-fg hover:bg-fg/5')}
                  {...tipFor(t(item.key))}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="sr-only">{t(item.key)}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 w-full border-t border-line py-2 flex justify-center">
        <AccountMenu
          variant="rail"
          name={userName}
          email={userEmail}
          image={userImage}
          detail={labels.role(access?.isOwner ? 'OWNER' : workspace.role)}
          onSignOut={() => signOut({ callbackUrl: '/login' })}
        />
      </div>

      {tip && (
        <div
          data-rail-tip=""
          aria-hidden="true"
          style={{ top: tip.top, left: SIDEBAR_RAIL + 6 }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-ctl bg-ink px-2.5 py-1.5 text-xs font-medium text-on-ink shadow-lift"
        >
          {tip.label}
        </div>
      )}
    </div>
  )
}

/**
 * The foot of the sidebar: the user, whose row opens the account menu
 * (profile, theme, language, sign out) upwards.
 */
function UserBlock({ name, email, image, role }: { name?: string; email?: string; image?: string; role: WorkspaceRole | 'OWNER' }) {
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
