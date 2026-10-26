'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, Button, Modal, ModalBody } from '@/components/ui'
import { formatVnd } from '@/lib/bookings/display'
import { apiError } from '@/lib/i18n/api-errors'
import type { PlanId } from '@/lib/marketing/plans'
import type { PaymentView } from '@/lib/billing/view'
import { InvoiceForm, buyerPayload, buyerValid, initialBuyer, type BuyerDraft } from './invoice-form'
import { planName, vnDate, type Billing, type BillingData, type ChangeKind, type LimitKey } from './types'

const POLL_MS = 3000
const LIMITS: LimitKey[] = ['properties', 'rooms', 'staff']

type Target = { plan: PlanId; billing: Billing }

/**
 * Buying a plan in three steps: what the purchase does (period.ts
 * planChange: the days an upgrade gives up, when a renewal or a downgrade
 * starts) and who the e-invoice is for; the VietQR with a poll until PayOS
 * reports the money; then what changed. Opened on a payment still waiting,
 * it starts at the QR.
 */
export function PurchaseDialog({
  data,
  target: initialTarget,
  resume,
  locale,
  onClose,
}: {
  data: BillingData
  target: Target | null
  resume: PaymentView | null
  locale: 'vi' | 'en'
  onClose: (changed: boolean) => void
}) {
  const t = useTranslations('dash.billing')
  const [target, setTarget] = React.useState<Target | null>(initialTarget ?? (resume ? { plan: resume.plan as PlanId, billing: resume.billing } : null))
  const [payment, setPayment] = React.useState<PaymentView | null>(resume)
  const [buyer, setBuyer] = React.useState<BuyerDraft>(() => initialBuyer(data.einvoice?.lastBuyer))
  const [showErrors, setShowErrors] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const checkout = async () => {
    if (!target) return
    if (data.einvoice && !buyerValid(buyer)) {
      setShowErrors(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/workspaces/${data.workspace.id}/subscription/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, ...(data.einvoice && { invoice: buyerPayload(buyer) }) }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(apiError(json?.error) || t('notReady'))
        return
      }
      setPayment(json.data)
    } finally {
      setBusy(false)
    }
  }

  // The dialog's name follows the step (screen readers, tests).
  const title = payment || !target ? t('checkout.title') : t(`review.title.${data.changes[target.plan][target.billing].kind}`, { plan: planName(target.plan) })

  return (
    <Modal isOpen onClose={() => onClose(payment?.status === 'PAID')} title={title} size="md">
      <ModalBody className="p-5 sm:p-7">
        {payment ? (
          <PaymentStep
            workspaceId={data.workspace.id}
            initial={payment}
            locale={locale}
            email={data.einvoice?.email ?? null}
            onClose={() => onClose(true)}
            onNewCode={() => {
              // A QR that ran out: make a new one for the same plan, asking nothing again.
              setPayment(null)
              if (!initialTarget && resume) setTarget({ plan: resume.plan as PlanId, billing: resume.billing })
            }}
          />
        ) : target ? (
          <Review data={data} target={target} locale={locale} buyer={buyer} onBuyer={setBuyer} showErrors={showErrors}>
            {error && (
              <Alert variant="destructive" className="mt-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => onClose(false)}>
                {t('review.later')}
              </Button>
              <Button isLoading={busy} onClick={checkout}>
                {data.changes[target.plan][target.billing].kind === 'upgrade' ? t('review.confirmUpgrade') : t('review.continue')}
              </Button>
            </div>
          </Review>
        ) : null}
      </ModalBody>
    </Modal>
  )
}

function Review({
  data,
  target,
  locale,
  buyer,
  onBuyer,
  showErrors,
  children,
}: {
  data: BillingData
  target: Target
  locale: 'vi' | 'en'
  buyer: BuyerDraft
  onBuyer: (b: BuyerDraft) => void
  showErrors: boolean
  children: React.ReactNode
}) {
  const t = useTranslations('dash.billing')
  const change = data.changes[target.plan][target.billing]
  const plan = data.plans.find((p) => p.id === target.plan)!
  const amount = target.billing === 'YEAR' ? plan.price * data.yearlyMonths : plan.price
  const startsNow = change.kind === 'new' || change.kind === 'upgrade'
  // Over the plan bought, after a downgrade: the 7-day grace, then locks (src/lib/billing/overage.ts).
  const over = change.kind === 'downgrade' ? LIMITS.filter((k) => data.usage[k] > plan[k]) : []

  return (
    <>
      <h2 className="font-serif text-[24px] leading-tight text-fg">{t(`review.title.${change.kind}`, { plan: planName(target.plan) })}</h2>
      <dl className="mt-5 grid gap-3 rounded-box border border-line bg-page p-4 text-small sm:grid-cols-3">
        <div>
          <dt className="text-muted">{t('checkout.plan')}</dt>
          <dd className="mt-0.5 font-medium text-fg">
            {planName(target.plan)} · {target.billing === 'YEAR' ? t('yearly') : t('monthly')}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t('checkout.amount')}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-fg">{formatVnd(amount, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('review.period')}</dt>
          <dd className="mt-0.5 tabular-nums text-fg">
            {startsNow ? t('review.fromPayment', { date: vnDate(change.endsAt) }) : `${vnDate(change.startsAt)} – ${vnDate(change.endsAt)}`}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-2 text-small">
        {change.kind === 'upgrade' && change.lostDays > 0 && (
          <p className="rounded-ctl border border-warn/40 bg-warn-soft p-3 text-warn">{t('review.upgradeNote', { days: change.lostDays })}</p>
        )}
        {change.kind === 'new' && change.lostDays > 0 && <p className="text-muted">{t('review.trialNote', { days: change.lostDays })}</p>}
        {change.kind === 'new' && change.lostDays === 0 && <p className="text-muted">{t('review.newNote')}</p>}
        {change.kind === 'renew' && <p className="text-muted">{t('review.renewNote', { date: vnDate(change.startsAt) })}</p>}
        {change.kind === 'downgrade' && <p className="text-muted">{t('review.downgradeNote', { plan: planName(target.plan), date: vnDate(change.startsAt) })}</p>}
        {over.length > 0 && (
          <p className="rounded-ctl border border-warn/40 bg-warn-soft p-3 text-warn">
            {t('review.overNote', { plan: planName(target.plan), what: over.map((k) => `${t(`limits.${k}`).toLowerCase()} ${data.usage[k]}/${plan[k]}`).join(', ') })}
          </p>
        )}
        {data.scheduled && change.kind !== 'downgrade' && (
          <p className="text-muted">{t('review.scheduledMoves', { plan: planName(data.scheduled.plan), date: vnDate(change.endsAt) })}</p>
        )}
      </div>

      {data.einvoice && (
        <div className="mt-6 border-t border-line pt-5">
          <InvoiceForm value={buyer} onChange={onBuyer} email={data.einvoice.email} vat={data.einvoice.vat} showErrors={showErrors} />
        </div>
      )}
      {children}
    </>
  )
}

