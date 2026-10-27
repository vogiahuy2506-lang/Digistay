'use client'

/**
 * Every notice of the signed-in user (src/lib/notifications.ts), not only
 * the bell's latest: newest first, by day, all or the unread ones, more on
 * demand (GET /api/notifications with nextCursor). Opening one marks it read
 * and goes where it points, as in the bell; the bell links here.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui'
import { TitleBlock } from '@/components/layout'
import { refreshBell } from '@/components/layout/notification-bell'
import { useNoticeText, type NoticeItem } from '@/components/layout/notification-text'
import { useDashLabels } from '@/lib/i18n/dash'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'unread'

interface Page {
  items: NoticeItem[]
  unread: number
  nextCursor: string | null
}

/** The day of `iso` in Vietnam time, "2026-10-27": the groups of the list. */
const vnDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10)

export default function NotificationsPage() {
  const t = useTranslations('dash.common.notifications')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const router = useRouter()
  const { text, ago } = useNoticeText()
  const [filter, setFilter] = React.useState<Filter>('all')
  const [items, setItems] = React.useState<NoticeItem[]>([])
  const [unread, setUnread] = React.useState(0)
  const [next, setNext] = React.useState<string | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [more, setMore] = React.useState(false)

  const fetchPage = React.useCallback(async (cursor: string | null): Promise<Page | null> => {
    const query = new URLSearchParams({ limit: '30', ...(filter === 'unread' && { unread: '1' }), ...(cursor && { cursor }) })
    const res = await fetch(`/api/notifications?${query}`, { cache: 'no-store' }).catch(() => null)
    const data = res?.ok ? await res.json().catch(() => null) : null
    return data?.success ? data.data : null
  }, [filter])

  React.useEffect(() => {
    let live = true
    setState('loading')
    fetchPage(null).then((page) => {
      if (!live) return
      if (!page) return setState('error')
      setItems(page.items)
      setUnread(page.unread)
      setNext(page.nextCursor)
      setState('ready')
    })
    return () => {
      live = false
    }
  }, [fetchPage])

  const loadMore = async () => {
    if (!next) return
    setMore(true)
    const page = await fetchPage(next)
    setMore(false)
    if (!page) return
    setItems((list) => [...list, ...page.items])
    setUnread(page.unread)
    setNext(page.nextCursor)
  }

  const markRead = async (body: { ids: string[] } | { all: true }) => {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    refreshBell()
  }

  const markAll = async () => {
    const now = new Date().toISOString()
    setItems((list) => (filter === 'unread' ? [] : list.map((i) => (i.readAt ? i : { ...i, readAt: now }))))
    setUnread(0)
    setNext(filter === 'unread' ? null : next)
    await markRead({ all: true })
  }

  const open = (item: NoticeItem) => {
    if (!item.readAt) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)))
      setUnread((n) => Math.max(0, n - 1))
      markRead({ ids: [item.id] })
    }
    if (item.link) router.push(item.link)
  }

  // Consecutive notices of a day under its heading.
  const groups: { day: string; items: NoticeItem[] }[] = []
  for (const item of items) {
    const day = vnDay(item.createdAt)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  const today = vnDay(new Date().toISOString())
  const yesterday = vnDay(new Date(Date.now() - 86_400_000).toISOString())
  const dayLabel = (day: string) => (day === today ? t('today') : day === yesterday ? t('yesterday') : labels.longDate(`${day}T12:00:00+07:00`))

  return (
    <div>
      <TitleBlock
        title={t('title')}
        lead={t('pageLead')}
        actions={
          unread > 0 && (
            <Button variant="outline" onClick={markAll}>
              <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('markAll')}
            </Button>
          )
        }
      />

      <div className="mt-6 flex w-fit gap-1 rounded-lg bg-fg/5 p-1">
        {(['all', 'unread'] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn('flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition', filter === key ? 'bg-panel text-acc shadow-sm' : 'text-muted hover:text-fg')}
          >
            {key === 'all' ? t('filterAll') : t('filterUnread')}
            {key === 'unread' && unread > 0 && <span className="text-xs tabular-nums text-muted">{unread}</span>}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {state === 'loading' ? (
          <p className="rounded-box border border-line bg-panel px-6 py-12 text-center text-small text-muted">{tc('states.loading')}</p>
        ) : state === 'error' ? (
          <p role="alert" className="rounded-box border border-line bg-panel px-6 py-12 text-center text-small text-err">
            {t('loadFailed')}
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-box border border-line bg-panel px-6 py-12 text-center text-small text-muted">{filter === 'unread' ? t('emptyUnread') : t('empty')}</p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.day}>
                <h2 className="mb-2 text-label uppercase text-muted">{dayLabel(group.day)}</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-box border border-line bg-panel">
                  {group.items.map((item) => {
                    const { title, detail } = text(item)
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => open(item)}
                          className="flex w-full gap-3 px-4 py-3.5 text-left hover:bg-fg/[0.03] focus:outline-none focus-visible:bg-fg/[0.05] sm:px-5"
                        >
                          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-acc')} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-body', item.readAt ? 'text-fg/80' : 'font-medium text-fg')}>{title}</span>
                            {detail && <span className="mt-0.5 block text-small text-muted">{detail}</span>}
                          </span>
                          <span className="shrink-0 text-right text-xs text-muted" title={labels.dateTime(item.createdAt)}>
                            {ago(item.createdAt)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            {next && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={loadMore} isLoading={more}>
                  {t('loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
