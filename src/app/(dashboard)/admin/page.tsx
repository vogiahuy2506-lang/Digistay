'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Activity,
  ArrowRight,
  BedDouble,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  History,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { AdminPage, Empty, Pill, Section, Stat, useAdminData, type Tone } from '@/components/admin/admin-ui'

interface OverviewData {
  customers: {
    workspaces: number
    newWorkspaces: number
    byState: { trial: number; active: number; grace: number; locked: number }
    paidByPlan: Record<string, number>
    users: number
    lockedUsers: number
  }
  orders: {
    revenueMonth: number
    paidMonth: number
    revenue30d: number
    pending: number
    flagged: number
  }
  scale: {
    properties: number
    bookings: number
    rooms: number
  }
  recentOrders: Array<{
    id: string
    orderCode: string
    amount: number
    status: string
    plan: string
    billing: string
    createdAt: string
    workspace: { id: string; name: string; slug: string }
  }>
  recentActivity: Array<{
    id: string
    action: string
    entityType: string
    entityId: string | null
    createdAt: string
    user: { name: string | null; email: string } | null
    workspace: { name: string; slug: string } | null
  }>
  system: {
    problemsCount: number
    redisOk: boolean
  }
}

const statusTone: Record<string, Tone> = {
  PAID: 'ok',
  PENDING: 'info',
  CANCELLED: 'muted',
  EXPIRED: 'muted',
  FAILED: 'bad',
}

