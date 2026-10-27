'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import {
  Card, CardContent, CardHeader, CardTitle, Button, Select, Input, Tabs, TabsList, TabsTrigger,
  Dropdown, DropdownItem, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui'
import { useTranslations } from 'next-intl'
import { routes } from '@/lib/utils/routes'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'
import { METHOD_GROUPS, toCsv, type GroupBy, type MethodGroup } from '@/lib/reports/revenue'
import type { RevenueReport } from '@/lib/reports/revenue-report'
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, Download, FileText, Wallet } from 'lucide-react'
import { NoAccess } from '@/components/payment/no-access'
import { useCan } from '@/components/layout/workspace-context'

type Period = '7' | '30' | '90' | 'thisMonth' | 'lastMonth' | 'custom'
const PERIODS: Period[] = ['7', '30', '90', 'thisMonth', 'lastMonth', 'custom']

/** Mắt Bão MaTTHDon codes with a label (src/lib/einvoice/cqt-labels.ts). */
const CQT_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
type CqtCode = (typeof CQT_CODES)[number]

const DAY_MS = 24 * 60 * 60 * 1000
/** Today in Vietnam time, yyyy-mm-dd. */
const vnToday = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
const shiftDay = (day: string, days: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)

function periodRange(period: Period, custom: { from: string; to: string }) {
  const today = vnToday()
  switch (period) {
    case 'thisMonth':
      return { from: `${today.slice(0, 7)}-01`, to: today }
    case 'lastMonth': {
      const lastDay = shiftDay(`${today.slice(0, 7)}-01`, -1)
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay }
    }
    case 'custom':
      return custom
    default:
      return { from: shiftDay(today, 1 - Number(period)), to: today }
  }
}

