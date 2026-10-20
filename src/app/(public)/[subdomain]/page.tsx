import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { getPublicSiteProps } from '@/lib/public-site/site'
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
  // is handled in src/middleware.ts). Not cached: a deactivated hotel or a
  // changed subdomain applies at once.
  const property = await prisma.property.findFirst({
    where: { subdomain, isActive: true },
    select: { id: true },
  })
  if (!property) notFound()

  const site = await getPublicSiteProps(property.id)
  if (!site) notFound()

  return <PropertySite {...site} />
}
