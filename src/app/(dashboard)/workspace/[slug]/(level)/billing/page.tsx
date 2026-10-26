'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Alert, AlertDescription, Badge, Button, Loading, Modal, ModalBody } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { formatVnd } from '@/lib/bookings/display'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'
import { isPlanId, type Plan, type PlanId } from '@/lib/marketing/plans'
import type { PaymentView } from '@/lib/billing/view'

type Billing = 'MONTH' | 'YEAR'
type State = 'trial' | 'active' | 'grace' | 'locked'
type LimitKey = 'properties' | 'rooms' | 'staff' | 'invoices'

interface BillingData {
  workspace: { id: string; name: string; slug: string }
  subscription: {
    plan: PlanId
    billing: Billing | null
    trial: boolean
    periodStart: string
    periodEnd: string
    state: State
    daysLeft: number
    graceDaysLeft: number
    locksAt: string
  }
  limits: Record<LimitKey, number>
  usage: Record<LimitKey, number>
  plans: Plan[]
  yearlyMonths: number
  checkoutReady: boolean
  pending: PaymentView | null
  payments: PaymentView[]
}

const STATE_TONE: Record<State, 'success' | 'warning' | 'danger' | 'secondary'> = {
  trial: 'secondary',
  active: 'success',
  grace: 'warning',
  locked: 'danger',
}
const LIMITS: LimitKey[] = ['properties', 'rooms', 'staff', 'invoices']
const POLL_MS = 3000

/** 26/10/2026 (Vietnam time, written by hand: Intl dates differ between Node and browsers). */
function vnDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

const planName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)

