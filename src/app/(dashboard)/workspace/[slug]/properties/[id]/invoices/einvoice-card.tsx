'use client'

import * as React from 'react'
import { CheckCircle2, Copy, FileCheck2 } from 'lucide-react'
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui'
import { VAT_CODES, VAT_LABELS } from '@/lib/einvoice/vat'

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
}

const yearPrefix = `C${String(new Date().getFullYear()).slice(-2)}`
const EMPTY = { environment: 'DEMO', taxCode: '', username: '', password: '', templateCode: '1', series: '', vatCode: '' }

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
        setError(data.error || 'Không kết nối được Mắt Bão')
        return
      }
      setStatus(data.data)
      onStatus(data.data)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Ngắt kết nối Mắt Bão? Hoá đơn đã phát hành vẫn còn trên Mắt Bão; hoá đơn mới sẽ không phát hành được.')) return
    await fetch(`/api/properties/${propertyId}/einvoice`, { method: 'DELETE' })
    await load()
  }

  if (!status) return null
  const lowNumbers = status.remainingNumbers != null && status.remainingNumbers <= 50

  return (
    <Card className="mb-6">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                Hoá đơn điện tử (Mắt Bão)
                {status.connected ? (
                  <Badge variant={status.environment === 'PRODUCTION' ? 'success' : 'warning'}>
                    {status.environment === 'PRODUCTION' ? 'Chính thức' : 'Thử nghiệm'}
                  </Badge>
                ) : (
                  <Badge variant="gray">Chưa kết nối</Badge>
                )}
              </p>
              {status.connected ? (
                <p className="text-sm text-gray-700 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  MST {status.taxCode} · Mẫu {status.templateCode} · Ký hiệu {status.series} · Thuế suất{' '}
                  {VAT_LABELS[status.vatCode as keyof typeof VAT_LABELS]} ·{' '}
                  <span className={lowNumbers ? 'text-red-600 font-semibold' : ''}>
                    còn {status.remainingNumbers ?? '?'} số
                  </span>
                </p>
              ) : (
                <p className="text-sm text-gray-600 mt-1">
                  Phát hành hoá đơn GTGT dưới mã số thuế của khách sạn, qua tài khoản Mắt Bão của khách sạn.
                </p>
              )}
            </div>
          </div>
          {!editing && (
            <div className="flex gap-2 shrink-0">
              <Button variant={status.connected ? 'outline' : 'primary'} size="sm" onClick={startEditing}>
                {status.connected ? 'Sửa' : 'Kết nối'}
              </Button>
              {status.connected && (
                <Button variant="ghost" size="sm" onClick={disconnect}>
                  Ngắt kết nối
                </Button>
              )}
            </div>
          )}
        </div>

        {status.connected && status.webhookUrl && !editing && (
          <div className="text-xs text-gray-500 border-t pt-3">
            <p>
              Để nhận trạng thái từ cơ quan thuế (đã cấp mã / bị từ chối), gửi địa chỉ này cho bộ phận hỗ trợ Mắt
              Bão. Địa chỉ có mã bí mật: không chia sẻ nơi khác.
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="truncate bg-gray-100 px-1.5 py-0.5 rounded">{status.webhookUrl}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(status.webhookUrl!)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Sao chép địa chỉ"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {editing && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm text-gray-600">
              Lấy các thông tin này từ Mắt Bão (hoặc kế toán). Ký hiệu đổi theo năm, ví dụ {yearPrefix}TAA cho năm nay.
              Thuế suất do kế toán của khách sạn quyết định; giá phòng được coi là đã gồm thuế.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Môi trường"
                value={form.environment}
                onChange={(e) => setForm({ ...form, environment: e.target.value })}
                options={[
                  { value: 'DEMO', label: 'Thử nghiệm (demo.matbao.in)' },
                  { value: 'PRODUCTION', label: 'Chính thức — hoá đơn có giá trị pháp lý' },
                ]}
              />
              <Input label="Mã số thuế khách sạn" value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
              <Input
                label="Tên đăng nhập Mắt Bão"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="off"
              />
              <Input
                label="Mật khẩu Mắt Bão"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={status.connected ? 'Để trống nếu không đổi' : ''}
                autoComplete="new-password"
              />
              <Input label="Mẫu số" value={form.templateCode} onChange={(e) => setForm({ ...form, templateCode: e.target.value })} />
              <Input
                label="Ký hiệu"
                value={form.series}
                onChange={(e) => setForm({ ...form, series: e.target.value.toUpperCase() })}
                placeholder={`${yearPrefix}TAA`}
              />
              <Select
                label="Thuế suất GTGT"
                value={form.vatCode}
                onChange={(e) => setForm({ ...form, vatCode: e.target.value })}
                options={[
                  { value: '', label: 'Chọn thuế suất' },
                  ...VAT_CODES.map((code) => ({ value: String(code), label: VAT_LABELS[code] })),
                ]}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Huỷ
              </Button>
              <Button onClick={save} isLoading={busy}>
                Lưu và kiểm tra
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