export default function AdminOverviewPage() {
  const t = useTranslations('dash.admin')
  const tc = useTranslations('dash.admin.common')
  const to = useTranslations('dash.admin.overview')
  const labels = useDashLabels()
  const { data, state, reload } = useAdminData<OverviewData>('/api/admin/overview')

  return (
    <AdminPage
      title={to('title')}
      lead={to('lead')}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={reload}
          disabled={state === 'loading'}
          className="gap-1.5"
        >
          <RefreshCw className={state === 'loading' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
          <span>{tc('refresh')}</span>
        </Button>
      }
    >
      {state === 'error' && (
        <div className="rounded-box border border-err/30 bg-err-soft p-4 text-center text-sm text-err">
          <p>{tc('loadFailed')}</p>
          <Button variant="secondary" size="sm" onClick={reload} className="mt-2">
            {tc('retry')}
          </Button>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Primary Key Performance Indicators */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={to('kpis.revenueMonth')}
              value={labels.money(data.orders.revenueMonth)}
              hint={to('kpis.paidOrders', { count: data.orders.paidMonth })}
              tone="ok"
            />
            <Stat
              label={to('kpis.activeWorkspaces')}
              value={data.customers.workspaces}
              hint={`+${data.customers.newWorkspaces} mới trong 30 ngày`}
            />
            <Stat
              label={to('kpis.totalUsers')}
              value={data.customers.users}
              hint={
                data.customers.lockedUsers > 0
                  ? to('kpis.lockedAccounts', { count: data.customers.lockedUsers })
                  : undefined
              }
              tone={data.customers.lockedUsers > 0 ? 'warn' : undefined}
            />
            <div className="flex h-full flex-col justify-between rounded-box border border-line bg-panel px-4 py-3">
              <p className="text-xs text-muted">{to('kpis.systemHealth')}</p>
              <div className="my-1 flex items-center gap-2">
                {data.system.problemsCount === 0 ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok"></span>
                    </span>
                    <span className="text-base font-semibold text-ok">{to('kpis.healthy')}</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-err opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-err"></span>
                    </span>
                    <span className="text-base font-semibold text-err">
                      {to('kpis.hasProblems', { count: data.system.problemsCount })}
                    </span>
                  </>
                )}
              </div>
              <Link
                href="/admin/system"
                className="inline-flex items-center gap-1 text-xs font-medium text-acc hover:underline"
              >
                <span>{to('shortcuts.checkInfra')}</span>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <Section title={to('shortcuts.title')}>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/admin/customers"
                className="group relative flex flex-col justify-between rounded-lg border border-line bg-panel p-5 transition-all hover:border-sky-500/40 hover:bg-fg/[0.02] shadow-2xs"
              >
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-fg group-hover:text-sky-500 transition-colors">
                    {to('shortcuts.customers')}
                  </h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    {to('shortcuts.customersDesc')}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-sky-500">
                  <span>{to('shortcuts.customersAction')}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>

              <Link
                href="/admin/plans"
                className="group relative flex flex-col justify-between rounded-lg border border-line bg-panel p-5 transition-all hover:border-primary/40 hover:bg-fg/[0.02] shadow-2xs"
              >
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-fg group-hover:text-primary transition-colors">
                    {to('shortcuts.plans')}
                  </h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    {to('shortcuts.plansDesc')}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <span>{to('shortcuts.plansAction')}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>

              <Link
                href="/admin/orders"
                className="group relative flex flex-col justify-between rounded-lg border border-line bg-panel p-5 transition-all hover:border-emerald-500/40 hover:bg-fg/[0.02] shadow-2xs"
              >
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Receipt className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-fg group-hover:text-emerald-500 transition-colors">
                    {to('shortcuts.orders')}
                  </h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    {to('shortcuts.ordersDesc')}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                  <span>{to('shortcuts.ordersAction')}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>

              <Link
                href="/admin/platform-settings"
                className="group relative flex flex-col justify-between rounded-lg border border-line bg-panel p-5 transition-all hover:border-indigo-500/40 hover:bg-fg/[0.02] shadow-2xs"
              >
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                    <Settings className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-fg group-hover:text-indigo-500 transition-colors">
                    {to('shortcuts.settings')}
                  </h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    {to('shortcuts.settingsDesc')}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-indigo-500">
                  <span>{to('shortcuts.settingsAction')}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>

              <Link
                href="/admin/security"
                className="group relative flex flex-col justify-between rounded-lg border border-line bg-panel p-5 transition-all hover:border-rose-500/40 hover:bg-fg/[0.02] shadow-2xs"
              >
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                    <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-fg group-hover:text-rose-500 transition-colors">
                    {to('shortcuts.security')}
                  </h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    {to('shortcuts.securityDesc')}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-rose-500">
                  <span>{to('shortcuts.securityAction')}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>

              <Link
                href="/admin/system"
                className="group relative flex flex-col justify-between rounded-lg border border-line bg-panel p-5 transition-all hover:border-amber-500/40 hover:bg-fg/[0.02] shadow-2xs"
              >
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <Server className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-fg group-hover:text-amber-500 transition-colors">
                    {to('shortcuts.system')}
                  </h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    {to('shortcuts.systemDesc')}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-amber-500">
                  <span>{to('shortcuts.systemAction')}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>
            </div>
          </Section>

          {/* Platform Scale & Plan State Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Section title={to('scale.title')} className="lg:col-span-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2.5 text-sm text-fg">
                    <Building2 className="h-4 w-4 text-muted" aria-hidden="true" />
                    <span>{to('scale.properties')}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-fg">{data.scale.properties}</span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2.5 text-sm text-fg">
                    <CalendarCheck className="h-4 w-4 text-muted" aria-hidden="true" />
                    <span>{to('scale.bookings')}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-fg">{data.scale.bookings}</span>
                </div>
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2.5 text-sm text-fg">
                    <BedDouble className="h-4 w-4 text-muted" aria-hidden="true" />
                    <span>{to('scale.rooms')}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-fg">{data.scale.rooms}</span>
                </div>
              </div>
            </Section>

            <Section
              title={to('scale.plansBreakdown')}
              aside={
                <Link
                  href="/admin/customers"
                  className="text-xs font-medium text-acc hover:underline"
                >
                  Chi tiết khách hàng →
                </Link>
              }
              className="lg:col-span-2"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-ctl border border-line bg-panel p-3">
                  <p className="text-xs text-muted">{t('states.trial')}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-fg">
                    {data.customers.byState.trial}
                  </p>
                  <span className="text-[11px] text-muted">Dùng thử 14 ngày</span>
                </div>
                <div className="rounded-ctl border border-ok/30 bg-ok-soft/30 p-3">
                  <p className="text-xs text-ok">{t('states.active')}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-ok">
                    {data.customers.byState.active}
                  </p>
                  <span className="text-[11px] text-muted">Trả phí đều đặn</span>
                </div>
                <div className="rounded-ctl border border-warn/30 bg-warn-soft/30 p-3">
                  <p className="text-xs text-warn">{t('states.grace')}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-warn">
                    {data.customers.byState.grace}
                  </p>
                  <span className="text-[11px] text-muted">Gia hạn quá hạn</span>
                </div>
                <div className="rounded-ctl border border-err/30 bg-err-soft/30 p-3">
                  <p className="text-xs text-err">{t('states.locked')}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-err">
                    {data.customers.byState.locked}
                  </p>
                  <span className="text-[11px] text-muted">Khoá chỉ xem</span>
                </div>
              </div>
            </Section>
          </div>

          {/* Two Responsive Tables: Recent Orders & Recent Activities */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Orders */}
            <Section
              title={to('recentOrders.title')}
              aside={
                <Link
                  href="/admin/orders"
                  className="inline-flex items-center gap-1 text-xs font-medium text-acc hover:underline"
                >
                  <span>{to('recentOrders.viewAll')}</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              }
            >
              {data.recentOrders.length === 0 ? (
                <Empty>Chưa có đơn hàng nào.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th className="pb-2 font-medium">{to('recentOrders.orderCode')}</th>
                        <th className="pb-2 font-medium">{to('recentOrders.customer')}</th>
                        <th className="pb-2 font-medium">{to('recentOrders.amount')}</th>
                        <th className="pb-2 text-right font-medium">{to('recentOrders.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.recentOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-fg/[0.02]">
                          <td className="py-2.5 font-mono font-medium text-fg">{o.orderCode}</td>
                          <td className="py-2.5">
                            <Link
                              href={`/admin/orders?workspace=${o.workspace.id}`}
                              className="font-medium text-fg hover:text-acc hover:underline"
                            >
                              {o.workspace.name}
                            </Link>
                            <span className="block text-[11px] text-muted uppercase">
                              {o.plan} · {o.billing === 'YEAR' ? 'Năm' : 'Tháng'}
                            </span>
                          </td>
                          <td className="py-2.5 font-semibold tabular-nums text-fg">
                            {labels.money(o.amount)}
                          </td>
                          <td className="py-2.5 text-right">
                            <Pill tone={statusTone[o.status] ?? 'muted'}>{o.status}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Recent Activity */}
            <Section
              title={to('recentActivity.title')}
              aside={
                <Link
                  href="/admin/activity"
                  className="inline-flex items-center gap-1 text-xs font-medium text-acc hover:underline"
                >
                  <span>{to('recentActivity.viewAll')}</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              }
            >
              {data.recentActivity.length === 0 ? (
                <Empty>Chưa có hoạt động nào được ghi nhận.</Empty>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentActivity.map((act) => (
                    <li key={act.id} className="flex items-start justify-between gap-3 py-2.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-fg">
                            {act.user?.name || act.user?.email || 'Hệ thống'}
                          </span>
                          <span className="rounded bg-fg/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-muted">
                            {act.action}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted">
                          {act.workspace ? (
                            <Link
                              href={`/admin/activity?workspace=${act.workspace.slug}`}
                              className="hover:text-fg hover:underline"
                            >
                              {act.workspace.name}
                            </Link>
                          ) : (
                            act.entityType
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted">
                        {labels.dateTime(act.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}
    </AdminPage>
  )
}
