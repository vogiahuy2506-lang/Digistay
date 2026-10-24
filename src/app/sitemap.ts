import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { appOrigin, hostSite } from '@/lib/public-site/site-host'
import { hotelSeoSite } from '@/lib/seo/host-site'
import { digistaySitemap, hotelSitemap } from '@/lib/seo/robots-sitemap'

// Per host, like robots.ts: Digistay's pages, or the hotel's on its canonical origin.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = hostSite((await headers()).get('host'))
  if (host.kind === 'digistay') return digistaySitemap(appOrigin())
  return hotelSitemap(await hotelSeoSite(host, { rooms: true }))
}
