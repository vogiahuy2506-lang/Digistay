'use client'

/**
 * One customer for the operators (src/lib/admin/customers.ts customerDetail):
 * its plan and usage, with "change plan / extend" (setPlan); its owner and
 * staff, each with the account actions; its properties; its latest plan
 * orders. Links to its orders and its activity log.
 */
import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Select, Textarea, toast } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'
import { AdminPage, Empty, Pill, Section, adminSend, useAdminData } from '@/components/admin/admin-ui'
import { AccountActions, AccountPills, type AdminAccount } from '@/components/admin/account-actions'
import { PlanState, usePlanName, type PlanView, type Usage } from '@/components/admin/plan-bits'

const PLANS = ['starter', 'growth', 'business'] as const
const USAGE = ['properties', 'rooms', 'staff', 'invoices'] as const
const PAYMENT_STATUS = ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'] as const
const has = (list: readonly string[], value: unknown) => typeof value === 'string' && list.includes(value)
const DAY_MS = 86_400_000

interface Detail {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: string
  deletedAt: string | null
  owner: AdminAccount
  members: { id: string; role: string; joinedAt: string; disabledAt: string | null; planLockedAt: string | null; user: AdminAccount }[]
  properties: { id: string; name: string; createdAt: string; deletedAt: string | null; planLockedAt: string | null; rooms: number }[]
  plan: PlanView | null
  usage: Usage
  limits: Usage
  payments: {
    id: string
    orderCode: string
    plan: string
    billing: 'MONTH' | 'YEAR'
    amount: number
    status: string
    createdAt: string
    paidAt: string | null
    periodStart: string | null
    periodEnd: string | null
    paidAfter: string | null
  }[]
  openInvitations: number
}

/** "YYYY-MM-DD" of `date` in Vietnam time, for a date input. */
const vnDay = (date: Date) => new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

