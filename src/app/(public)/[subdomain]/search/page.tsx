import { notFound } from 'next/navigation'
import { loadVisibleSite } from '@/lib/public-site/visibility'
import { SearchClient } from './SearchClient'

interface PageProps {
  params: Promise<{ subdomain: string }>
}

export const dynamic = 'force-dynamic'

/** Free rooms for a stay. Checked here so an unpublished site is a 404 like its other pages. */
export default async function SearchPage({ params }: PageProps) {
  if (!(await loadVisibleSite((await params).subdomain))) notFound()
  return <SearchClient params={params} />
}
