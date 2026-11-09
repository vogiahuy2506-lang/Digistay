'use client'

import * as React from 'react'
import { CheckCircle2, Copy, Wallet, ExternalLink } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'

interface MomoStatus {
  connected: boolean
  partnerCode: string | null
  environment: string
  accessKeyHint: string | null
  webhookUrl: string
}

const EMPTY = {
  partnerCode: '',
  accessKey: '',
  secretKey: '',
  environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
}

export function MomoCard({
  propertyId,
  onChange,
}: {
  propertyId: string
  onChange?: () => void
}) {
  const [status, setStatus] = React.useState<MomoStatus | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/gateways/momo`)
      const data = await res.json().catch(() => ({}))
      if (data.success) setStatus(data.data)
    } catch {
      // ignore
    }
  }, [propertyId])

  React.useEffect(() => {
    load()
  }, [load])

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/properties/${propertyId}/gateways/momo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        setError(apiError(data.error) || 'Kết nối MoMo thất bại')
        return
      }
      setStatus(data.data)
      setEditing(false)
      setForm(EMPTY)
      toast.success('Đã kết nối Ví MoMo thành công')
      onChange?.()
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Bạn có chắc muốn hủy kết nối Ví MoMo không?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/gateways/momo`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success('Đã hủy kết nối Ví MoMo')
        await load()
        onChange?.()
      } else {
        toast.error(apiError(data.error) || 'Không thể hủy kết nối Ví MoMo')
      }
    } finally {
      setBusy(false)
    }
  }

  const copyWebhook = async () => {
    if (!status?.webhookUrl) return
    try {
      await navigator.clipboard.writeText(status.webhookUrl)
      toast.success('Đã sao chép IPN URL')
    } catch {
      toast.error('Không thể sao chép URL')
    }
  }

  if (!status) return null

  return (
    <Card className="mb-6">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-fg flex flex-wrap items-center gap-2">
                Cổng thanh toán MoMo Business (Ví MoMo & MoMo QR)
                {status.connected ? (
                  <Badge variant="success">Đã kết nối</Badge>
                ) : (
                  <Badge variant="gray">Chưa kết nối</Badge>
                )}
                {status.connected && (
                  <Badge variant={status.environment === 'PRODUCTION' ? 'acc' : 'warn'}>
                    {status.environment === 'PRODUCTION' ? 'Chính thức' : 'Thử nghiệm'}
                  </Badge>
                )}
              </p>
              <p className="text-sm text-muted mt-1">
                Cho phép khách hàng thanh toán tiền cọc tức thì bằng app Ví MoMo hoặc quét mã MoMo QR.
              </p>
              {status.connected && (
                <div className="mt-2 space-y-1.5 text-sm text-fg">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-ok" />
                    <span>Partner Code: <strong>{status.partnerCode}</strong></span>
                    {status.accessKeyHint && (
                      <span className="text-muted">· Access Key: <code className="text-xs bg-line/50 px-1.5 py-0.5 rounded">{status.accessKeyHint}</code></span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-muted">IPN Webhook URL MoMo:</span>
                    <code className="text-xs bg-line/60 px-2 py-0.5 rounded text-acc font-mono max-w-sm truncate">
                      {status.webhookUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyWebhook} className="h-7 text-xs gap-1">
                      <Copy className="w-3 h-3" />
                      Sao chép
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!editing && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant={status.connected ? 'outline' : 'primary'} size="sm" onClick={() => setEditing(true)}>
                {status.connected ? 'Cập nhật khóa' : 'Kết nối MoMo'}
              </Button>
              {status.connected && (
                <Button variant="ghost" size="sm" onClick={disconnect} isLoading={busy}>
                  Hủy kết nối
                </Button>
              )}
            </div>
          )}
        </div>

        {editing && (
          <div className="border-t border-line pt-4 space-y-3">
            <div className="p-3 bg-panel-soft rounded-lg text-sm text-muted space-y-1.5">
              <p className="font-medium text-fg flex items-center gap-1.5">
                Hướng dẫn tích hợp MoMo Business:
                <a
                  href="https://business.momo.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-acc hover:underline inline-flex items-center gap-1 text-xs"
                >
                  MoMo Business Portal <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-xs">
                <li>Đăng nhập Cổng MoMo Doanh Nghiệp, vào mục <strong>Tích hợp thanh toán</strong> &gt; <strong>Thông tin API</strong>.</li>
                <li>Lấy <strong>Partner Code</strong>, <strong>Access Key</strong> và <strong>Secret Key</strong> nhập vào form.</li>
                <li>Dán IPN Webhook URL bên dưới vào phần cấu hình thông báo tức thì của MoMo.</li>
              </ol>
            </div>

            {/* Prevent browser autofill */}
            <input type="text" name="prevent_autofill_user" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sr-only opacity-0 w-0 h-0 pointer-events-none absolute" />
            <input type="password" name="prevent_autofill_pass" tabIndex={-1} autoComplete="new-password" aria-hidden="true" className="sr-only opacity-0 w-0 h-0 pointer-events-none absolute" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                name="momo_partner_code"
                id="momo_partner_code"
                label="Partner Code *"
                placeholder="Ví dụ: MOMO12345"
                value={form.partnerCode}
                onChange={(e) => setForm({ ...form, partnerCode: e.target.value })}
                autoComplete="off"
              />
              <Select
                name="momo_environment"
                id="momo_environment"
                label="Môi trường hoạt động *"
                value={form.environment}
                onChange={(e) => setForm({ ...form, environment: e.target.value as 'SANDBOX' | 'PRODUCTION' })}
                options={[
                  { value: 'SANDBOX', label: 'Thử nghiệm (Sandbox Test)' },
                  { value: 'PRODUCTION', label: 'Môi trường thực tế (Production Live)' },
                ]}
              />
              <Input
                name="momo_access_key"
                id="momo_access_key"
                label="Access Key *"
                type="password"
                placeholder="Nhập Access Key MoMo"
                value={form.accessKey}
                onChange={(e) => setForm({ ...form, accessKey: e.target.value })}
                autoComplete="new-password"
              />
              <Input
                name="momo_secret_key"
                id="momo_secret_key"
                label="Secret Key *"
                type="password"
                placeholder="Nhập Secret Key MoMo"
                value={form.secretKey}
                onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-sm text-err">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setError('') }} disabled={busy}>
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={connect}
                isLoading={busy}
                disabled={!form.partnerCode.trim() || !form.accessKey.trim() || !form.secretKey.trim()}
              >
                Lưu cấu hình
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

