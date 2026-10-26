'use client'

/**
 * The system page for the people running Digistay (SUPER_ADMIN): health,
 * current problems, scheduled jobs and email queues
 * (src/lib/ops/system-status.ts). Plain markup on purpose: it should not
 * depend on the shared UI components while they are being redesigned.
 */
import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

interface Problem {
  key: string
  severity: 'critical' | 'warning'
  title: string
  lines: string[]
}
interface JobRow {
  job: string
  last: { status: string; startedAt: string; durationMs: number | null; error: string | null } | null
  lastSuccessAt: string | null
  failures24h: number
}
interface Status {
  checkedAt: string
  health: { version: string; schema: string; redis: string }
  problems: Problem[]
  alerts: { key: string; severity: string; title: string; firstSeenAt: string; lastSentAt: string | null; resolvedAt: string | null }[]
  alertRecipients: string[]
  jobs: JobRow[]
  queues: { outbox: Record<string, number>; invoiceEmails: Record<string, number> }
  recentRuns: { id: string; job: string; status: string; startedAt: string; durationMs: number | null; error: string | null }[]
  planInvoices: PlanInvoice[]
}
/** A plan payment's e-invoice (src/lib/billing/einvoice.ts). */
interface PlanInvoice {
  id: string
  workspace: string
  orderCode: string
  plan: string
  billing: string
  amount: number
  buyerType: string
  buyer: string | null
  status: 'PENDING' | 'ISSUING' | 'ISSUED' | 'FAILED'
  environment: string | null
  einvoiceNumber: string | null
  attempts: number
  nextAttemptAt: string | null
  error: string | null
  emailStatus: string | null
  emailError: string | null
  cqtStatus: number | null
  createdAt: string
}

// Job names (messages: system.jobs.names) and email queue states (system.queues.status).
const JOB_KEYS = {
  'payos-reconcile': 'payosReconcile',
  'subscription-jobs': 'subscriptionJobs',
  'einvoice-jobs': 'einvoiceJobs',
  'email-outbox': 'emailOutbox',
  'ops-alerts': 'opsAlerts',
  backup: 'backup',
} as const
const QUEUE_STATES = ['PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'] as const
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key)

