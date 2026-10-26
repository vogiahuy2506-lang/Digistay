'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Select, Modal, ModalFooter } from '@/components/ui'
import { 
  Search, Filter, CreditCard, Smartphone, Banknote, Building, 
  Clock, CheckCircle, XCircle, AlertCircle, Download, RefreshCw,
  Plus, Eye, QrCode, FileText, Copy, Check, TrendingUp, Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import QRCode from 'qrcode'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'
import { apiError } from '@/lib/i18n/api-errors'
import { toast } from '@/components/ui/toast'
import { bankLabel, toBankName } from '@/lib/vietqr'
import { BookingPicker, bookingBalance } from '@/components/payment/booking-picker'
import { MONEY_MANAGERS, NoAccess, useHasRole } from '@/components/payment/no-access'
import { toCsv } from '@/lib/reports/revenue'
import { MAX_PAGE_SIZE } from '@/lib/api/list-params'

/** dd/mm/yyyy HH:mm in Vietnam time, written by hand (Intl differs between Node and browsers). */
function vnDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

interface Payment {
  id: string
  bookingId: string
  amount: number
  fee: number
  netAmount: number
  method: string
  status: string
  bankCode: string | null
  bankAccount: string | null
  accountHolder: string | null
  transferContent: string | null
  paidAt: string | null
  expiresAt: string | null
  createdAt: string
  paymentGateway: string | null
  checkoutUrl: string | null
  qrCodeUrl: string | null
  metadata: {
    payos?: { amountMismatch?: number; paidAfter?: string }
    /** written by the booking cancel route; a partial refund leaves the payment PROCESSING */
    refundedAmount?: number
    refundedAt?: string
  } | null
  booking: {
    id: string
    bookingCode: string
    guestName: string
    property: {
      id: string
      name: string
    }
  }
}

interface Property {
  id: string
  name: string
}

// Labels: messages dash.money.payments.methodOptions / methods / status.
const PAYMENT_METHODS = ['BANK_TRANSFER', 'QR_VIETQR', 'CARD', 'CREDIT_CARD', 'E_WALLET', 'CASH'] as const
type PaymentMethodKey = (typeof PAYMENT_METHODS)[number]
const isPaymentMethod = (method: string): method is PaymentMethodKey => (PAYMENT_METHODS as readonly string[]).includes(method)

/** Renders a VietQR/PayOS payload as an image. */
function QrImage({ payload }: { payload: string }) {
  const t = useTranslations('dash.money.payments')
  const [src, setSrc] = React.useState('')
  React.useEffect(() => {
    QRCode.toDataURL(payload, { margin: 1, width: 220 }).then(setSrc).catch(() => setSrc(''))
  }, [payload])
  // eslint-disable-next-line @next/next/no-img-element -- data: URL rendered in the browser
  return src ? <img src={src} alt={t('qrAlt')} className="w-48 h-48 mx-auto" /> : null
}

const paymentMethodIcons: Record<string, any> = {
  BANK_TRANSFER: Building,
  QR_VIETQR: QrCode,
  CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  E_WALLET: Smartphone,
  CASH: Banknote,
}

type PaymentStatusKey = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'CANCELLED' | 'PROCESSING' | 'PARTIAL'
/** Shown, not stored: a PROCESSING payment the cancel route gave part of back. */
type DisplayStatusKey = PaymentStatusKey | 'PARTIALLY_REFUNDED'

const paymentStatusConfig: Record<DisplayStatusKey, { color: string; bgColor: string; borderColor: string; icon: any }> = {
  PENDING: { color: 'text-warn', bgColor: 'bg-warn-soft', borderColor: 'border-warn/30', icon: Clock },
  PAID: { color: 'text-ok', bgColor: 'bg-ok-soft', borderColor: 'border-ok/30', icon: CheckCircle },
  FAILED: { color: 'text-err', bgColor: 'bg-err-soft', borderColor: 'border-err/30', icon: XCircle },
  EXPIRED: { color: 'text-plain', bgColor: 'bg-plain-soft', borderColor: 'border-line', icon: AlertCircle },
  REFUNDED: { color: 'text-refund', bgColor: 'bg-refund-soft', borderColor: 'border-refund/30', icon: RefreshCw },
  // Every PaymentStatus needs an entry: rows render config[status].icon.
  CANCELLED: { color: 'text-plain', bgColor: 'bg-plain-soft', borderColor: 'border-line', icon: XCircle },
  PROCESSING: { color: 'text-info', bgColor: 'bg-info-soft', borderColor: 'border-info/30', icon: Clock },
  PARTIAL: { color: 'text-info', bgColor: 'bg-info-soft', borderColor: 'border-info/30', icon: Clock },
  PARTIALLY_REFUNDED: { color: 'text-refund', bgColor: 'bg-refund-soft', borderColor: 'border-refund/30', icon: RefreshCw },
}
/** The statuses the filter offers (stored ones). */
const PAYMENT_STATUSES: PaymentStatusKey[] = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED', 'PROCESSING', 'PARTIAL']
/** What was given back of a payment, 0 if nothing. */
const refundedOf = (p: Payment) => (typeof p.metadata?.refundedAmount === 'number' ? p.metadata.refundedAmount : 0)
/** A status this page knows, else PENDING (as the rows did before). */
const statusKey = (p: Payment): DisplayStatusKey =>
  p.status === 'PROCESSING' && refundedOf(p) > 0
    ? 'PARTIALLY_REFUNDED'
    : p.status in paymentStatusConfig
      ? (p.status as PaymentStatusKey)
      : 'PENDING'

type PaymentStats = {
  total: number
  count: number
  pending: number
  paid: number
  failed: number
  pendingCount: number
  paidCount: number
  failedCount: number
}

export default function PaymentsPage() {
  const t = useTranslations('dash.money.payments')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const { id: routePropertyId } = useParams<{ slug: string; id: string }>()
  // Payments are worked by staff (menu: src/components/layout/nav.ts); the
  // money totals are for the owner and managers only.
  const allowed = useHasRole(['ADMIN', 'MANAGER', 'RECEPTIONIST'])
  const seesTotals = useHasRole(MONEY_MANAGERS)
  const methodOptions = PAYMENT_METHODS.map((value) => ({ value, label: t(`methodOptions.${value}`) }))
  // Offered first when the property has connected its PayOS account (Part 5).
  const payosOption = { value: 'PAYOS', label: t('methodOptions.PAYOS') }
  const [payments, setPayments] = React.useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = React.useState<Payment[]>([])
  const [properties, setProperties] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedPayment, setSelectedPayment] = React.useState<Payment | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  
  // Filters
  const [selectedProperty, setSelectedProperty] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [methodFilter, setMethodFilter] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  // Filters and search run on the server (GET /api/payments), one page at a time.
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 })
  
  // Create payment form
  const [createForm, setCreateForm] = React.useState({
    bookingId: '',
    method: 'QR_VIETQR',
    amount: '',
  })
  const [createError, setCreateError] = React.useState('')
  const [createSuccess, setCreateSuccess] = React.useState('')
  const [payosConnected, setPayosConnected] = React.useState(false)
  const [payosBusy, setPayosBusy] = React.useState(false)

  // Stats: null when the API gives none (not a manager)
  const [stats, setStats] = React.useState<PaymentStats | null>(null)

  React.useEffect(() => {
    if (allowed) fetchProperties()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // A new filter starts again from the first page.
  React.useEffect(() => {
    setPage(1)
  }, [selectedProperty, statusFilter, methodFilter, debouncedQuery, dateFrom, dateTo])

  React.useEffect(() => {
    if (selectedProperty) fetchPayments(selectedProperty)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, statusFilter, methodFilter, debouncedQuery, dateFrom, dateTo, page])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setProperties(data.data)
        // This page's hotel, not the first one of every workspace.
        const own = data.data.find((p: Property) => p.id === routePropertyId)
        setSelectedProperty((own ?? data.data[0]).id)
      } else {
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
      setIsLoading(false)
    }
  }

  const fetchPayments = async (propertyId: string, { syncPayos = true } = {}): Promise<Payment[]> => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ propertyId, page: String(page), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      if (methodFilter) params.set('method', methodFilter)
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (dateFrom) params.set('startDate', dateFrom)
      if (dateTo) params.set('endDate', dateTo)
      const res = await fetch(`/api/payments?${params}`)
      const data = await res.json()
      if (data.success) {
        setPayments(data.data)
        setFilteredPayments(data.data)
        setPagination(data.pagination)
        setStats(data.stats)
        if (syncPayos) syncPendingPayos(propertyId, data.data)
        return data.data
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err)
    } finally {
      setIsLoading(false)
    }
    return []
  }

  // A missed webhook must not leave a paid link pending: ask PayOS about
  // recent pending links (a few, one at a time), then reload if any changed.
  const syncPendingPayos = async (propertyId: string, list: Payment[]) => {
    const recent = Date.now() - 48 * 60 * 60 * 1000
    const pending = list
      .filter((p) => p.paymentGateway === 'PAYOS' && p.status === 'PENDING' && new Date(p.createdAt).getTime() > recent)
      .slice(0, 10)
    let changed = false
    for (const p of pending) {
      const res = await fetch(`/api/payments/${p.id}/sync`, { method: 'POST' }).catch(() => null)
      const data = await res?.json().catch(() => null)
      if (data?.success && data.data.status !== 'PENDING') changed = true
    }
    if (changed) fetchPayments(propertyId, { syncPayos: false })
  }

  const fetchPayosStatus = async (propertyId: string) => {
    const res = await fetch(`/api/properties/${propertyId}/payos`).catch(() => null)
    const data = await res?.json().catch(() => null)
    const connected = Boolean(data?.success && data.data.connected)
    setPayosConnected(connected)
    return connected
  }

  const handlePayosAction = async (paymentId: string, action: 'sync' | 'cancel') => {
    if (action === 'cancel' && !confirm(t('confirm.cancelLink'))) return
    setPayosBusy(true)
    try {
      const res = await fetch(`/api/payments/${paymentId}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        toast.error(apiError(data.error) || t('errors.generic'))
        return
      }
      if (action === 'sync' && data.data.status === 'PENDING') toast.info(t('payosNotPaid'))
      const list = await fetchPayments(selectedProperty, { syncPayos: false })
      setSelectedPayment(list.find((p) => p.id === paymentId) ?? null)
    } finally {
      setPayosBusy(false)
    }
  }


  const formatPrice = labels.money
  const methodLabel = (p: Payment) =>
    p.paymentGateway === 'PAYOS' ? 'PayOS' : isPaymentMethod(p.method) ? t(`methods.${p.method}`) : p.method
  const methodIcon = (p: Payment) =>
    p.paymentGateway === 'PAYOS' ? QrCode : (paymentMethodIcons[p.method] ?? CreditCard)

  // "Xuất Excel": every transaction the filters select (all pages), as a CSV Excel opens (UTF-8 BOM).
  const [exporting, setExporting] = React.useState(false)
  const exportCsv = async () => {
    if (!selectedProperty) return
    setExporting(true)
    try {
      const rows: Payment[] = []
      for (let p = 1; p <= 50; p++) {
        const params = new URLSearchParams({ propertyId: selectedProperty, page: String(p), limit: String(MAX_PAGE_SIZE) })
        if (statusFilter) params.set('status', statusFilter)
        if (methodFilter) params.set('method', methodFilter)
        if (debouncedQuery) params.set('q', debouncedQuery)
        if (dateFrom) params.set('startDate', dateFrom)
        if (dateTo) params.set('endDate', dateTo)
        const res = await fetch(`/api/payments?${params}`, { cache: 'no-store' }).catch(() => null)
        const data = await res?.json().catch(() => null)
        if (!res?.ok || !data?.success) {
          toast.error(apiError(data?.error) || t('export.error'))
          return
        }
        rows.push(...data.data)
        if (p >= data.pagination.totalPages) break
      }
      const csv = toCsv([
        [t('export.time'), t('export.booking'), t('export.guest'), t('export.method'), t('export.status'), t('export.amount'), t('export.fee'), t('export.net'), t('export.content')],
        ...rows.map((r) => [
          vnDateTime(r.paidAt ?? r.createdAt),
          r.booking?.bookingCode,
          r.booking?.guestName,
          methodLabel(r),
          t(`status.${statusKey(r)}`),
          r.amount,
          r.fee,
          r.netAmount,
          r.transferContent,
        ]),
      ])
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${t('export.file')}_${vnDateTime(new Date().toISOString()).slice(0, 10).split('/').reverse().join('-')}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } finally {
      setExporting(false)
    }
  }

  const handleRefresh = () => {
    if (selectedProperty) {
      fetchPayments(selectedProperty)
    }
  }

  const handlePropertyChange = (propertyId: string) => {
    setSelectedProperty(propertyId)
  }

  const handleOpenCreateModal = async () => {
    const connected = selectedProperty ? await fetchPayosStatus(selectedProperty) : false
    setCreateForm({ bookingId: '', method: connected ? 'PAYOS' : 'QR_VIETQR', amount: '' })
    setCreateError('')
    setCreateSuccess('')
    setIsCreating(true)
  }

  const handleCreatePayment = async () => {
    if (!createForm.bookingId) {
      setCreateError(t('createModal.bookingRequired'))
      return
    }
    if (!createForm.amount || parseFloat(createForm.amount) <= 0) {
      setCreateError(t('createModal.amountInvalid'))
      return
    }

    setCreateError('')
    setCreateSuccess('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: createForm.bookingId,
          method: createForm.method,
          amount: parseFloat(createForm.amount),
        }),
      })
      const data = await res.json()

      if (data.success && createForm.method === 'PAYOS') {
        // Straight to the QR and link to give the guest.
        setIsCreating(false)
        const list = await fetchPayments(selectedProperty, { syncPayos: false })
        setSelectedPayment(list.find((p) => p.id === data.data.id) ?? null)
      } else if (data.success) {
        setCreateSuccess(t('createModal.success'))
        setTimeout(() => {
          setIsCreating(false)
          if (selectedProperty) {
            fetchPayments(selectedProperty)
          }
        }, 1500)
      } else {
        setCreateError(apiError(data.error) || t('errors.generic'))
      }
    } catch (err) {
      setCreateError(t('errors.retry'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment)
  }

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleConfirmPayment = async (paymentId: string) => {
    if (!confirm(t('confirm.markPaid'))) {
      return
    }
    try {
      const res = await fetch(`/api/payments/${paymentId}/confirm`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        if (data.warning) {
          toast.warning(apiError(data.warning) || data.warning)
        }
        if (selectedProperty) {
          fetchPayments(selectedProperty)
        }
        setSelectedPayment(null)
      } else {
        toast.error(apiError(data.error) || t('errors.generic'))
      }
    } catch (err) {
      toast.error(t('errors.generic'))
    }
  }

  if (!allowed) return <NoAccess title={t('header.title')} />

  return (
    <div>
      <PageContainer>
        <Header
          title={t('header.title')}
          description={t('header.description')}
          actions={
            <div className="flex items-center gap-2 shrink-0">
              <Select
                value={selectedProperty}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="w-44 text-sm shrink-0"
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
              />
              <Button aria-label={tc('actions.refresh')} size="sm" variant="secondary" onClick={handleRefresh} className="gap-1.5 shrink-0">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{tc('actions.refresh')}</span>
              </Button>
              <Button aria-label={t('header.create')} size="sm" onClick={handleOpenCreateModal} className="gap-1.5 shrink-0">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{t('header.create')}</span>
              </Button>
            </div>
          }
        />

        {/* Money totals: owner and managers only (the API sends none to others) */}
        {seesTotals && stats && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            <StatCard label={t('stats.total')} amount={formatPrice(stats.total)} count={t('stats.transactions', { count: stats.count })} icon={TrendingUp} />
            <StatCard tone="ok" label={t('stats.paid')} amount={formatPrice(stats.paid)} count={t('stats.transactions', { count: stats.paidCount })} icon={CheckCircle} countIcon={ArrowUpRight} />
            <StatCard tone="warn" label={t('stats.pending')} amount={formatPrice(stats.pending)} count={t('stats.transactions', { count: stats.pendingCount })} icon={Clock} countIcon={Wallet} />
            <StatCard tone="err" label={t('stats.failed')} amount={formatPrice(stats.failed)} count={t('stats.transactions', { count: stats.failedCount })} icon={XCircle} countIcon={AlertTriangle} />
          </div>
        )}

        {/* Filters - CRM Style */}
        <div className="bg-panel rounded-xl p-4 shadow-sm border border-line mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-fg/5 flex items-center justify-center">
                <Filter className="w-3.5 h-3.5 text-muted" />
              </div>
              <span className="text-sm font-semibold text-fg">{t('filters.title')}</span>
            </div>
            {(searchQuery || statusFilter || methodFilter || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('')
                  setMethodFilter('')
                  setDateFrom('')
                  setDateTo('')
                }}
                className="text-xs text-muted hover:text-err font-medium flex items-center gap-1"
              >
                <XCircle className="w-3 h-3" />
                {t('filters.clear')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="col-span-2 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                aria-label={t('filters.search')}
                placeholder={t('filters.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition"
              />
            </div>
            <select
              aria-label={t('filters.status')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition appearance-none cursor-pointer"
            >
              <option value="">{t('filters.status')}</option>
              {PAYMENT_STATUSES.map((key) => (
                <option key={key} value={key}>{t(`status.${key}`)}</option>
              ))}
            </select>
            <select
              aria-label={t('filters.method')}
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition appearance-none cursor-pointer"
            >
              <option value="">{t('filters.method')}</option>
              {methodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="date"
              aria-label={t('filters.from')}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition"
            />
            <input
              type="date"
              aria-label={t('filters.to')}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition"
            />
          </div>
        </div>

        {/* Payments List - CRM Table */}
        <div className="bg-panel rounded-xl shadow-sm border border-line overflow-hidden">
          {/* Table Header */}
          <div className="px-4 py-3 bg-fg/[0.03] border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-acc-soft flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-acc" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-fg">{t('list.title')}</h3>
                <p className="text-xs text-muted">{t('stats.transactions', { count: pagination.total })}</p>
              </div>
            </div>
            <Button
              aria-label={tc('actions.export')}
              size="sm"
              variant="ghost"
              className="gap-2 text-muted hover:text-fg"
              onClick={exportCsv}
              isLoading={exporting}
              disabled={pagination.total === 0}
            >
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">{tc('actions.export')}</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="p-10 text-center">
              <div className="w-10 h-10 border-4 border-acc/20 border-t-acc rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted">{t('list.loading')}</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-fg/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-muted" />
              </div>
              <h3 className="text-base font-semibold text-fg mb-1">{t('list.empty')}</h3>
              <p className="text-sm text-muted mb-4">{t('list.emptyHint')}</p>
              <Button onClick={handleOpenCreateModal} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('header.create')}
              </Button>
            </div>
          ) : (
            <>
              {/* Phone: one block per payment, amount and status always in view */}
              <ul className="md:hidden divide-y divide-line">
                {filteredPayments.map((payment) => {
                  const status = statusKey(payment)
                  const statusInfo = paymentStatusConfig[status]
                  const StatusIcon = statusInfo.icon
                  return (
                    <li key={payment.id}>
                      <button
                        type="button"
                        onClick={() => handleViewPayment(payment)}
                        className="w-full text-left px-4 py-3 hover:bg-fg/5 focus:outline-none focus-visible:bg-fg/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-fg">{payment.booking?.bookingCode}</p>
                            <p className="text-sm text-muted truncate">{payment.booking?.guestName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-fg whitespace-nowrap">{formatPrice(payment.amount)}</p>
                            {refundedOf(payment) > 0 && (
                              <p className="text-xs text-refund whitespace-nowrap">{t('list.refunded', { amount: formatPrice(refundedOf(payment)) })}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-3">
                          <span className="text-xs text-muted truncate">
                            {methodLabel(payment)} · {format(new Date(payment.createdAt), 'dd/MM/yyyy')}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.bgColor} ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {t(`status.${status}`)}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {/* Tablet and up; the payment code, method and date get their own columns from xl */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-fg/[0.03] border-b border-line">
                      <th className="hidden xl:table-cell px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('columns.code')}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('columns.booking')}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('columns.guest')}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('columns.amount')}</th>
                      <th className="hidden xl:table-cell px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('columns.method')}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('columns.status')}</th>
                      <th className="hidden xl:table-cell px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('columns.date')}</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted uppercase tracking-wider">{t('columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredPayments.map((payment, index) => {
                      const status = statusKey(payment)
                      const statusInfo = paymentStatusConfig[status]
                      const MethodIcon = methodIcon(payment)
                      const StatusIcon = statusInfo.icon
                      const date = format(new Date(payment.createdAt), 'dd/MM/yyyy')

                      return (
                        <tr key={payment.id} className={`hover:bg-fg/5 transition-colors ${index % 2 === 0 ? 'bg-panel' : 'bg-fg/[0.03]'}`}>
                          <td className="hidden xl:table-cell px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-medium text-fg bg-fg/5 px-2 py-1 rounded-lg">
                                {payment.id.slice(-8).toUpperCase()}
                              </span>
                              <button
                                onClick={() => handleCopyToClipboard(payment.id, payment.id)}
                                className="p-1 hover:bg-fg/10 rounded transition"
                                title={t('list.copy')}
                                aria-label={t('list.copy')}
                              >
                                {copiedId === payment.id ? (
                                  <Check className="w-3 h-3 text-ok" />
                                ) : (
                                  <Copy className="w-3 h-3 text-muted" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-medium text-fg whitespace-nowrap">{payment.booking?.bookingCode}</span>
                            <span className="xl:hidden block text-xs text-muted whitespace-nowrap">{date}</span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 shrink-0 rounded-full bg-acc-soft text-acc font-semibold text-xs flex items-center justify-center">
                                {payment.booking?.guestName?.charAt(0)?.toUpperCase() || 'G'}
                              </div>
                              <span className="text-sm text-fg truncate max-w-[11rem] xl:max-w-[14rem]" title={payment.booking?.guestName}>
                                {payment.booking?.guestName}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-semibold text-fg whitespace-nowrap">{formatPrice(payment.amount)}</span>
                            {refundedOf(payment) > 0 && (
                              <span className="block text-xs text-refund whitespace-nowrap">{t('list.refunded', { amount: formatPrice(refundedOf(payment)) })}</span>
                            )}
                            {payment.fee > 0 && (
                              <span className="block text-xs text-muted whitespace-nowrap">{t('list.fee', { amount: formatPrice(payment.fee) })}</span>
                            )}
                            <span className="xl:hidden block text-xs text-muted whitespace-nowrap">{methodLabel(payment)}</span>
                          </td>
                          <td className="hidden xl:table-cell px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 shrink-0 rounded bg-fg/5 flex items-center justify-center">
                                <MethodIcon className="w-3 h-3 text-muted" />
                              </div>
                              <span className="text-xs text-muted whitespace-nowrap">{methodLabel(payment)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.bgColor} ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {t(`status.${status}`)}
                            </span>
                          </td>
                          <td className="hidden xl:table-cell px-3 py-3">
                            <span className="text-sm text-muted whitespace-nowrap">{date}</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Button aria-label={tc('actions.details')} size="sm" variant="ghost" onClick={() => handleViewPayment(payment)} className="gap-1.5 text-muted hover:text-acc">
                              <Eye className="w-4 h-4" />
                              <span className="hidden xl:inline">{tc('actions.details')}</span>
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
              <span>
                {t('pagination.page', { page: pagination.page, totalPages: pagination.totalPages })}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1 || isLoading} onClick={() => setPage(page - 1)}>
                  {t('pagination.prev')}
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages || isLoading} onClick={() => setPage(page + 1)}>
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageContainer>

      {/* Create Payment Modal */}
      <Modal showHeader
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title={t('createModal.title')}
        size="md"
      >
        {createSuccess ? (
          <div className="text-center py-8 px-6">
            <div className="w-16 h-16 bg-ok-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-ok" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">{createSuccess}</h3>
            <p className="text-muted">{t('createModal.redirecting')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-5 p-6 overflow-y-auto">
              <BookingPicker
                propertyId={selectedProperty}
                label={t('createModal.booking')}
                required
                forPayment
                value={createForm.bookingId}
                onChange={(booking) => {
                  // What is still owed is the usual amount; staff can change it.
                  const due = booking ? bookingBalance(booking) : 0
                  setCreateForm({ ...createForm, bookingId: booking?.id ?? '', amount: due > 0 ? String(due) : '' })
                }}
              />

              <Select
                label={t('createModal.method')}
                required
                value={createForm.method}
                onChange={(e) => setCreateForm({ ...createForm, method: e.target.value })}
                options={payosConnected ? [payosOption, ...methodOptions] : methodOptions}
              />
              {createForm.method === 'PAYOS' && (
                <p className="text-xs text-muted -mt-2">
                  {t('createModal.payosHint')}
                </p>
              )}

              <Input
                label={t('createModal.amount')}
                required
                type="number"
                min="0"
                step="1000"
                value={createForm.amount}
                onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                placeholder={t('createModal.amountPlaceholder')}
              />

              {createError && (
                <div className="p-3 bg-err-soft border border-err/30 rounded-xl text-err text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {createError}
                </div>
              )}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setIsCreating(false)}>
                {t('createModal.cancel')}
              </Button>
              <Button onClick={handleCreatePayment} isLoading={isSubmitting} disabled={isSubmitting} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('createModal.submit')}
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* View Payment Modal */}
      <Modal showHeader
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title={t('detail.title')}
        size="lg"
      >
        {selectedPayment && (
          <>
            <div className="space-y-6 p-6 overflow-y-auto">
              {/* Payment Header */}
              <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-2xl border border-line">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-lg font-bold bg-ink text-on-ink px-3 py-1.5 rounded-lg">
                      {selectedPayment.id.slice(-8).toUpperCase()}
                    </span>
                    <button
                      onClick={() => handleCopyToClipboard(selectedPayment.id, selectedPayment.id)}
                      className="p-2 hover:bg-fg/10 rounded-lg transition"
                    >
                      {copiedId === selectedPayment.id ? (
                        <Check className="w-4 h-4 text-ok" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-muted">
                    {t('detail.createdAt', { date: format(new Date(selectedPayment.createdAt), 'dd/MM/yyyy HH:mm') })}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border ${paymentStatusConfig[statusKey(selectedPayment)].bgColor} ${paymentStatusConfig[statusKey(selectedPayment)].color} ${paymentStatusConfig[statusKey(selectedPayment)].borderColor}`}>
                  {React.createElement(paymentStatusConfig[statusKey(selectedPayment)].icon, { className: 'w-4 h-4' })}
                  {t(`status.${statusKey(selectedPayment)}`)}
                </span>
              </div>

              {/* Amount */}
              <div className="bg-acc-soft rounded-2xl p-6 text-center border border-acc/30">
                <p className="text-sm text-acc mb-2 font-medium">{t('detail.amount')}</p>
                <p className="text-4xl font-bold text-acc">{formatPrice(selectedPayment.amount)}</p>
                {selectedPayment.fee > 0 && (
                  <p className="text-sm text-acc mt-3 flex items-center justify-center gap-4">
                    <span>{t('detail.fee', { amount: formatPrice(selectedPayment.fee) })}</span>
                    <span className="text-acc/60">•</span>
                    <span className="font-semibold">{t('detail.net', { amount: formatPrice(selectedPayment.netAmount) })}</span>
                  </p>
                )}
              </div>

              {/* Payment Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-fg/[0.03] rounded-xl border border-line">
                  <div className="flex items-center gap-2 mb-2">
                    {React.createElement(paymentMethodIcons[selectedPayment.method] || CreditCard, { className: 'w-4 h-4 text-acc' })}
                    <span className="text-xs font-semibold text-muted uppercase">{t('detail.method')}</span>
                  </div>
                  <p className="font-semibold text-fg">
                    {selectedPayment.paymentGateway === 'PAYOS'
                      ? 'PayOS'
                      : isPaymentMethod(selectedPayment.method) && t(`methods.${selectedPayment.method}`)}
                  </p>
                </div>
                <div className="p-4 bg-fg/[0.03] rounded-xl border border-line">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-acc" />
                    <span className="text-xs font-semibold text-muted uppercase">{t('detail.booking')}</span>
                  </div>
                  <p className="font-semibold text-fg">{selectedPayment.booking?.bookingCode}</p>
                </div>
                <div className="p-4 bg-fg/[0.03] rounded-xl border border-line">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-4 h-4 text-acc" />
                    <span className="text-xs font-semibold text-muted uppercase">{t('detail.property')}</span>
                  </div>
                  <p className="font-semibold text-fg">{selectedPayment.booking?.property?.name}</p>
                </div>
                <div className="p-4 bg-fg/[0.03] rounded-xl border border-line">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-acc" />
                    <span className="text-xs font-semibold text-muted uppercase">{t('detail.guest')}</span>
                  </div>
                  <p className="font-semibold text-fg">{selectedPayment.booking?.guestName}</p>
                </div>
              </div>

              {/* PayOS: what staff need to know and to send */}
              {selectedPayment.metadata?.payos?.amountMismatch != null && (
                <div className="p-3 rounded-xl bg-err-soft border border-err/30 text-sm text-err">
                  {t('detail.payosMismatch', { amount: formatPrice(selectedPayment.metadata.payos.amountMismatch) })}
                </div>
              )}
              {selectedPayment.metadata?.payos?.paidAfter && (
                <div className="p-3 rounded-xl bg-warn-soft border border-warn/30 text-sm text-warn">
                  {t('detail.paidAfter')}
                </div>
              )}
              {selectedPayment.paymentGateway === 'PAYOS' && selectedPayment.checkoutUrl && selectedPayment.status === 'PENDING' && (
                <div className="p-4 rounded-2xl border border-line space-y-2">
                  <p className="text-sm text-muted">
                    {t('detail.sendLink')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-xs bg-fg/5 px-2 py-1.5 rounded">{selectedPayment.checkoutUrl}</code>
                    <button
                      onClick={() => handleCopyToClipboard(selectedPayment.checkoutUrl!, 'checkoutUrl')}
                      className="p-1.5 hover:bg-fg/10 rounded-lg transition"
                      aria-label={t('detail.copyLink')}
                    >
                      {copiedId === 'checkoutUrl' ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4 text-muted" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Bank Transfer Info */}
              {selectedPayment.paymentGateway !== 'PAYOS' && (selectedPayment.method === 'BANK_TRANSFER' || selectedPayment.method === 'QR_VIETQR') && (
                <div className="border border-line rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-fg/[0.03] border-b border-line">
                    <h4 className="font-semibold text-fg flex items-center gap-2">
                      <Building className="w-4 h-4 text-acc" />
                      {t('detail.transferInfo')}
                    </h4>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-line">
                      <span className="text-muted">{t('detail.bank')}</span>
                      <span className="font-semibold text-fg text-right">{selectedPayment.bankCode ? bankLabel(selectedPayment.bankCode) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-line">
                      <span className="text-muted">{t('detail.accountNumber')}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-fg">{selectedPayment.bankAccount || 'N/A'}</span>
                        {selectedPayment.bankAccount && (
                          <button
                            onClick={() => handleCopyToClipboard(selectedPayment.bankAccount!, 'bankAccount')}
                            className="p-1 hover:bg-fg/10 rounded transition"
                          >
                            {copiedId === 'bankAccount' ? (
                              <Check className="w-4 h-4 text-ok" />
                            ) : (
                              <Copy className="w-4 h-4 text-muted" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-line">
                      <span className="text-muted">{t('detail.accountName')}</span>
                      <span className="font-semibold text-fg text-right">{selectedPayment.accountHolder ? toBankName(selectedPayment.accountHolder) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-acc-soft -mx-4 -mb-4 px-4 mt-2">
                      <span className="text-acc font-medium">{t('detail.transferContent')}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-acc text-lg">{selectedPayment.transferContent || 'N/A'}</span>
                        {selectedPayment.transferContent && (
                          <button
                            onClick={() => handleCopyToClipboard(selectedPayment.transferContent!, 'transferContent')}
                            className="p-1.5 hover:bg-acc/10 rounded-lg transition"
                          >
                            {copiedId === 'transferContent' ? (
                              <Check className="w-4 h-4 text-ok" />
                            ) : (
                              <Copy className="w-4 h-4 text-acc" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* QR Code Area */}
              {selectedPayment.method === 'QR_VIETQR' && selectedPayment.status === 'PENDING' && (
                <div className="border border-line rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-fg/[0.03] border-b border-line">
                    <h4 className="font-semibold text-fg flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-acc" />
                      {t('detail.scanQr')}
                    </h4>
                  </div>
                  <div className="p-6 text-center bg-fg/[0.03]">
                    {/* Light on purpose: a QR code needs a white quiet zone to scan, in either theme. */}
                    <div data-theme="light" className="w-52 h-52 mx-auto bg-panel rounded-2xl flex items-center justify-center mb-4 border border-line">
                      {selectedPayment.qrCodeUrl ? (
                        <QrImage payload={selectedPayment.qrCodeUrl} />
                      ) : (
                        <QrCode className="w-36 h-36 text-muted" />
                      )}
                    </div>
                    {selectedPayment.expiresAt && (
                      <p className="text-sm text-warn flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        {t('detail.expires', { date: format(new Date(selectedPayment.expiresAt), 'dd/MM/yyyy HH:mm') })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Given back when the booking was cancelled */}
              {refundedOf(selectedPayment) > 0 && (
                <div className="p-3 rounded-xl bg-refund-soft border border-refund/30 text-sm text-refund">
                  {selectedPayment.metadata?.refundedAt
                    ? t('detail.refundedAt', {
                        amount: formatPrice(refundedOf(selectedPayment)),
                        date: labels.dateTime(selectedPayment.metadata.refundedAt),
                      })
                    : t('detail.refunded', { amount: formatPrice(refundedOf(selectedPayment)) })}
                </div>
              )}

              {/* Paid Info */}
              {selectedPayment.paidAt && (
                <div className="bg-ok-soft rounded-2xl p-5 text-center border border-ok/30">
                  <CheckCircle className="w-10 h-10 text-ok mx-auto mb-3" />
                  <p className="text-ok font-semibold text-lg">
                    {t('detail.paid')}
                  </p>
                  <p className="text-ok text-sm mt-1">
                    {t('detail.paidAt', {
                      time: format(new Date(selectedPayment.paidAt), 'HH:mm'),
                      date: format(new Date(selectedPayment.paidAt), 'dd/MM/yyyy'),
                    })}
                  </p>
                </div>
              )}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setSelectedPayment(null)} className="gap-2">
                {tc('actions.close')}
              </Button>
              {selectedPayment.paymentGateway === 'PAYOS' && selectedPayment.status === 'PENDING' && (
                <>
                  <Button variant="secondary" onClick={() => handlePayosAction(selectedPayment.id, 'cancel')} isLoading={payosBusy}>
                    {t('detail.cancelLink')}
                  </Button>
                  <Button variant="secondary" onClick={() => handlePayosAction(selectedPayment.id, 'sync')} isLoading={payosBusy} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    {t('detail.checkNow')}
                  </Button>
                </>
              )}
              {selectedPayment.status === 'PENDING' && (
                <Button onClick={() => handleConfirmPayment(selectedPayment.id)} className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {t('detail.markPaid')}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  )
}

const STAT_TONES = {
  ok: { border: 'border-ok/30', chip: 'bg-ok-soft', text: 'text-ok' },
  warn: { border: 'border-warn/30', chip: 'bg-warn-soft', text: 'text-warn' },
  err: { border: 'border-err/30', chip: 'bg-err-soft', text: 'text-err' },
} as const

/** One money card; on a phone the icon gives its room to the amount, which never gets cut. */
function StatCard({
  tone,
  label,
  amount,
  count,
  icon: Icon,
  countIcon: CountIcon,
}: {
  tone?: keyof typeof STAT_TONES
  label: string
  amount: string
  count: string
  icon: React.ComponentType<{ className?: string }>
  countIcon?: React.ComponentType<{ className?: string }>
}) {
  const c = tone ? STAT_TONES[tone] : { border: 'border-line', chip: 'bg-fg/5', text: 'text-fg' }
  const small = tone ? c.text : 'text-muted'
  return (
    <div className={`bg-panel rounded-xl p-3 sm:p-4 shadow-sm border ${c.border}`}>
      <div className="flex items-center gap-3">
        <div className={`hidden sm:flex w-10 h-10 rounded-xl ${c.chip} items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium leading-tight ${small}`}>{label}</p>
          <p className={`text-base sm:text-lg font-bold whitespace-nowrap ${c.text}`}>{amount}</p>
        </div>
      </div>
      <p className={`text-xs mt-2 flex items-center gap-1 ${small}`}>
        {CountIcon && <CountIcon className="w-3 h-3" />}
        {count}
      </p>
    </div>
  )
}
