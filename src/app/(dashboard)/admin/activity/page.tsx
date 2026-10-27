'use client'

/**
 * The platform's activity log (Nhật ký): everything logged on Digistay,
 * newest first, with who did it, where and what (src/lib/admin/activity.ts),
 * so "who deleted this booking?" needs no SQL. The filters live in the URL:
 * the customers page links here with ?workspace=… or ?user=…, and a view
 * can be shared as is.
 */
import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown, Copy, X } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { AdminPage, Empty, Section, useDebounced } from '@/components/admin/admin-ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'
import { detailLines, useActivityLabels } from './labels'

interface Row {
  id: string
  createdAt: string
  action: string
  entityType: string
  entityId: string
  actor: { id: string; name: string | null; email: string | null } | null
  workspace: { id: string; name: string | null; slug: string | null; deleted: boolean } | null
  property: { id: string; name: string | null; deleted: boolean } | null
  changes: unknown
  metadata: unknown
  ipAddress: string | null
  userAgent: string | null
}
interface Facets {
  actions: string[]
  entityTypes: string[]
}
interface Scope {
  workspace: { id: string; name: string; deleted: boolean } | null
  user: { id: string; name: string | null; email: string } | null
}
interface Log {
  url: string
  rows: Row[]
  nextCursor: string | null
  facets?: Facets
  scope?: Scope
}

/** The URL's filters, in the API's names (GET /api/admin/activity). */
const FILTERS = ['q', 'action', 'entity', 'workspace', 'user', 'from', 'to'] as const
type Filter = (typeof FILTERS)[number]

async function getPage(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) throw new Error(body?.error ?? `HTTP ${res.status}`)
  return body.data as Omit<Log, 'url'>
}

/** The log for `url`: its first page, then each "Tải thêm" appended. */
function useLog(url: string) {
  const [log, setLog] = React.useState<Log | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [more, setMore] = React.useState<'idle' | 'loading' | 'error'>('idle')
  const latest = React.useRef(url)
  latest.current = url

  const load = React.useCallback(async () => {
    setState('loading')
    setMore('idle')
    try {
      const data = await getPage(url)
      // A newer filter was asked for meanwhile: this answer is stale.
      if (latest.current !== url) return
      setLog({ url, ...data })
      setState('ready')
    } catch {
      if (latest.current === url) setState('error')
    }
  }, [url])

  React.useEffect(() => {
    load()
  }, [load])

  const loadMore = async () => {
    if (!log?.nextCursor || log.url !== url) return
    setMore('loading')
    try {
      const data = await getPage(`${url}${url.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(log.nextCursor)}`)
      if (latest.current !== url) return
      setLog((prev) => (prev && prev.url === url ? { ...prev, rows: [...prev.rows, ...data.rows], nextCursor: data.nextCursor } : prev))
      setMore('idle')
    } catch {
      if (latest.current === url) setMore('error')
    }
  }

  return { log, state, more, reload: load, loadMore }
}