const duration = (ms: number | null) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; children: React.ReactNode }) {
  const tones = {
    ok: 'bg-ok-soft text-ok border-ok/30',
    warn: 'bg-warn-soft text-warn border-warn/30',
    bad: 'bg-err-soft text-err border-err/30',
    muted: 'bg-fg/[0.03] text-muted border-line',
  }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

const statusTone = (s: string) => (s === 'SUCCESS' ? 'ok' : s === 'FAILURE' ? 'bad' : s === 'RUNNING' ? 'warn' : 'muted')

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-box border border-line bg-panel p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export default function SystemPage() {
  const t = useTranslations('dash.account.system')
  const tc = useTranslations('dash.common')
  const locale = useLocale()
  const [status, setStatus] = React.useState<Status | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading')

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system', { cache: 'no-store' })
      if (res.status === 404 || res.status === 401 || res.status === 403) return setState('forbidden')
      const data = await res.json()
      if (!data.success) return setState('error')
      setStatus(data.data)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  React.useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  const [actionMessage, setActionMessage] = React.useState('')
  /** Retry a failed plan invoice, or email an issued one again (POST /api/admin/plan-invoices/[id]). */
  const act = async (id: string, action: 'retry' | 'resend') => {
    setActionMessage(t('planInvoices.working'))
    const res = await fetch(`/api/admin/plan-invoices/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setActionMessage(data?.success ? t('planInvoices.done') : `${t('planInvoices.failed')} ${data?.error ?? ''}`)
    await load()
  }

  const dateTime = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'vi-VN', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
    [locale]
  )
  const time = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : '—')
  const jobLabel = (job: string) => (has(JOB_KEYS, job) ? t(`jobs.names.${JOB_KEYS[job as keyof typeof JOB_KEYS]}`) : job)
  const queueLabel = (queueState: string) =>
    QUEUE_STATES.includes(queueState as never) ? t(`queues.status.${queueState as (typeof QUEUE_STATES)[number]}`) : queueState

  if (state === 'forbidden') {
    return (
      <div className="mx-auto max-w-xl p-10 text-center">
        <h1 className="text-xl font-semibold text-fg">{t('notFound')}</h1>
        <Link href="/workspaces" className="mt-4 inline-block text-sm text-acc underline">
          {t('backToWorkspaces')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
          <p className="text-sm text-muted">
            {status ? t('checkedAt', { time: time(status.checkedAt) }) : tc('states.loading')}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-ctl border border-line bg-panel px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/[0.03]"
        >
          {tc('actions.refresh')}
        </button>
      </header>

      {state === 'error' && <p className="rounded-lg border border-err/30 bg-err-soft p-3 text-sm text-err">{t('loadFailed')}</p>}

      {status && (
        <>
          <Section title={t('health.title')}>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-muted">{t('health.version')}</p>
                <p className="font-mono text-fg">{status.health.version.slice(0, 12)}</p>
              </div>
              <div>
                <p className="text-muted">{t('health.schema')}</p>
                <Pill tone={status.health.schema === 'ok' ? 'ok' : status.health.schema === 'unknown' ? 'muted' : 'bad'}>
                  {status.health.schema === 'ok'
                    ? t('health.schemaOk')
                    : status.health.schema === 'unknown'
                      ? t('health.schemaUnknown')
                      : t('health.schemaMissing', { migrations: status.health.schema.replace('missing ', '') })}
                </Pill>
              </div>
              <div>
                <p className="text-muted">{t('health.redis')}</p>
                <Pill tone={status.health.redis === 'ok' ? 'ok' : 'warn'}>{status.health.redis === 'ok' ? t('health.redisOk') : t('health.redisDown')}</Pill>
              </div>
              <div>
                <p className="text-muted">{t('health.alertRecipients')}</p>
                <p className="text-fg">{status.alertRecipients.length ? status.alertRecipients.join(', ') : <span className="text-err">{t('health.noRecipients')}</span>}</p>
              </div>
            </div>
          </Section>

          <Section title={t('problems.title')} aside={<Pill tone={status.problems.length ? 'bad' : 'ok'}>{status.problems.length || t('problems.none')}</Pill>}>
            {status.problems.length === 0 ? (
              <p className="text-sm text-muted">{t('problems.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {status.problems.map((p) => (
                  <li key={p.key} className={`rounded-lg border p-3 ${p.severity === 'critical' ? 'border-err/30 bg-err-soft' : 'border-warn/30 bg-warn-soft'}`}>
                    <p className="text-sm font-semibold text-fg">
                      <Pill tone={p.severity === 'critical' ? 'bad' : 'warn'}>{p.severity === 'critical' ? t('problems.critical') : t('problems.warning')}</Pill> {p.title}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-fg">
                      {p.lines.map((line, i) => (
                        <li key={i} className="break-words">{line}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t('planInvoices.title')}>
            {status.planInvoices.length === 0 ? (
              <p className="text-sm text-muted">{t('planInvoices.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="py-2 pr-4">{t('planInvoices.when')}</th>
                      <th className="py-2 pr-4">{t('planInvoices.workspace')}</th>
                      <th className="py-2 pr-4">{t('planInvoices.buyer')}</th>
                      <th className="py-2 pr-4">{t('planInvoices.status')}</th>
                      <th className="py-2 pr-4">{t('planInvoices.email')}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {status.planInvoices.map((i) => (
                      <tr key={i.id} className="align-top">
                        <td className="py-2 pr-4 tabular-nums">{time(i.createdAt)}</td>
                        <td className="py-2 pr-4 text-fg">
                          {i.workspace}
                          <span className="block text-xs text-muted">
                            {i.plan} · {i.billing} · {i.amount.toLocaleString('vi-VN')} ₫ · #{i.orderCode}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{i.buyer ?? t(`planInvoices.buyerTypes.${i.buyerType === 'personal' || i.buyerType === 'company' ? i.buyerType : 'none'}`)}</td>
                        <td className="py-2 pr-4">
                          <Pill tone={i.status === 'ISSUED' ? (i.cqtStatus === 6 ? 'bad' : 'ok') : i.status === 'FAILED' ? 'bad' : 'warn'}>
                            {i.status === 'ISSUED' && i.einvoiceNumber ? t('planInvoices.issued', { number: i.einvoiceNumber }) : i.status}
                          </Pill>
                          {i.environment === 'DEMO' && <span className="ml-1 text-xs text-muted">DEMO</span>}
                          {i.cqtStatus === 6 && <p className="mt-1 text-xs text-err">{t('planInvoices.cqtRefused')}</p>}
                          {i.error && i.status !== 'ISSUED' && <p className="mt-1 max-w-xs break-words text-xs text-err">{i.error}</p>}
                          {i.status === 'FAILED' && i.nextAttemptAt && <p className="mt-1 text-xs text-muted">{t('planInvoices.nextTry', { time: time(i.nextAttemptAt) })}</p>}
                        </td>
                        <td className="py-2 pr-4">
                          {i.emailStatus ? <Pill tone={i.emailStatus === 'SENT' ? 'ok' : i.emailStatus === 'FAILED' ? 'bad' : 'muted'}>{queueLabel(i.emailStatus)}</Pill> : '—'}
                          {i.emailError && i.emailStatus === 'FAILED' && <p className="mt-1 max-w-xs break-words text-xs text-err">{i.emailError}</p>}
                        </td>
                        <td className="py-2 text-right">
                          {i.status === 'FAILED' && (
                            <button type="button" className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-fg hover:bg-fg/5" onClick={() => act(i.id, 'retry')}>
                              {t('planInvoices.retry')}
                            </button>
                          )}
                          {i.status === 'ISSUED' && i.buyerType !== 'none' && (
                            <button type="button" className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-fg hover:bg-fg/5" onClick={() => act(i.id, 'resend')}>
                              {t('planInvoices.resend')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {actionMessage && <p className="mt-3 text-sm text-fg">{actionMessage}</p>}
          </Section>

          <Section title={t('jobs.title')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="py-2 pr-4">{t('jobs.job')}</th>
                    <th className="py-2 pr-4">{t('jobs.last')}</th>
                    <th className="py-2 pr-4">{t('jobs.result')}</th>
                    <th className="py-2 pr-4">{t('jobs.duration')}</th>
                    <th className="py-2 pr-4">{t('jobs.lastSuccess')}</th>
                    <th className="py-2 pr-4">{t('jobs.failures24h')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {status.jobs.map((j) => (
                    <tr key={j.job}>
                      <td className="py-2 pr-4 font-medium text-fg">{jobLabel(j.job)}</td>
                      <td className="py-2 pr-4 tabular-nums">{time(j.last?.startedAt ?? null)}</td>
                      <td className="py-2 pr-4">
                        {j.last ? <Pill tone={statusTone(j.last.status)}>{j.last.status}</Pill> : <Pill tone="bad">{t('jobs.neverRan')}</Pill>}
                        {j.last?.error && <p className="mt-1 max-w-xs break-words text-xs text-err">{j.last.error}</p>}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{duration(j.last?.durationMs ?? null)}</td>
                      <td className="py-2 pr-4 tabular-nums">{time(j.lastSuccessAt)}</td>
                      <td className="py-2 pr-4 tabular-nums">{j.failures24h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ['outbox', status.queues.outbox],
                ['invoiceEmails', status.queues.invoiceEmails],
              ] as const
            ).map(([queue, counts]) => (
              <Section key={queue} title={t(`queues.${queue}`)}>
                {Object.keys(counts).length === 0 ? (
                  <p className="text-sm text-muted">{t('queues.empty')}</p>
                ) : (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {Object.entries(counts).map(([s, n]) => (
                      <div key={s}>
                        <p className="text-muted">{queueLabel(s)}</p>
                        <p className={`text-lg font-semibold tabular-nums ${s === 'FAILED' ? 'text-err' : 'text-fg'}`}>{n}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            ))}
          </div>

          <Section title={t('runs.title')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {status.recentRuns.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5 pr-4 tabular-nums text-muted">{time(r.startedAt)}</td>
                      <td className="py-1.5 pr-4">{jobLabel(r.job)}</td>
                      <td className="py-1.5 pr-4"><Pill tone={statusTone(r.status)}>{r.status}</Pill></td>
                      <td className="py-1.5 pr-4 tabular-nums">{duration(r.durationMs)}</td>
                      <td className="py-1.5 pr-4 break-words text-xs text-err">{r.error}</td>
                    </tr>
                  ))}
                  {status.recentRuns.length === 0 && (
                    <tr>
                      <td className="py-2 text-muted">{t('runs.empty')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={t('alerts.title')}>
            {status.alerts.length === 0 ? (
              <p className="text-sm text-muted">{t('alerts.empty')}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {status.alerts.map((a) => (
                  <li key={a.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                    <Pill tone={a.resolvedAt ? 'ok' : a.severity === 'critical' ? 'bad' : 'warn'}>{a.resolvedAt ? t('alerts.resolved') : t('alerts.active')}</Pill>
                    <span className="min-w-0 flex-1 text-fg">{a.title}</span>
                    <span className="text-xs text-muted">
                      {a.resolvedAt
                        ? t('alerts.timesResolved', { first: time(a.firstSeenAt), last: time(a.lastSentAt), resolved: time(a.resolvedAt) })
                        : t('alerts.times', { first: time(a.firstSeenAt), last: time(a.lastSentAt) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
