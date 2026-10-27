'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNoticeText, type NoticeItem } from './notification-text'
import { useDialogBehavior } from '@/components/ui/dialog-behavior'

type Item = NoticeItem

const POLL_MS = 30_000

/**
 * One poll for every bell on the page (the phone top bar's is mounted, only
 * hidden, next to the sidebar's): a small shared store.
 */
interface BellState {
  items: Item[]
  unread: number
}

const store: {
  state: BellState
  listeners: Set<() => void>
  timer: ReturnType<typeof setInterval> | null
  load: () => Promise<void>
  set: (next: BellState) => void
} = {
  state: { items: [], unread: 0 },
  listeners: new Set(),
  timer: null,
  async load() {
    const res = await fetch('/api/notifications', { cache: 'no-store' }).catch(() => null)
    const data = res?.ok ? await res.json().catch(() => null) : null
    if (data?.success) {
      store.state = { items: data.data.items, unread: data.data.unread }
      store.listeners.forEach((listener) => listener())
    }
  },
  set(next: BellState) {
    store.state = next
    store.listeners.forEach((listener) => listener())
  },
}
const onVisible = () => document.visibilityState === 'visible' && store.load()

/** Asks for the bell's notices again now: the notifications page marked some read. */
export const refreshBell = () => store.load()

function subscribe(listener: () => void) {
  store.listeners.add(listener)
  if (store.listeners.size === 1) {
    store.load()
    store.timer = setInterval(() => document.visibilityState === 'visible' && store.load(), POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
  }
  return () => {
    store.listeners.delete(listener)
    if (store.listeners.size === 0) {
      if (store.timer) clearInterval(store.timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}

const EMPTY: BellState = { items: [], unread: 0 }

/**
 * The bell (src/lib/notifications.ts): the unread count, and the latest
 * notices in a panel. Asks every half minute and when the tab comes back
 * (once for all bells); opening one marks it read and goes to its booking
 * (an invitation: to /workspaces, where it is answered; a plan notice: to the
 * plan page). Every notice: the notifications page, linked at the bottom.
 */
export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const t = useTranslations('dash.common.notifications')
  const { text, ago } = useNoticeText()
  const { slug } = useParams<{ slug?: string }>()
  const router = useRouter()
  const { items, unread } = React.useSyncExternalStore(subscribe, () => store.state, () => EMPTY)
  const [open, setOpen] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const close = React.useCallback(() => setOpen(false), [])
  useDialogBehavior(panelRef, open, { onEscape: close, modal: false })

  React.useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.parentElement?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markRead = async (body: { ids: string[] } | { all: true }) => {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    store.load()
  }

  const openItem = (item: Item) => {
    setOpen(false)
    if (!item.readAt) {
      store.set({
        items: items.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)),
        unread: Math.max(0, unread - 1),
      })
      markRead({ ids: [item.id] })
    }
    if (item.link) router.push(item.link)
  }

  return (
    // data-bell-open lifts the sticky bar holding it above the page's own sticky header while open.
    <div className="relative" data-bell-open={open || undefined}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? t('openUnread', { count: unread }) : t('open')}
        className="relative w-9 h-9 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-err text-[10px] font-semibold leading-4 text-white text-center tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('title')}
          tabIndex={-1}
          className={cn(
            'absolute z-50 mt-2 w-[min(360px,calc(100vw-24px))] rounded-box border border-line bg-raised shadow-lg focus:outline-none',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-fg">{t('title')}</p>
            {unread > 0 && (
              <button type="button" onClick={() => markRead({ all: true })} className="text-xs text-acc hover:underline">
                {t('markAll')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{t('empty')}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {items.map((item) => {
                const { title, detail } = text(item)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex w-full gap-3 px-4 py-3 text-left hover:bg-fg/[0.04] focus:outline-none focus-visible:bg-fg/[0.06]"
                    >
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-acc')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', item.readAt ? 'text-fg/80' : 'font-medium text-fg')}>{title}</span>
                        {detail && <span className="mt-0.5 block text-xs text-muted">{detail}</span>}
                        <span className="mt-1 block text-[11px] text-muted">{ago(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {slug && (
            <div className="border-t border-line px-4 py-2.5 text-center">
              <Link href={`/workspace/${slug}/notifications`} onClick={close} className="text-xs font-medium text-acc hover:underline">
                {t('viewAll')}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
