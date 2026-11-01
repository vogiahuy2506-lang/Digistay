'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X, Gift, Check, Copy, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { formatVnd } from '@/lib/bookings/display'
import type { ExitIntentCoupon } from '@/lib/public-site/site-frame'

interface ExitIntentModalProps {
  propertyId: string
  hotelName: string
  coupon: ExitIntentCoupon
}

export function ExitIntentModal({ propertyId, hotelName, coupon }: ExitIntentModalProps) {
  const t = useTranslations('site.exitIntent')
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const hasTriggered = React.useRef(false)
  const isExcludedPage = Boolean(
    pathname && (pathname.includes('/xac-nhan') || pathname.includes('/dat-coc') || pathname.includes('/hoa-don'))
  )

  const trigger = React.useCallback(() => {
    if (hasTriggered.current || isExcludedPage) return
    const key = `ds_exit_shown_${propertyId}`
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(key)) return

    hasTriggered.current = true
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(key, '1')
    }
    setIsOpen(true)
  }, [propertyId, isExcludedPage])

  React.useEffect(() => {
    if (isExcludedPage || typeof window === 'undefined') return
    const key = `ds_exit_shown_${propertyId}`
    if (window.sessionStorage.getItem(key)) return

    // Grace period of 3 seconds before listening for exit intent
    let mounted = true
    let graceTimeout: NodeJS.Timeout | null = null
    let mobileTimer: NodeJS.Timeout | null = null

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10) {
        trigger()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Visitor is switching tab or leaving
        trigger()
      }
    }

    graceTimeout = setTimeout(() => {
      if (!mounted) return
      document.addEventListener('mouseleave', handleMouseLeave)
      document.addEventListener('visibilitychange', handleVisibilityChange)

      // Mobile fallback: trigger after 45 seconds of viewing the page
      mobileTimer = setTimeout(() => {
        if (mounted) trigger()
      }, 45000)
    }, 3000)

    return () => {
      mounted = false
      if (graceTimeout) clearTimeout(graceTimeout)
      if (mobileTimer) clearTimeout(mobileTimer)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [propertyId, isExcludedPage, trigger])

  // Handle escape key
  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setIsSuccess(true)
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(`ds_exit_coupon_${propertyId}`, coupon.code)
          window.sessionStorage.setItem(`ds_exit_email_${propertyId}`, trimmed)
        }
      } else {
        setError(data.error || 'Có lỗi xảy ra, vui lòng thử lại.')
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      setCopied(true)
    }
  }

  const handleBookNow = () => {
    setIsOpen(false)
    if (typeof window !== 'undefined') {
      const roomsEl = document.getElementById('rooms')
      if (roomsEl) {
        roomsEl.scrollIntoView({ behavior: 'smooth' })
      } else {
        window.location.href = '/#rooms'
      }
    }
  }

  if (!isOpen || isExcludedPage) return null

  const formattedAmount =
    coupon.discountType === 'PERCENT'
      ? `${coupon.discountValue}%`
      : formatVnd(coupon.discountValue, 'vi')

  const headingText =
    coupon.discountType === 'PERCENT'
      ? t('headingPercent', { percent: coupon.discountValue })
      : t('headingFixed', { amount: formattedAmount })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false)
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel p-6 shadow-2xl transition-all">
        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          aria-label={t('close')}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted hover:text-fg hover:bg-fg/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSuccess ? (
          <div>
            {/* Header Badge & Icon */}
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-acc-soft text-acc border border-acc/20">
                <Sparkles className="w-3.5 h-3.5" />
                {t('badge')}
              </span>
            </div>

            {/* Title & Subtitle */}
            <h2 id="exit-intent-title" className="font-site text-2xl font-bold leading-tight text-fg mb-2">
              {headingText}
            </h2>
            <p className="text-sm text-muted mb-6 leading-relaxed">
              {t('subtitle', { hotel: hotelName })}
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  disabled={loading}
                  className="w-full h-12 px-4 rounded-xl border border-line bg-raised text-fg placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-acc text-sm"
                />
              </div>

              {error && <p className="text-xs text-err">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-acc text-on-acc font-medium text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('submitting')}</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span>{t('submit')}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center py-2 animate-in zoom-in-95 duration-200">
            {/* Success icon */}
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-ok-soft text-ok flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>

            <h2 className="font-site text-xl font-bold text-fg mb-1">
              {t('successTitle')}
            </h2>
            <p className="text-sm text-muted mb-5">
              {t('successSubtitle')}
            </p>

            {/* Code presentation card */}
            <div className="flex items-center justify-between p-3.5 mb-5 rounded-xl border-2 border-dashed border-acc/40 bg-acc-soft/30">
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold tracking-wider text-acc block">
                  {coupon.name}
                </span>
                <span className="font-mono text-xl font-black tracking-widest text-fg">
                  {coupon.code}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-panel border border-line text-xs font-semibold text-fg hover:bg-fg/5 transition-colors shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-ok" />
                    <span className="text-ok">{t('codeCopied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t('copyCode')}</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleBookNow}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-acc text-on-acc font-medium text-sm hover:opacity-90 active:scale-[0.99] transition-all"
            >
              <span>{t('bookNow')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

