'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'

/**
 * A page the signed-in role may not use, opened by its URL (the sidebar
 * hides it): says so instead of an empty state that invites adding things
 * the API would refuse.
 */
export function NoAccess({ hint, backHref, backLabel }: { hint?: string; backHref?: string; backLabel?: string }) {
  const t = useTranslations('dash.common.states')
  return (
    <div role="status" className="mx-auto mt-10 max-w-md rounded-box border border-line bg-panel px-6 py-10 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-fg/5 text-muted">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-fg">{t('noPermission')}</h1>
      {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
      {backHref && backLabel && (
        <Link
          href={backHref}
          className="mt-6 inline-flex h-10 items-center rounded-ctl border border-line px-4 text-sm font-medium text-fg hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
        >
          {backLabel}
        </Link>
      )}
    </div>
  )
}
