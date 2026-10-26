'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { Button, toast } from '@/components/ui'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { vnDay } from './delete-workspace-dialog'

/** One row of GET /api/workspaces/[id]/deleted-properties or /api/workspaces/deleted (src/lib/deletion). */
interface DeletedItem {
  id: string
  name: string
  /** subdomain of a property, slug of a workspace */
  handle: string
  deletedAt: string
  purgeAt: string
  daysLeft: number
}

type Props =
  | { kind: 'property'; workspaceId: string; slug: string; reloadKey?: number }
  | { kind: 'workspace'; workspaceId?: undefined; slug?: undefined; reloadKey?: number }

/**
 * "Đã xoá gần đây": what the owner deleted in the last 30 days, with the
 * days left, and "Khôi phục". Properties on the workspace home, workspaces on
 * /workspaces. Nothing shows when there is nothing to restore (or the viewer
 * is not the owner: the list does not answer them). Restoring opens what was
 * restored.
 */
export function RecentlyDeleted(props: Props) {
  const t = useTranslations('dash.deletion')
  const router = useRouter()
  const [items, setItems] = React.useState<DeletedItem[]>([])
  const [busy, setBusy] = React.useState<string | null>(null)
  const area = props.kind === 'property' ? 'property' : 'workspace'
  const listUrl = props.kind === 'property' ? `/api/workspaces/${props.workspaceId}/deleted-properties` : '/api/workspaces/deleted'

  React.useEffect(() => {
    let cancelled = false
    fetch(listUrl, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) setItems(data.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [listUrl, props.reloadKey])

  const restore = async (item: DeletedItem) => {
    setBusy(item.id)
    try {
      const url = props.kind === 'property' ? `/api/properties/${item.id}/restore` : `/api/workspaces/${item.id}/restore`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(apiError(data.error) || t('restoreFailed'))
        return
      }
      toast.success(t(`${area}.restored`, { name: item.name }))
      setItems((all) => all.filter((i) => i.id !== item.id))
      router.push(props.kind === 'property' ? routes.property(props.slug, item.id) : routes.workspace(item.handle))
    } catch {
      toast.error(t('restoreFailed'))
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) return null

  return (
    <section className="mt-14" data-testid={`recently-deleted-${props.kind}`}>
      <div className="border-b border-line pb-3">
        <h2 className="text-body font-semibold text-fg">{t(`${area}.recentTitle`)}</h2>
        <p className="mt-1 text-small text-muted">{t(`${area}.recentLead`)}</p>
      </div>
      <ul className="border-b border-line">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 border-b border-line last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-fg truncate">{item.name}</p>
              <p className="mt-0.5 text-small text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="break-all">{item.handle}</span>
                <span aria-hidden="true" className="w-px h-3 bg-line" />
                <span className={cn('tabular-nums', item.daysLeft <= 3 ? 'text-err' : item.daysLeft <= 7 ? 'text-warn' : '')}>
                  {t('daysLeft', { days: item.daysLeft })}
                </span>
                <span className="tabular-nums">({t('purgeOn', { date: vnDay(item.purgeAt) })})</span>
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => restore(item)}
              isLoading={busy === item.id}
              disabled={busy !== null}
              className="shrink-0 self-start sm:self-auto"
            >
              {busy !== item.id && <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />}
              {t('restore')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