function PlanForm({ detail, onClose, onSaved }: { detail: Detail; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('dash.admin')
  const current = detail.plan
  const [plan, setPlan] = React.useState<string>(current?.plan ?? 'growth')
  const [trial, setTrial] = React.useState(current?.trial ?? true)
  // From the current end while it is ahead, else from today.
  const base = Math.max(Date.now(), current ? Date.parse(current.periodEnd) : 0)
  const [end, setEnd] = React.useState(vnDay(new Date(base)))
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const save = async () => {
    if (note.trim().length < 3) return setError(t('common.noteRequired'))
    setBusy(true)
    setError('')
    try {
      await adminSend(`/api/admin/customers/${detail.id}/plan`, 'POST', { plan, trial, periodEnd: end, note })
      toast.success(t('planForm.done'))
      onSaved()
    } catch (e) {
      setError(t('common.failed', { error: (e as Error).message }))
      setBusy(false)
    }
  }

  const close = () => !busy && onClose()
  return (
    <Modal isOpen onClose={close} size="md" title={t('planForm.title')}>
      <ModalHeader onClose={close}>
        <h2 className="text-lg font-semibold text-fg">{t('planForm.title')}</h2>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <p className="text-sm text-fg/80">{t('planForm.lead')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('planForm.plan')} value={plan} onChange={(e) => setPlan(e.target.value)} options={PLANS.map((p) => ({ value: p, label: t(`plans.${p}`) }))} />
            <Select
              label={t('planForm.kind')}
              value={trial ? 'trial' : 'paid'}
              onChange={(e) => setTrial(e.target.value === 'trial')}
              options={[
                { value: 'trial', label: t('planForm.kindTrial') },
                { value: 'paid', label: t('planForm.kindPaid') },
              ]}
            />
          </div>
          <div>
            <Input type="date" label={t('planForm.end')} value={end} min={vnDay(new Date(Date.now() + DAY_MS))} onChange={(e) => setEnd(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ['d7', 7],
                  ['d30', 30],
                  ['d365', 365],
                ] as const
              ).map(([key, days]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEnd(vnDay(new Date(base + days * DAY_MS)))}
                  className="rounded-ctl border border-line px-2.5 py-1 text-xs font-medium text-fg hover:bg-fg/[0.04]"
                >
                  {t(`planForm.quick.${key}`)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {plan === current?.plan ? t('planForm.samePlan') : t('planForm.otherPlan')}
              {current?.nextPlan && ` ${t('planForm.nextMoves')}`}
            </p>
          </div>
          <Textarea label={t('planForm.note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('planForm.notePlaceholder')} rows={3} />
          {error && <p className="text-sm text-err">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={close} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button onClick={save} isLoading={busy}>
          {t('planForm.confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  )
}

function Person({ account, extra, onDone }: { account: AdminAccount; extra?: React.ReactNode; onDone: () => void }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-fg">
          {account.name || account.email}
          {extra}
        </p>
        <p className="truncate text-sm text-muted">
          {account.email}
          {account.phone && ` · ${account.phone}`}
        </p>
        <AccountPills account={account} />
      </div>
      <AccountActions account={account} onDone={onDone} />
    </li>
  )
}

export default function CustomerPage() {
  const t = useTranslations('dash.admin')
  const labels = useDashLabels()
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { data, state, reload } = useAdminData<Detail>(`/api/admin/customers/${workspaceId}`)
  const [editing, setEditing] = React.useState(false)
  const planName = usePlanName()

  if (state === 'error' && !data) {
    return (
      <AdminPage title={t('detail.notFound')}>
        <Link href="/admin/customers" className="text-sm text-acc underline">
          {t('detail.back')}
        </Link>
      </AdminPage>
    )
  }
  if (!data) return <AdminPage title="…">{null}</AdminPage>

  const plan = data.plan
  return (
    <AdminPage
      title={data.name}
      lead={
        <>
          <Link href="/admin/customers" className="mr-2 inline-flex items-center gap-1 text-acc hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('detail.back')}
          </Link>
          <span className="font-mono">{data.slug}</span> · {t('detail.created', { date: labels.date(data.createdAt) })}
        </>
      }
      actions={
        <>
          <Link href={`/admin/orders?workspace=${data.id}`} className="rounded-ctl border border-line bg-panel px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/[0.03]">
            {t('detail.openOrders')}
          </Link>
          <Link href={`/admin/activity?workspace=${data.id}`} className="rounded-ctl border border-line bg-panel px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/[0.03]">
            {t('detail.openActivity')}
          </Link>
        </>
      }
    >
      {data.deletedAt && <p className="rounded-box border border-err/30 bg-err-soft p-3 text-sm text-err">{t('detail.deleted', { date: labels.date(data.deletedAt) })}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Section
          title={t('detail.plan.title')}
          aside={
            !data.deletedAt && (
              <Button size="sm" onClick={() => setEditing(true)}>
                {t('detail.plan.change')}
              </Button>
            )
          }
        >
          {plan ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label={t('detail.plan.current')}>{planName(plan)}</Field>
              <Field label={t('detail.plan.state')}>
                <PlanState plan={plan} />
              </Field>
              <Field label={t('detail.plan.period')}>
                {labels.date(plan.periodStart)} → {labels.date(plan.periodEnd)}
              </Field>
              {plan.nextPlan && plan.nextPeriodEnd && (
                <Field label={t('detail.plan.next')}>
                  {t('detail.plan.nextValue', {
                    plan: planName({ plan: plan.nextPlan, billing: plan.nextBilling, trial: false }),
                    from: labels.date(plan.periodEnd),
                    to: labels.date(plan.nextPeriodEnd),
                  })}
                </Field>
              )}
              {plan.overLimitSince && (
                <p className="text-sm text-warn sm:col-span-2">{t('detail.plan.overLimit', { date: labels.date(plan.overLimitSince) })}</p>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted">{t('customers.noPlan')}</p>
          )}
        </Section>

        <Section title={t('detail.usage.title')}>
          <ul className="space-y-3">
            {USAGE.map((kind) => {
              const used = data.usage[kind]
              const limit = data.limits[kind]
              const over = used > limit
              return (
                <li key={kind}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-fg">{t(`customers.usage.${kind}`)}</span>
                    <span className={cn('tabular-nums', over ? 'font-semibold text-err' : 'text-muted')}>
                      {used}/{limit}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/[0.06]">
                    <div className={cn('h-full rounded-full', over ? 'bg-err' : 'bg-acc')} style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : used ? 100 : 0}%` }} />
                  </div>
                  {kind === 'staff' && data.openInvitations > 0 && (
                    <p className="mt-0.5 text-xs text-muted">{t('detail.usage.openInvitations', { count: data.openInvitations })}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>
      </div>

      <Section title={t('detail.people.title')}>
        <ul className="divide-y divide-line">
          <Person
            account={data.owner}
            onDone={reload}
            extra={
              <span className="ml-2 inline-flex align-middle">
                <Pill tone="info">{t('detail.owner')}</Pill>
              </span>
            }
          />
          {data.members.map((m) => (
            <Person
              key={m.id}
              account={m.user}
              onDone={reload}
              extra={
                <span className="ml-2 inline-flex gap-1 align-middle">
                  <Pill tone="muted">{labels.role(m.role)}</Pill>
                  {m.disabledAt && <Pill tone="warn">{t('detail.people.memberLocked')}</Pill>}
                  {m.planLockedAt && <Pill tone="warn">{t('detail.people.planLocked')}</Pill>}
                </span>
              }
            />
          ))}
        </ul>
        {data.members.length === 0 && <p className="pt-1 text-sm text-muted">{t('detail.people.empty')}</p>}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t('detail.properties.title')}>
          {data.properties.length === 0 ? (
            <Empty>{t('detail.properties.empty')}</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {data.properties.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-fg">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {p.deletedAt && <Pill tone="muted">{t('detail.properties.deleted')}</Pill>}
                    {p.planLockedAt && <Pill tone="warn">{t('detail.properties.planLocked')}</Pill>}
                    <span className="text-muted tabular-nums">{t('detail.properties.rooms', { count: p.rooms })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={t('detail.payments.title')}
          aside={
            <Link href={`/admin/orders?workspace=${data.id}`} className="text-sm text-acc hover:underline">
              {t('detail.payments.all')}
            </Link>
          }
        >
          {data.payments.length === 0 ? (
            <Empty>{t('detail.payments.empty')}</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {data.payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block text-fg">
                      {planName({ plan: p.plan, billing: p.billing, trial: false })} · <span className="tabular-nums">{labels.money(p.amount)}</span>
                    </span>
                    <span className="block text-xs text-muted">
                      #{p.orderCode} · {labels.dateTime(p.paidAt ?? p.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {p.paidAfter && <Pill tone="warn">{t('detail.payments.late')}</Pill>}
                    <Pill tone={p.status === 'PAID' ? 'ok' : p.status === 'PENDING' ? 'info' : 'muted'}>
                      {has(PAYMENT_STATUS, p.status) ? t(`detail.payments.status.${p.status as (typeof PAYMENT_STATUS)[number]}`) : p.status}
                    </Pill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {editing && (
        <PlanForm
          detail={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            reload()
          }}
        />
      )}
    </AdminPage>
  )
}
