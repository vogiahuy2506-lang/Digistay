'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/locales'
import { cn } from '@/lib/utils'

const NAMES: Record<Locale, string> = { vi: 'Tiếng Việt', en: 'English' }

/**
 * VI | EN on Digistay's own pages. The choice is kept in LOCALE_COOKIE, which
 * src/i18n/request.ts reads for every page but the hotel sites (those use /en).
 * "pill" is the header's segmented control; "text" the footer's
 * "Tiếng Việt · English".
 */
export function LocaleToggle({
  locale,
  label,
  variant = 'pill',
  size = 'sm',
}: {
  locale: Locale
  label: string
  variant?: 'pill' | 'text'
  size?: 'sm' | 'lg'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const choose = (next: Locale) => {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    startTransition(() => router.refresh())
  }

  if (variant === 'text') {
    return (
      <div role="group" aria-label={label} className="flex items-center gap-1.5">
        {LOCALES.map((l, i) => (
          <span key={l} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>·</span>}
            <button
              type="button"
              lang={l}
              aria-pressed={l === locale}
              disabled={pending}
              onClick={() => choose(l)}
              className={cn('hover:text-fg hover:underline', l === locale && 'text-fg')}
            >
              {NAMES[l]}
            </button>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-ctl border border-line p-0.5">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-label={NAMES[l]}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => choose(l)}
          className={cn(
            'rounded-[4px] font-semibold uppercase transition-colors duration-160 ease-ds',
            size === 'lg' ? 'h-10 px-3.5 text-[13px]' : 'h-7 px-2.5 text-[12.5px]',
            l === locale ? 'bg-ink text-on-ink' : 'text-muted hover:text-fg',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
