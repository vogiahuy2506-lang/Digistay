'use client'

/**
 * Small pieces the operator pages (/admin) share: the page's frame, a
 * titled section, status pills, figures, paging, and loading their data
 * from /api/admin/*. Role colors only, so the pages follow the dark theme.
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted'

export function Pill({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  const tones: Record<Tone, string> = {
    ok: 'bg-ok-soft text-ok border-ok/30',
    warn: 'bg-warn-soft text-warn border-warn/30',
    bad: 'bg-err-soft text-err border-err/30',
    info: 'bg-info-soft text-info border-info/30',
    muted: 'bg-fg/[0.03] text-muted border-line',
  }
  return (
    <span title={title} className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}

export function AdminPage({ title, lead, actions, children }: { title: string; lead?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-fg">{title}</h1>
          {lead && <p className="mt-1 text-sm text-muted">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </main>
  )
}

export function Section({ title, aside, children, className }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-box border border-line bg-panel p-4 sm:p-5', className)}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

/** One figure in a row of them. */
export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="h-full rounded-box border border-line bg-panel px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', tone === 'bad' ? 'text-err' : tone === 'warn' ? 'text-warn' : 'text-fg')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

/** Previous / next under a list of `total` rows, `size` a page. */
export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (page: number) => void }) {
  const t = useTranslations('dash.admin.common')
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return null
  const button = 'rounded-ctl border border-line bg-panel px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/[0.03] disabled:opacity-40'
  return (
    <div className="flex items-center justify-end gap-2 pt-3 text-sm">
      <span className="mr-auto text-muted tabular-nums">{t('page', { page, pages })}</span>
      <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t('prev')}
      </button>
      <button type="button" className={button} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t('next')}
      </button>
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-10 text-center text-sm text-muted">{children}</p>
}

/**
 * GET `url` from /api/admin/* as { success, data }: the data, the state, and
 * reload. A url of null loads nothing (waiting for a choice).
 */
export function useAdminData<T>(url: string | null) {
  const [data, setData] = React.useState<T | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const latest = React.useRef(url)
  latest.current = url

  const load = React.useCallback(async () => {
    if (!url) return
    setState((s) => (s === 'ready' ? s : 'loading'))
    try {
      const res = await fetch(url, { cache: 'no-store' })
      const body = await res.json().catch(() => null)
      // A newer url was asked for meanwhile: this answer is stale.
      if (latest.current !== url) return
      if (!res.ok || !body?.success) return setState('error')
      setData(body.data as T)
      setState('ready')
    } catch {
      if (latest.current === url) setState('error')
    }
  }, [url])

  React.useEffect(() => {
    load()
  }, [load])

  return { data, state, reload: load }
}

/** POST/PATCH JSON to /api/admin/*: the answer's data, or throws with its error. */
export async function adminSend<T = unknown>(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data.data as T
}

/** The search box of a list: typed text, sent after a short pause. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}
