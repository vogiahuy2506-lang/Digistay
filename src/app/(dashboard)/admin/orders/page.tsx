'use client'

/**
 * Plan orders for Digistay's operators (src/lib/admin/orders.ts): every plan
 * payment with what it bought and where it stands, the money received, and
 * the orders paid after their code was closed (paidAfter), to look at. The
 * filters live in the address, so a customer's page links to its orders
 * (?workspace=<id>) and an ops alert to one order (?q=<order code>).
 */
import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCheck, MoreVertical, RefreshCw, Search, X, XCircle } from 'lucide-react'
import { Button, Dropdown, DropdownItem, Input, Modal, ModalBody, ModalFooter, Select, Textarea, toast } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'
import { AdminPage, Empty, Pager, Pill, Section, Stat, adminSend, useAdminData, useDebounced, type Tone } from '@/components/admin/admin-ui'

const STATUSES = ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'] as const
const FLAGS = ['late', 'unreviewed'] as const
const PLANS = ['starter', 'growth', 'business'] as const
const CHANGES = ['new', 'renew', 'upgrade', 'downgrade'] as const
const LATE = ['CANCELLED', 'EXPIRED', 'FAILED'] as const
const INVOICE = ['PENDING', 'ISSUING', 'ISSUED', 'FAILED'] as const
type Status = (typeof STATUSES)[number]
type Action = 'cancel' | 'sync' | 'review'

const has = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === 'string' && (list as readonly string[]).includes(value)

const statusTone: Record<Status, Tone> = { PENDING: 'info', PAID: 'ok', CANCELLED: 'muted', EXPIRED: 'muted', FAILED: 'bad' }
const invoiceTone: Record<(typeof INVOICE)[number], Tone> = { PENDING: 'muted', ISSUING: 'info', ISSUED: 'ok', FAILED: 'bad' }

interface Order {
  id: string
  orderCode: string
  workspace: { id: string; name: string; slug: string; deleted: boolean }
  buyer: { name: string | null; email: string } | null
  plan: string
  billing: 'MONTH' | 'YEAR'
  amount: number
  status: Status
  createdAt: string
  expiresAt: string | null
  paidAt: string | null
  periodStart: string | null
  periodEnd: string | null
  change: string | null
  paidAfter: string | null
  reviewedAt: string | null
  reviewNote: string | null
  reviewer: string | null
  invoice: { status: string; einvoiceNumber: string | null } | null
}
interface OrdersData {
  rows: Order[]
  total: number
  page: number
  size: number
  summary: { revenueMonth: number; paidMonth: number; revenue30d: number; pending: number; flagged: number }
}

