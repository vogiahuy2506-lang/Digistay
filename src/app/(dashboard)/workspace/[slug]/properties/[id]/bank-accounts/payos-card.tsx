'use client'

import * as React from 'react'
import { CheckCircle2, Copy, Zap } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'

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
        setError(data.error || 'Không kết nối được PayOS')
        return
      }
      setStatus(data.data)
      setEditing(false)
      setForm(EMPTY)
      toast.success('Đã kết nối PayOS')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Ngắt kết nối PayOS? Các link đã gửi cho khách sẽ không còn tự xác nhận nữa.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/payos`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success('Đã ngắt kết nối PayOS')
        await load()
      } else {
        toast.error(data.error || 'Không ngắt kết nối được')
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
            <Zap className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                Thanh toán online (PayOS)
                {status.connected ? <Badge variant="success">Đã kết nối</Badge> : <Badge variant="gray">Chưa kết nối</Badge>}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Khách quét mã và chuyển khoản thẳng vào tài khoản của khách sạn; thanh toán tự xác nhận,
                không cần đối chiếu sao kê.
              </p>
              {status.connected && (
                <p className="text-sm text-gray-700 mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Tiền về: {status.accountName} · {status.accountNumber} (Client ID {status.clientIdHint})
                </p>
              )}
            </div>
          </div>
          {!editing && (
            <div className="flex gap-2 shrink-0">
              <Button variant={status.connected ? 'outline' : 'primary'} size="sm" onClick={() => setEditing(true)}>
                {status.connected ? 'Đổi khoá' : 'Kết nối'}
              </Button>
              {status.connected && (
                <Button variant="ghost" size="sm" onClick={disconnect} isLoading={busy}>
                  Ngắt kết nối
                </Button>
              )}
            </div>
          )}
        </div>

        {editing && (
          <div className="border-t pt-4 space-y-3">
            <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-1">
              <li>
                Đăng nhập <strong>my.payos.vn</strong>, tạo (hoặc chọn) kênh thanh toán gắn với tài khoản ngân
                hàng của khách sạn.
              </li>
              <li>Trong kênh đó, mở phần thông tin tích hợp và sao chép Client ID, API Key, Checksum Key.</li>
              <li>Dán vào đây. Hệ thống sẽ tự đăng ký địa chỉ nhận thông báo với PayOS.</li>
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
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              Địa chỉ nhận thông báo: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{status.webhookUrl}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(status.webhookUrl).then(() => toast.success('Đã sao chép'))}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Sao chép địa chỉ"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setForm(EMPTY)
                  setError('')
                }}
              >
                Huỷ
              </Button>
              <Button
                onClick={connect}
                isLoading={busy}
                disabled={!form.clientId.trim() || !form.apiKey.trim() || !form.checksumKey.trim()}
              >
                Lưu và kết nối
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