export default function ActivityPage() {
  const t = useTranslations('dash.adminActivity')
  const tc = useTranslations('dash.admin.common')
  const labels = useActivityLabels()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const value = (key: Filter) => params.get(key) ?? ''

  const setFilters = React.useCallback(
    (next: Partial<Record<Filter, string>>) => {
      const query = new URLSearchParams(params.toString())
      for (const [key, v] of Object.entries(next)) {
        if (v) query.set(key, v)
        else query.delete(key)
      }
      const qs = query.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router]
  )

  // The search box: typed text reaches the URL after a pause; a q set
  // elsewhere (a link, "history of this object") fills the box.
  const urlQ = value('q')
  const [text, setText] = React.useState(urlQ)
  const typed = useDebounced(text.trim(), 400)
  const lastQ = React.useRef(urlQ)
  React.useEffect(() => {
    if (typed === lastQ.current) return
    lastQ.current = typed
    setFilters({ q: typed })
  }, [typed, setFilters])
  React.useEffect(() => {
    if (urlQ === lastQ.current) return
    lastQ.current = urlQ
    setText(urlQ)
  }, [urlQ])
  const search = (q: string) => {
    lastQ.current = q
    setText(q)
    setFilters({ q })
  }

  const query = React.useMemo(() => {
    const q = new URLSearchParams()
    for (const key of FILTERS) {
      const v = params.get(key)
      if (v) q.set(key, v)
    }
    return q.toString()
  }, [params])
  const { log, state, more, reload, loadMore } = useLog(`/api/admin/activity${query ? `?${query}` : ''}`)

  // The choices: what the log holds, plus the one picked even if it holds none.
  const facets = log?.facets
  const choices = (codes: string[] | undefined, picked: string, label: (code: string) => string) =>
    [...new Set([...(codes ?? []), ...(picked ? [picked] : [])])]
      .map((code) => ({ value: code, label: label(code) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  const actionChoices = choices(facets?.actions, value('action'), labels.action)
  const entityChoices = choices(facets?.entityTypes, value('entity'), labels.entity)

  const [open, setOpen] = React.useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const filtered = FILTERS.some((key) => value(key))
  const scope = log?.scope
  const workspaceId = value('workspace')
  const userId = value('user')
  const rows = log?.rows ?? []

  return (
    <AdminPage
      title={t('title')}
      lead={t('lead')}
      actions={
        <Button variant="secondary" size="sm" onClick={reload}>
          {tc('refresh')}
        </Button>
      }
    >
      <Section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Input
              type="search"
              label={t('filters.search')}
              placeholder={t('filters.searchPlaceholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
            />
          </div>
          <Select label={t('filters.action')} value={value('action')} onChange={(e) => setFilters({ action: e.target.value })}>
            <option value="">{t('filters.allActions')}</option>
            {actionChoices.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select label={t('filters.entity')} value={value('entity')} onChange={(e) => setFilters({ entity: e.target.value })}>
            <option value="">{t('filters.allEntities')}</option>
            {entityChoices.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            label={t('filters.from')}
            value={value('from')}
            max={value('to') || undefined}
            onChange={(e) => setFilters({ from: e.target.value })}
          />
          <Input
            type="date"
            label={t('filters.to')}
            value={value('to')}
            min={value('from') || undefined}
            onChange={(e) => setFilters({ to: e.target.value })}
          />
        </div>
        {filtered && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {workspaceId && (
              <Chip label={t('filters.workspace', { name: scope?.workspace?.name ?? workspaceId })} remove={t('filters.remove')} onRemove={() => setFilters({ workspace: '' })} />
            )}
            {userId && (
              <Chip
                label={t('filters.user', { name: scope?.user ? scope.user.name || scope.user.email : userId })}
                remove={t('filters.remove')}
                onRemove={() => setFilters({ user: '' })}
              />
            )}
            <button
              type="button"
              className="ml-auto text-sm text-muted underline-offset-2 hover:text-fg hover:underline"
              onClick={() => {
                lastQ.current = ''
                setText('')
                setFilters(Object.fromEntries(FILTERS.map((key) => [key, ''])))
              }}
            >
              {t('filters.clear')}
            </button>
          </div>
        )}
      </Section>

      {state === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-err/30 bg-err-soft p-3 text-sm text-err" role="alert">
          <span>{tc('loadFailed')}</span>
          <Button variant="secondary" size="sm" onClick={reload}>
            {tc('retry')}
          </Button>
        </div>
      )}

      {!log ? (
        state === 'loading' && <Empty>{t('loading')}</Empty>
      ) : (
        <div className={cn('overflow-hidden rounded-box border border-line bg-panel transition-opacity', state === 'loading' && 'opacity-60')} aria-busy={state === 'loading'}>
          {rows.length === 0 ? (
            <Empty>{filtered ? t('empty') : t('emptyAll')}</Empty>
          ) : (
            <>
              {/* Desktop: a table, each row's details under it. */}
              <table className="hidden w-full text-sm md:table">
                <thead className="border-b border-line text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t('columns.time')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('columns.who')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('columns.where')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('columns.what')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('columns.entity')}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                          <Time iso={row.createdAt} />
                        </td>
                        <td className="max-w-[14rem] px-4 py-3">
                          <Who row={row} onUser={(id) => setFilters({ user: id })} />
                        </td>
                        <td className="max-w-[14rem] px-4 py-3">
                          <Where row={row} />
                        </td>
                        <td className="px-4 py-3 text-fg" title={`${row.action} · ${row.entityType}`}>
                          {labels.what(row.action, row.entityType)}
                        </td>
                        <td className="px-4 py-3">
                          <Entity row={row} onHistory={search} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DetailsToggle row={row} open={open.has(row.id)} onToggle={() => toggle(row.id)} />
                        </td>
                      </tr>
                      {open.has(row.id) && (
                        <tr>
                          <td colSpan={6} className="bg-fg/[0.02] px-4 pb-4 pt-1">
                            <Details row={row} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* Phones: one card a row. */}
              <ol className="divide-y divide-line md:hidden">
                {rows.map((row) => (
                  <li key={row.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-fg" title={`${row.action} · ${row.entityType}`}>
                        {labels.what(row.action, row.entityType)}
                      </p>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        <Time iso={row.createdAt} />
                      </span>
                    </div>
                    <Who row={row} onUser={(id) => setFilters({ user: id })} />
                    <Where row={row} />
                    <div className="flex items-start justify-between gap-3">
                      <Entity row={row} onHistory={search} />
                      <DetailsToggle row={row} open={open.has(row.id)} onToggle={() => toggle(row.id)} />
                    </div>
                    {open.has(row.id) && (
                      <div className="rounded-ctl bg-fg/[0.02] p-3">
                        <Details row={row} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line px-4 py-3 text-sm">
                {log.nextCursor ? (
                  <>
                    {more === 'error' && <span className="text-err">{tc('loadFailed')}</span>}
                    <Button variant="secondary" size="sm" isLoading={more === 'loading'} disabled={state === 'loading'} onClick={loadMore}>
                      {more === 'error' ? tc('retry') : t('loadMore')}
                    </Button>
                  </>
                ) : (
                  <span className="text-muted">{t('end')}</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </AdminPage>
  )
}

function Chip({ label, remove, onRemove }: { label: string; remove: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-acc/30 bg-acc-soft py-0.5 pl-3 pr-1 text-sm text-fg">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={remove}
        title={remove}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-fg/5 hover:text-fg"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  )
}

function Time({ iso }: { iso: string }) {
  const { dateTime } = useDashLabels()
  return <time dateTime={iso}>{dateTime(iso)}</time>
}

/** Who did it: a person (click: everything they did), a guest, or the system. */
function Who({ row, onUser }: { row: Row; onUser: (id: string) => void }) {
  const t = useTranslations('dash.adminActivity')
  const { actor } = row
  if (!actor) {
    const byGuest = (row.metadata as { by?: unknown } | null)?.by === 'guest'
    return <span className="text-muted">{byGuest ? t('who.guest') : t('who.system')}</span>
  }
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => onUser(actor.id)}
        title={t('who.filter')}
        className="max-w-full truncate text-left font-medium text-fg underline-offset-2 hover:underline"
      >
        {actor.name || actor.email || t('who.gone')}
      </button>
      {actor.name && actor.email && <p className="truncate text-xs text-muted">{actor.email}</p>}
      {!actor.email && <p className="truncate font-mono text-xs text-muted">{actor.id}</p>}
    </div>
  )
}

/** Workspace › hotel; the workspace opens its customer page. */
function Where({ row }: { row: Row }) {
  const t = useTranslations('dash.adminActivity')
  const tc = useTranslations('dash.admin.common')
  const { workspace, property } = row
  if (!workspace && !property) return <span className="text-muted">{tc('none')}</span>
  const deleted = <span className="text-xs text-muted"> ({t('where.deleted')})</span>
  return (
    <p className="min-w-0 break-words">
      {workspace && (
        <>
          {/* A purged workspace (no slug: the row is gone) has no customer page left. */}
          {workspace.slug !== null ? (
            <Link href={`/admin/customers/${workspace.id}`} title={t('where.openCustomer')} className="text-acc underline-offset-2 hover:underline">
              {workspace.name ?? workspace.id}
            </Link>
          ) : (
            <span className={cn('text-fg', !workspace.name && 'font-mono text-xs')}>{workspace.name ?? workspace.id}</span>
          )}
          {workspace.deleted && deleted}
        </>
      )}
      {workspace && property && <span className="text-muted"> › </span>}
      {property && (
        <>
          <span className={cn('text-fg', !property.name && 'font-mono text-xs')}>{property.name ?? property.id}</span>
          {property.deleted && deleted}
        </>
      )}
    </p>
  )
}

/** The object: its kind, and its id (click: its whole history; copy). */
function Entity({ row, onHistory }: { row: Row; onHistory: (q: string) => void }) {
  const t = useTranslations('dash.adminActivity')
  const labels = useActivityLabels()
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(row.entityId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // No clipboard (insecure context): the id can still be selected by hand.
    }
  }
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{labels.entity(row.entityType)}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onHistory(row.entityId)}
          title={t('entityId.history')}
          className="min-w-0 truncate text-left font-mono text-xs text-fg underline-offset-2 hover:underline"
        >
          {row.entityId}
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? t('entityId.copied') : t('entityId.copy')}
          title={copied ? t('entityId.copied') : t('entityId.copy')}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-ctl text-muted hover:bg-fg/5 hover:text-fg"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-ok" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}

const hasDetails = (row: Row) => row.changes != null || row.metadata != null || !!row.ipAddress || !!row.userAgent

function DetailsToggle({ row, open, onToggle }: { row: Row; open: boolean; onToggle: () => void }) {
  const t = useTranslations('dash.adminActivity')
  if (!hasDetails(row)) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-ctl px-2 py-1 text-xs font-medium text-muted hover:bg-fg/5 hover:text-fg"
    >
      {open ? t('details.hide') : t('details.show')}
      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
    </button>
  )
}

/** Changes and metadata as "key: value" lines (JSON when not an object), then where it came from. */
function Details({ row }: { row: Row }) {
  const t = useTranslations('dash.adminActivity')
  const { dateTime } = useDashLabels()
  const blocks = [
    { title: t('details.changes'), value: row.changes },
    { title: t('details.metadata'), value: row.metadata },
  ].filter((b) => b.value != null)
  if (!blocks.length && !row.ipAddress && !row.userAgent) return <p className="text-xs text-muted">{t('details.empty')}</p>
  return (
    <div className="grid gap-4 text-xs md:grid-cols-2">
      {blocks.map(({ title, value }) => {
        const lines = detailLines(value, dateTime)
        return (
          <div key={title} className="min-w-0">
            <p className="mb-1 font-semibold text-fg">{title}</p>
            {lines ? (
              lines.length ? (
                <dl className="space-y-0.5">
                  {lines.map((line) => (
                    <div key={line.key} className="flex gap-2">
                      <dt className="shrink-0 font-mono text-muted">{line.key}:</dt>
                      <dd className="min-w-0 break-words text-fg">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted">{t('details.empty')}</p>
              )
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-fg">{JSON.stringify(value, null, 2)}</pre>
            )}
          </div>
        )
      })}
      {(row.ipAddress || row.userAgent) && (
        <dl className="space-y-0.5 md:col-span-2">
          {row.ipAddress && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted">{t('details.ip')}:</dt>
              <dd className="font-mono text-fg">{row.ipAddress}</dd>
            </div>
          )}
          {row.userAgent && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted">{t('details.userAgent')}:</dt>
              <dd className="min-w-0 break-words text-fg">{row.userAgent}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
