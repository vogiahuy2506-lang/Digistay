'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { ShieldCheck, ExternalLink, AlertCircle } from 'lucide-react'
import { inkButton } from '@/components/marketing/styles'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface TermsModalProps {
  initialNeedsAcceptance: boolean
}

/**
 * Required Terms of Service & Privacy Policy acceptance modal.
 * Shown when a user signs up with Google upon first entering the dashboard.
 */
export function TermsModal({ initialNeedsAcceptance }: TermsModalProps) {
  const t = useTranslations('auth.termsModal')
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(initialNeedsAcceptance)
  const [agreed, setAgreed] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  if (!isOpen) return null

  const handleAccept = async () => {
    if (!agreed || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/users/me/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setError(data.error || 'Đã xảy ra lỗi, vui lòng thử lại.')
        setSubmitting(false)
        return
      }

      setIsOpen(false)
      toast.success(t('success'))
      router.refresh()
    } catch {
      setError('Đã xảy ra lỗi kết nối, vui lòng thử lại.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Non-dismissible backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        className="relative z-10 w-full max-w-lg rounded-box border border-line bg-raised text-fg shadow-lift flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 border-b border-line px-6 py-5 bg-panel/40">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 id="terms-modal-title" className="text-[17px] font-semibold text-fg">
              {t('title')}
            </h2>
            <p className="text-[13px] text-muted">{t('subtitle')}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-[14.5px] leading-relaxed text-fg/90">{t('intro')}</p>

          <div className="rounded-ctl border border-line bg-panel p-4 space-y-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[11px] font-bold text-ink">
                1
              </span>
              <div className="min-w-0">
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-ink hover:underline text-[14px]"
                >
                  {t('termsTitle')}
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </Link>
                <p className="text-[13px] leading-normal text-muted mt-0.5">{t('termsDesc')}</p>
              </div>
            </div>

            <div className="h-px bg-line/70" />

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[11px] font-bold text-ink">
                2
              </span>
              <div className="min-w-0">
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-ink hover:underline text-[14px]"
                >
                  {t('privacyTitle')}
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </Link>
                <p className="text-[13px] leading-normal text-muted mt-0.5">{t('privacyDesc')}</p>
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 pt-1 text-[14px] leading-snug text-fg select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-ink"
            />
            <span>{t('checkbox')}</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 rounded-ctl border border-err/30 bg-err-soft/40 px-3.5 py-2.5 text-[13px] text-err">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line bg-panel/40 px-6 py-4">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            disabled={submitting}
            className="text-[14px] font-medium text-muted hover:text-fg text-center sm:text-left transition-colors duration-160"
          >
            {t('signOut')}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={!agreed || submitting}
            className={cn(inkButton, 'h-11 px-6 text-[14.5px] disabled:bg-muted disabled:opacity-50')}
          >
            {submitting ? t('submitting') : t('agree')}
          </button>
        </div>
      </div>
    </div>
  )
}
