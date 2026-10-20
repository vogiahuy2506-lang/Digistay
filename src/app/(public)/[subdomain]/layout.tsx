import { headers } from 'next/headers'
import { siteBasePath } from '@/lib/public-site/paths'
import { SiteBaseProvider } from './_components/site-base'

/**
 * Every page of a hotel's site: works out once whether links need the
 * "/<subdomain>" prefix (app host) or not (the hotel's own host).
 */
export default async function HotelSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const host = (await headers()).get('host')
  return <SiteBaseProvider base={siteBasePath(subdomain, host)}>{children}</SiteBaseProvider>
}
