import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { WorkspaceShellData } from '@/lib/auth/workspace-shell-data'
import { routes } from '@/lib/utils/routes'
import { cn } from '@/lib/utils'

/** Days before the end when the banner starts showing for a trial or a paid plan. */
const SHOW_WITHIN_DAYS = 3

/** 26/10/2026, Vietnam time. */
function vnDate(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

/**
 * One line above every dashboard page about the Digistay plan: the last
 * days of a trial or plan, the grace after it ended, and the read-only lock
 * (src/lib/billing). Owners and admins get the way to pay; others are told
 * to ask the owner. Nothing shows the rest of the time.
 *
 * A second line when the workspace uses more than its plan allows
 * (src/lib/billing/overage.ts): during the 7-day grace what is over and
 * when the excess locks; after that what is locked.
 */
export async function PlanBanner({ plan, slug, role }: { plan: WorkspaceShellData['plan']; slug: string; role: string }) {
  const t = await getTranslations('dash.billing.banner')
  const show = plan.state === 'grace' || plan.state === 'locked' || plan.daysLeft <= SHOW_WITHIN_DAYS
  const name = plan.planId.charAt(0).toUpperCase() + plan.planId.slice(1)
  const text =
    plan.state === 'locked'
      ? t('locked')
      : plan.state === 'grace'
        ? t('grace', { date: vnDate(plan.periodEnd), days: plan.graceDaysLeft })
        : plan.trial
          ? t('trial', { days: plan.daysLeft })
          : t('active', { plan: name, days: plan.daysLeft })
  const tone = plan.state === 'locked' ? 'bg-err-soft text-err' : plan.state === 'grace' ? 'bg-warn-soft text-warn' : 'bg-info-soft text-info'
  return (
    <>
      {show && (
        <div role={plan.state === 'locked' ? 'alert' : 'status'} className={cn('border-b border-line/60 px-5 py-2.5 text-small sm:px-8', tone)}>
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
            <span>{text}</span>
            {role === 'ADMIN' ? (
              <Link href={routes.billing(slug)} className="font-semibold underline underline-offset-4">
                {plan.trial && plan.state === 'trial' ? t('choose') : t('renew')}
              </Link>
            ) : (
              <span className="opacity-80">{t('askOwner')}</span>
            )}
          </div>
        </div>
      )}
      <OverageLine overage={plan.overage} slug={slug} role={role} />
    </>
  )
}

async function OverageLine({ overage, slug, role }: { overage: WorkspaceShellData['plan']['overage']; slug: string; role: string }) {
  if (!overage) return null
  const t = await getTranslations('dash.billing.banner')
  const locked = (['properties', 'roomTypes', 'members'] as const)
    .filter((kind) => overage.locked[kind] > 0)
    .map((kind) => t(`lockedCount.${kind}`, { count: overage.locked[kind] }))
  const grace = overage.locksAt && overage.over.length > 0
  if (!grace && locked.length === 0) return null
  return (
    <div
      role={grace ? 'status' : 'alert'}
      data-testid="overage-banner"
      className={cn('border-b border-line/60 px-5 py-2.5 text-small sm:px-8', grace ? 'bg-warn-soft text-warn' : 'bg-err-soft text-err')}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        {grace && (
          <span>
            {t('overGrace', { what: overage.over.map((kind) => t(`overKinds.${kind}`)).join(', '), date: vnDate(overage.locksAt!) })}
          </span>
        )}
        {locked.length > 0 && <span>{t('overLocked', { what: locked.join(', ') })}</span>}
        {role === 'ADMIN' ? (
          <Link href={routes.billing(slug)} className="font-semibold underline underline-offset-4">
            {t('viewPlan')}
          </Link>
        ) : (
          <span className="opacity-80">{t('askOwnerPlan')}</span>
        )}
      </div>
    </div>
  )
}
