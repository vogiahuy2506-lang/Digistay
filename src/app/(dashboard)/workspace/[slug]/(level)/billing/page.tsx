'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Alert, AlertDescription, Badge, Button, Loading } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { formatVnd } from '@/lib/bookings/display'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'
import { isPlanId, type Plan, type PlanId } from '@/lib/marketing/plans'
import type { PaymentView } from '@/lib/billing/view'
import { PurchaseDialog } from './purchase-dialog'
import { planName, vnDate, type Billing, type BillingData, type ChangeKind, type ChangeView, type LimitKey, type State } from './types'

const STATE_TONE: Record<State, 'success' | 'warning' | 'danger' | 'secondary'> = {
  trial: 'secondary',
  active: 'success',
  grace: 'warning',
  locked: 'danger',
}
const LIMITS: LimitKey[] = ['properties', 'rooms', 'staff', 'invoices']

/**
 * The workspace's Digistay plan (owner and admins): its state and usage,
 * the plans for sale with a monthly / yearly switch and what buying each
 * does now (renew, upgrade, scheduled downgrade: src/lib/billing/period.ts),
 * the purchase dialog (who the e-invoice is for, then Digistay's VietQR),
 * and past payments with their e-invoices.
 */
export default function BillingPage() {
  const t = useTranslations('dash.billing')
  const locale = useLocale() === 'en' ? 'en' : 'vi'
  const search = useSearchParams()
  const { workspace, loading: wsLoading } = useWorkspace()
  const workspaceId = workspace?.id

  const [data, setData] = React.useState<BillingData | null>(null)
  const [error, setError] = React.useState('')
  const [billing, setBilling] = React.useState<Billing>(search.get('billing') === 'YEAR' ? 'YEAR' : 'MONTH')
  const [buying, setBuying] = React.useState<{ plan: PlanId; billing: Billing } | null>(null)
  const [resume, setResume] = React.useState<PaymentView | null>(null)
  // A plan picked on the pricing page (/billing/start) opens its purchase once.
  const preset = React.useRef(search.get('plan'))

  const load = React.useCallback(async () => {
    if (!workspaceId) return
    const res = await fetch(`/api/workspaces/${workspaceId}/subscription`, { cache: 'no-store' }).catch(() => null)
    const json = await res?.json().catch(() => null)
    if (!res?.ok || !json?.success) {
      setError(apiError(json?.error) || t('notReady'))
      return
    }
    setData(json.data)
  }, [workspaceId, t])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    const plan = preset.current
    if (!data || !plan || !isPlanId(plan) || !data.checkoutReady) return
    preset.current = null
    if (!data.changes[plan][billing].blocked) setBuying({ plan, billing })
  }, [data, billing])

  if (wsLoading || (!data && !error)) return <Loading className="py-24" />
  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const sub = data.subscription
  const current = data.plans.find((p) => p.id === sub.plan) ?? data.plans[0]
  const price = (p: Plan) => (billing === 'YEAR' ? p.price * data.yearlyMonths : p.price)
  /** The button of a plan card: what buying it does now, or why it cannot be bought now. */
  const action = (p: Plan, c: ChangeView) => {
    const amount = formatVnd(price(p), locale)
    if (c.blocked === 'RENEW_TOO_EARLY') return t('action.renewFrom', { date: vnDate(c.renewFrom!) })
    if (c.blocked === 'YEARLY_TO_MONTHLY') return t('action.yearLocked')
    if (c.blocked === 'CHANGE_SCHEDULED') return t('action.scheduledAlready')
    if (c.kind === 'downgrade') return t('action.downgrade', { date: vnDate(c.startsAt), price: amount })
    return t(`action.${c.kind}`, { price: amount })
  }

  return (
    <>
      <div className="max-w-2xl">
        <h1 className="font-serif text-[30px] leading-[1.15] tracking-[-0.02em] text-fg sm:text-[38px]">{t('title')}</h1>
        <p className="mt-2 text-small text-muted sm:text-body">{t('lead', { workspace: data.workspace.name })}</p>
      </div>

      {/* The plan in force */}
      <section className="mt-8 grid gap-6 rounded-box border border-line bg-panel p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
        <div>
          <p className="text-label uppercase text-muted">{t('current')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-[28px] leading-tight text-fg">{sub.trial ? t('trialOf', { plan: planName(current.id) }) : planName(current.id)}</h2>
            <Badge variant={STATE_TONE[sub.state]}>{t(`state.${sub.state}`)}</Badge>
          </div>
          <p className="mt-3 text-body text-fg">
            {sub.state === 'trial' || sub.state === 'active'
              ? `${t('validUntil', { date: vnDate(sub.periodEnd) })} · ${t('daysLeft', { days: sub.daysLeft })}`
              : t('endedOn', { date: vnDate(sub.periodEnd) })}
          </p>
          {sub.state === 'grace' && <p className="mt-2 text-small text-warn">{t('graceLeft', { days: sub.graceDaysLeft, date: vnDate(sub.locksAt) })}</p>}
          {sub.state === 'locked' && <p className="mt-2 text-small text-err">{t('lockedSince', { date: vnDate(sub.locksAt) })}</p>}
          {data.scheduled && (
            <p className="mt-3 rounded-ctl border border-line bg-page px-3 py-2 text-small text-fg">
              {t('scheduled', {
                plan: planName(data.scheduled.plan),
                billing: data.scheduled.billing === 'YEAR' ? t('yearly').toLowerCase() : t('monthly').toLowerCase(),
                date: vnDate(data.scheduled.startsAt),
              })}
            </p>
          )}
        </div>
        <dl className="grid gap-3.5">
          {LIMITS.map((k) => {
            const limit = data.limits[k]
            const used = data.usage[k]
            const ratio = limit > 0 ? Math.min(1, used / limit) : 0
            // Red only past the limit; at it (nothing more can be added) amber.
            const tone = limit > 0 && used > limit ? 'bg-err' : ratio >= 0.8 ? 'bg-warn' : 'bg-ink'
            return (
              <div key={k}>
                <div className="flex items-baseline justify-between gap-4 text-small">
                  <dt className="text-fg/80">{t(`limits.${k}`)}</dt>
                  <dd className="tabular-nums text-fg">{limit === 0 ? t('noInvoices') : `${used} / ${limit}`}</dd>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-plain-soft" aria-hidden>
                  <div className={cn('h-full rounded-full', tone)} style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            )
          })}
        </dl>
        {(() => {
          const over = LIMITS.filter((k) => data.limits[k] > 0 && data.usage[k] > data.limits[k])
          if (!over.length) return null
          return (
            <p className="text-small text-err lg:col-span-2">
              {t('overLimit', { what: over.map((k) => t(`limits.${k}`).toLowerCase()).join(', ') })}
            </p>
          )
        })()}
      </section>

      {data.pending && !resume && !buying && (
        <Alert className="mt-6">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('checkout.resume', { plan: planName(data.pending.plan), amount: formatVnd(data.pending.amount, locale) })}</span>
            <Button size="sm" variant="secondary" onClick={() => setResume(data.pending)}>
              {t('checkout.resumeOpen')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* The plans for sale */}
      <section className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-serif text-[24px] leading-tight text-fg sm:text-[28px]">{t('choose')}</h2>
          <div role="radiogroup" aria-label={t('choose')} className="flex self-start rounded-ctl border border-line bg-panel p-1 sm:self-auto">
            {(['MONTH', 'YEAR'] as const).map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={billing === b}
                onClick={() => setBilling(b)}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-[6px] px-3.5 text-small font-medium transition-colors duration-160',
                  billing === b ? 'bg-ink text-on-ink' : 'text-fg/80 hover:text-fg',
                )}
              >
                {b === 'MONTH' ? t('monthly') : t('yearly')}
                {b === 'YEAR' && (
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', billing === b ? 'bg-on-ink/15 text-on-ink' : 'bg-ok-soft text-ok')}>
                    {t('yearlyBadge', { months: 12 - data.yearlyMonths })}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {!data.checkoutReady && (
          <Alert variant="warning" className="mt-5">
            <AlertDescription>{t('notReady')}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {data.plans.map((p) => {
            const isCurrent = !sub.trial && p.id === sub.plan && billing === (sub.billing ?? 'MONTH')
            const change = data.changes[p.id][billing]
            return (
              <div key={p.id} className={cn('flex flex-col rounded-box border bg-panel p-5 sm:p-6', isCurrent ? 'border-ink' : 'border-line')}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-label font-medium uppercase text-muted">{t(`plans.${p.id}.name`)}</h3>
                  {isCurrent && <Badge variant="gray">{t('thisPlan')}</Badge>}
                </div>
                <p className="mt-1.5 text-small text-muted">{t(`plans.${p.id}.fit`)}</p>
                <p key={billing} className="swap-in mt-5 flex flex-wrap items-baseline gap-1.5">
                  <span className="text-[28px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-fg">{formatVnd(price(p), locale)}</span>
                  <span className="text-small text-muted">{billing === 'YEAR' ? t('perYear') : t('perMonth')}</span>
                </p>
                <ul className="mt-5 grid gap-1.5 border-t border-line/70 pt-4 text-small text-fg/80">
                  <li>{t('planLimits', { properties: p.properties, rooms: p.rooms, staff: p.staff })}</li>
                  <li>{p.invoices > 0 ? t('planInvoices', { count: p.invoices }) : t('planNoInvoices')}</li>
                </ul>
                <Button
                  className="mt-6 w-full"
                  size="lg"
                  variant={isCurrent || change.kind === 'downgrade' || change.blocked ? 'secondary' : 'primary'}
                  disabled={!data.checkoutReady || Boolean(change.blocked)}
                  onClick={() => setBuying({ plan: p.id, billing })}
                >
                  {action(p, change)}
                </Button>
                {change.blocked === 'YEARLY_TO_MONTHLY' && <p className="mt-2 text-small text-muted">{t('action.yearLockedHint')}</p>}
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-small text-muted">
          {t('rulesNote', { days: sub.renewWindowDays })} {data.einvoice ? t('vatInvoice', { vat: data.einvoice.vat }) : t('vat')}
        </p>
      </section>

      {/* Past payments */}
      <section className="mt-12">
        <h2 className="font-serif text-[24px] leading-tight text-fg sm:text-[28px]">{t('history.title')}</h2>
        {data.payments.length === 0 ? (
          <p className="mt-4 text-small text-muted">{t('history.empty')}</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-box border border-line bg-panel">
            <table className="w-full min-w-[680px] text-small">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-3 font-normal">{t('history.date')}</th>
                  <th className="px-4 py-3 font-normal">{t('history.plan')}</th>
                  <th className="px-4 py-3 text-right font-normal">{t('history.amount')}</th>
                  <th className="px-4 py-3 font-normal">{t('history.status')}</th>
                  <th className="px-4 py-3 font-normal">{t('history.period')}</th>
                  <th className="px-4 py-3 font-normal">{t('history.invoice')}</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-line/70 last:border-b-0">
                    <td className="px-4 py-3 tabular-nums text-fg">{vnDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-4 py-3 text-fg">
                      {planName(p.plan)} · {p.billing === 'YEAR' ? t('yearly') : t('monthly')}
                      {p.change && p.change !== 'new' && <span className="block text-[12px] text-muted">{t(`history.change.${p.change as ChangeKind}`)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg">{formatVnd(p.amount, locale)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === 'PAID' ? 'success' : 'warning'}>{t(`history.${p.status === 'PAID' ? 'PAID' : 'PENDING'}`)}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-fg/80">{p.periodStart && p.periodEnd ? `${vnDate(p.periodStart)} – ${vnDate(p.periodEnd)}` : '—'}</td>
                    <td className="px-4 py-3">
                      {p.invoice?.status === 'ISSUED' ? (
                        <a
                          href={`/api/workspaces/${data.workspace.id}/subscription/payments/${p.id}/invoice`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg"
                        >
                          {p.invoice.number ? t('history.invoiceNumber', { number: p.invoice.number }) : t('history.invoicePdf')}
                        </a>
                      ) : p.invoice ? (
                        <span className="text-muted">{t('history.invoicePending')}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(buying || resume) && (
        <PurchaseDialog
          data={data}
          target={buying}
          resume={resume}
          locale={locale}
          onClose={() => {
            setBuying(null)
            setResume(null)
            load()
          }}
        />
      )}
    </>
  )
}
