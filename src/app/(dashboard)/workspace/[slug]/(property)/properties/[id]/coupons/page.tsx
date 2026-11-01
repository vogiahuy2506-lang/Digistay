'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Header, PageContainer } from '@/components/layout'
import { useCan } from '@/components/layout/workspace-context'
import { Badge, Button, Input, Modal, ModalBody, ModalFooter, Select } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { useDashLabels } from '@/lib/i18n/dash'
import { Plus, Pencil, Trash2, TicketPercent, Search } from 'lucide-react'

interface Coupon {
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
  isActive: boolean
}

interface Form {
  code: string
  name: string
  discountType: 'PERCENT' | 'FIXED_AMOUNT'
  discountValue: string
  maxDiscount: string
  minOrderAmount: string
  startDate: string
  endDate: string
  usageLimit: string
  isActive: boolean
}

const EMPTY_FORM: Form = {
  code: '',
  name: '',
  discountType: 'PERCENT',
  discountValue: '',
  maxDiscount: '',
  minOrderAmount: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
  isActive: true,
}

/** yyyy-mm-ddTHH:mm for <input type="datetime-local"> from a stored ISO date. */
function toLocalInput(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formOf(c: Coupon | null): Form {
  if (!c) return EMPTY_FORM
  return {
    code: c.code,
    name: c.name,
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
    minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : '',
    startDate: toLocalInput(c.startDate),
    endDate: toLocalInput(c.endDate),
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
    isActive: c.isActive,
  }
}

/**
 * The hotel's discount codes (Task 41): staff with property_edit create and
 * edit them; any member with access may read the list (the API allows it).
 */
export default function CouponsPage() {
  const t = useTranslations('dash.coupons')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const { id: propertyId } = useParams<{ slug: string; id: string }>()
  const canEdit = useCan('property_edit')

  const [coupons, setCoupons] = React.useState<Coupon[] | null>(null)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = React.useState(1)
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 })
  const [debouncedQuery, setDebouncedQuery] = React.useState('')

  const [editing, setEditing] = React.useState<Coupon | 'new' | null>(null)
  const [form, setForm] = React.useState<Form>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  React.useEffect(() => {
    setPage(1)
  }, [debouncedQuery, status])

  const load = React.useCallback(async () => {
    if (!propertyId) return
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (status !== 'all') params.set('status', status === 'active' ? 'active' : 'inactive')
    const res = await fetch(`/api/properties/${propertyId}/coupons?${params}`, { cache: 'no-store' }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (data?.success) {
      setCoupons(data.data)
      setPagination(data.pagination)
      setLoadFailed(false)
    } else {
      setLoadFailed(true)
      toast.error(t('loadFailed'), apiError(data?.error))
    }
  }, [propertyId, page, debouncedQuery, status, t])

  React.useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditing('new')
  }

  const openEdit = (c: Coupon) => {
    setForm(formOf(c))
    setEditing(c)
  }

  const close = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  const save = async () => {
    if (!propertyId) return
    if (!form.code.trim() || !form.name.trim() || !form.discountValue.trim() || !form.startDate || !form.endDate) {
      toast.error(t('modal.saveFailed'))
      return
    }
    setSaving(true)
    try {
      const payload = {
        code: form.code,
        name: form.name,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount.trim() === '' ? undefined : Number(form.maxDiscount),
        minOrderAmount: form.minOrderAmount.trim() === '' ? undefined : Number(form.minOrderAmount),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        usageLimit: form.usageLimit.trim() === '' ? undefined : Number(form.usageLimit),
        isActive: form.isActive,
      }
      const isNew = editing === 'new'
      const url = isNew
        ? `/api/properties/${propertyId}/coupons`
        : `/api/properties/${propertyId}/coupons/${(editing as Coupon).id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        toast.error(t('modal.saveFailed'), apiError(data.error))
        return
      }
      toast.success(isNew ? t('modal.added') : t('modal.updated'))
      close()
      await load()
    } catch {
      toast.error(t('modal.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (c: Coupon) => {
    if (!confirm(t('deleteConfirm', { code: c.code }))) return
    const res = await fetch(`/api/properties/${propertyId}/coupons/${c.id}`, { method: 'DELETE' }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!data.success) {
      toast.error(t('deleteFailed'), apiError(data?.error))
      return
    }
    toast.success(t('deleted'))
    await load()
  }

  const toggle = async (c: Coupon) => {
    setTogglingId(c.id)
    try {
      const res = await fetch(`/api/properties/${propertyId}/coupons/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !c.isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        toast.error(t('modal.saveFailed'), apiError(data.error))
        return
      }
      await load()
    } catch {
      toast.error(t('modal.saveFailed'))
    } finally {
      setTogglingId(null)
    }
  }

  const discountLabel = (c: Coupon) =>
    c.discountType === 'PERCENT'
      ? c.maxDiscount != null
        ? t('percentCapped', { value: c.discountValue, max: labels.money(c.maxDiscount) })
        : t('percent', { value: c.discountValue })
      : t('fixed', { value: labels.money(c.discountValue) })

  if (!propertyId) {
    return (
      <PageContainer>
        <div className="py-16 text-center">
          <p className="text-muted">{t('noProperty')}</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <Header
          title={t('title')}
          description={t('description')}
          actions={
            canEdit && coupons && coupons.length > 0 ? (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('add')}
              </Button>
            ) : undefined
          }
        />
        {!canEdit && <p className="text-small text-muted">{t('description')}</p>}

        <section className="rounded-box border border-line bg-panel p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
              <input
                type="search"
                aria-label={t('search')}
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-base sm:text-sm bg-panel text-fg border border-line rounded-lg focus:outline-none focus:border-muted w-full"
              />
            </div>
            <div className="flex gap-2" role="group" aria-label={t('columns.status')}>
              {(['all', 'active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    status === s ? 'bg-info text-on-ink' : 'bg-fg/5 text-muted hover:bg-fg/10'
                  }`}
                >
                  {s === 'all' ? t('all') : s === 'active' ? t('active') : t('off')}
                </button>
              ))}
            </div>
          </div>

          {coupons === null ? (
            loadFailed ? (
              <div className="px-6 py-12 text-center">
                <p className="text-body text-fg mb-4">{t('loadError')}</p>
                <Button variant="secondary" onClick={load}>
                  {tc('actions.retry')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3" aria-busy="true">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-box bg-fg/5 animate-pulse" />
                ))}
              </div>
            )
          ) : coupons.length === 0 ? (
            <div className="rounded-box border border-dashed border-line px-6 py-12 text-center">
              <TicketPercent className="w-8 h-8 text-muted mx-auto mb-4" aria-hidden="true" />
              <p className="text-body font-medium text-fg">{t('empty')}</p>
              <p className="mx-auto mt-2 max-w-xl text-small text-muted">{t('emptyHint')}</p>
              {canEdit && (
                <Button className="mt-6" onClick={openNew}>
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t('addFirst')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {coupons.map((c) => (
                  <li key={c.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-1 py-4 first:pt-0 last:pb-0">
                    <div className="hidden sm:flex w-10 h-10 bg-fg/5 rounded-lg items-center justify-center shrink-0">
                      <TicketPercent className="w-5 h-5 text-muted" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-fg">{c.code}</span>
                        <Badge variant={c.isActive ? 'success' : 'gray'}>
                          {c.isActive ? t('active') : t('off')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted mt-0.5 truncate">{c.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {discountLabel(c)}
                        {c.minOrderAmount != null && c.minOrderAmount > 0
                          ? ` · ${t('minOrder', { amount: labels.money(c.minOrderAmount) })}`
                          : ''}
                        {` · ${labels.date(c.startDate)} – ${labels.date(c.endDate)}`}
                        {` · ${c.usageLimit != null ? t('limited', { used: c.usageCount, limit: c.usageLimit }) : t('unlimited', { used: c.usageCount })}`}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 ml-auto">
                        <label className="relative inline-flex items-center cursor-pointer mr-1" title={c.isActive ? t('off') : t('active')}>
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={c.isActive}
                            disabled={togglingId === c.id}
                            onChange={() => toggle(c)}
                            aria-label={c.code}
                          />
                          <span className="w-9 h-5 bg-fg/10 peer-focus-visible:ring-2 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-ink" />
                        </label>
                        <button
                          type="button"
                          aria-label={tc('actions.edit')}
                          onClick={() => openEdit(c)}
                          className="p-2 text-muted hover:text-fg hover:bg-fg/5 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={tc('actions.delete')}
                          onClick={() => remove(c)}
                          className="p-2 text-muted hover:text-err hover:bg-err-soft rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-5 text-sm text-muted">
                  <span>{t('pagination.page', { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total })}</span>
                  <span className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      {t('pagination.prev')}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                      {t('pagination.next')}
                    </Button>
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Modal showHeader isOpen={editing !== null} onClose={close} title={editing === 'new' ? t('modal.newTitle') : t('modal.editTitle')}>
        <ModalBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('modal.code')}
              required
              maxLength={30}
              value={form.code}
              onChange={(e) => set({ code: e.target.value })}
              placeholder={t('modal.codePlaceholder')}
              hint={t('modal.codeHint')}
              className="font-mono uppercase"
            />
            <Input
              label={t('modal.name')}
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={t('modal.namePlaceholder')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('modal.type')}
              value={form.discountType}
              onChange={(e) => set({ discountType: e.target.value as Form['discountType'] })}
              options={[
                { value: 'PERCENT', label: t('modal.percent') },
                { value: 'FIXED_AMOUNT', label: t('modal.fixed') },
              ]}
            />
            <Input
              label={form.discountType === 'PERCENT' ? t('modal.valuePercent') : t('modal.valueFixed')}
              required
              type="number"
              min={0}
              value={form.discountValue}
              onChange={(e) => set({ discountValue: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('modal.maxDiscount')}
              type="number"
              min={0}
              value={form.maxDiscount}
              onChange={(e) => set({ maxDiscount: e.target.value })}
              hint={t('modal.maxDiscountHint')}
              disabled={form.discountType !== 'PERCENT'}
            />
            <Input
              label={t('modal.minOrder')}
              type="number"
              min={0}
              value={form.minOrderAmount}
              onChange={(e) => set({ minOrderAmount: e.target.value })}
              hint={t('modal.minOrderHint')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('modal.start')}
              required
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
            <Input
              label={t('modal.end')}
              required
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </div>
          <Input
            label={t('modal.limit')}
            type="number"
            min={1}
            step={1}
            value={form.usageLimit}
            onChange={(e) => set({ usageLimit: e.target.value })}
            hint={t('modal.limitHint')}
          />
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set({ isActive: e.target.checked })}
              className="w-4 h-4 rounded border-line"
            />
            {t('modal.isActive')}
          </label>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={close} disabled={saving}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={save} isLoading={saving}>
            {editing === 'new' ? t('modal.create') : tc('actions.saveChanges')}
          </Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}
