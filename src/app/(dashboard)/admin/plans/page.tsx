'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { Check, Edit3, HelpCircle, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import { Button, Input, Modal, ModalBody, ModalFooter, toast } from '@/components/ui'
import { formatVnd } from '@/lib/bookings/display'
import type { Plan, PlanId } from '@/lib/marketing/plans'

interface EditingPlan {
  id: PlanId
  name: string
  price: number
  properties: number
  rooms: number
  staff: number
  invoices: number
  isActive: boolean
}

export default function AdminPlansPage() {
  const locale = useLocale() === 'en' ? 'en' : 'vi'
  const [plans, setPlans] = React.useState<Plan[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [editing, setEditing] = React.useState<EditingPlan | null>(null)
  const [saving, setSaving] = React.useState(false)

  const loadPlans = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/plans', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (json?.success && Array.isArray(json.data)) {
        setPlans(json.data)
      } else {
        setError(json?.error || 'Không tải được danh sách gói cước')
      }
    } catch {
      setError('Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadPlans()
  }, [loadPlans])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Không thể lưu thay đổi gói')
        return
      }
      toast.success(`Đã cập nhật gói ${editing.name} thành công!`)
      setEditing(null)
      await loadPlans()
    } catch {
      toast.error('Lỗi kết nối khi lưu gói')
    } finally {
      setSaving(false)
    }
  }

  const planTitles: Record<PlanId, { badge: string; desc: string }> = {
    starter: {
      badge: 'Cơ bản',
      desc: 'Dành cho homestay, villa, khách sạn nhỏ quản lý 1 cơ sở độc lập.',
    },
    growth: {
      badge: 'Phổ biến nhất',
      desc: 'Phù hợp khách sạn vừa, chuỗi 2-3 homestay, tích hợp đồng bộ đa kênh OTA.',
    },
    business: {
      badge: 'Chuyên nghiệp',
      desc: 'Giải pháp hoàn chỉnh cho khách sạn lớn, chuỗi cơ sở với hạn mức phòng cao.',
    },
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Quản lý Bảng giá & Gói cước Digistay
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Thiết lập giá niêm yết và hạn mức tài nguyên (cơ sở, phòng, nhân viên). Thay đổi được áp dụng ngay lập tức cho toàn bộ khách hàng mà không cần build lại server.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadPlans}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Info notice */}
      <div className="mt-6 flex items-start gap-3 rounded-ctl border border-line bg-panel p-4 text-xs text-muted">
        <Sparkles className="h-5 w-5 shrink-0 text-acc" />
        <div className="space-y-1">
          <p className="font-medium text-fg">Cơ chế đồng bộ giá thời gian thực (Zero-deployment Pricing)</p>
          <p>
            Giá và hạn mức lưu trực tiếp tại bảng cơ sở dữ liệu <code>PlatformPlan</code>. Khi bạn sửa giá, giá mới sẽ ngay lập tức xuất hiện tại: <strong>Trang chủ</strong>, <strong>Bảng giá (/pricing)</strong>, <strong>Trang quản lý gói Workspace (/billing)</strong> và <strong>Cổng thanh toán VietQR PayOS</strong>.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-ctl border border-err/30 bg-err-soft p-3 text-sm text-err">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Plans grid */}
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const info = planTitles[p.id] || { badge: 'Gói dịch vụ', desc: '' }
          const yearlyPrice = p.price * 10
          return (
            <div
              key={p.id}
              className={`flex flex-col justify-between rounded-box border p-6 shadow-sm transition-all ${
                p.id === 'growth'
                  ? 'border-acc bg-gradient-to-b from-acc/5 to-transparent'
                  : 'border-line bg-panel'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {p.id.toUpperCase()}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.id === 'growth'
                        ? 'bg-acc text-white'
                        : 'bg-fg/[0.06] text-muted'
                    }`}
                  >
                    {info.badge}
                  </span>
                </div>

                <h2 className="mt-3 font-serif text-2xl font-bold text-fg">
                  {p.id.charAt(0).toUpperCase() + p.id.slice(1)}
                </h2>
                <p className="mt-1 text-xs text-muted leading-relaxed min-h-[36px]">
                  {info.desc}
                </p>

                {/* Price block */}
                <div className="mt-5 border-t border-line/70 pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-fg tabular-nums">
                      {formatVnd(p.price, locale)}
                    </span>
                    <span className="text-xs text-muted">/ tháng</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Thanh toán năm: <strong className="text-fg tabular-nums">{formatVnd(yearlyPrice, locale)}</strong> (tặng 2 tháng)
                  </div>
                </div>

                {/* Resource limits */}
                <div className="mt-6 space-y-2.5 border-t border-line/70 pt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Số cơ sở tối đa:</span>
                    <span className="font-semibold text-fg">{p.properties} cơ sở</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Số phòng quản lý:</span>
                    <span className="font-semibold text-fg">{p.rooms} phòng</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Tài khoản nhân viên:</span>
                    <span className="font-semibold text-fg">{p.staff} tài khoản</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Hóa đơn điện tử GTGT:</span>
                    <span className="font-semibold text-fg">
                      {p.invoices > 0 ? `${p.invoices} hóa đơn/tháng` : 'Không bao gồm'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Tên miền website:</span>
                    <span className="font-medium text-ok flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Có sẵn
                    </span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="mt-8 border-t border-line/70 pt-4">
                <Button
                  className="w-full flex items-center justify-center gap-1.5"
                  variant={p.id === 'growth' ? 'primary' : 'secondary'}
                  onClick={() =>
                    setEditing({
                      id: p.id,
                      name: p.id.charAt(0).toUpperCase() + p.id.slice(1),
                      price: p.price,
                      properties: p.properties,
                      rooms: p.rooms,
                      staff: p.staff,
                      invoices: p.invoices,
                      isActive: true,
                    })
                  }
                >
                  <Edit3 className="h-4 w-4" />
                  Chỉnh sửa giá & hạn mức
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Modal */}
      {editing && (
        <Modal isOpen={true} onClose={() => setEditing(null)}>
          <form onSubmit={handleSave}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-fg">
                Chỉnh sửa gói {editing.name}
              </h2>
              <p className="mt-1 text-xs text-muted">
                Điều chỉnh giá niêm yết và hạn mức tài nguyên cho gói này.
              </p>

              <ModalBody className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-fg">
                    Giá niêm yết theo tháng (VND) <span className="text-err">*</span>
                  </label>
                  <Input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    Giá năm (x10 tháng): <strong>{formatVnd(editing.price * 10, locale)}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-fg">
                      Cơ sở tối đa <span className="text-err">*</span>
                    </label>
                    <Input
                      type="number"
                      min="1"
                      required
                      value={editing.properties}
                      onChange={(e) => setEditing({ ...editing, properties: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-fg">
                      Phòng tối đa <span className="text-err">*</span>
                    </label>
                    <Input
                      type="number"
                      min="1"
                      required
                      value={editing.rooms}
                      onChange={(e) => setEditing({ ...editing, rooms: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-fg">
                      Tài khoản nhân viên <span className="text-err">*</span>
                    </label>
                    <Input
                      type="number"
                      min="1"
                      required
                      value={editing.staff}
                      onChange={(e) => setEditing({ ...editing, staff: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-fg">
                      Hóa đơn GTGT Mắt Bão
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={editing.invoices}
                      onChange={(e) => setEditing({ ...editing, invoices: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </ModalBody>

              <ModalFooter className="mt-6 flex justify-end gap-2 border-t border-line/70 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                >
                  Hủy
                </Button>
                <Button type="submit" isLoading={saving}>
                  Lưu thay đổi
                </Button>
              </ModalFooter>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

