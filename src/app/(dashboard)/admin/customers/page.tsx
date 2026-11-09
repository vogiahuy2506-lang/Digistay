'use client'

/**
 * The operators' customers (src/lib/admin/customers.ts): the workspaces with
 * their plan, where it stands and what they use; and the accounts, to lock,
 * unlock or reset two-factor sign-in (src/lib/admin/users.ts). The tab and
 * filters live in the address, so a link opens the same list.
 */
import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ExternalLink, Search } from 'lucide-react'
import { ExportDropdown, Input, Select } from '@/components/ui'
import { exportToCsv, exportToExcel } from '@/lib/export/export-data'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'
import { AdminPage, Empty, Pager, Pill, Section, Stat, useAdminData, useDebounced } from '@/components/admin/admin-ui'
import { PLAN_STATES, PlanState, UsageLine, stateTone, usePlanName, type PlanStateName, type PlanView, type Usage } from '@/components/admin/plan-bits'
import { AccountActions, AccountPills, type AdminAccount } from '@/components/admin/account-actions'

const STATES = PLAN_STATES
type State = PlanStateName
const has = (list: readonly string[], value: unknown) => typeof value === 'string' && list.includes(value)

interface CustomerRow {
  id: string
  name: string
  slug: string
  createdAt: string
  owner: { id: string; name: string | null; email: string; disabledAt: string | null }
  plan: PlanView | null
  usage: Usage
  limits: Usage
}
interface CustomersData {
  rows: CustomerRow[]
  total: number
  page: number
  size: number
  summary: {
    workspaces: number
    newWorkspaces: number
    byState: Record<State, number>
    users: number
    lockedUsers: number
  } | null
}
interface AccountsData {
  rows: AdminAccount[]
  total: number
  page: number
  size: number
}

