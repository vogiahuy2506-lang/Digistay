'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Building2, CreditCard, History, LayoutDashboard, Moon, Receipt, Server, ShieldCheck, Sun } from 'lucide-react'
import { Logo } from '@/components/marketing/Logo'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/layout/theme-root'
import { useLanguageSwitch } from '@/components/layout/language-switch'

const NAV = [
  { href: '/admin', key: 'overview', icon: LayoutDashboard },
  { href: '/admin/customers', key: 'customers', icon: Building2 },
  { href: '/admin/orders', key: 'orders', icon: Receipt },
  { href: '/admin/plans', key: 'plans', icon: CreditCard },
  { href: '/admin/activity', key: 'activity', icon: History },
  { href: '/admin/system', key: 'system', icon: Server },
] as const

/** The operator pages' frame: Digistay mark, Super Admin badge, theme/lang controls, navigation, and workspace escape. */
export function AdminFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dash.admin.frame')
  const pathname = usePathname()
  const theme = useTheme()
  const language = useLanguageSwitch()
  const dark = theme?.preference === 'dark'

  return (
    <div className="min-h-screen bg-page text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex h-9 items-center rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              <Logo size="sm" />
            </Link>
            <div className="flex items-center gap-1.5 rounded-full border border-acc/30 bg-acc/10 px-2.5 py-0.5 text-xs font-semibold text-acc">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>SUPER ADMIN</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {theme && (
              <button
                type="button"
                aria-label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
                title={dark ? 'Chế độ sáng' : 'Chế độ tối'}
                onClick={() => theme.setPreference(dark ? 'light' : 'dark')}
                className="flex h-8 w-8 items-center justify-center rounded-ctl border border-line text-muted transition-colors hover:bg-fg/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
              >
                {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
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
                    'h-7 rounded-[4px] px-2 text-[12px] font-semibold uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
                    language.locale === l ? 'bg-ink text-on-ink' : 'text-muted hover:text-fg',
                    language.pending && 'cursor-wait opacity-60'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-line" aria-hidden="true" />

            <Link
              href="/workspaces"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('back')}</span>
            </Link>
          </div>
        </div>

        <nav aria-label={t('title')} className="mx-auto max-w-6xl overflow-x-auto px-4 pt-1 sm:px-6">
          <ul className="flex gap-1">
            {NAV.map((item) => {
              const active = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname?.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
                      active ? 'border-acc text-fg' : 'border-transparent text-muted hover:text-fg'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{t(`nav.${item.key}`)}</span>
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
