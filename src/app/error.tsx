'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/marketing/Logo'
import { frame, inkButton, lineButton, softText } from '@/components/marketing/styles'
import { THEME_COOKIE, parseThemePreference, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * Something broke on Digistay's own pages (the dashboard and hotel sites
 * have their own error.tsx). Claude Design "Digistay Loi", "Lỗi chung":
 * retry, home, and the error's digest to send to support. The message
 * itself is not shown: in production it says nothing useful, and in
 * development it can say too much.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common.error')
  const [tries, setTries] = React.useState(0)
  const [copied, setCopied] = React.useState(false)
  const code = error.digest ? `ERR-${error.digest}` : null
  // The visitor's light / dark choice (src/lib/theme.ts); this page only renders in the browser.
  const [theme, setTheme] = React.useState<ThemePreference>('light')
  React.useEffect(() => {
    setTheme(parseThemePreference(document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`))?.[1]))
  }, [])

  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div data-public-theme data-theme={theme} className="flex min-h-screen flex-col bg-page font-sans text-fg">
      <header className="border-b border-line/70">
        <div className={cn(frame, 'py-4 lg:py-5')}>
          <Link href="/" className="inline-block rounded-ctl">
            <Logo />
          </Link>
        </div>
      </header>
      <main className={cn(frame, 'flex flex-1 justify-center pb-20 pt-12 lg:pt-24')}>
        <div className="w-full max-w-[640px]">
          <p className="font-mono text-[13px] font-medium text-brand">{t('label')}</p>
          <h1 className="mt-4 font-serif text-[36px] font-medium leading-[1.12] tracking-[-0.02em] lg:text-[52px]">{t('title')}</h1>
          <p className={cn('mt-4 text-[16px] leading-[1.7] lg:text-[17px]', softText)}>{t('text')}</p>
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setTries((n) => n + 1)
                reset()
              }}
              className={cn(inkButton, 'h-[52px] px-8 text-[15px]')}
            >
              {t('retry')}
            </button>
            <Link href="/" className={cn(lineButton, 'h-[52px] px-6 text-[15px]')}>
              {t('home')}
            </Link>
          </div>
          {tries > 0 && <p className="mt-5 rounded-ctl border border-warn/25 bg-warn-soft px-4 py-3 text-[14px]">⚠ {t('stillFailing')}</p>}
          {code && (
            <div className="mt-8 flex flex-col gap-4 rounded-box border border-line bg-panel p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-label uppercase text-muted">{t('code')}</p>
                <p className="mt-1 font-mono text-[14px] font-medium">{code}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(code).then(() => setCopied(true), () => {})
                  }}
                  className={cn(lineButton, 'h-10 border-line px-4 text-[13.5px]')}
                >
                  {copied ? t('copied') : t('copy')}
                </button>
                <Link href="/contact" className={cn(lineButton, 'h-10 border-line px-4 text-[13.5px]')}>
                  {t('support')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
