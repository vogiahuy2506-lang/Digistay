'use client'

import Link from 'next/link'
import * as React from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { useProperty, type PropertyContext } from '@/lib/hooks/use-property'
import { Avatar, Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { useDialogBehavior } from '@/components/ui/dialog-behavior'
import { useTheme } from './theme-root'
import { LanguageButton } from './language-button'
import { NotificationBell } from './notification-bell'
import { activeHref, primaryNav, workspaceNav, type NavItem, type WorkspaceRole } from './nav'
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
export function WorkspaceShell(props: WorkspaceShellProps) {
  const t = useTranslations('dash.common.nav')
  const pathname = usePathname()
  const { property } = useProperty()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const drawerRef = React.useRef<HTMLDivElement>(null)
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), [])
  useDialogBehavior(drawerRef, drawerOpen, { onEscape: closeDrawer, modal: true })

  // Following a link in the drawer closes it.
  React.useEffect(() => setDrawerOpen(false), [pathname])

  return (
    <div className="lg:flex min-h-screen">
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-line bg-page [&:has([data-bell-open])]:z-[45]">
        <SidebarContent {...props} pathname={pathname} property={property} />
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
            <SidebarContent {...props} pathname={pathname} property={property} />
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
}: WorkspaceShellProps & { pathname: string; property: PropertyContext | null }) {
  const t = useTranslations('dash.common.nav')
  const labels = useDashLabels()
  const router = useRouter()
  const params = useParams<{ slug: string; id?: string }>()
  const slug = params.slug ?? workspace.slug
  const propertyId = params.id

  const allowed = (item: NavItem) => item.roles.includes(workspace.role)
  const main = primaryNav(slug, propertyId).filter(allowed)
  const bottom = workspaceNav(slug).filter(allowed)
  const current = activeHref(pathname, [...main, ...bottom])
  // The tab's title: "Đặt phòng · Khách sạn Demo Hà Nội · Digistay" (both
  // sidebars render this; the same title twice changes nothing). From every
  // entry, not only the role's: a page opened by its URL still says what it is.
  const every = [...primaryNav(slug, propertyId), ...workspaceNav(slug)]
  const page = every.find((item) => item.href === activeHref(pathname, every))
  useDocumentTitle([page && t(page.key), propertyId ? property?.name : workspace.name])

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
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center h-10 lg:h-8 px-3 rounded-ctl text-sm transition-colors duration-160',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
          active ? 'bg-acc-soft text-acc font-medium' : 'text-fg/80 hover:text-fg hover:bg-fg/5'
        )}
      >
        {t(item.key)}
      </Link>
    )
  }

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
          <div className="space-y-0.5">{main.map(renderItem)}</div>
          {bottom.length > 0 && (
            <>
              <div className="my-2 mx-3 border-t border-line" role="separator" />
              <div className="space-y-0.5">{bottom.map(renderItem)}</div>
            </>
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

function UserBlock({ name, email, image, role }: { name?: string; email?: string; image?: string; role: WorkspaceRole }) {
  const t = useTranslations('dash.common.shell')
  const labels = useDashLabels()
  const theme = useTheme()
  const dark = theme?.preference === 'dark'
  const iconButton =
    'w-8 h-8 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors duration-160 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc disabled:opacity-40 disabled:cursor-not-allowed'

  // The name has the block's whole width; the role shares the second line with the buttons.
  return (
    <div className="shrink-0 border-t border-line px-3 py-2.5 flex items-start gap-2.5">
      <Avatar src={image} name={name || t('user')} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg truncate" title={email}>
          {name || email || t('user')}
        </p>
        <div className="flex items-center justify-between gap-1">
          <p className="min-w-0 text-xs text-muted truncate">{labels.role(role)}</p>
          <div className="-mr-1 flex shrink-0 items-center">
            {theme && (
              <button
                type="button"
                onClick={() => theme.setPreference(dark ? 'light' : 'dark')}
                aria-pressed={dark}
                aria-label={t('darkTheme')}
                title={theme.darkAvailable ? (dark ? t('toLight') : t('toDark')) : t('noDarkHere')}
                className={iconButton}
              >
                {dark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
              </button>
            )}
            <LanguageButton compact />
            {/* signOut() sends NextAuth's CSRF token; the old bare form POST had none,
                so NextAuth ignored it and the session survived. */}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              aria-label={t('signOut')}
              title={t('signOut')}
              className={cn(iconButton, 'hover:text-err hover:bg-err-soft')}
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
