'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { AccountMenu } from '@/components/layout/account-menu'
import { Logo } from '@/components/marketing/Logo'
import { routes } from '@/lib/utils/routes'
import { Building2 } from 'lucide-react'

/**
 * The slim bar of the account pages (/workspaces, /profile): the brand, which
 * leads back to the workspaces, and the account menu (theme and language are
 * in it). No workspace is open here, so there is no switcher.
 * The name comes from the session (SessionScope in the dashboard layout).
 * Full width, like the workspace level's bar (workspace-top-bar.tsx).
 */
export function AccountTopBar() {
  const t = useTranslations('workspaces')
  const { data: session } = useSession()
  const name = session?.user?.name ?? undefined
  const email = session?.user?.email ?? undefined
  const image = session?.user?.image ?? undefined

  const signOutEverywhere = async () => {
    sessionStorage.setItem('justSignedOut', 'true')
    await signOut({ callbackUrl: '/' })
  }

  return (
    <header className="sticky top-0 z-30 [&:has([data-account-open])]:z-[45] border-b border-line bg-page/90 backdrop-blur">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link
            href={routes.workspaces()}
            className="inline-flex shrink-0 items-center rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
          >
            <Logo size="sm" />
          </Link>

          <AccountMenu
            variant="bar"
            name={name}
            email={email}
            image={image}
            links={[{ label: t('title'), href: routes.workspaces(), icon: <Building2 className="w-4 h-4" aria-hidden="true" /> }]}
            onSignOut={signOutEverywhere}
          />
        </div>
      </div>
    </header>
  )
}