export default function CustomersPage() {
  const t = useTranslations('dash.admin')
  const labels = useDashLabels()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab = params.get('tab') === 'accounts' ? 'accounts' : 'workspaces'
  const stateParam = params.get('state')
  const state = has(STATES, stateParam) ? (stateParam as State) : ''
  const locked = params.get('locked') === '1'
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

  const search = new URLSearchParams({ ...(q && { q }), page: String(page) })
  const customers = useAdminData<CustomersData>(tab === 'workspaces' ? `/api/admin/customers?${search}${state ? `&state=${state}` : ''}` : null)
  const accounts = useAdminData<AccountsData>(tab === 'accounts' ? `/api/admin/users?${search}${locked ? '&locked=1' : ''}` : null)
  // The figures come with page 1 only: keep the last ones while paging.
  const [summary, setSummary] = React.useState<CustomersData['summary']>(null)
  React.useEffect(() => {
    if (customers.data?.summary) setSummary(customers.data.summary)
  }, [customers.data])
  React.useEffect(() => {
    if (tab === 'accounts' && !summary) fetch('/api/admin/customers').then((r) => r.json()).then((d) => d?.success && setSummary(d.data.summary)).catch(() => {})
  }, [tab, summary])

  const planName = usePlanName()
  const tabClass = (active: boolean) =>
    cn('inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium', active ? 'border-acc text-fg' : 'border-transparent text-muted hover:text-fg')

  const fetchAllWorkspacesForExport = async (): Promise<CustomerRow[]> => {
    try {
      const searchParams = new URLSearchParams()
      searchParams.set('size', '5000')
      if (q) searchParams.set('q', q)
      if (state) searchParams.set('state', state)
      const res = await fetch(`/api/admin/customers?${searchParams.toString()}`)
      const data = await res.json()
      if (data?.success && Array.isArray(data.data?.rows)) {
        return data.data.rows
      }
    } catch (e) {
      console.error(e)
    }
    return customers.data?.rows ?? []
  }

  const fetchAllAccountsForExport = async (): Promise<AdminAccount[]> => {
    try {
      const searchParams = new URLSearchParams()
      searchParams.set('size', '5000')
      if (q) searchParams.set('q', q)
      if (locked) searchParams.set('locked', '1')
      const res = await fetch(`/api/admin/users?${searchParams.toString()}`)
      const data = await res.json()
      if (data?.success && Array.isArray(data.data?.rows)) {
        return data.data.rows
      }
    } catch (e) {
      console.error(e)
    }
    return accounts.data?.rows ?? []
  }

  const handleExportCsv = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const stateMap: Record<string, string> = {
      trial: 'Dùng thử',
      active: 'Đang hoạt động',
      grace: 'Gia hạn thêm',
      locked: 'Bị khóa',
    }

    if (tab === 'workspaces') {
      const rows = await fetchAllWorkspacesForExport()
      if (!rows.length) return
      const headers = ['Tên Workspace', 'Slug', 'Chủ sở hữu', 'Email chủ sở hữu', 'Gói dịch vụ', 'Trạng thái gói', 'Số ngày còn lại', 'Số cơ sở', 'Số phòng', 'Ngày tạo']
      const data = rows.map((r) => [
        r.name,
        r.slug,
        r.owner.name || '',
        r.owner.email,
        r.plan ? planName(r.plan) : 'Chưa có gói',
        r.plan?.state ? (stateMap[r.plan.state] || r.plan.state) : '—',
        r.plan?.daysLeft != null ? r.plan.daysLeft : '—',
        r.usage.properties,
        r.usage.rooms,
        new Date(r.createdAt).toLocaleDateString('vi-VN'),
      ])
      exportToCsv(`danh-sach-workspace-${today}.csv`, headers, data)
    } else {
      const rows = await fetchAllAccountsForExport()
      if (!rows.length) return
      const headers = ['Họ và tên', 'Username', 'Email', 'Số điện thoại', 'Vai trò', 'Trạng thái', 'Xác thực 2FA', 'Gói dịch vụ', 'Số Workspace sở hữu', 'Số Workspace tham gia', 'Ngày đăng ký']
      const data = rows.map((a) => [
        a.name || '—',
        a.username ? `@${a.username}` : '—',
        a.email,
        a.phone || '—',
        a.role === 'PLATFORM_ADMIN' ? 'Quản trị hệ thống' : 'Người dùng',
        a.disabledAt ? 'Bị khóa' : 'Hoạt động',
        a.twoFactor ? 'Đã bật' : 'Chưa bật',
        a.plan ? planName(a.plan) : '—',
        a.ownedWorkspaces,
        a.memberships,
        new Date(a.createdAt).toLocaleDateString('vi-VN'),
      ])
      exportToCsv(`danh-sach-tai-khoan-${today}.csv`, headers, data)
    }
  }

  const handleExportExcel = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const stateMap: Record<string, string> = {
      trial: 'Dùng thử',
      active: 'Đang hoạt động',
      grace: 'Gia hạn thêm',
      locked: 'Bị khóa',
    }

    if (tab === 'workspaces') {
      const rows = await fetchAllWorkspacesForExport()
      if (!rows.length) return
      const headers = ['Tên Workspace', 'Slug', 'Chủ sở hữu', 'Email chủ sở hữu', 'Gói dịch vụ', 'Trạng thái gói', 'Số ngày còn lại', 'Số cơ sở', 'Số phòng', 'Ngày tạo']
      const data = rows.map((r) => [
        r.name,
        r.slug,
        r.owner.name || '',
        r.owner.email,
        r.plan ? planName(r.plan) : 'Chưa có gói',
        r.plan?.state ? (stateMap[r.plan.state] || r.plan.state) : '—',
        r.plan?.daysLeft != null ? r.plan.daysLeft : '—',
        r.usage.properties,
        r.usage.rooms,
        new Date(r.createdAt).toLocaleDateString('vi-VN'),
      ])
      exportToExcel(`danh-sach-workspace-${today}.xls`, 'DANH SÁCH KHÁCH HÀNG DOANH NGHIỆP (WORKSPACES)', headers, data, [
        { label: 'Tổng số Workspace', value: rows.length },
        { label: 'Ngày xuất báo cáo', value: new Date().toLocaleDateString('vi-VN') },
      ])
    } else {
      const rows = await fetchAllAccountsForExport()
      if (!rows.length) return
      const headers = ['Họ và tên', 'Username', 'Email', 'Số điện thoại', 'Vai trò', 'Trạng thái', 'Xác thực 2FA', 'Gói dịch vụ', 'Số Workspace sở hữu', 'Số Workspace tham gia', 'Ngày đăng ký']
      const data = rows.map((a) => [
        a.name || '—',
        a.username ? `@${a.username}` : '—',
        a.email,
        a.phone || '—',
        a.role === 'PLATFORM_ADMIN' ? 'Quản trị hệ thống' : 'Người dùng',
        a.disabledAt ? 'Bị khóa' : 'Hoạt động',
        a.twoFactor ? 'Đã bật' : 'Chưa bật',
        a.plan ? planName(a.plan) : '—',
        a.ownedWorkspaces,
        a.memberships,
        new Date(a.createdAt).toLocaleDateString('vi-VN'),
      ])
      exportToExcel(`danh-sach-tai-khoan-${today}.xls`, 'DANH SÁCH TÀI KHOẢN NGƯỜI DÙNG', headers, data, [
        { label: 'Tổng số tài khoản', value: rows.length },
        { label: 'Ngày xuất báo cáo', value: new Date().toLocaleDateString('vi-VN') },
      ])
    }
  }

  const hasRows = tab === 'workspaces' ? (customers.data?.rows.length ?? 0) > 0 : (accounts.data?.rows.length ?? 0) > 0

  return (
    <AdminPage
      title={t('customers.title')}
      lead={t('customers.lead')}
      actions={
        hasRows ? (
          <ExportDropdown
            onExportExcel={handleExportExcel}
            onExportCsv={handleExportCsv}
          />
        ) : undefined
      }
    >
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={t('customers.stats.workspaces')} value={summary.workspaces} hint={t('customers.stats.newWorkspaces', { count: summary.newWorkspaces })} />
          {STATES.map((s) => (
            <button key={s} type="button" onClick={() => update({ tab: null, state: state === s ? null : s })} aria-pressed={state === s} className="h-full text-left">
              <Stat label={t(`customers.stats.${s}`)} value={summary.byState[s]} tone={s === 'grace' && summary.byState[s] > 0 ? 'warn' : undefined} />
            </button>
          ))}
          <button type="button" onClick={() => update({ tab: 'accounts', locked: '1', state: null })} className="h-full text-left">
            <Stat
              label={t('customers.stats.lockedUsers')}
              value={summary.lockedUsers}
              hint={t('customers.stats.users', { count: summary.users })}
              tone={summary.lockedUsers > 0 ? 'bad' : undefined}
            />
          </button>
        </div>
      )}

      <Section>
        <div className="-mt-1 mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line">
          <div role="tablist" className="flex">
            <button type="button" role="tab" aria-selected={tab === 'workspaces'} className={tabClass(tab === 'workspaces')} onClick={() => update({ tab: null, locked: null })}>
              {t('customers.tabs.workspaces')}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'accounts'} className={tabClass(tab === 'accounts')} onClick={() => update({ tab: 'accounts', state: null })}>
              {t('customers.tabs.accounts')}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-80">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'workspaces' ? t('customers.search') : t('accounts.search')}
              aria-label={t('common.search')}
              icon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
          {tab === 'workspaces' ? (
            <div className="sm:w-56">
              <Select
                aria-label={t('customers.stateFilter')}
                value={state}
                onChange={(e) => update({ state: e.target.value || null })}
                options={[{ value: '', label: `${t('customers.stateFilter')}: ${t('common.all')}` }, ...STATES.map((s) => ({ value: s, label: t(`states.${s}`) }))]}
              />
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={locked} onChange={(e) => update({ locked: e.target.checked ? '1' : null })} className="h-4 w-4 accent-acc" />
              {t('accounts.lockedOnly')}
            </label>
          )}
        </div>

        {tab === 'workspaces' ? (
          customers.state === 'error' ? (
            <Empty>{t('common.loadFailed')}</Empty>
          ) : !customers.data ? (
            <Empty>{t('common.working')}</Empty>
          ) : customers.data.rows.length === 0 ? (
            <Empty>{t('customers.empty')}</Empty>
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 pr-3 font-medium">{t('customers.columns.workspace')}</th>
                    <th className="py-2 pr-3 font-medium">{t('customers.columns.plan')}</th>
                    <th className="py-2 pr-3 font-medium">{t('customers.columns.state')}</th>
                    <th className="py-2 pr-3 font-medium">{t('customers.columns.usage')}</th>
                    <th className="py-2 font-medium">{t('customers.columns.created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.data.rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/70 align-top last:border-0 hover:bg-fg/[0.02]">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/admin/customers/${row.id}`} className="font-medium text-fg hover:underline">
                            {row.name}
                          </Link>
                          <Link
                            href={`/workspace/${row.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Mở workspace trực tiếp"
                            className="inline-flex text-muted hover:text-acc"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </div>
                        <p className="text-xs text-muted">{row.owner.email}</p>
                        {row.owner.disabledAt && <Pill tone="bad">{t('customers.ownerLocked')}</Pill>}
                      </td>
                      <td className="py-3 pr-3 text-fg">{row.plan ? planName(row.plan) : '—'}</td>
                      <td className="py-3 pr-3">
                        <PlanState plan={row.plan} />
                      </td>
                      <td className="py-3 pr-3">
                        <UsageLine usage={row.usage} limits={row.limits} />
                      </td>
                      <td className="py-3 text-muted tabular-nums">{labels.date(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-line md:hidden">
                {customers.data.rows.map((row) => (
                  <li key={row.id} className="py-3">
                    <Link href={`/admin/customers/${row.id}`} className="block space-y-1.5">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg">{row.name}</span>
                          <span className="block truncate text-xs text-muted">{row.owner.email}</span>
                        </span>
                        {row.plan && <Pill tone={stateTone[row.plan.state]}>{t(`states.${row.plan.state}`)}</Pill>}
                      </span>
                      <span className="block text-sm text-fg">
                        {row.plan ? `${planName(row.plan)} · ${t('customers.endsOn', { date: labels.date(row.plan.periodEnd) })}` : t('customers.noPlan')}
                      </span>
                      <UsageLine usage={row.usage} limits={row.limits} />
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager page={page} size={customers.data.size} total={customers.data.total} onPage={(p) => update({ page: String(p) })} />
            </>
          )
        ) : accounts.state === 'error' ? (
          <Empty>{t('common.loadFailed')}</Empty>
        ) : !accounts.data ? (
          <Empty>{t('common.working')}</Empty>
        ) : accounts.data.rows.length === 0 ? (
          <Empty>{t('accounts.empty')}</Empty>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {accounts.data.rows.map((account) => (
                <li key={account.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-fg">
                        {account.name || account.email}
                        {account.username && <span className="ml-2 text-xs font-normal text-muted">@{account.username}</span>}
                      </p>
                      {account.plan && (
                        <span className="inline-flex items-center gap-1.5">
                          <Pill tone={stateTone[account.plan.state]}>
                            {planName(account.plan)}
                          </Pill>
                          <span className="text-xs text-muted">
                            {account.plan.trial ? `(${t('plans.trial')})` : `(${t('plans.paid')})`} · {t('customers.endsOn', { date: labels.date(account.plan.periodEnd) })}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted">
                      {account.email}
                      {account.phone && ` · ${account.phone}`}
                    </p>
                    <AccountPills account={account} />
                    {account.disabledAt && account.disabledReason && (
                      <p className="text-xs text-err">{t('accounts.lockedSince', { date: labels.date(account.disabledAt), reason: account.disabledReason })}</p>
                    )}
                    <p className="text-xs text-muted">
                      {t('accounts.workspaces', { owned: account.ownedWorkspaces, member: account.memberships })} · {labels.date(account.createdAt)}
                    </p>
                  </div>
                  <AccountActions account={account} onDone={accounts.reload} />
                </li>
              ))}
            </ul>
            <Pager page={page} size={accounts.data.size} total={accounts.data.total} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </Section>
    </AdminPage>
  )
}
