import { redirect } from 'next/navigation'
import { routes } from '@/lib/utils/routes'

/**
 * The workspace home lists the properties, so this address only forwards there
 * instead of keeping a second list that could drift from it.
 */
export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(routes.workspace(slug))
}