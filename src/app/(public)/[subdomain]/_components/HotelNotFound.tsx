'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { SiteHeader } from './SiteHeader'
import { SiteLink, useSiteHotel } from './site-base'
import { Container } from './site-ui'
import { BookingFooter } from './booking/BookingFooter'

/**
 * A page missing from a hotel's site (an unknown room, an old guest link):
 * the hotel's 404, in its own header and footer, with the way to its rooms.
 * It used to be Digistay's, with Digistay's logo and sign-in links.
 * `fallback`: Digistay's 404, when there is no site to show.
 */
export function HotelNotFound({ fallback }: { fallback: React.ReactNode }) {
  const hotel = useSiteHotel()
  const t = useTranslations('site.notFound')
  if (!hotel) return <>{fallback}</>
  const { property } = hotel
  return (
    <>
      <SiteHeader property={property} sections={hotel.sections} onHome={false} />
      <main>
        <Container className="pb-6 pt-12 lg:pt-24">
          <div className="max-w-[640px]">
            <p className="font-mono text-[13px] font-medium text-acc">404</p>
            <h1 className="mt-4 font-site text-[36px] leading-[1.12] text-fg lg:text-[52px]">{t('title')}</h1>
            <p className="mt-4 text-[16px] leading-[1.7] text-muted lg:text-[17px]">{t('lead', { hotel: property.name })}</p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <SiteLink path="/search" className="flex h-[52px] items-center justify-center bg-ink px-7 text-[15px] font-medium text-on-ink transition-colors hover:bg-ink/90">
                {t('rooms')}
              </SiteLink>
              <SiteLink path="/" className="flex h-[52px] items-center justify-center border border-ink px-6 text-[15px] font-medium text-fg hover:bg-fg/5">
                {t('home')}
              </SiteLink>
            </div>
            {property.phone && (
              <p className="mt-8 border-t border-line pt-6 text-[14px] text-muted">
                {t('help')}{' '}
                <a href={`tel:${property.phone.replace(/[^\d+]/g, '')}`} className="font-medium text-acc hover:underline">
                  {property.phone}
                </a>
              </p>
            )}
          </div>
        </Container>
      </main>
      <BookingFooter property={property} />
    </>
  )
}
