'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Copy, CreditCard } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'

interface SepayStatus {
  connected: boolean
  merchantIdHint: string | null
  environment: 'sandbox' | 'production' | null
  connectedAt: string | null
  ipnUrl: string
}

const EMPTY = { merchantId: '', secretKey: '', environment: 'sandbox' as 'sandbox' | 'production' }

/**
 * The property's own SePay payment gateway account (task 34): guests pay
 * their deposit by Visa / Mastercard / JCB into the hotel's SePay merchant.
 * The secret key is write-only here: the API never sends it back.
 */
export function SepayCard({ propertyId }: { propertyId: string }) {
  const t = useTranslations('dash.money.sepay')
  const [status, setStatus] = React.useState<SepayStatus | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/sepay`)
    const data = await res.json().catch(() => ({}))
    if (data.success) setStatus(data.data)
  }, [propertyId])

  React.useEffect(() => {
    load()
  }, [load])

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/properties/${propertyId}/sepay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        setError(apiError(data.error) || t('connectFailed'))
        return
      }
      setStatus(data.data)
      setEditing(false)
      setForm(EMPTY)
      toast.success(t('connectedToast'))
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm(t('confirmDisconnect'))) return
    setBusy(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/sepay`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success(t('disconnectedToast'))
        await load()
      } else {
        toast.error(apiError(data.error) || t('disconnectFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null

  const ipn = (
    <p className="text-xs text-muted flex flex-wrap items-center gap-1.5">
      {t('ipnUrl')} <code className="bg-fg/5 px-1.5 py-0.5 rounded break-all">{status.ipnUrl}</code>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(status.ipnUrl).then(() => toast.success(t('copied')))}
        className="text-muted hover:text-fg"
        aria-label={t('copyAddress')}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </p>
  )

  return (
    <Card className="mb-6">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-info mt-0.5" />
            <div>
              <p className="font-semibold text-fg flex flex-wrap items-center gap-2">
                {t('title')}
                {status.connected ? <Badge variant="success">{t('connected')}</Badge> : <Badge variant="gray">{t('notConnected')}</Badge>}
                {status.environment === 'sandbox' && <Badge variant="warning">{t('sandbox')}</Badge>}
              </p>
              <p className="text-sm text-muted mt-1">{t('intro')}</p>
              {status.connected && (
                <p className="text-sm text-fg mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-ok" />
                  {t('merchant', { hint: status.merchantIdHint ?? '', environment: t(`environments.${status.environment ?? 'sandbox'}`) })}
                </p>
              )}
            </div>
          </div>
          {!editing && (
            <div className="flex gap-2 shrink-0">
              <Button variant={status.connected ? 'outline' : 'primary'} size="sm" onClick={() => setEditing(true)}>
                {status.connected ? t('changeKeys') : t('connect')}
              </Button>
              {status.connected && (
                <Button variant="ghost" size="sm" onClick={disconnect} isLoading={busy}>
                  {t('disconnect')}
                </Button>
              )}
            </div>
          )}
        </div>

        {status.connected && !editing && ipn}

        {editing && (
          <div className="border-t pt-4 space-y-3">
            <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
              <li>{t.rich('step1', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
              <li>{t('step2')}</li>
              <li>{t.rich('step3', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
              <li>{t('step4')}</li>
            </ol>
            <Select
              label={t('environment')}
              value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value as 'sandbox' | 'production' })}
              options={[
                { value: 'sandbox', label: t('environments.sandbox') },
                { value: 'production', label: t('environments.production') },
              ]}
            />
            <Input
              label="Merchant ID"
              value={form.merchantId}
              onChange={(e) => setForm({ ...form, merchantId: e.target.value })}
              autoComplete="off"
            />
            <Input
              label="Secret key"
              type="password"
              value={form.secretKey}
              onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
              autoComplete="new-password"
            />
            {ipn}
            {error && <p className="text-sm text-err">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setForm(EMPTY)
                  setError('')
                }}
              >
                {t('cancel')}
              </Button>
              <Button onClick={connect} isLoading={busy} disabled={!form.merchantId.trim() || !form.secretKey.trim()}>
                {t('save')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