/** The VietQR of one plan payment, its countdown, and a poll until PayOS reports the money. */
function PaymentStep({
  workspaceId,
  initial,
  locale,
  email,
  onClose,
  onNewCode,
}: {
  workspaceId: string
  initial: PaymentView
  locale: 'vi' | 'en'
  email: string | null
  onClose: () => void
  onNewCode: () => void
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

  if (payment.status === 'PAID') {
    const change = (payment.change ?? 'new') as ChangeKind
    return (
      <div className="py-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-soft text-[22px] text-ok" aria-hidden>
          ✓
        </div>
        <h2 className="mt-4 font-serif text-[26px] leading-tight text-fg">{t(`checkout.paid.${change}`, { plan: planName(payment.plan) })}</h2>
        <p className="mt-2 text-small text-muted">
          {change === 'downgrade'
            ? t('checkout.paidStarts', { date: payment.periodStart ? vnDate(payment.periodStart) : '' })
            : t('checkout.paidLead', { date: payment.periodEnd ? vnDate(payment.periodEnd) : '' })}
        </p>
        {payment.invoice && (
          <p className="mt-2 text-small text-muted">
            {payment.invoice.buyerType !== 'none' && email ? t('checkout.invoiceSent', { email }) : t('checkout.invoiceIssued')}
          </p>
        )}
        <Button className="mt-6" onClick={onClose}>
          {t('checkout.close')}
        </Button>
      </div>
    )
  }

  return (
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
          <Button onClick={onNewCode}>{t('checkout.newCode')}</Button>
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
  )
}
