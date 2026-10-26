import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

/**
 * Every page of one property: a property that is not in this workspace, or
 * was deleted (src/lib/deletion; `prisma` does not see it), is not found,
 * rather than each page failing on its own requests. The parent layout has
 * already checked the caller belongs to the workspace.
 */
export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const property = await prisma.property.findFirst({ where: { id, workspace: { slug } }, select: { id: true } })
  if (!property) notFound()
  return children
}
