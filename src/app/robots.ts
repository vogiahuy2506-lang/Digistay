import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { appOrigin, hostSite } from '@/lib/public-site/site-host'
import { hotelSeoSite } from '@/lib/seo/host-site'
import { digistayRobots, hotelRobots } from '@/lib/seo/robots-sitemap'

// Per host: Digistay's, a hotel's (subdomain or own domain), or nothing.
// The middleware does not rewrite /robots.txt, so the Host header is the visitor's.
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = hostSite((await headers()).get('host'))
  if (host.kind === 'digistay') return digistayRobots(appOrigin())
  return hotelRobots(await hotelSeoSite(host))
}
