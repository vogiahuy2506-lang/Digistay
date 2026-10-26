import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { frame, inkButton, lineButton } from '@/components/marketing/styles'
import { isPlanId } from '@/lib/marketing/plans'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false } }

/**
 * /billing/start?plan=…&billing=MONTH|YEAR — where "Đăng ký gói này" on the
 * pricing page leads. Signed out: sign up first, then back here. One
 * workspace the visitor owns or administers: straight to its plan page with
 * the plan picked (it opens the QR). Several: choose one. None: create one.
 */
export default async function BillingStartPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const plan = isPlanId(sp.plan) ? sp.plan : 'growth'
  const billing = sp.billing === 'YEAR' ? 'YEAR' : 'MONTH'
  const query = `plan=${plan}&billing=${billing}`

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect(`/register?callbackUrl=${encodeURIComponent(`/billing/start?${query}`)}`)

  const workspaces = await prisma.workspace.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId, role: 'ADMIN', planLockedAt: null } } }] },
    select: { name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  })
  if (workspaces.length === 1) redirect(`/workspace/${workspaces[0].slug}/billing?${query}`)

  const t = await getTranslations('dash.billing.start')
  const nav = await getTranslations('marketing.nav')
  return (
    <>
      <MarketingHeader />
      <main className={cn(frame, 'flex justify-center pb-16 pt-12 lg:pt-20')}>
        <div className="w-full max-w-[560px]">
          <h1 className="font-serif text-[34px] font-medium leading-[1.12] tracking-[-0.02em] text-fg lg:text-[44px]">{t('title')}</h1>
          <p className="mt-3 text-[15px] leading-[1.65] text-fg/80">{workspaces.length ? t('lead') : t('none')}</p>
          {workspaces.length ? (
            <ul className="mt-8 border-t border-line">
              {workspaces.map((w) => (
                <li key={w.slug} className="border-b border-line">
                  <Link href={`/workspace/${w.slug}/billing?${query}`} className="flex items-center justify-between gap-4 py-4 text-[16px] font-medium text-fg hover:underline">
                    {w.name}
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Link href="/workspaces" className={cn(inkButton, 'mt-8 h-12 px-6 text-[15px]')}>
              {t('goWorkspaces')}
            </Link>
          )}
          {workspaces.length > 0 && (
            <Link href="/pricing" className={cn(lineButton, 'mt-8 h-11 px-5 text-[14px]')}>
              ← {nav('pricing')}
            </Link>
          )}
        </div>
      </main>
    </>
  )
}
