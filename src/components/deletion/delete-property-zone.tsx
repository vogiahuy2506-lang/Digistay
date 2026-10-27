'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, toast } from '@/components/ui'
import { useWorkspaceAccess } from '@/components/layout/workspace-context'
import { apiError } from '@/lib/i18n/api-errors'
import { routes } from '@/lib/utils/routes'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'

/** GET /api/properties/[id]/deletion */
interface PropertyDeletionInfo {
  name: string
  booked: number
  issuedInvoices: number
  restoreDays: number
}

/**
 * "Xoá cơ sở" on the property's page: deleting it (src/lib/deletion).
 * For the workspace's owner only: the card shows when the deletion details
 * answer, which they do for the owner alone. Then the workspace home, where
 * the property waits under "Đã xoá gần đây".
 */
export function DeletePropertyZone({ propertyId, slug }: { propertyId: string; slug: string }) {
  const t = useTranslations('dash.deletion')
  const router = useRouter()
  const isOwner = useWorkspaceAccess()?.isOwner ?? false
  const [info, setInfo] = React.useState<PropertyDeletionInfo | null>(null)
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState('')

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/deletion`, { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    return res.ok && data?.success ? (data.data as PropertyDeletionInfo) : null
  }, [propertyId])

  // The owner alone deletes a property.
  React.useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    load()
      .then((found) => {
        if (!cancelled) setInfo(found)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOwner, load])

  // Counted again on opening: bookings may have changed since the page loaded.
  const openDialog = async () => {
    setOpen(true)
    setLoading(true)
    setLoadError('')
    try {
      const fresh = await load()
      if (fresh) setInfo(fresh)
      else setLoadError(t('loadFailed'))
    } catch {
      setLoadError(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const confirm = async (typedName: string) => {
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: typedName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'GUESTS_BOOKED' && info) setInfo({ ...info, booked: Number(data.count) || info.booked })
        return apiError(data.error) || t('failed')
      }
      toast.success(t('property.deleted', { name: info?.name ?? '' }), t('property.deletedHint'))
      setOpen(false)
      router.push(routes.workspace(slug))
      return null
    } catch {
      return t('failed')
    }
  }

  if (!info) return null

  return (
    <>
      <div className="mt-6" data-testid="property-danger-zone">
        <Card className="border-err/30">
          <CardHeader>
            <CardTitle className="text-err">{t('zoneProperty')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-small text-muted max-w-xl">{t('property.zoneText')}</p>
            <Button variant="danger-outline" onClick={openDialog} className="shrink-0 self-start sm:self-auto">
              <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
              {t('property.delete')}
            </Button>
          </CardContent>
        </Card>
      </div>
      <ConfirmDeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('property.title', { name: info.name })}
        name={info.name}
        loading={loading}
        loadError={loadError}
        facts={[
          t('property.hidden'),
          t('property.restore', { days: info.restoreDays }),
          t('property.bookingsRule'),
          t('property.invoices', { count: info.issuedInvoices }),
        ]}
        blocked={info.booked > 0 ? t('property.booked', { count: info.booked }) : null}
        confirmLabel={t('property.delete')}
        onConfirm={confirm}
      />
    </>
  )
}
