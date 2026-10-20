import { notFound } from 'next/navigation'
import { getPublicSiteProps } from '@/lib/public-site/site'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { PropertySite } from './_components/PropertySite'

interface PageProps {
  params: Promise<{ subdomain: string }>
}

// Rendered per request; the heavy part (what the site shows) is cached per
// property and dropped on every edit (src/lib/public-site/site.ts).
export const dynamic = 'force-dynamic'

export default async function PublicPropertyPage({ params }: PageProps) {
  const { subdomain } = await params

  // Lookup property by subdomain (path param — real wildcard subdomain routing
  // is handled in src/middleware.ts). Not cached: a deactivated, unpublished
  // hotel or a changed subdomain applies at once (src/lib/public-site/visibility.ts).
  const visible = await loadVisibleSite(subdomain)
  if (!visible) notFound()

  const site = await getPublicSiteProps(visible.propertyId)
  if (!site) notFound()

  return <PropertySite {...site} />
}
