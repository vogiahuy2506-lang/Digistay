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
  /** issue by itself once a booking is fully paid (src/lib/einvoice/jobs.ts) */
  autoIssue?: boolean
  autoIssueSince?: string | null
  /** email issued invoices to the buyer (src/lib/einvoice/delivery.ts) */
  emailInvoices?: boolean
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

  const setOption = async (option: 'autoIssue' | 'emailInvoices', value: boolean) => {
    if (
      option === 'autoIssue' &&
      value &&
      !confirm(
        `Tự xuất hoá đơn: từ bây giờ, mỗi đơn đặt phòng được thanh toán đủ sẽ tự được phát hành một hoá đơn bằng tổng tiền đơn${
          status?.environment === 'PRODUCTION' ? ' (môi trường CHÍNH THỨC: hoá đơn thật)' : ''
        }. Người mua là công ty khách nhập khi đặt phòng, không có thì là khách. Đơn đã có hoá đơn thì không xuất thêm. Bật?`
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
      setError(data.error || 'Không lưu được')
      return
    }
    setStatus(data.data)
    onStatus(data.data)
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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="w-5 h-5 text-info mt-0.5" />
            <div>
              <p className="font-semibold text-fg flex items-center gap-2">
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
                <p className="text-sm text-fg mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-ok" />
                  MST {status.taxCode} · Mẫu {status.templateCode} · Ký hiệu {status.series} · Thuế suất{' '}
                  {VAT_LABELS[status.vatCode as keyof typeof VAT_LABELS]} ·{' '}
                  <span className={lowNumbers ? 'text-err font-semibold' : ''}>
                    còn {status.remainingNumbers ?? '?'} số
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted mt-1">
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

        {status.connected && !editing && (
          <div className="border-t pt-3 space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(status.autoIssue)}
                onChange={(e) => setOption('autoIssue', e.target.checked)}
              />
              <span>
                <span className="font-medium text-fg">Tự xuất hoá đơn khi đơn đã thanh toán đủ</span>
                <span className="block text-xs text-muted">
                  Áp dụng cho đơn thanh toán đủ từ lúc bật. Tiền cọc chưa đủ thì chưa xuất. Thông tin công ty không hợp
                  lệ thì hoá đơn chờ nhân viên sửa.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={status.emailInvoices !== false}
                onChange={(e) => setOption('emailInvoices', e.target.checked)}
              />
              <span>
                <span className="font-medium text-fg">Gửi hoá đơn (PDF) qua email cho người mua sau khi phát hành</span>
              </span>
            </label>
            {error && <p className="text-sm text-err">{error}</p>}
          </div>
        )}

        {status.connected && status.webhookUrl && !editing && (
          <div className="text-xs text-muted border-t pt-3">
            <p>
              Để nhận trạng thái từ cơ quan thuế (đã cấp mã / bị từ chối), gửi địa chỉ này cho bộ phận hỗ trợ Mắt
              Bão. Địa chỉ có mã bí mật: không chia sẻ nơi khác.
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="truncate bg-fg/5 px-1.5 py-0.5 rounded">{status.webhookUrl}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(status.webhookUrl!)}
                className="text-muted hover:text-fg"
                aria-label="Sao chép địa chỉ"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {editing && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm text-muted">
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
            {error && <p className="text-sm text-err">{error}</p>}
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
