import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Lock } from 'lucide-react'
import { prisma } from '@/lib/db'
import { routes } from '@/lib/utils/routes'

/**
 * Every page of one property: a property locked because the workspace is
 * over its plan (src/lib/billing/overage.ts) says so on top. The parent
 * layout has already checked the caller belongs to the workspace; the
 * property is looked up within it.
 */
export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const property = await prisma.property.findFirst({ where: { id, workspace: { slug } }, select: { planLockedAt: true } })
  if (!property?.planLockedAt) return children
  const t = await getTranslations('dash.billing')
  return (
    <>
      <div className="px-4 sm:px-6 lg:px-8 pt-5 lg:pt-7 max-w-7xl mx-auto">
        <div role="alert" data-testid="property-plan-locked" className="flex gap-3 rounded-ctl border border-err/20 bg-err-soft p-4 text-err">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 text-small">
            <p className="font-semibold">{t('propertyLocked.title')}</p>
            <p className="mt-1">{t('propertyLocked.text')}</p>
            <Link href={routes.billing(slug)} className="mt-1.5 inline-block font-semibold underline underline-offset-4">
              {t('propertyLocked.link')}
            </Link>
          </div>
        </div>
      </div>
      {children}
    </>
  )
}
