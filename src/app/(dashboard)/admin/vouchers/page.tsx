'use client'

import * as React from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Search, Tag, Ticket, Trash2, Power, CheckCircle2, Clock } from 'lucide-react'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Select, toast } from '@/components/ui'
import { useDashLabels } from '@/lib/i18n/dash'
import { AdminPage, Empty, Pager, Pill, Section, Stat, adminSend, useAdminData } from '@/components/admin/admin-ui'
import { PLANS, type PlanId } from '@/lib/marketing/plans'
import { cn } from '@/lib/utils'

interface VoucherRow {
  id: string
  code: string
  name: string
  discountType: 'PERCENT' | 'FIXED_AMOUNT'
  discountValue: number
  maxDiscount: number | null
  minOrderAmount: number | null
  startDate: string
  endDate: string
  usageLimit: number | null
  usageCount: number
  applicablePlans: string | null
  isActive: boolean
  createdAt: string
}

interface VouchersResponse {
  rows: VoucherRow[]
  total: number
  page: number
  size: number
  summary: {
    totalVouchers: number
    activeVouchers: number
    totalUsage: number
  }
}

const DAY_MS = 86_400_000
const vnDay = (date: Date) => new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

function CreateVoucherModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useTranslations('dash.admin.vouchers')
  const tc = useTranslations('dash.admin.common')
  const tm = useTranslations('dash.admin.vouchers.modal')

  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [discountType, setDiscountType] = React.useState<'PERCENT' | 'FIXED_AMOUNT'>('PERCENT')
  const [discountValue, setDiscountValue] = React.useState<number>(10)
  const [maxDiscount, setMaxDiscount] = React.useState<string>('')
  const [minOrderAmount, setMinOrderAmount] = React.useState<string>('')
  const [endDate, setEndDate] = React.useState(vnDay(new Date(Date.now() + 30 * DAY_MS)))
  const [usageLimit, setUsageLimit] = React.useState<string>('')
  const [selectedPlans, setSelectedPlans] = React.useState<string[]>(PLANS.map((p) => p.id))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const handlePlanToggle = (planId: string) => {
    setSelectedPlans((prev) =>
      prev.includes(planId) ? prev.filter((p) => p !== planId) : [...prev, planId]
    )
  }

  const save = async () => {
    const trimmedCode = code.trim().toUpperCase()
    if (trimmedCode.length < 3) return setError('Mã voucher phải có ít nhất 3 ký tự')
    if (name.trim().length < 2) return setError('Vui lòng nhập tên chương trình khuyến mãi')
    if (!endDate) return setError('Vui lòng chọn ngày kết thúc')
    if (discountType === 'PERCENT' && (discountValue <= 0 || discountValue > 100)) {
      return setError('Phần trăm giảm giá phải từ 1 đến 100%')
    }
    if (discountType === 'FIXED_AMOUNT' && discountValue < 1000) {
      return setError('Số tiền giảm phải từ 1.000đ trở lên')
    }

    setBusy(true)
    setError('')
    try {
      const applicablePlans =
        selectedPlans.length === PLANS.length || selectedPlans.length === 0
          ? null
          : selectedPlans.join(',')

      await adminSend('/api/admin/vouchers', 'POST', {
        code: trimmedCode,
        name: name.trim(),
        discountType,
        discountValue,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        endDate,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        applicablePlans,
        isActive: true,
      })

      toast.success(tm('success', { code: trimmedCode }))
      onCreated()
    } catch (e) {
      setError((e as Error).message || tc('failed', { error: 'Lỗi không xác định' }))
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={() => !busy && onClose()} size="lg" title={tm('title')}>
      <ModalHeader onClose={() => !busy && onClose()}>
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-acc" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-fg">{tm('title')}</h2>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{tm('code')}</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={tm('codePlaceholder')}
                className="font-mono font-bold tracking-wider uppercase"
                disabled={busy}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{tm('name')}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tm('namePlaceholder')}
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={tm('type')}
              value={discountType}
              onChange={(e) => {
                const next = e.target.value as 'PERCENT' | 'FIXED_AMOUNT'
                setDiscountType(next)
                if (next === 'PERCENT' && discountValue > 100) setDiscountValue(10)
                if (next === 'FIXED_AMOUNT' && discountValue <= 100) setDiscountValue(50_000)
              }}
              options={[
                { value: 'PERCENT', label: tm('typePercent') },
                { value: 'FIXED_AMOUNT', label: tm('typeFixed') },
              ]}
              disabled={busy}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                {discountType === 'PERCENT' ? tm('valuePercent') : tm('valueFixed')}
              </label>
              <Input
                type="number"
                min={discountType === 'PERCENT' ? 1 : 1000}
                max={discountType === 'PERCENT' ? 100 : 100_000_000}
                step={discountType === 'PERCENT' ? 1 : 1000}
                value={discountValue}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {discountType === 'PERCENT' ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{tm('maxDiscount')}</label>
                <Input
                  type="number"
                  placeholder="VD: 200000"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  disabled={busy}
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{tm('minOrderAmount')}</label>
                <Input
                  type="number"
                  placeholder="VD: 500000"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  disabled={busy}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{tm('usageLimit')}</label>
              <Input
                type="number"
                min={1}
                placeholder="VD: 100"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{tm('endDate')}</label>
            <Input
              type="date"
              value={endDate}
              min={vnDay(new Date(Date.now() + DAY_MS))}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={busy}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ['d30', 30],
                  ['d90', 90],
                  ['d365', 365],
                ] as const
              ).map(([key, days]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEndDate(vnDay(new Date(Date.now() + days * DAY_MS)))}
                  className="rounded-ctl border border-line px-2.5 py-1 text-xs font-medium text-fg hover:bg-fg/[0.04]"
                >
                  {tm(`quick.${key}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{tm('plans')}</label>
            <div className="flex flex-wrap gap-3">
              {PLANS.map((plan) => (
                <label
                  key={plan.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-ctl border px-3 py-1.5 text-xs font-medium transition-colors',
                    selectedPlans.includes(plan.id)
                      ? 'border-acc bg-acc/10 text-acc'
                      : 'border-line text-muted hover:text-fg'
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedPlans.includes(plan.id)}
                    onChange={() => handlePlanToggle(plan.id)}
                  />
                  <span>Gói {plan.id.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-err">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {tc('cancel')}
        </Button>
        <Button onClick={save} isLoading={busy}>
          {tm('submit')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default function VouchersPage() {
  const t = useTranslations('dash.admin.vouchers')
  const tc = useTranslations('dash.admin.common')
  const labels = useDashLabels()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || 'all'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const [search, setSearch] = React.useState(q)
  const [createOpen, setCreateOpen] = React.useState(false)

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status && status !== 'all') params.set('status', status)
    if (page > 1) params.set('page', String(page))
    const s = params.toString()
    return s ? `?${s}` : ''
  }, [q, status, page])

  const { data, reload, state } = useAdminData<VouchersResponse>(`/api/admin/vouchers${queryString}`)

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === '' || (key === 'status' && val === 'all') || (key === 'page' && val === '1')) {
        params.delete(key)
      } else {
        params.set(key, val)
      }
    }
    const s = params.toString()
    router.replace(s ? `${pathname}?${s}` : pathname)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ q: search.trim() || null, page: null })
  }

  const toggleVoucher = async (voucher: VoucherRow) => {
    try {
      await adminSend(`/api/admin/vouchers/${voucher.id}`, 'PATCH', {
        isActive: !voucher.isActive,
      })
      toast.success(t('actions.toggleSuccess'))
      reload()
    } catch (e) {
      toast.error((e as Error).message || tc('failed', { error: 'Lỗi' }))
    }
  }

  const deleteVoucher = async (voucher: VoucherRow) => {
    if (!confirm(t('actions.deleteConfirm', { code: voucher.code }))) return
    try {
      await adminSend(`/api/admin/vouchers/${voucher.id}`, 'DELETE', {})
      toast.success(t('actions.deleteSuccess'))
      reload()
    } catch (e) {
      toast.error((e as Error).message || tc('failed', { error: 'Lỗi' }))
    }
  }

  const now = new Date()

  return (
    <AdminPage
      title={t('title')}
      lead={t('lead')}
      actions={
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{t('create')}</span>
        </Button>
      }
    >
      {/* Stats summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={t('kpis.total')}
          value={data?.summary?.totalVouchers ?? '—'}
          hint="Mã voucher trong hệ thống"
        />
        <Stat
          label={t('kpis.active')}
          value={data?.summary?.activeVouchers ?? '—'}
          tone="ok"
          hint="Đang mở cho khách áp dụng"
        />
        <Stat
          label={t('kpis.used')}
          value={data?.summary?.totalUsage ?? '—'}
          tone="info"
          hint="Lượt áp dụng mua gói"
        />
      </div>

      <Section>
        {/* Filter tabs & search */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 border-b border-line pb-2 sm:border-0 sm:pb-0">
            {[
              ['all', t('tabs.all')],
              ['active', t('tabs.active')],
              ['expired', t('tabs.expired')],
              ['inactive', t('tabs.inactive')],
            ].map(([tabKey, tabLabel]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => updateFilters({ status: tabKey, page: null })}
                className={cn(
                  'rounded-ctl px-3 py-1.5 text-xs font-medium transition-colors',
                  status === tabKey
                    ? 'bg-ink text-on-ink'
                    : 'text-muted hover:bg-fg/5 hover:text-fg'
                )}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative min-w-[200px] flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã hoặc tên..."
                className="pl-8 text-xs"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Tìm
            </Button>
          </form>
        </div>

        {/* Vouchers Table */}
        {state === 'loading' && !data ? (
          <p className="py-12 text-center text-sm text-muted">Đang tải danh sách voucher...</p>
        ) : !data || data.rows.length === 0 ? (
          <Empty>{t('empty')}</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="py-2.5 pr-3 font-medium">{t('columns.code')}</th>
                    <th className="py-2.5 pr-3 font-medium">{t('columns.discount')}</th>
                    <th className="py-2.5 pr-3 font-medium">{t('columns.plans')}</th>
                    <th className="py-2.5 pr-3 font-medium">{t('columns.usage')}</th>
                    <th className="py-2.5 pr-3 font-medium">{t('columns.period')}</th>
                    <th className="py-2.5 pr-3 font-medium">{t('columns.status')}</th>
                    <th className="py-2.5 text-right font-medium">{t('columns.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {data.rows.map((row) => {
                    const isExpired = new Date(row.endDate) < now
                    const planList = row.applicablePlans
                      ? row.applicablePlans
                          .split(',')
                          .map((p) => p.toUpperCase())
                          .join(', ')
                      : t('allPlans')

                    return (
                      <tr key={row.id} className="align-middle hover:bg-fg/[0.02]">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded border border-acc/40 bg-acc/10 px-2 py-0.5 font-mono text-xs font-bold text-acc">
                              {row.code}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">{row.name}</p>
                        </td>

                        <td className="py-3 pr-3">
                          <span className="font-semibold text-fg">
                            {row.discountType === 'PERCENT'
                              ? `Giảm ${row.discountValue}%`
                              : `Giảm ${labels.money(row.discountValue)}`}
                          </span>
                          {row.maxDiscount && (
                            <span className="block text-xs text-muted">
                              Tối đa {labels.money(row.maxDiscount)}
                            </span>
                          )}
                          {row.minOrderAmount && (
                            <span className="block text-xs text-muted">
                              Đơn từ {labels.money(row.minOrderAmount)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-3 text-xs text-muted">{planList}</td>

                        <td className="py-3 pr-3 tabular-nums">
                          <span className="font-medium text-fg">{row.usageCount}</span>
                          <span className="text-muted"> / {row.usageLimit ?? t('unlimited')}</span>
                        </td>

                        <td className="py-3 pr-3 text-xs text-muted tabular-nums">
                          {labels.date(row.startDate)} → {labels.date(row.endDate)}
                        </td>

                        <td className="py-3 pr-3">
                          {!row.isActive ? (
                            <Pill tone="muted">{t('paused')}</Pill>
                          ) : isExpired ? (
                            <Pill tone="bad">{t('expired')}</Pill>
                          ) : (
                            <Pill tone="ok">{t('active')}</Pill>
                          )}
                        </td>

                        <td className="py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleVoucher(row)}
                              title={row.isActive ? t('actions.deactivate') : t('actions.activate')}
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors hover:bg-fg/5 hover:text-fg',
                                !row.isActive && 'text-warn'
                              )}
                            >
                              <Power className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteVoucher(row)}
                              title={t('actions.delete')}
                              className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors hover:bg-err-soft hover:text-err"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pager
              page={data.page}
              size={data.size}
              total={data.total}
              onPage={(p) => updateFilters({ page: String(p) })}
            />
          </>
        )}
      </Section>

      {createOpen && (
        <CreateVoucherModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false)
            reload()
          }}
        />
      )}
    </AdminPage>
  )
}
