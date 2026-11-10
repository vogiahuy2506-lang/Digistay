'use client'

import * as React from 'react'
import { Phone, Calendar, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useIsPreview, useSiteHotel, useSiteHref } from './site-base'
import { usePathname } from 'next/navigation'

/**
 * High-converting sticky mobile booking bar.
 * Slides up from the bottom on phones when scrolled past the hero section.
 * Automatically hidden on checkout/payment pages.
 */
export function StickyBookingBar() {
  const t = useTranslations('site')
  const hotel = useSiteHotel()
  const href = useSiteHref()
  const pathname = usePathname()
  const [visible, setVisible] = React.useState(false)

  // Don't show sticky bar on dedicated booking or confirmation pages
  const isBookingFlow = Boolean(
    pathname &&
      (pathname.includes('/dat-phong') ||
        pathname.includes('/thanh-toan') ||
        pathname.includes('/dat-coc') ||
        pathname.includes('/xac-nhan') ||
        pathname.includes('/hoa-don'))
  )

  React.useEffect(() => {
    if (isBookingFlow) {
      setVisible(false)
      return
    }

    const onScroll = () => {
      // Show when scrolled down past 260px (past hero title)
      const scrolled = window.scrollY > 260
      setVisible(scrolled)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [isBookingFlow])

  const isPreview = useIsPreview()
  if (isBookingFlow || !hotel || isPreview) return null

  const phone = hotel.property.phone
  const cleanPhone = phone?.replace(/[^\d+]/g, '')
  const isHome =
    !pathname ||
    pathname === '/' ||
    (hotel.property.name ? pathname.endsWith(`/${hotel.property.name}`) : false) ||
    !pathname.includes('/')

  return (
    <aside
      aria-label={t('nav.book')}
      className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-line bg-page/95 backdrop-blur-md px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-in-out ${
        visible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-acc truncate">
            {t('nav.book')} trực tiếp
          </p>
          <p className="text-xs text-muted truncate">
            {hotel.property.name}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {cleanPhone && (
            <a
              href={`tel:${cleanPhone}`}
              className="flex h-10 w-10 items-center justify-center rounded-ctl border border-line bg-panel text-fg hover:text-acc focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
              aria-label={`Gọi ${cleanPhone}`}
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
            </a>
          )}

          <a
            href={isHome ? '#rooms' : href('/search')}
            className="inline-flex h-10 items-center gap-1.5 rounded-ctl bg-ink px-4 text-small font-medium text-on-ink shadow hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('nav.book')}</span>
            <ArrowRight className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
          </a>
        </div>
      </div>
    </aside>
  )
}

