'use client'

import * as React from 'react'
import { CheckCircle2, Copy, Radio, ExternalLink } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'

interface SepayStatus {
  connected: boolean
  apiKeyHint: string | null
  accountNumber: string | null
  bankCode: string | null
  webhookUrl: string
}

const EMPTY = { apiKey: '', webhookToken: '', accountNumber: '', bankCode: '' }

export function SepayCard({
  propertyId,
  onChange,
}: {
  propertyId: string
  onChange?: () => void
}) {
  const [status, setStatus] = React.useState<SepayStatus | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/gateways/sepay`)
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
      const res = await fetch(`/api/properties/${propertyId}/gateways/sepay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        setError(apiError(data.error) || 'Kết nối SePay thất bại')
        return
      }
      setStatus(data.data)
      setEditing(false)
      setForm(EMPTY)
      toast.success('Đã kết nối SePay thành công')
      onChange?.()
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Bạn có chắc muốn hủy kết nối SePay không?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/gateways/sepay`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success('Đã hủy kết nối SePay')
        await load()
        onChange?.()
      } else {
        toast.error(apiError(data.error) || 'Không thể hủy kết nối SePay')
      }
    } finally {
      setBusy(false)
    }
  }

  const copyWebhook = async () => {
    if (!status?.webhookUrl) return
    try {
      await navigator.clipboard.writeText(status.webhookUrl)
      toast.success('Đã sao chép Webhook URL')
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
            <div className="w-10 h-10 rounded-xl bg-acc-soft text-acc flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-fg flex flex-wrap items-center gap-2">
                Cổng SePay (Webhook biến động số dư ngân hàng)
                {status.connected ? <Badge variant="success">Đã kết nối</Badge> : <Badge variant="gray">Chưa kết nối</Badge>}
              </p>
              <p className="text-sm text-muted mt-1">
                Tự động xác nhận tiền cọc khi khách chuyển khoản vào tài khoản ngân hàng của khách sạn thông qua biến động số dư SePay.
              </p>
              {status.connected && (
                <div className="mt-2 space-y-1.5 text-sm text-fg">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-ok" />
                    <span>API Key: <code className="text-xs bg-line/50 px-1.5 py-0.5 rounded">{status.apiKeyHint}</code></span>
                    {status.accountNumber && <span className="text-muted">· STK: {status.accountNumber}</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-muted">Webhook URL SePay:</span>
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
                {status.connected ? 'Cập nhật khóa' : 'Kết nối SePay'}
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
                Các bước kết nối với SePay:
                <a
                  href="https://my.sepay.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-acc hover:underline inline-flex items-center gap-1 text-xs"
                >
                  Mở trang SePay <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-xs">
                <li>Đăng nhập my.sepay.vn, vào mục <strong>Tích hợp Webhook</strong> hoặc <strong>API Token</strong>.</li>
                <li>Tạo API Key mới và dán vào trường <strong>SePay API Key</strong> dưới đây.</li>
                <li>Sao chép URL Webhook bên dưới và dán vào cài đặt Webhook trên SePay để nhận biến động giao dịch tức thì.</li>
              </ol>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-fg font-medium">Webhook URL:</span>
                <code className="text-xs bg-panel px-2 py-1 rounded border border-line select-all text-acc">
                  {status.webhookUrl}
                </code>
                <Button variant="secondary" size="sm" onClick={copyWebhook} className="h-6 text-xs gap-1">
                  <Copy className="w-3 h-3" />
                  Copy
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="SePay API Key *"
                type="password"
                placeholder="Nhập API Key từ SePay"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                autoComplete="new-password"
              />
              <Input
                label="Webhook Token (Tùy chọn)"
                type="password"
                placeholder="Khóa bí mật xác thực webhook"
                value={form.webhookToken}
                onChange={(e) => setForm({ ...form, webhookToken: e.target.value })}
                autoComplete="new-password"
              />
              <Input
                label="Số tài khoản ngân hàng SePay (Tùy chọn)"
                placeholder="Ví dụ: 0123456789"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              />
              <Input
                label="Mã ngân hàng (Tùy chọn)"
                placeholder="Ví dụ: MB, VCB, TCB"
                value={form.bankCode}
                onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-err">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setError('') }} disabled={busy}>
                Hủy
              </Button>
              <Button size="sm" onClick={connect} isLoading={busy} disabled={!form.apiKey.trim()}>
                Lưu cấu hình
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