/**
 * The workspace's Digistay plan (owner and admins): its state and usage,
 * the plans for sale with a monthly / yearly switch, the VietQR to pay one
 * (Digistay's PayOS account, src/lib/billing), and past payments.
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
  const [paying, setPaying] = React.useState<PlanId | null>(null)
  const [checkout, setCheckout] = React.useState<PaymentView | null>(null)
  const [checkoutError, setCheckoutError] = React.useState('')
  // A plan picked on the pricing page (/billing/start) opens its QR once.
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

  const pay = React.useCallback(
    async (plan: PlanId, period: Billing) => {
      if (!workspaceId) return
      setPaying(plan)
      setCheckoutError('')
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/subscription/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, billing: period }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          setCheckoutError(apiError(json?.error) || t('notReady'))
          return
        }
        setCheckout(json.data)
      } finally {
        setPaying(null)
      }
    },
    [workspaceId, t],
  )

  React.useEffect(() => {
    const plan = preset.current
    if (!data || !plan || !isPlanId(plan) || !data.checkoutReady) return
    preset.current = null
    pay(plan, billing)
  }, [data, billing, pay])

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

      {data.pending && !checkout && (
        <Alert className="mt-6">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('checkout.resume', { plan: planName(data.pending.plan), amount: formatVnd(data.pending.amount, locale) })}</span>
            <Button size="sm" variant="secondary" onClick={() => setCheckout(data.pending)}>
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
        {checkoutError && (
          <Alert variant="destructive" className="mt-5">
            <AlertDescription>{checkoutError}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {data.plans.map((p) => {
            const isCurrent = !sub.trial && p.id === sub.plan
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
                  variant={isCurrent ? 'secondary' : 'primary'}
                  disabled={!data.checkoutReady || paying !== null}
                  isLoading={paying === p.id}
                  onClick={() => pay(p.id, billing)}
                >
                  {(isCurrent ? t('renew', { price: formatVnd(price(p), locale) }) : t('pay', { price: formatVnd(price(p), locale) }))}
                </Button>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-small text-muted">
          {t('newPeriodNote')} {t('vat')}
        </p>
      </section>

      {/* Past payments */}
      <section className="mt-12">
        <h2 className="font-serif text-[24px] leading-tight text-fg sm:text-[28px]">{t('history.title')}</h2>
        {data.payments.length === 0 ? (
          <p className="mt-4 text-small text-muted">{t('history.empty')}</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-box border border-line bg-panel">
            <table className="w-full min-w-[560px] text-small">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-3 font-normal">{t('history.date')}</th>
                  <th className="px-4 py-3 font-normal">{t('history.plan')}</th>
                  <th className="px-4 py-3 text-right font-normal">{t('history.amount')}</th>
                  <th className="px-4 py-3 font-normal">{t('history.status')}</th>
                  <th className="px-4 py-3 font-normal">{t('history.period')}</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-line/70 last:border-b-0">
                    <td className="px-4 py-3 tabular-nums text-fg">{vnDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-4 py-3 text-fg">
                      {planName(p.plan)} · {p.billing === 'YEAR' ? t('yearly') : t('monthly')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg">{formatVnd(p.amount, locale)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === 'PAID' ? 'success' : 'warning'}>{t(`history.${p.status === 'PAID' ? 'PAID' : 'PENDING'}`)}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-fg/80">{p.periodStart && p.periodEnd ? `${vnDate(p.periodStart)} – ${vnDate(p.periodEnd)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {checkout && workspaceId && (
        <CheckoutDialog
          workspaceId={workspaceId}
          initial={checkout}
          locale={locale}
          onClose={() => {
            setCheckout(null)
            load()
          }}
          onNewCode={(p) => pay(p.plan as PlanId, p.billing)}
        />
      )}
    </>
  )
}

/** The VietQR of one plan payment, its countdown, and a poll until PayOS reports the money. */
function CheckoutDialog({
  workspaceId,
  initial,
  locale,
  onClose,
  onNewCode,
}: {
  workspaceId: string
  initial: PaymentView
  locale: 'vi' | 'en'
  onClose: () => void
  onNewCode: (payment: PaymentView) => void
}) {
  const t = useTranslations('dash.billing')
  const [payment, setPayment] = React.useState(initial)
  const [checking, setChecking] = React.useState(false)
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => setPayment(initial), [initial])

  const refresh = React.useCallback(
    async (sync: boolean) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/subscription/payments/${payment.id}${sync ? '?sync=1' : ''}`, { cache: 'no-store' }).catch(() => null)
      const json = await res?.json().catch(() => null)
      if (json?.success) setPayment((p) => ({ ...json.data, qrImage: json.data.qrImage ?? p.qrImage }))
    },
    [workspaceId, payment.id],
  )

  // Poll while waiting; every fourth poll also asks PayOS (a webhook may be late).
  React.useEffect(() => {
    if (payment.status !== 'PENDING') return
    let n = 0
    const id = setInterval(() => {
      n++
      refresh(n % 4 === 0)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [payment.status, refresh])

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const left = payment.expiresAt ? Math.max(0, new Date(payment.expiresAt).getTime() - now) : null
  const expired = payment.status !== 'PAID' && (payment.status !== 'PENDING' || left === 0)
  const mmss = left === null ? '' : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`

  return (
    <Modal isOpen onClose={onClose} title={t('checkout.title')} size="md">
      <ModalBody className="p-5 sm:p-7">
        {payment.status === 'PAID' ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-soft text-[22px] text-ok" aria-hidden>
              ✓
            </div>
            <h2 className="mt-4 font-serif text-[26px] leading-tight text-fg">{t('checkout.paidTitle', { plan: planName(payment.plan) })}</h2>
            <p className="mt-2 text-small text-muted">{t('checkout.paidLead', { date: payment.periodEnd ? vnDate(payment.periodEnd) : '' })}</p>
            <Button className="mt-6" onClick={onClose}>
              {t('checkout.close')}
            </Button>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-[24px] leading-tight text-fg">{t('checkout.title')}</h2>
            <p className="mt-1.5 text-small text-muted">{t('checkout.lead')}</p>
            <div className="mt-5 grid items-start gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="mx-auto w-full max-w-[240px]">
                {payment.qrImage && !expired ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a data: URL made on the server
                  <img src={payment.qrImage} alt={t('checkout.qrAlt')} className="aspect-square w-full rounded-ctl border border-line bg-white p-2" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-ctl border border-dashed border-line p-4 text-center text-small text-muted">
                    {t('checkout.expired')}
                  </div>
                )}
              </div>
              <dl className="grid gap-3 text-small">
                <div>
                  <dt className="text-muted">{t('checkout.plan')}</dt>
                  <dd className="mt-0.5 font-medium text-fg">
                    {planName(payment.plan)} · {payment.billing === 'YEAR' ? t('yearly') : t('monthly')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t('checkout.amount')}</dt>
                  <dd className="mt-0.5 text-[22px] font-semibold tabular-nums text-fg">{formatVnd(payment.amount, locale)}</dd>
                </div>
                {payment.description && (
                  <div>
                    <dt className="text-muted">{t('checkout.content')}</dt>
                    <dd className="mt-0.5 font-mono text-fg">{payment.description}</dd>
                  </div>
                )}
                {!expired && mmss && <p className="text-muted">{t('checkout.expires', { time: mmss })}</p>}
                {!expired && <p className="text-muted">{t('checkout.waiting')}</p>}
              </dl>
            </div>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              {expired ? (
                <Button onClick={() => onNewCode(payment)}>{t('checkout.newCode')}</Button>
              ) : (
                <>
                  {payment.checkoutUrl && (
                    <a
                      href={payment.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center justify-center rounded-ctl border border-line px-4 text-small font-medium text-fg hover:border-muted sm:h-9"
                    >
                      {t('checkout.openPayos')}
                    </a>
                  )}
                  <Button
                    isLoading={checking}
                    onClick={async () => {
                      setChecking(true)
                      await refresh(true)
                      setChecking(false)
                    }}
                  >
                    {checking ? t('checkout.checking') : t('checkout.check')}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </ModalBody>
    </Modal>
  )
}
