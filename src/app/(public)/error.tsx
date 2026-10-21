'use client'

/**
 * Error boundary for the (public) route group. Keeps the marketing
 * site visible even when one of the blocks (rooms, gallery, etc.)
 * throws — visitors still see the rest of the page plus a "Thử lại"
 * affordance, instead of a blank screen.
 */
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function PublicSiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common.error')
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Public site error:', error)
  }, [error])

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-2xl bg-warn-soft mx-auto mb-4 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-warn" />
        </div>
        <h2 className="text-base font-semibold text-fg mb-1">{t('title')}</h2>
        <p className="text-sm text-muted mb-4">{t('text')}</p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('retry')}
        </button>
      </div>
    </div>
  )
}
