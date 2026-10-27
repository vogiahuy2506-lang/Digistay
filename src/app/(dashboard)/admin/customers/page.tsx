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
import { Search } from 'lucide-react'
import { Input, Select } from '@/components/ui'
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

  return (
    <AdminPage title={t('customers.title')} lead={t('customers.lead')}>
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
                        <Link href={`/admin/customers/${row.id}`} className="font-medium text-fg hover:underline">
                          {row.name}
                        </Link>
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
                    <p className="truncate font-medium text-fg">
                      {account.name || account.email}
                      {account.username && <span className="ml-2 text-xs font-normal text-muted">@{account.username}</span>}
                    </p>
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
