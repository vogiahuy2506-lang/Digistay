'use client'

import * as React from 'react'
import { CheckCircle2, Copy, CreditCard, ExternalLink } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'

interface VnpayStatus {
  connected: boolean
  tmnCode: string | null
  environment: string
  hashSecretHint: string | null
  webhookUrl: string
}

const EMPTY = {
  tmnCode: '',
  hashSecret: '',
  environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
}

export function VnpayCard({
  propertyId,
  onChange,
}: {
  propertyId: string
  onChange?: () => void
}) {
  const [status, setStatus] = React.useState<VnpayStatus | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/gateways/vnpay`)
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
      const res = await fetch(`/api/properties/${propertyId}/gateways/vnpay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        setError(apiError(data.error) || 'Kết nối VNPay thất bại')
        return
      }
      setStatus(data.data)
      setEditing(false)
      setForm(EMPTY)
      toast.success('Đã kết nối Cổng VNPay thành công')
      onChange?.()
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Bạn có chắc muốn hủy kết nối Cổng VNPay không?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/gateways/vnpay`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success('Đã hủy kết nối Cổng VNPay')
        await load()
        onChange?.()
      } else {
        toast.error(apiError(data.error) || 'Không thể hủy kết nối Cổng VNPay')
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
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-fg flex flex-wrap items-center gap-2">
                Cổng thanh toán VNPay (VNPay-QR, Thẻ ATM & Quốc tế)
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
                Cho phép khách hàng thanh toán cọc qua VNPay-QR trên hơn 40 ứng dụng ngân hàng, thẻ ATM nội địa và thẻ Visa/Mastercard.
              </p>
              {status.connected && (
                <div className="mt-2 space-y-1.5 text-sm text-fg">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-ok" />
                    <span>Terminal ID (TMN Code): <strong>{status.tmnCode}</strong></span>
                    {status.hashSecretHint && (
                      <span className="text-muted">· Hash Secret: <code className="text-xs bg-line/50 px-1.5 py-0.5 rounded">{status.hashSecretHint}</code></span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-muted">IPN Webhook URL VNPay:</span>
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
                {status.connected ? 'Cập nhật khóa' : 'Kết nối VNPay'}
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
                Hướng dẫn cấu hình cổng VNPay:
                <a
                  href="https://sandbox.vnpayment.vn/devreg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-acc hover:underline inline-flex items-center gap-1 text-xs"
                >
                  VNPay Merchant Portal <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-xs">
                <li>Đăng ký merchant trên VNPay và nhận email chứa <strong>Terminal ID (vnp_TmnCode)</strong> và <strong>Secret Key (vnp_HashSecret)</strong>.</li>
                <li>Nhập mã Terminal ID và Hash Secret vào biểu mẫu bên dưới.</li>
                <li>Đăng ký URL IPN bên dưới với VNPay Merchant Support để hệ thống tự động xác nhận đặt cọc khi giao dịch thành công.</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Terminal ID (TMN Code) *"
                placeholder="Ví dụ: VNPAY001"
                value={form.tmnCode}
                onChange={(e) => setForm({ ...form, tmnCode: e.target.value })}
              />
              <Select
                label="Môi trường hoạt động *"
                value={form.environment}
                onChange={(e) => setForm({ ...form, environment: e.target.value as 'SANDBOX' | 'PRODUCTION' })}
                options={[
                  { value: 'SANDBOX', label: 'Thử nghiệm (Sandbox Test)' },
                  { value: 'PRODUCTION', label: 'Môi trường thực tế (Production Live)' },
                ]}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Hash Secret (Secret Key) *"
                  type="password"
                  placeholder="Khóa bí mật tạo và kiểm tra chữ ký HMAC SHA512"
                  value={form.hashSecret}
                  onChange={(e) => setForm({ ...form, hashSecret: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
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
                disabled={!form.tmnCode.trim() || !form.hashSecret.trim()}
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

