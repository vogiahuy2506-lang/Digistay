'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Avatar, Dropdown, DropdownDivider, DropdownItem } from '@/components/ui'
import { useTheme } from '@/components/layout/theme-root'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react'
import type { WorkspaceRole } from './nav'

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
 * Below `lg` the workspace switcher collapses into the brand line.
 */
export function WorkspaceTopBar({ workspace, workspaces, userName, userEmail, userImage }: WorkspaceTopBarProps) {
  const t = useTranslations('workspaces')
  const router = useRouter()
  const theme = useTheme()
  const [menuOpen, setMenuOpen] = React.useState(false)

  const signOutEverywhere = async () => {
    sessionStorage.setItem('justSignedOut', 'true')
    await signOut({ callbackUrl: '/' })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={routes.workspaces()}
              className="inline-flex items-center gap-2 rounded-ctl text-brand font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              <span className="w-2.5 h-2.5 rounded-[3px] bg-brand" aria-hidden="true" />
              Digistay
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
                  className="inline-flex items-center gap-1.5 rounded-ctl h-9 px-1.5 max-w-[220px] text-small text-fg hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                >
                  <span className="truncate">{workspace.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                </button>
              }
            >
              {workspaces.map((ws) => (
                <DropdownItem key={ws.id} onClick={() => router.push(routes.workspace(ws.slug))}>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.slug === workspace.slug && <span className="text-acc" aria-label="Đang chọn">✓</span>}
                </DropdownItem>
              ))}
              <DropdownDivider />
              <DropdownItem onClick={() => router.push(routes.workspaces())}>
                {t('allWorkspaces')}
              </DropdownItem>
            </Dropdown>
          </div>

          <div className="flex items-center gap-1">
            {theme && (
              <button
                type="button"
                onClick={() => theme.setPreference(theme.preference === 'dark' ? 'light' : 'dark')}
                aria-pressed={theme.preference === 'dark'}
                aria-label={t(theme.preference === 'dark' ? 'account.light' : 'account.dark')}
                className="w-9 h-9 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
              >
                {theme.preference === 'dark' ? (
                  <Sun className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Moon className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            )}
            <AccountMenu name={userName} email={userEmail} image={userImage} onSignOut={signOutEverywhere} />
          </div>
        </div>
      </div>
    </header>
  )
}

function AccountMenu({
  name,
  email,
  image,
  onSignOut,
}: {
  name?: string
  email?: string
  image?: string
  onSignOut: () => void
}) {
  const t = useTranslations('workspaces')
  const [open, setOpen] = React.useState(false)
  const initial = name ? name.trim().charAt(0).toUpperCase() : (email?.charAt(0) ?? '?').toUpperCase()

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-ctl h-9 px-1.5 max-w-[220px] hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
        >
          <Avatar src={image} name={name || email || 'User'} size="sm" />
          <span className="truncate text-small text-fg">{name || email}</span>
        </button>
      }
    >
      <DropdownItem onClick={onSignOut} danger icon={<LogOut className="w-4 h-4" />}>
        {t('account.signOut')}
      </DropdownItem>
    </Dropdown>
  )
}