'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Copy, Zap } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'

interface PayosStatus {
  connected: boolean
  clientIdHint: string | null
  accountName: string | null
  accountNumber: string | null
  connectedAt: string | null
  webhookUrl: string
}

const EMPTY = { clientId: '', apiKey: '', checksumKey: '' }

/**
 * The property's own PayOS account (Part 5): guests pay into the hotel's
 * bank account and payments confirm themselves. Keys are write-only here:
 * the API never sends them back.
 */
export function PayosCard({ propertyId }: { propertyId: string }) {
  const t = useTranslations('dash.money.payos')
  const [status, setStatus] = React.useState<PayosStatus | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/payos`)
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
      const res = await fetch(`/api/properties/${propertyId}/payos`, {
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
      const res = await fetch(`/api/properties/${propertyId}/payos`, { method: 'DELETE' })
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

  return (
    <Card className="mb-6">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-warn mt-0.5" />
            <div>
              <p className="font-semibold text-fg flex items-center gap-2">
                {t('title')}
                {status.connected ? <Badge variant="success">{t('connected')}</Badge> : <Badge variant="gray">{t('notConnected')}</Badge>}
              </p>
              <p className="text-sm text-muted mt-1">
                {t('intro')}
              </p>
              {status.connected && (
                <p className="text-sm text-fg mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-ok" />
                  {t('payout', {
                    name: status.accountName ?? '',
                    number: status.accountNumber ?? '',
                    hint: status.clientIdHint ?? '',
                  })}
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

        {editing && (
          <div className="border-t pt-4 space-y-3">
            <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
              <li>{t.rich('step1', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
              <li>{t('step2')}</li>
              <li>{t('step3')}</li>
            </ol>
            <Input
              label="Client ID"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              autoComplete="off"
            />
            <Input
              label="API Key"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              autoComplete="new-password"
            />
            <Input
              label="Checksum Key"
              type="password"
              value={form.checksumKey}
              onChange={(e) => setForm({ ...form, checksumKey: e.target.value })}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted flex items-center gap-1.5">
              {t('webhookUrl')} <code className="bg-fg/5 px-1.5 py-0.5 rounded">{status.webhookUrl}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(status.webhookUrl).then(() => toast.success(t('copied')))}
                className="text-muted hover:text-fg"
                aria-label={t('copyAddress')}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </p>
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
              <Button
                onClick={connect}
                isLoading={busy}
                disabled={!form.clientId.trim() || !form.apiKey.trim() || !form.checksumKey.trim()}
              >
                {t('save')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
