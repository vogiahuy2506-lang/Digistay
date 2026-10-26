'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, toast } from '@/components/ui'
import { apiError } from '@/lib/i18n/api-errors'
import { routes } from '@/lib/utils/routes'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'

/** GET /api/workspaces/[id]/deletion */
interface WorkspaceDeletionInfo {
  name: string
  booked: number
  properties: number
  members: number
  planPaymentOpen: boolean
  plan: { planId: string; trial: boolean; state: string; daysLeft: number; periodEnd: string }
  restoreDays: number
}

const loadInfo = async (workspaceId: string) => {
  const res = await fetch(`/api/workspaces/${workspaceId}/deletion`, { cache: 'no-store' })
  const data = await res.json().catch(() => null)
  return { status: res.status, info: res.ok && data?.success ? (data.data as WorkspaceDeletionInfo) : null }
}

/** 26/10/2026 from an ISO date, in Vietnam time, by hand (Intl differs between Node and browsers). */
export function vnDay(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

const planName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)

/**
 * Deleting a workspace (src/lib/deletion): what goes, the paid plan's time
 * that is lost (no refund; the end date stays if restored), what stops it,
 * then the name typed by hand. Used by the workspace's settings and the
 * workspace list. `onDeleted` runs after the toast.
 */
export function DeleteWorkspaceDialog({
  workspaceId,
  workspaceName,
  open,
  onClose,
  onDeleted,
}: {
  workspaceId: string | null
  /** For the title while the details load. */
  workspaceName?: string
  open: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const t = useTranslations('dash.deletion')
  const [info, setInfo] = React.useState<WorkspaceDeletionInfo | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState('')

  React.useEffect(() => {
    if (!open || !workspaceId) return
    let cancelled = false
    setInfo(null)
    setLoading(true)
    setLoadError('')
    loadInfo(workspaceId)
      .then(({ status, info: found }) => {
        if (cancelled) return
        if (found) setInfo(found)
        else setLoadError(status === 403 ? t('workspace.ownerOnly') : t('loadFailed'))
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, workspaceId, t])

  const confirm = async (typedName: string) => {
    if (!workspaceId) return t('failed')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: typedName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'GUESTS_BOOKED' && info) setInfo({ ...info, booked: Number(data.count) || info.booked })
        if (data.code === 'PLAN_PAYMENT_OPEN' && info) setInfo({ ...info, planPaymentOpen: true })
        return apiError(data.error) || t('failed')
      }
      toast.success(t('workspace.deleted', { name: info?.name ?? workspaceName ?? '' }), t('workspace.deletedHint'))
      onDeleted()
      return null
    } catch {
      return t('failed')
    }
  }

  // A paid plan with time left loses it; a trial just runs out on its own.
  const paidTimeLeft = info && !info.plan.trial && info.plan.daysLeft > 0
  const blocked = info
    ? info.booked > 0
      ? t('workspace.booked', { count: info.booked })
      : info.planPaymentOpen
        ? t('workspace.planPaymentOpen')
        : null
    : null

  return (
    <ConfirmDeleteDialog
      open={open}
      onClose={onClose}
      title={t('workspace.title', { name: info?.name ?? workspaceName ?? '' })}
      name={info?.name ?? null}
      loading={loading}
      loadError={loadError}
      facts={
        info
          ? [
              t('workspace.hidden', { properties: info.properties, members: info.members }),
              t('workspace.restore', { days: info.restoreDays }),
              t('workspace.bookingsRule'),
              t('workspace.invoices'),
            ]
          : []
      }
      warning={
        paidTimeLeft
          ? t('workspace.planPaid', { plan: planName(info.plan.planId), days: info.plan.daysLeft, date: vnDay(info.plan.periodEnd) })
          : null
      }
      blocked={blocked}
      confirmLabel={t('workspace.delete')}
      onConfirm={confirm}
    />
  )
}

/**
 * "Vùng nguy hiểm" in the workspace's settings: the owner deletes the
 * workspace, then lands on /workspaces where it waits under "Đã xoá gần đây".
 * An admin who is not the owner is told only the owner can.
 */
export function DeleteWorkspaceZone({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const t = useTranslations('dash.deletion')
  const router = useRouter()
  const [owner, setOwner] = React.useState<boolean | null>(null)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    loadInfo(workspaceId)
      .then(({ status, info }) => {
        if (!cancelled) setOwner(info ? true : status === 403 ? false : null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  if (owner === null) return null

  return (
    <>
      <div data-testid="workspace-danger-zone">
        <Card className="border-err/30">
          <CardHeader>
            <CardTitle className="text-err">{t('zone')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-small text-muted max-w-xl">{owner ? t('workspace.zoneText') : t('workspace.ownerOnly')}</p>
            {owner && (
              <Button variant="danger-outline" onClick={() => setOpen(true)} className="shrink-0 self-start sm:self-auto">
                <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('workspace.delete')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      <DeleteWorkspaceDialog
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        open={open}
        onClose={() => setOpen(false)}
        onDeleted={() => {
          setOpen(false)
          router.push(routes.workspaces())
        }}
      />
    </>
  )
}
