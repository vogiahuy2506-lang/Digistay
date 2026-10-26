import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import DigistayNotFound from '@/app/not-found'
import { HotelNotFound } from './_components/HotelNotFound'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site.notFound')
  return { title: t('title'), robots: { index: false } }
}

/**
 * notFound() on a hotel's page (an unknown room, a stale deposit or
 * confirmation link): the hotel's own 404. It gets no params: the hotel
 * comes from the site's layout (SiteBaseProvider), and Digistay's 404 when
 * there is no site to show.
 */
export default function NotFound() {
  return <HotelNotFound fallback={<DigistayNotFound />} />
}
