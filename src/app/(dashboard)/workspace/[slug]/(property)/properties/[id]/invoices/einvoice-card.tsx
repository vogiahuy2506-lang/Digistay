'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Copy, FileCheck2 } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui'
import { VAT_CODES, VAT_LABELS, type VatCode } from '@/lib/einvoice/vat'
import { apiError } from '@/lib/i18n/api-errors'

export interface EinvoiceStatus {
  connected: boolean
  environment?: 'DEMO' | 'PRODUCTION'
  taxCode?: string
  username?: string
  templateCode?: string
  series?: string
  vatCode?: number
  remainingNumbers?: number | null
  verifiedAt?: string | null
  /** owners/ADMINs only: contains a secret */
  webhookUrl?: string
  /** issue by itself once a booking is fully paid (src/lib/einvoice/jobs.ts) */
  autoIssue?: boolean
  autoIssueSince?: string | null
  /** email issued invoices to the buyer (src/lib/einvoice/delivery.ts) */
  emailInvoices?: boolean
  /** the saved password cannot be decrypted (DATA_ENCRYPTION_KEYS changed): it must be typed again */
  credentialsUnreadable?: boolean
  credentialsError?: string
}

const yearPrefix = `C${String(new Date().getFullYear()).slice(-2)}`
const EMPTY = { environment: 'DEMO', taxCode: '', username: '', password: '', templateCode: '1', series: '', vatCode: '' }

/** A VAT code's label in the page's language: the rates as they are, KCT and KKKNT in words. */
export function useVatLabel() {
  const t = useTranslations('dash.money.einvoice.vat')
  return (code: VatCode) => (code === -1 ? t('exempt') : code === -2 ? t('undeclared') : VAT_LABELS[code])
}

/**
 * The property's Mắt Bão account (Part 6): invoices are issued under the
 * hotel's tax code. Owner/ADMIN only (the API enforces it). The password
 * is write-only.
 */