export default function OrdersPage() {
  const t = useTranslations('dash.adminOrders')
  const tc = useTranslations('dash.admin.common')
  const labels = useDashLabels()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const statusParam = params.get('status')
  const status = has(STATUSES, statusParam) ? statusParam : ''
  const flagParam = params.get('flag')
  const flag = has(FLAGS, flagParam) ? flagParam : ''
  const workspace = params.get('workspace') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [query, setQuery] = React.useState(params.get('q') ?? '')
  const q = useDebounced(query.trim())

  /** Changes some of the address's filters; any change but the page goes back to page 1. */
  const update = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (!('page' in changes)) next.delete('page')
      const text = next.toString()
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
    },
    [params, pathname, router]
  )

  React.useEffect(() => {
    if ((params.get('q') ?? '') !== q) update({ q: q || null })
    // Only the typed text drives this; the address follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const search = new URLSearchParams({
    ...(q && { q }),
    ...(status && { status }),
    ...(flag && { flag }),
    ...(workspace && { workspace }),
    page: String(page),
  })
  const orders = useAdminData<OrdersData>(`/api/admin/orders?${search}`)
  const summary = orders.data?.summary

  /** The order an action is running on, and which one. */
  const [busy, setBusy] = React.useState<{ id: string; action: Action } | null>(null)
  const [dialog, setDialog] = React.useState<{ kind: 'cancel' | 'review'; order: Order } | null>(null)
  const [note, setNote] = React.useState('')
  const [noteError, setNoteError] = React.useState('')

  const statusLabel = (value: unknown) => (has(STATUSES, value) ? t(`status.${value}`) : String(value ?? ''))
  const openDialog = (kind: 'cancel' | 'review', order: Order) => {
    setNote('')
    setNoteError('')
    setDialog({ kind, order })
  }

  const act = async (order: Order, action: Action, text?: string) => {
    const code = order.orderCode
    setBusy({ id: order.id, action })
    try {
      const data = await adminSend<{ status?: string; payos?: boolean }>(`/api/admin/orders/${order.id}`, 'POST', { action, ...(text && { note: text }) })
      if (action === 'cancel' && data.payos === false) toast.warning(t('toast.cancelledHere', { code }), t('toast.cancelledHereText'))
      else if (action === 'cancel') toast.success(t('toast.cancelled', { code }))
      else if (action === 'sync') toast.success(t('toast.synced', { code, status: statusLabel(data.status) }))
      else toast.success(t('toast.reviewed', { code }))
      setDialog(null)
      orders.reload()
    } catch (error) {
      toast.error(t('toast.failed'), apiError(error instanceof Error ? error.message : undefined))
    } finally {
      setBusy(null)
    }
  }

  const confirm = () => {
    if (!dialog) return
    const text = note.trim()
    if (dialog.kind === 'review' && text.length < 3) return setNoteError(t('reviewDialog.tooShort'))
    act(dialog.order, dialog.kind, text || undefined)
  }

  // The workspace filtered on, by name once its orders are loaded.
  const workspaceName = orders.data?.rows.find((r) => r.workspace.id === workspace)?.workspace.name ?? workspace

  return (
    <AdminPage title={t('title')} lead={t('lead')}>
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t('stats.month')} value={labels.money(summary.revenueMonth)} hint={t('stats.monthHint', { count: summary.paidMonth })} />
          <Stat label={t('stats.last30')} value={labels.money(summary.revenue30d)} hint={t('stats.last30Hint')} />
          <Stat label={t('stats.pending')} value={summary.pending} hint={t('stats.pendingHint')} />
          <button
            type="button"
            aria-pressed={flag === 'unreviewed'}
            onClick={() => update({ flag: flag === 'unreviewed' ? null : 'unreviewed', status: null })}
            className="rounded-box text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
          >
            <Stat label={t('stats.flagged')} value={summary.flagged} hint={t('stats.flaggedHint')} tone={summary.flagged > 0 ? 'warn' : undefined} />
          </button>
        </div>
      )}

      <Section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="sm:w-80">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('filters.search')}
              aria-label={tc('search')}
              icon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
          <div className="sm:w-52">
            <Select
              aria-label={t('filters.status')}
              value={status}
              onChange={(e) => update({ status: e.target.value || null })}
              options={[{ value: '', label: `${t('filters.status')}: ${tc('all')}` }, ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))]}
            />
          </div>
          <div className="sm:w-56">
            <Select
              aria-label={t('filters.flag')}
              value={flag}
              onChange={(e) => update({ flag: e.target.value || null })}
              options={[
                { value: '', label: t('filters.allFlags') },
                { value: 'late', label: t('filters.late') },
                { value: 'unreviewed', label: t('filters.unreviewed') },
              ]}
            />
          </div>
          {workspace && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-fg/[0.03] py-1 pl-3 pr-1 text-sm text-fg">
              <span className="truncate">{t('filters.workspace', { name: workspaceName })}</span>
              <button
                type="button"
                onClick={() => update({ workspace: null })}
                aria-label={t('filters.clearWorkspace')}
                title={t('filters.clearWorkspace')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-fg/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          )}
        </div>

        {orders.state === 'error' && !orders.data ? (
          <Empty>{tc('loadFailed')}</Empty>
        ) : !orders.data ? (
          <Empty>{tc('working')}</Empty>
        ) : orders.data.rows.length === 0 ? (
          <Empty>{t('empty')}</Empty>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 pr-3 font-medium">{t('columns.order')}</th>
                    <th className="py-2 pr-3 font-medium">{t('columns.workspace')}</th>
                    <th className="py-2 pr-3 font-medium">{t('columns.plan')}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t('columns.amount')}</th>
                    <th className="py-2 pr-3 font-medium">{t('columns.status')}</th>
                    <th className="py-2 pr-3 font-medium">{t('columns.period')}</th>
                    <th className="py-2 pr-3 font-medium">{t('columns.invoice')}</th>
                    <th className="py-2 font-medium">
                      <span className="sr-only">{t('columns.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data.rows.map((order) => (
                    <tr key={order.id} className="border-b border-line/70 align-top last:border-0 hover:bg-fg/[0.02]">
                      <td className="py-3 pr-3">
                        <p className="font-mono text-fg">{order.orderCode}</p>
                        <p className="whitespace-nowrap text-xs text-muted">{t('created', { time: labels.dateTime(order.createdAt) })}</p>
                      </td>
                      <td className="max-w-[14rem] py-3 pr-3">
                        <WorkspaceCell order={order} />
                      </td>
                      <td className="py-3 pr-3">
                        <PlanCell order={order} />
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-right font-medium tabular-nums text-fg">{labels.money(order.amount)}</td>
                      <td className="py-3 pr-3">
                        <StatusCell order={order} />
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-fg">
                        <PeriodText order={order} />
                      </td>
                      <td className="py-3 pr-3">
                        <InvoiceCell order={order} />
                      </td>
                      <td className="py-3">
                        <OrderActions order={order} busy={busy?.id === order.id ? busy.action : null} onCancel={() => openDialog('cancel', order)} onSync={() => act(order, 'sync')} onReview={() => openDialog('review', order)} menu />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line lg:hidden">
              {orders.data.rows.map((order) => (
                <li key={order.id} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <WorkspaceCell order={order} />
                    </div>
                    <span className="shrink-0 font-medium tabular-nums text-fg">{labels.money(order.amount)}</span>
                  </div>
                  <p className="text-xs text-muted">
                    <span className="font-mono text-fg">{order.orderCode}</span> · {t('created', { time: labels.dateTime(order.createdAt) })}
                  </p>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <PlanCell order={order} />
                    <StatusCell order={order} />
                  </div>
                  {(order.periodStart || order.invoice) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      {order.periodStart && (
                        <span>
                          {t('columns.period')}: <PeriodText order={order} />
                        </span>
                      )}
                      {order.invoice && (
                        <span className="inline-flex items-center gap-1">
                          {t('columns.invoice')}: <InvoiceCell order={order} />
                        </span>
                      )}
                    </div>
                  )}
                  <OrderActions order={order} busy={busy?.id === order.id ? busy.action : null} onCancel={() => openDialog('cancel', order)} onSync={() => act(order, 'sync')} onReview={() => openDialog('review', order)} />
                </li>
              ))}
            </ul>
            <Pager page={page} size={orders.data.size} total={orders.data.total} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </Section>

      <Modal
        isOpen={dialog !== null}
        onClose={() => setDialog(null)}
        size="sm"
        showHeader
        title={dialog ? t(dialog.kind === 'cancel' ? 'cancelDialog.title' : 'reviewDialog.title', { code: dialog.order.orderCode }) : ''}
      >
        <ModalBody>
          <p className="text-body text-fg/80">
            {dialog?.kind === 'review' ? t('reviewDialog.text', { status: statusLabel(dialog.order.paidAfter) }) : t('cancelDialog.text')}
          </p>
          <Textarea
            label={dialog?.kind === 'review' ? t('reviewDialog.note') : t('cancelDialog.note')}
            required={dialog?.kind === 'review'}
            placeholder={dialog?.kind === 'review' ? t('reviewDialog.placeholder') : undefined}
            value={note}
            maxLength={1000}
            rows={3}
            error={noteError || undefined}
            onChange={(e) => {
              setNote(e.target.value)
              if (noteError) setNoteError('')
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDialog(null)}>
            {dialog?.kind === 'cancel' ? t('cancelDialog.keep') : tc('cancel')}
          </Button>
          <Button variant={dialog?.kind === 'cancel' ? 'danger' : 'primary'} isLoading={busy !== null} onClick={confirm}>
            {dialog?.kind === 'cancel' ? t('cancelDialog.confirm') : t('reviewDialog.confirm')}
          </Button>
        </ModalFooter>
      </Modal>
    </AdminPage>
  )
}

/** The workspace (to its page on /admin/customers) and who bought. */
function WorkspaceCell({ order }: { order: Order }) {
  const t = useTranslations('dash.adminOrders')
  return (
    <>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Link href={`/admin/customers/${order.workspace.id}`} className="truncate font-medium text-fg hover:underline">
          {order.workspace.name}
        </Link>
        {order.workspace.deleted && <Pill tone="bad">{t('deleted')}</Pill>}
      </span>
      {order.buyer && (
        <span className="block truncate text-xs text-muted" title={order.buyer.name ?? undefined}>
          {order.buyer.email}
        </span>
      )}
    </>
  )
}

/** "Growth · Tháng", and how it was applied once paid. */
function PlanCell({ order }: { order: Order }) {
  const t = useTranslations('dash.adminOrders')
  const ta = useTranslations('dash.admin')
  const plan = has(PLANS, order.plan) ? ta(`plans.${order.plan}`) : order.plan
  return (
    <div>
      <p className="whitespace-nowrap text-sm text-fg">{t('planBilling', { plan, billing: ta(`billing.${order.billing}`) })}</p>
      {has(CHANGES, order.change) && <p className="text-xs text-muted">{t(`change.${order.change}`)}</p>}
    </div>
  )
}

/** The status, its time, and the flag of money that came after the code was closed. */
function StatusCell({ order }: { order: Order }) {
  const t = useTranslations('dash.adminOrders')
  const labels = useDashLabels()
  const qrGone = order.status === 'PENDING' && order.expiresAt !== null && new Date(order.expiresAt).getTime() < Date.now()
  return (
    <div className="space-y-1">
      <Pill tone={statusTone[order.status]}>{t(`status.${order.status}`)}</Pill>
      {order.paidAt ? (
        <p className="whitespace-nowrap text-xs text-muted">{t('paid', { time: labels.dateTime(order.paidAt) })}</p>
      ) : order.status === 'PENDING' && order.expiresAt ? (
        <p className="whitespace-nowrap text-xs text-muted">{qrGone ? t('qrExpired') : t('expires', { time: labels.dateTime(order.expiresAt) })}</p>
      ) : null}
      {order.paidAfter && (
        <>
          <span className="flex flex-wrap gap-1">
            <Pill tone={order.reviewedAt ? 'muted' : 'warn'}>{has(LATE, order.paidAfter) ? t(`late.${order.paidAfter}`) : order.paidAfter}</Pill>
            {order.reviewedAt && <Pill tone="ok">{t('reviewed')}</Pill>}
          </span>
          {order.reviewedAt && (
            <p className="max-w-[16rem] break-words text-xs text-muted">
              {t('reviewedBy', { email: order.reviewer ?? '—', time: labels.dateTime(order.reviewedAt), note: order.reviewNote ?? '' })}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** The period the payment bought (a renewal or a downgrade starts later). */
function PeriodText({ order }: { order: Order }) {
  const labels = useDashLabels()
  if (!order.periodStart || !order.periodEnd) return <span className="text-muted">—</span>
  return (
    <span>
      {labels.date(order.periodStart)} → {labels.date(order.periodEnd)}
    </span>
  )
}

function InvoiceCell({ order }: { order: Order }) {
  const t = useTranslations('dash.adminOrders')
  const invoice = order.invoice
  if (!invoice) return <span className="text-sm text-muted">—</span>
  if (!has(INVOICE, invoice.status)) return <Pill tone="muted">{invoice.status}</Pill>
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Pill tone={invoiceTone[invoice.status]}>{t(`invoice.${invoice.status}`)}</Pill>
      {invoice.einvoiceNumber && <span className="text-xs text-muted">{t('invoice.number', { number: invoice.einvoiceNumber })}</span>}
    </span>
  )
}

/** Cancel a code still waiting, ask PayOS again (anything not paid), mark a flagged order as looked at. */
function OrderActions({
  order,
  busy,
  onCancel,
  onSync,
  onReview,
  menu,
}: {
  order: Order
  /** The action running on this order, if any. */
  busy: Action | null
  onCancel: () => void
  onSync: () => void
  onReview: () => void
  /** In the table: a ⋮ menu, so the columns keep their width. */
  menu?: boolean
}) {
  const t = useTranslations('dash.adminOrders')
  const review = Boolean(order.paidAfter && !order.reviewedAt)
  if (order.status === 'PAID' && !review) return null
  if (menu) {
    return (
      <Dropdown
        trigger={
          <button
            type="button"
            aria-label={t('columns.actions')}
            disabled={busy !== null}
            className="relative flex h-9 w-9 items-center justify-center rounded-ctl text-muted hover:bg-fg/5 hover:text-fg disabled:opacity-50"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
            {/* A flagged order waits for someone: say so on the button too. */}
            {review && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warn" aria-hidden="true" />}
          </button>
        }
      >
        {review && (
          <DropdownItem icon={<CheckCheck className="h-4 w-4" />} onClick={onReview}>
            {t('actions.review')}
          </DropdownItem>
        )}
        {order.status !== 'PAID' && (
          <DropdownItem icon={<RefreshCw className="h-4 w-4" />} onClick={onSync}>
            {t('actions.sync')}
          </DropdownItem>
        )}
        {order.status === 'PENDING' && (
          <DropdownItem icon={<XCircle className="h-4 w-4" />} danger onClick={onCancel}>
            {t('actions.cancel')}
          </DropdownItem>
        )}
      </Dropdown>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {review && (
        <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onReview}>
          {t('actions.review')}
        </Button>
      )}
      {order.status !== 'PAID' && (
        <Button size="sm" variant="outline" isLoading={busy === 'sync'} disabled={busy !== null} onClick={onSync}>
          {t('actions.sync')}
        </Button>
      )}
      {order.status === 'PENDING' && (
        <Button size="sm" variant="danger-outline" disabled={busy !== null} onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
      )}
    </div>
  )
}