/** A report bucket (Vietnam day yyyy-mm-dd or month yyyy-mm) as the reader writes it. */
function bucketLabel(key: string, short = false) {
  const [y, m, d] = key.split('-')
  if (!d) return `${m}/${y}`
  return short ? `${d}/${m}` : `${d}/${m}/${y}`
}

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function ReportsPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  const t = useTranslations('dash.reports.revenue')
  const tc = useTranslations('dash.common')
  const ti = useTranslations('dash.money.invoices')
  const labels = useDashLabels()
  // Revenue is for the owner and managers (src/components/layout/nav.ts); the API refuses the others.
  const allowed = useCan('revenue_view')

  const [period, setPeriod] = React.useState<Period>('30')
  const [custom, setCustom] = React.useState(() => ({ from: shiftDay(vnToday(), -29), to: vnToday() }))
  const [groupBy, setGroupBy] = React.useState<GroupBy>('day')
  const [method, setMethod] = React.useState<MethodGroup | ''>('')
  const [report, setReport] = React.useState<RevenueReport | null>(null)
  const [error, setError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [exporting, setExporting] = React.useState(false)

  const range = periodRange(period, custom)
  const query = React.useCallback(
    (extra: Record<string, string> = {}) =>
      new URLSearchParams({ propertyId, from: range.from, to: range.to, groupBy, ...(method && { method }), ...extra }).toString(),
    [propertyId, range.from, range.to, groupBy, method]
  )

  React.useEffect(() => {
    if (!allowed || !range.from || !range.to) return
    let stale = false
    setIsLoading(true)
    setError('')
    fetch(`/api/reports/revenue?${query()}`)
      .then((res) => res.json())
      .then((data) => {
        if (stale) return
        if (data.success) setReport(data.data)
        else setError(apiError(data.error) || t('loadError'))
      })
      .catch(() => !stale && setError(t('loadError')))
      .finally(() => !stale && setIsLoading(false))
    return () => {
      stale = true
    }
  }, [query, range.from, range.to, t, allowed])

  const methodLabel = (group: MethodGroup) => t(`method.${group}`)
  const cqtLabel = (code: number) =>
    (CQT_CODES as readonly string[]).includes(String(code))
      ? ti(`cqt.${String(code) as CqtCode}`)
      : ti('cqt.unknown', { code })

  const exportCsv = async (kind: 'payments' | 'invoices') => {
    setExporting(true)
    try {
      const res = await fetch(`/api/reports/revenue?${query({ rows: '1' })}`)
      const data = await res.json()
      if (!data.success) {
        setError(apiError(data.error) || t('loadError'))
        return
      }
      const full: RevenueReport = data.data
      const suffix = `${full.period.from}_${full.period.to}`
      if (kind === 'payments') {
        download(`${t('csv.paymentsFile')}_${suffix}.csv`, toCsv([
          [t('csv.time'), t('csv.kind'), t('csv.booking'), t('csv.guest'), t('csv.method'), t('csv.amount'), t('csv.transaction')],
          ...(full.rows ?? []).map((r) => [
            timeLabel(r.at),
            r.kind === 'IN' ? t('csv.in') : t('csv.refund'),
            r.bookingCode,
            r.guestName,
            labels.paymentMethod(r.method),
            r.kind === 'IN' ? r.amount : -r.amount,
            r.transactionId,
          ]),
        ]))
      } else {
        download(`${t('csv.invoicesFile')}_${suffix}.csv`, toCsv([
          [t('csv.invoiceNumber'), t('csv.einvoiceNumber'), t('csv.publishedAt'), t('csv.booking'), t('csv.buyer'), t('csv.taxCode'), t('csv.amount'), t('csv.status'), t('csv.cqt')],
          ...full.invoices.map((i) => [
            i.invoiceNumber,
            i.einvoiceNumber,
            timeLabel(i.publishedAt),
            i.bookingCode,
            i.buyer,
            i.taxCode,
            i.totalAmount,
            ti(`status.${i.status}`),
            i.cqtStatus == null ? '' : cqtLabel(i.cqtStatus),
          ]),
        ]))
      }
    } catch {
      setError(t('loadError'))
    } finally {
      setExporting(false)
    }
  }

  const compactMoney = new Intl.NumberFormat(labels.locale === 'en' ? 'en' : 'vi', { notation: 'compact', maximumFractionDigits: 1 })
  const summary = report?.summary
  const maxBucket = Math.max(1, ...(report?.series.map((s) => s.received) ?? []))
  const totalByMethod = report?.byMethod.reduce((sum, m) => sum + m.received, 0) ?? 0
  const activeRows = report?.series.filter((s) => s.received || s.refunded || s.bookings).slice().reverse() ?? []

  if (!allowed) return <NoAccess title={t('title')} />

  return (
    <PageContainer>
      <Header
        title={t('title')}
        description={t('description')}
        actions={
          <Dropdown
            trigger={
              <Button variant="outline" isLoading={exporting} disabled={!report}>
                <Download className="w-4 h-4 mr-2" />
                {tc('actions.export')}
              </Button>
            }
          >
            <DropdownItem onClick={() => exportCsv('payments')}>{t('exportPayments')}</DropdownItem>
            <DropdownItem onClick={() => exportCsv('invoices')}>{t('exportInvoices')}</DropdownItem>
          </Dropdown>
        }
      />

      {/* Filters: one row above the figures (each field fills its own box) */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-[170px]">
          <Select
            aria-label={t('period')}
            options={PERIODS.map((p) => ({ value: p, label: t(`periods.${p}`) }))}
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          />
        </div>
        {period === 'custom' && (
          <>
            <div className="w-[calc(50%-6px)] sm:w-[160px]">
              <Input
                type="date"
                aria-label={t('from')}
                value={custom.from}
                max={custom.to}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
              />
            </div>
            <div className="w-[calc(50%-6px)] sm:w-[160px]">
              <Input
                type="date"
                aria-label={t('to')}
                value={custom.to}
                min={custom.from}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </div>
          </>
        )}
        <div className="w-full sm:w-[200px]">
          <Select
            aria-label={t('methodFilter')}
            options={[{ value: '', label: t('allMethods') }, ...METHOD_GROUPS.map((m) => ({ value: m, label: methodLabel(m) }))]}
            value={method}
            onChange={(e) => setMethod(e.target.value as MethodGroup | '')}
          />
        </div>
        <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <TabsList>
            <TabsTrigger value="day">{t('byDay')}</TabsTrigger>
            <TabsTrigger value="month">{t('byMonth')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {error && <p role="alert" className="mb-4 text-small text-err">{error}</p>}

      {isLoading && !report ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc"></div>
        </div>
      ) : report && summary ? (
        <div className={isLoading ? 'space-y-6 opacity-60 transition-opacity' : 'space-y-6'}>
          <p className="text-small text-muted">
            {t('periodLine', { from: bucketLabel(report.period.from), to: bucketLabel(report.period.to) })}
            {report.period.method && ` · ${methodLabel(report.period.method as MethodGroup)}`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={ArrowDownLeft} label={t('received')} value={labels.money(summary.received)} note={t('paymentsCount', { count: summary.receivedCount })} />
            <StatCard icon={ArrowUpRight} label={t('refunded')} value={labels.money(summary.refunded)} note={t('refundsCount', { count: summary.refundedCount })} />
            <StatCard icon={Wallet} label={t('net')} value={labels.money(summary.net)} note={t('netNote')} />
            <StatCard icon={CalendarCheck} label={t('newBookings')} value={String(summary.bookings)} note={t('bookingValue', { amount: labels.money(summary.bookingValue) })} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{groupBy === 'day' ? t('chartDay') : t('chartMonth')}</CardTitle>
            </CardHeader>
            <CardContent>
              <BucketChart
                series={report.series}
                max={maxBucket}
                axisLabel={(n) => compactMoney.format(n)}
                label={bucketLabel}
                tooltip={(s) => [
                  bucketLabel(s.key),
                  `${t('received')}: ${labels.money(s.received)}`,
                  `${t('refunded')}: ${labels.money(s.refunded)}`,
                  `${t('net')}: ${labels.money(s.net)}`,
                ]}
                emptyLabel={t('noMovement')}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('byMethod')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {report.byMethod.map((m) => {
                    const share = totalByMethod ? Math.round((m.received / totalByMethod) * 100) : 0
                    const dim = method && method !== m.method
                    return (
                      <li key={m.method}>
                        <button
                          type="button"
                          onClick={() => setMethod(method === m.method ? '' : m.method)}
                          aria-pressed={method === m.method}
                          className="w-full text-left rounded-ctl -m-1 p-1 hover:bg-fg/[0.03]"
                        >
                          <span className="flex justify-between gap-3 text-small mb-1.5">
                            <span className={dim ? 'text-muted' : 'text-fg'}>{methodLabel(m.method)}</span>
                            <span className="font-medium text-fg tabular-nums">
                              {labels.money(m.received)} <span className="text-muted font-normal">· {share}%</span>
                            </span>
                          </span>
                          <span className="block h-2 bg-fg/5 rounded-full overflow-hidden">
                            <span
                              className={dim ? 'block h-full rounded-full bg-fg/25' : 'block h-full rounded-full bg-acc'}
                              style={{ width: `${share}%` }}
                            />
                          </span>
                          <span className="mt-1 block text-xs text-muted">
                            {t('paymentsCount', { count: m.count })}
                            {m.refunded > 0 && ` · ${t('refundedShort', { amount: labels.money(m.refunded) })}`}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-4 text-xs text-muted">{t('byMethodHint')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{groupBy === 'day' ? t('tableDay') : t('tableMonth')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {activeRows.length === 0 ? (
                  <p className="px-6 pb-6 text-small text-muted">{t('noMovement')}</p>
                ) : (
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{groupBy === 'day' ? t('columns.day') : t('columns.month')}</TableHead>
                          <TableHead className="text-right">{t('columns.received')}</TableHead>
                          <TableHead className="text-right">{t('columns.refunded')}</TableHead>
                          <TableHead className="text-right">{t('columns.net')}</TableHead>
                          <TableHead className="text-right">{t('columns.bookings')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeRows.map((s) => (
                          <TableRow key={s.key}>
                            <TableCell className="whitespace-nowrap">{bucketLabel(s.key)}</TableCell>
                            <TableCell className="text-right tabular-nums whitespace-nowrap">
                              {labels.money(s.received)}
                              <span className="block text-xs text-muted">{t('paymentsCount', { count: s.payments })}</span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums whitespace-nowrap">{s.refunded ? labels.money(s.refunded) : '—'}</TableCell>
                            <TableCell className="text-right tabular-nums whitespace-nowrap font-medium">{labels.money(s.net)}</TableCell>
                            <TableCell className="text-right tabular-nums">{s.bookings}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t('invoices')}
              </CardTitle>
              <Link href={routes.propertyInvoices(params.slug, propertyId)} className="text-small text-acc hover:underline">
                {t('allInvoices')}
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <p className="px-6 pb-4 text-small text-muted">
                {t('invoicesLine', { count: summary.invoiceCount, amount: labels.money(summary.invoiced) })}
              </p>
              {report.invoices.length === 0 ? (
                <p className="px-6 pb-6 text-small text-muted">{t('noInvoices')}</p>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('columns.invoice')}</TableHead>
                        <TableHead>{t('columns.publishedAt')}</TableHead>
                        <TableHead>{t('columns.buyer')}</TableHead>
                        <TableHead className="text-right">{t('columns.amount')}</TableHead>
                        <TableHead>{t('columns.cqt')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.invoices.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="whitespace-nowrap">
                            <span className="font-mono text-small">{i.einvoiceNumber || i.invoiceNumber}</span>
                            <span className="block text-xs text-muted">{i.bookingCode}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-small">{timeLabel(i.publishedAt)}</TableCell>
                          <TableCell className="min-w-[180px]">
                            {i.buyer}
                            {i.taxCode && <span className="block text-xs text-muted font-mono">{i.taxCode}</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {labels.money(i.totalAmount)}
                            {i.status === 'REPLACED' && <span className="block text-xs text-muted">{ti('status.REPLACED')}</span>}
                          </TableCell>
                          <TableCell className="text-small text-muted min-w-[160px]">
                            {i.cqtStatus == null ? '—' : cqtLabel(i.cqtStatus)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {report.invoicesTruncated && <p className="px-6 py-3 text-xs text-muted">{t('invoicesTruncated')}</p>}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted">{t('empty')}</p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}

function StatCard({ icon: Icon, label, value, note }: { icon: React.ElementType; label: string; value: string; note: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-small font-medium text-muted">{label}</p>
            <p className="text-2xl font-bold text-fg mt-1 tabular-nums truncate">{value}</p>
            <p className="text-small text-muted mt-1">{note}</p>
          </div>
          <Icon className="w-5 h-5 text-muted shrink-0" aria-hidden />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Money received per day or month: one series, bars from the baseline with
 * a 2 px gap, a hover / focus tooltip per bar, and every few labels so they
 * never collide. Wide ranges scroll sideways instead of thinning the bars.
 */
function BucketChart({
  series, max, axisLabel, label, tooltip, emptyLabel,
}: {
  series: RevenueReport['series']
  max: number
  axisLabel: (amount: number) => string
  label: (key: string, short?: boolean) => string
  tooltip: (s: RevenueReport['series'][number]) => string[]
  emptyLabel: string
}) {
  const [active, setActive] = React.useState<number | null>(null)
  if (!series.some((s) => s.received)) return <p className="py-16 text-center text-small text-muted">{emptyLabel}</p>
  const every = Math.max(1, Math.ceil(series.length / 12))
  const ticks = [1, 0.5, 0]
  return (
    <div className="flex gap-3">
      <div className="relative h-56 w-12 shrink-0 text-right text-xs text-muted tabular-nums">
        {ticks.map((f) => (
          <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>
            {axisLabel(Math.round(max * f))}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div style={{ minWidth: series.length * 8 }}>
          <div className="relative h-56">
            {ticks.map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - f) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
              {series.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  aria-label={tooltip(s).join(', ')}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="relative flex h-full flex-1 items-end focus:outline-none"
                >
                  <span
                    className={active === i ? 'block w-full rounded-t-[4px] bg-fg' : 'block w-full rounded-t-[4px] bg-acc'}
                    style={{ height: s.received ? `${Math.max((s.received / max) * 100, 1.5)}%` : 0 }}
                  />
                </button>
              ))}
            </div>
            {active !== null && (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 rounded-ctl border border-line bg-raised px-3 py-2 text-xs text-fg shadow-sm whitespace-nowrap"
                style={{
                  left: `${((active + 0.5) / series.length) * 100}%`,
                  transform: `translateX(${active / series.length > 0.6 ? '-100%' : active / series.length < 0.2 ? '0' : '-50%'})`,
                }}
              >
                {tooltip(series[active]).map((line, n) => (
                  <p key={n} className={n === 0 ? 'font-medium' : 'text-muted'}>{line}</p>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 flex gap-[2px] text-xs text-muted">
            {series.map((s, i) => (
              <span key={s.key} className="flex-1 overflow-visible whitespace-nowrap text-center">
                {i % every === 0 ? label(s.key, true) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
