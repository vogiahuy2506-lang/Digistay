'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * A fold under a form's Vietnamese fields holding the same texts in English,
 * for the hotel's English site (src/lib/i18n/content.ts). Open from the
 * start when one of them is filled in.
 */
export function EnglishCopy({ filled, children }: { filled: boolean; children: React.ReactNode }) {
  const t = useTranslations('dash.common.english')
  const [open, setOpen] = React.useState(filled)

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group rounded-box border border-line bg-fg/[0.02]"
    >
      <summary className="flex items-center gap-2 min-h-11 px-3 py-2.5 cursor-pointer select-none list-none text-sm font-medium text-fg rounded-box focus:outline-none focus-visible:ring-2 focus-visible:ring-acc [&::-webkit-details-marker]:hidden">
        <ChevronRight className="w-4 h-4 text-muted transition-transform duration-160 group-open:rotate-90" aria-hidden="true" />
        <span>{t('title')}</span>
        <span className="text-xs font-normal text-muted">({t('optional')})</span>
      </summary>
      <div className="px-3 pb-3 space-y-4">
        <p className="text-small text-muted">{t('hint')}</p>
        {children}
      </div>
    </details>
  )
}
