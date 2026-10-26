'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, History as HistoryIcon, Loader2, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription, Badge, Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { useDashLabels } from '@/lib/i18n/dash'
import { routes } from '@/lib/utils/routes'

type VersionKind = 'AUTO' | 'RESTORE' | 'BEFORE_RESTORE' | 'INITIAL'

/** One saved version, as GET /api/website/versions lists it (newest first). */
interface SiteVersionItem {
  id: string
  kind: VersionKind
  savedAt: string
  by: string | null
  restoredFromId: string | null
}

const KIND_BADGE: Record<VersionKind, 'outline' | 'info' | 'warn' | 'plain'> = {
  AUTO: 'outline',
  RESTORE: 'info',
  BEFORE_RESTORE: 'warn',
  INITIAL: 'plain',
}

/**
 * "Lịch sử phiên bản" in the website builder: the site's saved versions
 * (src/lib/public-site/versions.ts), each one viewable in a new tab (the
 * hotel site's own renderer, [subdomain]/phien-ban) and restorable after a
 * confirmation. `onRestored` reloads the builder from the restored site.
 */
export function VersionHistory({
  propertyId,
  subdomain,
  isOpen,
  onClose,
  onRestored,
}: {
  propertyId: string
  subdomain: string | undefined
  isOpen: boolean
  onClose: () => void
  onRestored: () => void
}) {
  const t = useTranslations('dash.website.versions')
  const tc = useTranslations('dash.common')
  const { dayMonthTime } = useDashLabels()
  const [versions, setVersions] = React.useState<SiteVersionItem[] | null>(null)
  const [limit, setLimit] = React.useState(50)
  const [failed, setFailed] = React.useState(false)
  const [confirming, setConfirming] = React.useState<SiteVersionItem | null>(null)
  const [restoring, setRestoring] = React.useState(false)

  const load = React.useCallback(async () => {
    setFailed(false)
    setVersions(null)
    try {
      const res = await fetch(`/api/website/versions?propertyId=${encodeURIComponent(propertyId)}`)
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) throw new Error(body?.error)
      setVersions(body.data.versions)
      setLimit(body.data.limit)
    } catch {
      setFailed(true)
    }
  }, [propertyId])

  React.useEffect(() => {
    if (!isOpen) return
    setConfirming(null)
    void load()
  }, [isOpen, load])

  const restore = async (version: SiteVersionItem) => {
    setRestoring(true)
    try {
      const res = await fetch(`/api/website/versions/${encodeURIComponent(version.id)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) {
        toast.error(apiError(body?.error) || t('restoreFailed'))
        return
      }
      toast.success(t('restored', { time: dayMonthTime(version.savedAt) }))
      onRestored()
      onClose()
    } catch {
      toast.error(t('restoreFailed'))
    } finally {
      setRestoring(false)
    }
  }

  const close = () => {
    if (!restoring) onClose()
  }
  const timeOf = (id: string | null) => {
    const found = id && versions?.find((v) => v.id === id)
    return found ? dayMonthTime(found.savedAt) : null
  }

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg">
      <ModalHeader onClose={close}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-box bg-acc-soft text-acc">
          <HistoryIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-fg">{confirming ? t('confirmTitle', { time: dayMonthTime(confirming.savedAt) }) : t('title')}</h2>
          {!confirming && <p className="text-xs text-muted">{t('subtitle', { limit })}</p>}
        </div>
      </ModalHeader>

      {confirming ? (
        <>
          <ModalBody className="space-y-3">
            <p className="text-small text-fg">{t('confirmBody')}</p>
            <p className="text-small text-muted">{t('confirmUnsaved')}</p>
            <p className="text-small text-muted">{t('hint')}</p>
          </ModalBody>
          <ModalFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={restoring} className="w-full sm:w-auto">
              {tc('actions.cancel')}
            </Button>
            <Button onClick={() => void restore(confirming)} isLoading={restoring} className="w-full gap-2 sm:w-auto">
              {!restoring && <RotateCcw className="h-4 w-4" aria-hidden="true" />}
              {t('confirm')}
            </Button>
          </ModalFooter>
        </>
      ) : (
        <ModalBody className="space-y-4">
          <p className="rounded-box bg-fg/[0.03] p-3 text-small text-muted">{t('hint')}</p>

          {failed ? (
            <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
              <AlertDescription>{t('loadFailed')}</AlertDescription>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                {tc('actions.retry')}
              </Button>
            </Alert>
          ) : versions === null ? (
            <p className="flex items-center justify-center gap-2 py-8 text-small text-muted" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('loading')}
            </p>
          ) : versions.length === 0 ? (
            <p className="rounded-box border border-dashed border-line p-6 text-center text-small text-muted">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-box border border-line">
              {versions.map((version, index) => {
                const time = dayMonthTime(version.savedAt)
                const from = version.kind === 'RESTORE' ? timeOf(version.restoredFromId) : null
                // The newest version is the site as it is now: nothing to restore.
                const current = index === 0
                return (
                  <li key={version.id} className="flex flex-col gap-3 bg-panel p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium tabular-nums text-fg">{time}</span>
                        <Badge variant={KIND_BADGE[version.kind]}>
                          {t(`kind.${version.kind}`)}
                          {from && ` ${t('restoredFrom', { time: from })}`}
                        </Badge>
                        {current && <Badge variant="ok">{t('current')}</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{version.by ?? t('unknownAuthor')}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {subdomain && (
                        <a
                          href={routes.siteVersionPreview(subdomain, version.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t('viewLabel', { time })}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-ctl border border-line px-3 text-small font-medium text-fg transition-colors hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-acc sm:h-8 sm:flex-none"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          {t('view')}
                        </a>
                      )}
                      {!current && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirming(version)}
                          aria-label={t('restoreLabel', { time })}
                          className="flex-1 gap-1.5 sm:flex-none"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          {t('restore')}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ModalBody>
      )}
    </Modal>
  )
}
