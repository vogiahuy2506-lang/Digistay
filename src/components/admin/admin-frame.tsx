'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/marketing/Logo'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin/customers', key: 'customers' },
  { href: '/admin/orders', key: 'orders' },
  { href: '/admin/activity', key: 'activity' },
  { href: '/admin/system', key: 'system' },
] as const

/** The operator pages' frame: Digistay's mark, the four pages, a way back to one's own workspaces. */
export function AdminFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dash.admin.frame')
  const pathname = usePathname()
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 sm:px-6">
          <Link href="/admin" className="inline-flex h-9 items-center rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc">
            <Logo size="sm" />
          </Link>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted">{t('title')}</span>
          <Link href="/workspaces" className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('back')}</span>
          </Link>
        </div>
        <nav aria-label={t('title')} className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
                      active ? 'border-acc text-fg' : 'border-transparent text-muted hover:text-fg'
                    )}
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>
      {children}
    </div>
  )
}
