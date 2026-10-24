'use client'

import * as React from 'react'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Textarea, Select, Modal, ModalFooter } from '@/components/ui'
import { 
  Search, FileText, Plus, Eye, Download, RefreshCw,
  Clock, CheckCircle, XCircle, AlertCircle, Send, Printer,
  Building, Copy, Check, Mail, Edit, Trash2, ArrowUpDown
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'
import { EinvoiceCard, type EinvoiceStatus } from './einvoice-card'
import {
  EMPTY_INVOICE_FORM,
  InvoiceFormFields,
  invoiceFormBody,
  validateInvoiceForm,
  type InvoiceFormValue,
} from './invoice-form'
import { apiError } from '@/lib/i18n/api-errors'

interface Invoice {
  id: string
  invoiceNumber: string
  bookingId: string
  propertyId: string
  status: string
  companyName: string
  companyAddress: string
  taxCode: string
  companyEmail: string | null
  customerName: string
  customerEmail: string
  customerAddress: string | null
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  invoicePattern: string | null
  invoiceSeries: string | null
  fiscalCode: string | null
  eInvoiceProvider: string | null
  publishedAt: string | null
  xmlUrl: string | null
  pdfUrl: string | null
  buyerType: string
  lookupCode: string | null
  einvoiceNumber: string | null
  publishError: string | null
  cqtStatus: number | null
  cqtNote: string | null
  replacesInvoice: { id: string; invoiceNumber: string; einvoiceNumber: string | null; invoiceSeries: string | null } | null
  replacements: { id: string; invoiceNumber: string; einvoiceNumber: string | null; status: string }[]
  adjustsInvoice: { id: string; invoiceNumber: string; einvoiceNumber: string | null; invoiceSeries: string | null } | null
  adjustments: { id: string; invoiceNumber: string; einvoiceNumber: string | null; status: string; totalAmount: number }[]
  metadata: { adjustmentReason?: string } | null
  autoIssued: boolean
  emailStatus: string | null
  emailedAt: string | null
  emailError: string | null
  createdAt: string
  updatedAt: string
  booking: {
    id: string
    bookingCode: string
    guestName: string
    checkInDate: string
    checkOutDate: string
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

interface Booking {
  id: string
  bookingCode: string
  guestName: string
  guestEmail?: string | null
  totalAmount: number
}

type InvoiceStatusKey = 'DRAFT' | 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'CANCELLED' | 'REPLACED'

// Labels: messages dash.money.invoices.status.
const invoiceStatusConfig: Record<InvoiceStatusKey, { color: string; bgColor: string; icon: any }> = {
  DRAFT: { color: 'text-plain', bgColor: 'bg-plain-soft', icon: FileText },
  PENDING: { color: 'text-warn', bgColor: 'bg-warn-soft', icon: Clock },
  PUBLISHING: { color: 'text-info', bgColor: 'bg-info-soft', icon: Clock },
  PUBLISHED: { color: 'text-ok', bgColor: 'bg-ok-soft', icon: CheckCircle },
  CANCELLED: { color: 'text-plain', bgColor: 'bg-plain-soft', icon: XCircle },
  REPLACED: { color: 'text-info', bgColor: 'bg-info-soft', icon: AlertCircle },
}
const INVOICE_STATUSES = Object.keys(invoiceStatusConfig) as InvoiceStatusKey[]
/** A status this page knows, else DRAFT (as the rows did before). */
const statusKey = (status: string): InvoiceStatusKey =>
  status in invoiceStatusConfig ? (status as InvoiceStatusKey) : 'DRAFT'

/** Mắt Bão MaTTHDon codes with a label (src/lib/einvoice/cqt-labels.ts). */
const CQT_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
type CqtCode = (typeof CQT_CODES)[number]

export default function InvoicesPage() {
  const t = useTranslations('dash.money.invoices')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const cqtLabel = (code: number) =>
    (CQT_CODES as readonly string[]).includes(String(code))
      ? t(`cqt.${String(code) as CqtCode}`)
      : t('cqt.unknown', { code })
  const [invoices, setInvoices] = React.useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = React.useState<Invoice[]>([])
  const [properties, setProperties] = React.useState<Property[]>([])
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  
  // Filters
  const [selectedProperty, setSelectedProperty] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  // Filters and search run on the server (GET /api/invoices), one page at a time.
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 })
  
  // Create/Edit form
  const [formData, setFormData] = React.useState<InvoiceFormValue & { bookingId: string }>({
    bookingId: '',
    ...EMPTY_INVOICE_FORM,
  })
  // Separate from the dialogs' open flags: an error keeps the dialog open.
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [einvoice, setEinvoice] = React.useState<EinvoiceStatus | null>(null)
  const [formError, setFormError] = React.useState('')
  const [formSuccess, setFormSuccess] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  // Adjustment (src/lib/einvoice/adjustment.ts): the issued invoice being adjusted
  const [adjusting, setAdjusting] = React.useState<Invoice | null>(null)
  const [adjustForm, setAdjustForm] = React.useState({ direction: 'increase', amount: '', reason: '' })
  const [adjustError, setAdjustError] = React.useState('')

  // Stats
  const [stats, setStats] = React.useState({
    totalInvoices: 0,
    draftCount: 0,
    pendingCount: 0,
    publishedCount: 0,
    totalAmount: 0,
  })

  React.useEffect(() => {
    fetchProperties()
  }, [])

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // A new filter starts again from the first page.
  React.useEffect(() => {
    setPage(1)
  }, [selectedProperty, statusFilter, debouncedQuery, dateFrom, dateTo])

  React.useEffect(() => {
    if (selectedProperty) fetchInvoices(selectedProperty)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, statusFilter, debouncedQuery, dateFrom, dateTo, page])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setProperties(data.data)
        setSelectedProperty(data.data[0].id)
      } else {
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
      setIsLoading(false)
    }
  }

  const fetchInvoices = async (propertyId: string): Promise<Invoice[]> => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ propertyId, page: String(page), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (dateFrom) params.set('startDate', dateFrom)
      if (dateTo) params.set('endDate', dateTo)
      const res = await fetch(`/api/invoices?${params}`)
      const data = await res.json()
      if (data.success) {
        setInvoices(data.data)
        setFilteredInvoices(data.data)
        setPagination(data.pagination)
        setStats({
          totalInvoices: data.stats.total,
          draftCount: data.stats.draft,
          pendingCount: data.stats.pending,
          publishedCount: data.stats.published,
          totalAmount: data.stats.issuedAmount,
        })
        return data.data
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
    } finally {
      setIsLoading(false)
    }
    return []
  }

  const fetchBookings = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/bookings?propertyId=${propertyId}`)
      const data = await res.json()
      if (data.success) {
        setBookings(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err)
    }
  }

  const formatPrice = labels.money

  const handleRefresh = () => {
    if (selectedProperty) {
      fetchInvoices(selectedProperty)
    }
  }

  const handlePropertyChange = (propertyId: string) => {
    setSelectedProperty(propertyId)
  }

  const resetForm = () => {
    setFormData({ bookingId: '', ...EMPTY_INVOICE_FORM })
    setFormError('')
    setFormSuccess('')
    setEditingId(null)
  }

  const handleOpenCreateModal = () => {
    resetForm()
    if (selectedProperty) {
      fetchBookings(selectedProperty)
    }
    setIsCreating(true)
  }

  const handleOpenEditModal = (invoice: Invoice) => {
    setEditingId(invoice.id)
    setFormData({
      bookingId: invoice.bookingId,
      buyerType: (invoice.buyerType as InvoiceFormValue['buyerType']) || 'company',
      companyName: invoice.companyName,
      companyAddress: invoice.companyAddress,
      taxCode: invoice.taxCode,
      companyEmail: invoice.companyEmail || '',
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerAddress: invoice.customerAddress || '',
      totalAmount: invoice.totalAmount.toString(),
    })
    setFormError('')
    setFormSuccess('')
    setIsEditing(true)
  }

  const handleSelectBooking = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (booking) {
      // The booking total includes VAT: it is the invoice total.
      setFormData({
        ...formData,
        bookingId,
        totalAmount: booking.totalAmount.toString(),
        customerName: formData.customerName || booking.guestName,
        customerEmail: formData.customerEmail || booking.guestEmail || '',
      })
    }
  }

  const validateForm = () => {
    if (!formData.bookingId) return t('errors.bookingRequired')
    const error = validateInvoiceForm(formData)
    return error ? t(`form.errors.${error}`) : null
  }

  const handleCreateInvoice = async () => {
    const error = validateForm()
    if (error) {
      setFormError(error)
      return
    }

    setFormError('')
    setFormSuccess('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: formData.bookingId, ...invoiceFormBody(formData) }),
      })
      const data = await res.json()

      if (data.success) {
        setFormSuccess(t('createModal.success'))
        setTimeout(() => {
          setIsCreating(false)
          if (selectedProperty) {
            fetchInvoices(selectedProperty)
          }
        }, 1500)
      } else {
        setFormError(apiError(data.error) || t('errors.generic'))
      }
    } catch (err) {
      setFormError(t('errors.retry'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateInvoice = async () => {
    if (!editingId) return
    
    const error = validateForm()
    if (error) {
      setFormError(error)
      return
    }

    setFormError('')
    setFormSuccess('')
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/invoices/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceFormBody(formData)),
      })
      const data = await res.json()

      if (data.success) {
        setFormSuccess(t('editModal.success'))
        setTimeout(() => {
          setIsEditing(false)
          setEditingId(null)
          if (selectedProperty) {
            fetchInvoices(selectedProperty)
          }
        }, 1500)
      } else {
        setFormError(apiError(data.error) || t('errors.generic'))
      }
    } catch (err) {
      setFormError(t('errors.retry'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm(t('confirm.delete'))) return

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (data.success) {
        if (selectedProperty) {
          fetchInvoices(selectedProperty)
        }
        setSelectedInvoice(null)
      } else {
        alert(apiError(data.error) || t('errors.generic'))
      }
    } catch (err) {
      alert(t('errors.generic'))
    }
  }

  const handlePublishInvoice = async (invoiceId: string) => {
    const where = einvoice?.environment === 'PRODUCTION' ? t('confirm.envProduction') : t('confirm.envDemo')
    if (!confirm(t('confirm.publish', { env: where }))) {
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/publish`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        setSelectedInvoice((current) => (current && current.id === invoiceId ? { ...current, ...data.data } : current))
      } else {
        alert(apiError(data.error) || t('errors.generic'))
      }
    } catch (err) {
      alert(t('errors.generic'))
    } finally {
      setIsSubmitting(false)
      // Also shows the reason a failed attempt left on the invoice.
      if (selectedProperty) {
        const list = await fetchInvoices(selectedProperty)
        setSelectedInvoice((current) => (current ? list.find((i) => i.id === current.id) ?? current : current))
      }
    }
  }

  // An issued invoice with a mistake: a corrected copy that, once issued,
  // replaces it on Mắt Bão (src/lib/einvoice/replacement.ts).
  const handleReplaceInvoice = async (invoice: Invoice) => {
    if (
      !confirm(t('confirm.replace', { number: String(invoice.einvoiceNumber) }))
    ) {
      return
    }
    const res = await fetch(`/api/invoices/${invoice.id}/replace`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!data.success) {
      alert(apiError(data.error) || t('errors.generic'))
      return
    }
    setSelectedInvoice(null)
    if (selectedProperty) await fetchInvoices(selectedProperty)
    handleOpenEditModal({ ...data.data, booking: invoice.booking, replacesInvoice: null, replacements: [], adjustsInvoice: null, adjustments: [] })
  }

  const handleOpenAdjust = (invoice: Invoice) => {
    setAdjustForm({ direction: 'increase', amount: '', reason: '' })
    setAdjustError('')
    setSelectedInvoice(null)
    setAdjusting(invoice)
  }

  const handleSubmitAdjust = async () => {
    if (!adjusting) return
    const amount = Number(adjustForm.amount)
    if (!Number.isInteger(amount) || amount <= 0) return setAdjustError(t('errors.adjustAmount'))
    if (adjustForm.reason.trim().length < 5) return setAdjustError(t('errors.adjustReason'))
    setAdjustError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/invoices/${adjusting.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: adjustForm.direction, amount, reason: adjustForm.reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.success) {
        setAdjustError(apiError(data.error) || t('errors.generic'))
        return
      }
      setAdjusting(null)
      // Open the draft: the next step is publishing it.
      const list = selectedProperty ? await fetchInvoices(selectedProperty) : []
      setSelectedInvoice(list.find((i) => i.id === data.data.id) ?? null)
    } catch (err) {
      setAdjustError(t('errors.retry'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Emails the issued invoice (PDF attached) to the buyer again (src/lib/einvoice/delivery.ts).
  const handleEmailInvoice = async (invoice: Invoice) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/email`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!data.success) alert(apiError(data.error) || t('errors.emailFailed'))
      if (data.data) setSelectedInvoice((current) => (current && current.id === invoice.id ? { ...current, ...data.data } : current))
    } catch (err) {
      alert(t('errors.generic'))
    } finally {
      setIsSubmitting(false)
      if (selectedProperty) fetchInvoices(selectedProperty)
    }
  }

  const handleCancelInvoice = async (invoiceId: string) => {
    if (!confirm(t('confirm.cancel'))) return

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/cancel`, {
        method: 'POST',
      })
      const data = await res.json()

      if (data.success) {
        if (selectedProperty) {
          fetchInvoices(selectedProperty)
        }
      } else {
        alert(apiError(data.error) || t('errors.generic'))
      }
    } catch (err) {
      alert(t('errors.generic'))
    }
  }

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div>
      <PageContainer>
        <Header
          title={t('header.title')}
          description={t('header.description')}
          actions={
            <div className="grid grid-cols-2 gap-3 w-full [&>:first-child]:col-span-2 sm:flex sm:items-center sm:w-auto">
              <Select
                value={selectedProperty}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="sm:w-64"
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
              />
              <Button variant="secondary" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {tc('actions.refresh')}
              </Button>
              <Button onClick={handleOpenCreateModal}>
                <Plus className="w-4 h-4 mr-2" />
                {t('header.create')}
              </Button>
            </div>
          }
        />

        {selectedProperty && <EinvoiceCard key={selectedProperty} propertyId={selectedProperty} onStatus={setEinvoice} />}
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{t('stats.total')}</p>
                  <p className="text-2xl font-bold text-fg">{stats.totalInvoices}</p>
                </div>
                <div className="w-12 h-12 bg-info-soft rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{t('stats.draft')}</p>
                  <p className="text-2xl font-bold text-muted">{stats.draftCount}</p>
                </div>
                <div className="w-12 h-12 bg-fg/5 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{t('stats.pending')}</p>
                  <p className="text-2xl font-bold text-warn">{stats.pendingCount}</p>
                </div>
                <div className="w-12 h-12 bg-warn-soft rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warn" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{t('stats.published')}</p>
                  <p className="text-2xl font-bold text-ok">{stats.publishedCount}</p>
                </div>
                <div className="w-12 h-12 bg-ok-soft rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-ok" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{t('stats.publishedAmount')}</p>
                  <p className="text-xl font-bold text-fg">{formatPrice(stats.totalAmount)}</p>
                </div>
                <div className="w-12 h-12 bg-acc-soft rounded-full flex items-center justify-center">
                  <Building className="w-6 h-6 text-acc" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                placeholder={t('filters.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="md:col-span-2"
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: t('filters.allStatuses') },
                  ...INVOICE_STATUSES.map((key) => ({ value: key, label: t(`status.${key}`) })),
                ]}
              />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder={t('filters.from')}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder={t('filters.to')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoices List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-acc border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted">{tc('states.loading')}</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted mb-4" />
                <p className="text-muted">{t('list.empty')}</p>
                <Button onClick={handleOpenCreateModal} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('header.create')}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-fg/[0.03] border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">{t('columns.code')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">{t('columns.booking')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">{t('columns.company')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">{t('columns.taxCode')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">{t('columns.total')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">{t('columns.status')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">{t('columns.createdAt')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">{t('columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInvoices.map((invoice) => {
                      const status = statusKey(invoice.status)
                      const statusInfo = invoiceStatusConfig[status]
                      const StatusIcon = statusInfo.icon
                      
                      return (
                        <tr key={invoice.id} className="hover:bg-fg/[0.03]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">{invoice.invoiceNumber}</span>
                              {invoice.autoIssued && (
                                <Badge className="bg-info-soft text-info">
                                  {t('list.auto')}
                                </Badge>
                              )}
                              <button
                                onClick={() => handleCopyToClipboard(invoice.invoiceNumber, invoice.id)}
                                className="p-1 hover:bg-fg/5 rounded"
                              >
                                {copiedId === invoice.id ? (
                                  <Check className="w-3 h-3 text-ok" />
                                ) : (
                                  <Copy className="w-3 h-3 text-muted" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium">{invoice.booking?.bookingCode}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium">{invoice.companyName}</span>
                              <span className="block text-xs text-muted">{invoice.customerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm">{invoice.taxCode}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold">{formatPrice(invoice.totalAmount)}</span>
                            {invoice.adjustsInvoice && (
                              <span className="block text-xs text-info">
                                {t(invoice.totalAmount < 0 ? 'list.adjustsDown' : 'list.adjustsUp', {
                                  number: invoice.adjustsInvoice.einvoiceNumber ?? '',
                                })}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {t(`status.${status}`)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-muted">
                              {format(new Date(invoice.createdAt), 'dd/MM/yyyy')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button aria-label={tc('actions.details')} size="sm" variant="ghost" onClick={() => handleViewInvoice(invoice)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {(invoice.status === 'DRAFT' || invoice.status === 'PENDING') && (
                                <>
                                  {!invoice.adjustsInvoice && (
                                    <Button aria-label={tc('actions.edit')} size="sm" variant="ghost" onClick={() => handleOpenEditModal(invoice)}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button aria-label={tc('actions.delete')} size="sm" variant="ghost" onClick={() => handleDeleteInvoice(invoice.id)}>
                                    <Trash2 className="w-4 h-4 text-err" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted">
                <span>
                  {t('pagination.page', { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total })}
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
          </CardContent>
        </Card>
      </PageContainer>

      {/* Create Invoice Modal */}
      <Modal showHeader
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title={t('createModal.title')}
        description={t('createModal.description')}
        size="lg"
      >
        {formSuccess ? (
          <div className="text-center py-6 px-6">
            <div className="w-16 h-16 bg-ok-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-ok" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">{formSuccess}</h3>
            <p className="text-muted">{t('createModal.redirecting')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-6 overflow-y-auto">
              <Select
                label={t('createModal.booking')}
                required
                value={formData.bookingId}
                onChange={(e) => handleSelectBooking(e.target.value)}
                options={[
                  { value: '', label: t('createModal.chooseBooking') },
                  ...bookings.map((b) => ({ value: b.id, label: `${b.bookingCode} - ${b.guestName}` })),
                ]}
              />

              {!einvoice?.connected && (
                <div className="p-3 bg-warn-soft border border-warn/30 rounded-lg text-warn text-sm">
                  {t('createModal.notConnected')}
                </div>
              )}
              <InvoiceFormFields
                value={formData}
                onChange={(v) => setFormData({ ...formData, ...v })}
                vatCode={einvoice?.vatCode}
              />

              {formError && (
                <div className="p-3 bg-err-soft border border-err/30 rounded-lg text-err text-sm">
                  {formError}
                </div>
              )}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setIsCreating(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button onClick={handleCreateInvoice} isLoading={isSubmitting} disabled={isSubmitting}>
                {t('createModal.submit')}
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal showHeader
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title={t('editModal.title')}
        description={t('editModal.description')}
        size="lg"
      >
        {formSuccess ? (
          <div className="text-center py-6 px-6">
            <div className="w-16 h-16 bg-ok-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-ok" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">{formSuccess}</h3>
            <p className="text-muted">{t('createModal.redirecting')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-6 overflow-y-auto">
              <InvoiceFormFields
                value={formData}
                onChange={(v) => setFormData({ ...formData, ...v })}
                vatCode={einvoice?.vatCode}
              />

              {formError && (
                <div className="p-3 bg-err-soft border border-err/30 rounded-lg text-err text-sm">
                  {formError}
                </div>
              )}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button onClick={handleUpdateInvoice} isLoading={isSubmitting} disabled={isSubmitting}>
                {tc('actions.saveChanges')}
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* View Invoice Modal */}
      <Modal showHeader
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={t('detail.title')}
        size="lg"
      >
        {selectedInvoice && (
          <>
            <div className="space-y-6 p-6 overflow-y-auto">
              {/* Invoice Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-xl font-bold">{selectedInvoice.invoiceNumber}</h3>
                    <button
                      onClick={() => handleCopyToClipboard(selectedInvoice.invoiceNumber, 'invoiceNumber')}
                      className="p-1 hover:bg-fg/5 rounded"
                    >
                      {copiedId === 'invoiceNumber' ? (
                        <Check className="w-4 h-4 text-ok" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-muted">
                    {t('detail.created', { date: format(new Date(selectedInvoice.createdAt), 'dd/MM/yyyy HH:mm') })}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={`${invoiceStatusConfig[statusKey(selectedInvoice.status)].bgColor} ${invoiceStatusConfig[statusKey(selectedInvoice.status)].color}`}>
                    {React.createElement(invoiceStatusConfig[statusKey(selectedInvoice.status)].icon, { className: 'w-3 h-3 mr-1' })}
                    {t(`status.${statusKey(selectedInvoice.status)}`)}
                  </Badge>
                  {selectedInvoice.publishedAt && (
                    <p className="text-xs text-muted mt-1">
                      {t('detail.published', { date: format(new Date(selectedInvoice.publishedAt), 'dd/MM/yyyy HH:mm') })}
                    </p>
                  )}
                  {selectedInvoice.einvoiceNumber && (
                    <p className="text-sm font-semibold text-fg mt-1">
                      {t('detail.number', { number: selectedInvoice.einvoiceNumber })}
                      {selectedInvoice.invoiceSeries && ` · ${t('detail.series', { series: selectedInvoice.invoiceSeries })}`}
                    </p>
                  )}
                  {selectedInvoice.replacesInvoice && (
                    <p className="text-xs text-info mt-1">
                      {t('detail.replaces', { number: selectedInvoice.replacesInvoice.einvoiceNumber ?? '' })}
                      {selectedInvoice.replacesInvoice.invoiceSeries &&
                        ` ${t('detail.seriesNote', { series: selectedInvoice.replacesInvoice.invoiceSeries })}`}
                    </p>
                  )}
                  {selectedInvoice.replacements?.length > 0 && (
                    <p className="text-xs text-info mt-1">
                      {t('detail.replacedBy', {
                        list: selectedInvoice.replacements
                          .map((r) => r.einvoiceNumber ?? t('detail.draft', { number: r.invoiceNumber }))
                          .join(', '),
                      })}
                    </p>
                  )}
                  {selectedInvoice.adjustsInvoice && (
                    <p className="text-xs text-info mt-1">
                      {t(selectedInvoice.totalAmount < 0 ? 'detail.adjustsDown' : 'detail.adjustsUp', {
                        number: selectedInvoice.adjustsInvoice.einvoiceNumber ?? '',
                      })}
                      {selectedInvoice.adjustsInvoice.invoiceSeries &&
                        ` ${t('detail.seriesNote', { series: selectedInvoice.adjustsInvoice.invoiceSeries })}`}
                      {selectedInvoice.metadata?.adjustmentReason && ` — ${selectedInvoice.metadata.adjustmentReason}`}
                    </p>
                  )}
                  {selectedInvoice.adjustments?.length > 0 && (
                    <p className="text-xs text-info mt-1">
                      {t('detail.adjusted', {
                        list: selectedInvoice.adjustments
                          .map(
                            (a) =>
                              `${a.einvoiceNumber ? t('detail.adjustedNumber', { number: a.einvoiceNumber }) : t('detail.draft', { number: a.invoiceNumber })} ${a.totalAmount > 0 ? '+' : ''}${formatPrice(a.totalAmount)}`
                          )
                          .join(', '),
                      })}
                    </p>
                  )}
                  {selectedInvoice.cqtStatus != null && (
                    <p
                      className={`text-xs mt-1 ${selectedInvoice.cqtStatus === 6 ? 'text-err font-semibold' : selectedInvoice.cqtStatus === 4 ? 'text-ok' : 'text-muted'}`}
                    >
                      {cqtLabel(selectedInvoice.cqtStatus)}
                      {selectedInvoice.cqtNote && ` — ${selectedInvoice.cqtNote}`}
                    </p>
                  )}
                </div>
              </div>

              {selectedInvoice.status === 'PUBLISHED' && selectedInvoice.emailStatus && (
                <div
                  className={`p-3 rounded-lg text-sm border ${
                    selectedInvoice.emailStatus === 'SENT'
                      ? 'bg-ok-soft border-ok/30 text-ok'
                      : selectedInvoice.emailStatus === 'FAILED' || selectedInvoice.emailStatus === 'SKIPPED'
                        ? 'bg-err-soft border-err/30 text-err'
                        : 'bg-fg/[0.03] border-line text-fg'
                  }`}
                >
                  {selectedInvoice.emailStatus === 'SENT'
                    ? selectedInvoice.emailedAt
                      ? t('detail.emailSentAt', { date: format(new Date(selectedInvoice.emailedAt), 'dd/MM/yyyy HH:mm') })
                      : t('detail.emailSent')
                    : selectedInvoice.emailStatus === 'FAILED'
                      ? t('detail.emailFailed', { error: selectedInvoice.emailError ?? '' })
                      : selectedInvoice.emailStatus === 'SKIPPED'
                        ? t('detail.emailSkipped', { error: selectedInvoice.emailError ?? '' })
                        : t('detail.emailPending')}
                </div>
              )}

              {selectedInvoice.publishError && selectedInvoice.status !== 'PUBLISHED' && (
                <div className="p-3 bg-err-soft border border-err/30 rounded-lg text-err text-sm">
                  {t('detail.publishError', { error: selectedInvoice.publishError })}
                </div>
              )}

              {/* Amount */}
              <div className="bg-info-soft rounded-lg p-6 text-center">
                <p className="text-sm text-muted mb-1">
                  {selectedInvoice.adjustsInvoice ? t('detail.adjustmentAmount') : t('detail.total')}
                </p>
                <p className="text-4xl font-bold text-fg">{formatPrice(selectedInvoice.totalAmount)}</p>
                <div className="flex justify-center gap-6 mt-3 text-sm">
                  <div>
                    <span className="text-muted">{t('detail.tax', { rate: selectedInvoice.taxRate * 100 })} </span>
                    <span className="font-medium">{formatPrice(selectedInvoice.taxAmount)}</span>
                  </div>
                  <div>
                    <span className="text-muted">{t('detail.net')} </span>
                    <span className="font-medium">{formatPrice(selectedInvoice.subtotal)}</span>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-fg mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    {t('detail.company')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted">{t('detail.companyName')}</span>
                      <p className="font-medium">{selectedInvoice.companyName}</p>
                    </div>
                    <div>
                      <span className="text-muted">{t('detail.taxCode')}</span>
                      <p className="font-mono font-medium">{selectedInvoice.taxCode}</p>
                    </div>
                    <div>
                      <span className="text-muted">{t('detail.address')}</span>
                      <p className="font-medium">{selectedInvoice.companyAddress}</p>
                    </div>
                    {selectedInvoice.companyEmail && (
                      <div>
                        <span className="text-muted">Email:</span>
                        <p className="font-medium">{selectedInvoice.companyEmail}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-fg mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('detail.customer')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted">{t('detail.customerName')}</span>
                      <p className="font-medium">{selectedInvoice.customerName}</p>
                    </div>
                    <div>
                      <span className="text-muted">Email:</span>
                      <p className="font-medium">{selectedInvoice.customerEmail}</p>
                    </div>
                    {selectedInvoice.customerAddress && (
                      <div>
                        <span className="text-muted">{t('detail.address')}</span>
                        <p className="font-medium">{selectedInvoice.customerAddress}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking Info */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-fg mb-3">{t('detail.booking')}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted">{t('detail.bookingCode')}</span>
                    <p className="font-medium">{selectedInvoice.booking?.bookingCode}</p>
                  </div>
                  <div>
                    <span className="text-muted">{t('detail.guest')}</span>
                    <p className="font-medium">{selectedInvoice.booking?.guestName}</p>
                  </div>
                  <div>
                    <span className="text-muted">{t('detail.property')}</span>
                    <p className="font-medium">{selectedInvoice.booking?.property?.name}</p>
                  </div>
                  <div>
                    <span className="text-muted">{t('detail.checkIn')}</span>
                    <p className="font-medium">{format(new Date(selectedInvoice.booking?.checkInDate), 'dd/MM/yyyy')}</p>
                  </div>
                  <div>
                    <span className="text-muted">{t('detail.checkOut')}</span>
                    <p className="font-medium">{format(new Date(selectedInvoice.booking?.checkOutDate), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* E-Invoice Info */}
              {selectedInvoice.eInvoiceProvider && (
                <div className="border rounded-lg p-4 bg-warn-soft">
                  <h4 className="font-medium text-fg mb-3">{t('detail.einvoice')}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted">{t('detail.provider')}</span>
                      <p className="font-medium">{selectedInvoice.eInvoiceProvider === 'MATBAO' ? t('detail.matbao') : selectedInvoice.eInvoiceProvider}</p>
                    </div>
                    {selectedInvoice.invoicePattern && (
                      <div>
                        <span className="text-muted">{t('detail.pattern')}</span>
                        <p className="font-medium">{selectedInvoice.invoicePattern}</p>
                      </div>
                    )}
                    {selectedInvoice.invoiceSeries && (
                      <div>
                        <span className="text-muted">{t('detail.seriesLabel')}</span>
                        <p className="font-medium">{selectedInvoice.invoiceSeries}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Up to six actions on an issued invoice: wrap instead of clipping the last ones. */}
            <ModalFooter className="sm:flex-wrap sm:justify-end">
              <Button variant="secondary" onClick={() => setSelectedInvoice(null)}>
                {tc('actions.close')}
              </Button>
              {selectedInvoice.status === 'PUBLISHED' &&
                selectedInvoice.eInvoiceProvider === 'MATBAO' &&
                !selectedInvoice.replacements?.length &&
                !selectedInvoice.adjustsInvoice &&
                !selectedInvoice.adjustments?.length && (
                  <Button variant="outline" onClick={() => handleReplaceInvoice(selectedInvoice)}>
                    <Edit className="w-4 h-4 mr-2" />
                    {t('detail.replace')}
                  </Button>
                )}
              {selectedInvoice.status === 'PUBLISHED' &&
                selectedInvoice.eInvoiceProvider === 'MATBAO' &&
                !selectedInvoice.replacements?.length &&
                !selectedInvoice.adjustsInvoice &&
                selectedInvoice.adjustments?.every((a) => a.status === 'PUBLISHED') !== false && (
                  <Button variant="outline" onClick={() => handleOpenAdjust(selectedInvoice)}>
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    {t('detail.adjust')}
                  </Button>
                )}
              {selectedInvoice.status === 'PUBLISHED' && (
                <Button variant="outline" onClick={() => window.open(`/api/invoices/${selectedInvoice.id}/pdf`, '_blank')}>
                  <Download className="w-4 h-4 mr-2" />
                  {t('detail.pdf')}
                </Button>
              )}
              {selectedInvoice.xmlUrl && (
                <Button variant="outline" onClick={() => window.open(selectedInvoice.xmlUrl || '', '_blank')}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('detail.xml')}
                </Button>
              )}
              {selectedInvoice.status === 'PUBLISHED' && (
                <Button variant="outline" onClick={() => handleEmailInvoice(selectedInvoice)} isLoading={isSubmitting}>
                  <Mail className="w-4 h-4 mr-2" />
                  {selectedInvoice.emailStatus === 'SENT' ? t('detail.resendEmail') : t('detail.sendEmail')}
                </Button>
              )}
              {(selectedInvoice.status === 'DRAFT' || selectedInvoice.status === 'PENDING') && (
                <>
                  <Button variant="outline" onClick={() => handleCancelInvoice(selectedInvoice.id)}>
                    <XCircle className="w-4 h-4 mr-2" />
                    {t('detail.cancel')}
                  </Button>
                  <Button onClick={() => handlePublishInvoice(selectedInvoice.id)} isLoading={isSubmitting}>
                    <Send className="w-4 h-4 mr-2" />
                    {selectedInvoice.publishError ? t('detail.republish') : t('detail.publish')}
                  </Button>
                </>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Adjustment Modal */}
      <Modal showHeader
        isOpen={!!adjusting}
        onClose={() => setAdjusting(null)}
        title={t('adjust.title')}
        description={
          adjusting
            ? t('adjust.description', { number: String(adjusting.einvoiceNumber), amount: formatPrice(adjusting.totalAmount) })
            : undefined
        }
        size="lg"
      >
        <div className="space-y-4 p-6 overflow-y-auto">
          <div className="p-3 bg-warn-soft border border-warn/30 rounded-lg text-warn text-sm space-y-1">
            <p>{t('adjust.note1')}</p>
            <p>{t('adjust.note2')}</p>
            <p>{t('adjust.note3')}</p>
          </div>
          <Select
            label={t('adjust.type')}
            required
            value={adjustForm.direction}
            onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value })}
            options={[
              { value: 'increase', label: t('adjust.increase') },
              { value: 'decrease', label: t('adjust.decrease') },
            ]}
          />
          <Input
            label={t('adjust.amount')}
            required
            type="number"
            min={1}
            value={adjustForm.amount}
            onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
          />
          <Textarea
            label={t('adjust.reason')}
            required
            maxLength={150}
            rows={2}
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
            hint={t('adjust.reasonHint')}
          />
          {adjustError && (
            <div className="p-3 bg-err-soft border border-err/30 rounded-lg text-err text-sm">{adjustError}</div>
          )}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAdjusting(null)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleSubmitAdjust} isLoading={isSubmitting} disabled={isSubmitting}>
            {t('adjust.submit')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
