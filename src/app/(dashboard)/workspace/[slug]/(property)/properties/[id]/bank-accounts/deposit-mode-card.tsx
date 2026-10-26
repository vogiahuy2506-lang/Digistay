'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Badge, Card, CardContent, Select } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'
import { findBank } from '@/lib/vietqr'

type Mode = 'MANUAL' | 'PAYOS'

export interface DepositSettings {
  mode: Mode | null
  effectiveMode: Mode | null
  payosConnected: boolean
  accountId: string | null
  percent: number
  deadlineMinutes: number
}

export interface ReceivingAccount {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountHolder: string
  qrEnabled: boolean
  isActive: boolean
}

/** "Vietcombank · 0123456789 · NGUYEN VAN A" */
const accountLabel = (a: ReceivingAccount) => `${findBank(a.bankCode)?.shortName ?? a.bankName} · ${a.accountNumber} · ${a.accountHolder}`

/**
 * How guests pay the online deposit (src/lib/payments/deposit-mode.ts):
 * two cards, Thủ công (VietQR to the hotel's account or MoMo, staff
 * confirm) and Tự động (PayOS, confirmed by webhook), each saying what
 * happens and what the hotel does; for manual, which account the QR names.
 * Saved as soon as one is picked (PUT /api/properties/[id]/deposit-mode).
 * `version` changes when the accounts or PayOS change, to read it again.
 */
export function DepositModeCard({
  propertyId,
  accounts,
  version,
  onLoaded,
}: {
  propertyId: string
  accounts: ReceivingAccount[]
  version: number
  /** each time the settings are read or saved */
  onLoaded?: (settings: DepositSettings) => void
}) {
  const t = useTranslations('dash.money.depositMode')
  const [settings, setSettingsState] = React.useState<DepositSettings | null>(null)
  const loadedRef = React.useRef(onLoaded)
  loadedRef.current = onLoaded
  const setSettings = React.useCallback((next: DepositSettings) => {
    setSettingsState(next)
    loadedRef.current?.(next)
  }, [])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    let live = true
    fetch(`/api/properties/${propertyId}/deposit-mode`)
      .then((res) => res.json())
      .then((data) => live && data.success && setSettings(data.data))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [propertyId, version, setSettings])

  const save = async (change: { mode?: Mode; accountId?: string }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/deposit-mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        toast.error(t('saveFailed'), apiError(data.error))
        return
      }
      setSettings(data.data)
      toast.success(t('saved'))
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return null
  const usable = accounts.filter((a) => a.isActive && a.qrEnabled)
  // What the cards show as picked: the hotel's choice, else what applies by default.
  const picked: Mode = settings.mode ?? (settings.payosConnected ? 'PAYOS' : 'MANUAL')
  const deadline =
    settings.deadlineMinutes >= 60 && settings.deadlineMinutes % 60 === 0 ? `${settings.deadlineMinutes / 60}h` : `${settings.deadlineMinutes}'`

  const option = (mode: Mode, title: string, what: string, todo: string, disabled: boolean) => {
    const selected = picked === mode
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled || saving}
        onClick={() => !selected && save({ mode })}
        className={cn(
          'flex min-w-0 flex-col items-start gap-2 rounded-box border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
          selected ? 'border-acc bg-acc-soft' : 'border-line bg-panel hover:border-muted',
          disabled && 'cursor-not-allowed opacity-70 hover:border-line'
        )}
      >
        <span className="flex w-full flex-wrap items-center gap-2">
          <span aria-hidden className={cn('flex h-4 w-4 flex-none items-center justify-center rounded-full border', selected ? 'border-acc' : 'border-muted')}>
            {selected && <span className="h-2 w-2 rounded-full bg-acc" />}
          </span>
          <span className="font-semibold text-fg">{title}</span>
          {settings.effectiveMode === mode && <Badge variant="success">{t('chosen')}</Badge>}
        </span>
        <span className="text-sm text-fg">{what}</span>
        <span className="text-sm text-muted">{todo}</span>
        {disabled && <span className="text-xs font-medium text-warn">{t('needsPayos')}</span>}
      </button>
    )
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-5 space-y-4">
        <div>
          <p className="font-semibold text-fg">{t('title')}</p>
          <p className="mt-1 text-sm text-muted">
            {settings.percent > 0 ? t('percent', { percent: settings.percent }) : t('percentOff')}
            {settings.percent > 0 && settings.deadlineMinutes > 0 && <> {t('deadline', { time: deadline })}</>}
          </p>
        </div>
        <div role="radiogroup" aria-label={t('title')} className="grid gap-3 sm:grid-cols-2">
          {option('MANUAL', t('manualTitle'), t('manualWhat'), t('manualDo'), false)}
          {option('PAYOS', t('payosTitle'), t('payosWhat'), t('payosDo'), !settings.payosConnected)}
        </div>
        {picked === 'PAYOS' && !settings.payosConnected && settings.effectiveMode === 'MANUAL' && (
          <p className="text-sm text-warn">{t('payosFallback')}</p>
        )}
        {(picked === 'MANUAL' || settings.effectiveMode === 'MANUAL') &&
          (usable.length > 0 ? (
            <div className="max-w-xl">
              <Select
                label={t('account')}
                value={settings.accountId ?? ''}
                disabled={saving}
                onChange={(e) => e.target.value && e.target.value !== settings.accountId && save({ accountId: e.target.value })}
                options={usable.map((a) => ({ value: a.id, label: accountLabel(a) }))}
              />
            </div>
          ) : (
            <p className="text-sm text-warn">{t('noAccount')}</p>
          ))}
      </CardContent>
    </Card>
  )
}
