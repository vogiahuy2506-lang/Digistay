'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Dropdown, DropdownDivider, DropdownItem } from '@/components/ui'
import { routes } from '@/lib/utils/routes'
import { ChevronDown } from 'lucide-react'
import type { WorkspaceRole } from './nav'
import { AccountMenu } from './account-menu'
import { NotificationBell } from './notification-bell'
import { Logo } from '@/components/marketing/Logo'

interface WorkspaceTopBarProps {
  workspace: { id: string; name: string; slug: string; role: WorkspaceRole }
  workspaces: { id: string; name: string; slug: string; role: WorkspaceRole }[]
  userName?: string
  userEmail?: string
  userImage?: string
}

/**
 * The bar on top of the workspace level pages, the same shape as the one on
 * /workspaces: the brand, the workspace being shown, and the account menu.
 * It spans the window with the property pages' side padding (PageContainer),
 * the brand at the left edge and the controls at the right, however wide.
 * Theme and language live in the account menu, with the profile and sign out.
 */
export function WorkspaceTopBar({ workspace, workspaces, userName, userEmail, userImage }: WorkspaceTopBarProps) {
  const t = useTranslations('workspaces')
  const router = useRouter()
  const [menuOpen, setMenuOpen] = React.useState(false)

  const signOutEverywhere = async () => {
    sessionStorage.setItem('justSignedOut', 'true')
    await signOut({ callbackUrl: '/' })
  }

  return (
    <header className="sticky top-0 z-30 [&:has([data-bell-open])]:z-[45] [&:has([data-account-open])]:z-[45] border-b border-line bg-page/90 backdrop-blur">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={routes.workspaces()}
              className="inline-flex shrink-0 items-center rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              <Logo size="sm" markBelowSm />
            </Link>

            <span aria-hidden="true" className="hidden sm:block w-px h-4 bg-line" />

            {/* The workspace being shown, and the way to another one. */}
            <Dropdown
              align="left"
              className="w-64"
              trigger={
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 rounded-ctl h-9 px-1.5 max-w-[50vw] sm:max-w-[220px] text-small text-fg hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                >
                  <span className="truncate">{workspace.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                </button>
              }
            >
              {workspaces.map((ws) => (
                <DropdownItem key={ws.id} onClick={() => router.push(routes.workspace(ws.slug))}>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.slug === workspace.slug && <span className="text-acc" aria-label={t('current')}>✓</span>}
                </DropdownItem>
              ))}
              <DropdownDivider />
              <DropdownItem onClick={() => router.push(routes.workspaces())}>
                {t('allWorkspaces')}
              </DropdownItem>
            </Dropdown>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <AccountMenu variant="bar" name={userName} email={userEmail} image={userImage} onSignOut={signOutEverywhere} />
          </div>
        </div>
      </div>
    </header>
  )
}