export function EinvoiceCard({
  propertyId,
  onStatus,
}: {
  propertyId: string
  onStatus: (status: EinvoiceStatus) => void
}) {
  const t = useTranslations('dash.money.einvoice')
  const tc = useTranslations('dash.common')
  const vatLabel = useVatLabel()
  const [status, setStatus] = React.useState<EinvoiceStatus | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/einvoice`).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (data?.success) {
      setStatus(data.data)
      onStatus(data.data)
    }
  }, [propertyId, onStatus])

  React.useEffect(() => {
    load()
  }, [load])

  const startEditing = () => {
    setForm(
      status?.connected
        ? {
            environment: status.environment ?? 'DEMO',
            taxCode: status.taxCode ?? '',
            username: status.username ?? '',
            password: '',
            templateCode: status.templateCode ?? '1',
            series: status.series ?? '',
            vatCode: String(status.vatCode ?? ''),
          }
        : EMPTY
    )
    setError('')
    setEditing(true)
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/properties/${propertyId}/einvoice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, vatCode: form.vatCode === '' ? undefined : Number(form.vatCode) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        setError(apiError(data.error) || t('errors.connect'))
        return
      }
      setStatus(data.data)
      onStatus(data.data)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const setOption = async (option: 'autoIssue' | 'emailInvoices', value: boolean) => {
    if (
      option === 'autoIssue' &&
      value &&
      !confirm(
        t('confirm.autoIssue', {
          note: status?.environment === 'PRODUCTION' ? ` ${t('confirm.autoIssueProduction')}` : '',
        })
      )
    ) {
      return
    }
    setError('')
    const res = await fetch(`/api/properties/${propertyId}/einvoice`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [option]: value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!data.success) {
      setError(apiError(data.error) || t('errors.save'))
      return
    }
    setStatus(data.data)
    onStatus(data.data)
  }

  const disconnect = async () => {
    if (!confirm(t('confirm.disconnect'))) return
    await fetch(`/api/properties/${propertyId}/einvoice`, { method: 'DELETE' })
    await load()
  }

  if (!status) return null
  const lowNumbers = status.remainingNumbers != null && status.remainingNumbers <= 50

  return (
    <Card className="mb-6">
      <CardContent className="p-5 space-y-4">
        {status.credentialsUnreadable && !editing && (
          <div role="alert" className="flex flex-col gap-3 rounded-ctl border border-warn/40 bg-warn-soft p-3 text-sm text-warn sm:flex-row sm:items-center sm:justify-between">
            <span>{apiError(status.credentialsError) || status.credentialsError}</span>
            <Button size="sm" variant="secondary" onClick={startEditing} className="shrink-0">
              {t('reenterPassword')}
            </Button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="w-5 h-5 text-info mt-0.5" />
            <div>
              <p className="font-semibold text-fg flex items-center gap-2">
                {t('title')}
                {status.connected ? (
                  <Badge variant={status.environment === 'PRODUCTION' ? 'success' : 'warning'}>
                    {status.environment === 'PRODUCTION' ? t('production') : t('demo')}
                  </Badge>
                ) : (
                  <Badge variant="gray">{t('notConnected')}</Badge>
                )}
              </p>
              {status.connected ? (
                <p className="text-sm text-fg mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-ok" />
                  {t('connectedLine', {
                    taxCode: status.taxCode ?? '',
                    template: status.templateCode ?? '',
                    series: status.series ?? '',
                    vat: VAT_CODES.includes(status.vatCode as VatCode) ? vatLabel(status.vatCode as VatCode) : '',
                  })}{' '}
                  <span className={lowNumbers ? 'text-err font-semibold' : ''}>
                    {status.remainingNumbers != null
                      ? t('remaining', { count: status.remainingNumbers })
                      : t('remainingUnknown')}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted mt-1">
                  {t('intro')}
                </p>
              )}
            </div>
          </div>
          {!editing && (
            <div className="flex gap-2 shrink-0">
              <Button variant={status.connected ? 'outline' : 'primary'} size="sm" onClick={startEditing}>
                {status.connected ? tc('actions.edit') : t('connect')}
              </Button>
              {status.connected && (
                <Button variant="ghost" size="sm" onClick={disconnect}>
                  {t('disconnect')}
                </Button>
              )}
            </div>
          )}
        </div>

        {status.connected && !editing && (
          <div className="border-t pt-3 space-y-3 text-sm">
            {/* The autoIssue flag as the choice it is for the hotel: who issues, and when. */}
            <fieldset>
              <legend className="font-medium text-fg">{t('issueMode')}</legend>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {([false, true] as const).map((auto) => {
                  const checked = Boolean(status.autoIssue) === auto
                  return (
                    <label
                      key={String(auto)}
                      className={`flex items-start gap-2.5 rounded-ctl border p-3 cursor-pointer ${
                        checked ? 'border-ink bg-fg/[0.03]' : 'border-line hover:border-fg/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`einvoice-issue-mode-${propertyId}`}
                        className="mt-0.5 w-4 h-4 shrink-0"
                        checked={checked}
                        onChange={() => setOption('autoIssue', auto)}
                      />
                      <span className="min-w-0">
                        <span className="font-medium text-fg">{auto ? t('modeAuto') : t('modeManual')}</span>
                        <span className="block text-xs text-muted mt-0.5">{auto ? t('modeAutoHint') : t('modeManualHint')}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={status.emailInvoices !== false}
                onChange={(e) => setOption('emailInvoices', e.target.checked)}
              />
              <span>
                <span className="font-medium text-fg">{t('emailInvoices')}</span>
              </span>
            </label>
            {error && <p className="text-sm text-err">{error}</p>}
          </div>
        )}

        {status.connected && status.webhookUrl && !editing && (
          <div className="text-xs text-muted border-t pt-3">
            <p>
              {t('webhookHint')}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="truncate bg-fg/5 px-1.5 py-0.5 rounded">{status.webhookUrl}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(status.webhookUrl!)}
                className="text-muted hover:text-fg"
                aria-label={t('copyAddress')}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {editing && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm text-muted">
              {t('formHint', { example: `${yearPrefix}TAA` })}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label={t('environment')}
                value={form.environment}
                onChange={(e) => setForm({ ...form, environment: e.target.value })}
                options={[
                  { value: 'DEMO', label: t('envDemo') },
                  { value: 'PRODUCTION', label: t('envProduction') },
                ]}
              />
              <Input label={t('taxCode')} value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
              <Input
                label={t('username')}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="off"
              />
              <Input
                label={t('password')}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={status.connected ? t('passwordKeep') : ''}
                autoComplete="new-password"
              />
              <Input label={t('template')} value={form.templateCode} onChange={(e) => setForm({ ...form, templateCode: e.target.value })} />
              <Input
                label={t('series')}
                value={form.series}
                onChange={(e) => setForm({ ...form, series: e.target.value.toUpperCase() })}
                placeholder={`${yearPrefix}TAA`}
              />
              <Select
                label={t('vatRate')}
                value={form.vatCode}
                onChange={(e) => setForm({ ...form, vatCode: e.target.value })}
                options={[
                  { value: '', label: t('chooseVat') },
                  ...VAT_CODES.map((code) => ({ value: String(code), label: vatLabel(code) })),
                ]}
              />
            </div>
            {error && <p className="text-sm text-err">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={save} isLoading={busy}>
                {t('save')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
