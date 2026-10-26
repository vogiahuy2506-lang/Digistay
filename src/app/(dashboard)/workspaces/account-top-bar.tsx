'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Avatar, Dropdown, DropdownDivider, DropdownItem } from '@/components/ui'
import { useTheme } from '@/components/layout/theme-root'
import { LanguageButton } from '@/components/layout/language-button'
import { Logo } from '@/components/marketing/Logo'
import { routes } from '@/lib/utils/routes'
import { Building2, LogOut, Moon, Sun, UserRound } from 'lucide-react'

/**
 * The slim bar of the account pages (/workspaces, /profile): the brand, which
 * leads back to the workspaces, the theme and language buttons, and the
 * account menu. No workspace is open here, so there is no switcher.
 * The name comes from the session (SessionScope in the dashboard layout).
 */
export function AccountTopBar() {
  const t = useTranslations('workspaces')
  const router = useRouter()
  const theme = useTheme()
  const { data: session } = useSession()
  const name = session?.user?.name ?? undefined
  const email = session?.user?.email ?? undefined
  const image = session?.user?.image ?? undefined

  const signOutEverywhere = async () => {
    sessionStorage.setItem('justSignedOut', 'true')
    await signOut({ callbackUrl: '/' })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link
            href={routes.workspaces()}
            className="inline-flex shrink-0 items-center rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
          >
            <Logo size="sm" />
          </Link>

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
            <LanguageButton compact="below-sm" />
            <Dropdown
              align="right"
              className="min-w-[200px]"
              trigger={
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-label={t('account.label')}
                  className="flex items-center gap-2 rounded-ctl h-9 px-1.5 max-w-[220px] hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                >
                  <Avatar src={image} name={name || email || 'User'} size="sm" />
                  {/* On phones only the avatar: the bar has no room for the name. */}
                  <span className="hidden sm:block truncate text-small text-fg">{name || email}</span>
                </button>
              }
            >
              <DropdownItem onClick={() => router.push(routes.workspaces())} icon={<Building2 className="w-4 h-4" />}>
                {t('title')}
              </DropdownItem>
              <DropdownItem onClick={() => router.push(routes.profile())} icon={<UserRound className="w-4 h-4" />}>
                {t('account.profile')}
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem onClick={signOutEverywhere} danger icon={<LogOut className="w-4 h-4" />}>
                {t('account.signOut')}
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </div>
    </header>
  )
}
