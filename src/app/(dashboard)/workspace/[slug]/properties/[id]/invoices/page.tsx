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
import { EinvoiceCard, type EinvoiceStatus } from './einvoice-card'
import { CQT_LABELS } from '@/lib/einvoice/cqt-labels'
import {
  EMPTY_INVOICE_FORM,
  InvoiceFormFields,
  invoiceFormBody,
  validateInvoiceForm,
  type InvoiceFormValue,
} from './invoice-form'

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

const invoiceStatusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Nháp', color: 'text-plain', bgColor: 'bg-plain-soft', icon: FileText },
  PENDING: { label: 'Chờ phát hành', color: 'text-warn', bgColor: 'bg-warn-soft', icon: Clock },
  PUBLISHING: { label: 'Đang phát hành', color: 'text-info', bgColor: 'bg-info-soft', icon: Clock },
  PUBLISHED: { label: 'Đã phát hành', color: 'text-ok', bgColor: 'bg-ok-soft', icon: CheckCircle },
  CANCELLED: { label: 'Đã hủy', color: 'text-plain', bgColor: 'bg-plain-soft', icon: XCircle },
  REPLACED: { label: 'Đã thay thế', color: 'text-info', bgColor: 'bg-info-soft', icon: AlertCircle },
}

export default function InvoicesPage() {
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price)
  }

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
    if (!formData.bookingId) return 'Vui lòng chọn đơn đặt phòng'
    return validateInvoiceForm(formData)
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
        setFormSuccess('Tạo hóa đơn thành công!')
        setTimeout(() => {
          setIsCreating(false)
          if (selectedProperty) {
            fetchInvoices(selectedProperty)
          }
        }, 1500)
      } else {
        setFormError(data.error || 'Có lỗi xảy ra')
      }
    } catch (err) {
      setFormError('Có lỗi xảy ra, vui lòng thử lại')
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
        setFormSuccess('Cập nhật hóa đơn thành công!')
        setTimeout(() => {
          setIsEditing(false)
          setEditingId(null)
          if (selectedProperty) {
            fetchInvoices(selectedProperty)
          }
        }, 1500)
      } else {
        setFormError(data.error || 'Có lỗi xảy ra')
      }
    } catch (err) {
      setFormError('Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hóa đơn này?')) return

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
        alert(data.error || 'Có lỗi xảy ra')
      }
    } catch (err) {
      alert('Có lỗi xảy ra')
    }
  }

  const handlePublishInvoice = async (invoiceId: string) => {
    const where = einvoice?.environment === 'PRODUCTION' ? 'CHÍNH THỨC' : 'thử nghiệm'
    if (!confirm(`Phát hành hoá đơn điện tử qua Mắt Bão (môi trường ${where})? Hoá đơn đã phát hành không sửa hay xoá được.`)) {
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
        alert(data.error || 'Có lỗi xảy ra')
      }
    } catch (err) {
      alert('Có lỗi xảy ra')
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
      !confirm(
        `Lập hoá đơn thay thế cho hoá đơn số ${invoice.einvoiceNumber}? Bản nháp sẽ chép dữ liệu hoá đơn này để bạn sửa rồi phát hành; khi phát hành, hoá đơn số ${invoice.einvoiceNumber} chuyển sang "Đã thay thế". Nên hỏi kế toán trước (có thể cần văn bản thoả thuận với người mua).`
      )
    ) {
      return
    }
    const res = await fetch(`/api/invoices/${invoice.id}/replace`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!data.success) {
      alert(data.error || 'Có lỗi xảy ra')
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
    if (!Number.isInteger(amount) || amount <= 0) return setAdjustError('Nhập số tiền chênh lệch (số nguyên, lớn hơn 0)')
    if (adjustForm.reason.trim().length < 5) return setAdjustError('Vui lòng ghi lý do điều chỉnh')
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
        setAdjustError(data.error || 'Có lỗi xảy ra')
        return
      }
      setAdjusting(null)
      // Open the draft: the next step is publishing it.
      const list = selectedProperty ? await fetchInvoices(selectedProperty) : []
      setSelectedInvoice(list.find((i) => i.id === data.data.id) ?? null)
    } catch (err) {
      setAdjustError('Có lỗi xảy ra, vui lòng thử lại')
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
      if (!data.success) alert(data.error || 'Không gửi được email')
      if (data.data) setSelectedInvoice((current) => (current && current.id === invoice.id ? { ...current, ...data.data } : current))
    } catch (err) {
      alert('Có lỗi xảy ra')
    } finally {
      setIsSubmitting(false)
      if (selectedProperty) fetchInvoices(selectedProperty)
    }
  }

  const handleCancelInvoice = async (invoiceId: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy hóa đơn này?')) return

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
        alert(data.error || 'Có lỗi xảy ra')
      }
    } catch (err) {
      alert('Có lỗi xảy ra')
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
          title="Hóa Đơn"
          description="Quản lý hóa đơn điện tử"
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
                Làm mới
              </Button>
              <Button onClick={handleOpenCreateModal}>
                <Plus className="w-4 h-4 mr-2" />
                Tạo hóa đơn
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
                  <p className="text-sm text-muted">Tổng hóa đơn</p>
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
                  <p className="text-sm text-muted">Nháp</p>
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
                  <p className="text-sm text-muted">Chờ phát hành</p>
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
                  <p className="text-sm text-muted">Đã phát hành</p>
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
                  <p className="text-sm text-muted">Đã phát hành (tiền)</p>
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
                placeholder="Mã hóa đơn, công ty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="md:col-span-2"
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'Tất cả trạng thái' },
                  ...Object.entries(invoiceStatusConfig).map(([key, { label }]) => ({ value: key, label })),
                ]}
              />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="Từ ngày"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="Đến ngày"
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
                <p className="text-muted">Đang tải...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted mb-4" />
                <p className="text-muted">Chưa có hóa đơn nào</p>
                <Button onClick={handleOpenCreateModal} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo hóa đơn
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-fg/[0.03] border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Mã HĐ</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Đơn đặt phòng</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Công ty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Mã số thuế</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Tổng tiền</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Trạng thái</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Ngày tạo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInvoices.map((invoice) => {
                      const statusInfo = invoiceStatusConfig[invoice.status] || invoiceStatusConfig.DRAFT
                      const StatusIcon = statusInfo.icon
                      
                      return (
                        <tr key={invoice.id} className="hover:bg-fg/[0.03]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">{invoice.invoiceNumber}</span>
                              {invoice.autoIssued && (
                                <Badge className="bg-info-soft text-info">
                                  Tự động
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
                                {invoice.totalAmount < 0 ? 'Điều chỉnh giảm' : 'Điều chỉnh tăng'} HĐ số{' '}
                                {invoice.adjustsInvoice.einvoiceNumber}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-muted">
                              {format(new Date(invoice.createdAt), 'dd/MM/yyyy')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleViewInvoice(invoice)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {(invoice.status === 'DRAFT' || invoice.status === 'PENDING') && (
                                <>
                                  {!invoice.adjustsInvoice && (
                                    <Button size="sm" variant="ghost" onClick={() => handleOpenEditModal(invoice)}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteInvoice(invoice.id)}>
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
                  Trang {pagination.page} / {pagination.totalPages} · {pagination.total} hoá đơn
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={page <= 1 || isLoading} onClick={() => setPage(page - 1)}>
                    Trước
                  </Button>
                  <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages || isLoading} onClick={() => setPage(page + 1)}>
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>

      {/* Create Invoice Modal */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Tạo hóa đơn mới"
        description="Tạo hóa đơn GTGT cho khách hàng"
        size="lg"
      >
        {formSuccess ? (
          <div className="text-center py-6 px-6">
            <div className="w-16 h-16 bg-ok-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-ok" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">{formSuccess}</h3>
            <p className="text-muted">Đang chuyển hướng...</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-6 overflow-y-auto">
              <Select
                label="Đơn đặt phòng"
                required
                value={formData.bookingId}
                onChange={(e) => handleSelectBooking(e.target.value)}
                options={[
                  { value: '', label: 'Chọn đơn đặt phòng' },
                  ...bookings.map((b) => ({ value: b.id, label: `${b.bookingCode} - ${b.guestName}` })),
                ]}
              />

              {!einvoice?.connected && (
                <div className="p-3 bg-warn-soft border border-warn/30 rounded-lg text-warn text-sm">
                  Khách sạn chưa kết nối hoá đơn điện tử Mắt Bão (thẻ phía trên trang), nên chưa tạo được hoá đơn.
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
                Hủy
              </Button>
              <Button onClick={handleCreateInvoice} isLoading={isSubmitting} disabled={isSubmitting}>
                Tạo hóa đơn
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title="Chỉnh sửa hóa đơn"
        description="Cập nhật thông tin hóa đơn"
        size="lg"
      >
        {formSuccess ? (
          <div className="text-center py-6 px-6">
            <div className="w-16 h-16 bg-ok-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-ok" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">{formSuccess}</h3>
            <p className="text-muted">Đang chuyển hướng...</p>
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
                Hủy
              </Button>
              <Button onClick={handleUpdateInvoice} isLoading={isSubmitting} disabled={isSubmitting}>
                Lưu thay đổi
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* View Invoice Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Chi tiết hóa đơn"
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
                    Tạo: {format(new Date(selectedInvoice.createdAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={`${invoiceStatusConfig[selectedInvoice.status]?.bgColor} ${invoiceStatusConfig[selectedInvoice.status]?.color}`}>
                    {React.createElement(invoiceStatusConfig[selectedInvoice.status]?.icon || FileText, { className: 'w-3 h-3 mr-1' })}
                    {invoiceStatusConfig[selectedInvoice.status]?.label}
                  </Badge>
                  {selectedInvoice.publishedAt && (
                    <p className="text-xs text-muted mt-1">
                      Phát hành: {format(new Date(selectedInvoice.publishedAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                  {selectedInvoice.einvoiceNumber && (
                    <p className="text-sm font-semibold text-fg mt-1">
                      Số hoá đơn: {selectedInvoice.einvoiceNumber}
                      {selectedInvoice.invoiceSeries && ` · Ký hiệu ${selectedInvoice.invoiceSeries}`}
                    </p>
                  )}
                  {selectedInvoice.replacesInvoice && (
                    <p className="text-xs text-info mt-1">
                      Thay thế cho hoá đơn số {selectedInvoice.replacesInvoice.einvoiceNumber}
                      {selectedInvoice.replacesInvoice.invoiceSeries && ` (ký hiệu ${selectedInvoice.replacesInvoice.invoiceSeries})`}
                    </p>
                  )}
                  {selectedInvoice.replacements?.length > 0 && (
                    <p className="text-xs text-info mt-1">
                      Có hoá đơn thay thế: {selectedInvoice.replacements.map((r) => r.einvoiceNumber ?? `${r.invoiceNumber} (nháp)`).join(', ')}
                    </p>
                  )}
                  {selectedInvoice.adjustsInvoice && (
                    <p className="text-xs text-info mt-1">
                      {selectedInvoice.totalAmount < 0 ? 'Điều chỉnh giảm' : 'Điều chỉnh tăng'} cho hoá đơn số{' '}
                      {selectedInvoice.adjustsInvoice.einvoiceNumber}
                      {selectedInvoice.adjustsInvoice.invoiceSeries && ` (ký hiệu ${selectedInvoice.adjustsInvoice.invoiceSeries})`}
                      {selectedInvoice.metadata?.adjustmentReason && ` — ${selectedInvoice.metadata.adjustmentReason}`}
                    </p>
                  )}
                  {selectedInvoice.adjustments?.length > 0 && (
                    <p className="text-xs text-info mt-1">
                      Đã điều chỉnh:{' '}
                      {selectedInvoice.adjustments
                        .map(
                          (a) =>
                            `${a.einvoiceNumber ? `số ${a.einvoiceNumber}` : `${a.invoiceNumber} (nháp)`} ${a.totalAmount > 0 ? '+' : ''}${formatPrice(a.totalAmount)}`
                        )
                        .join(', ')}
                    </p>
                  )}
                  {selectedInvoice.cqtStatus != null && (
                    <p
                      className={`text-xs mt-1 ${selectedInvoice.cqtStatus === 6 ? 'text-err font-semibold' : selectedInvoice.cqtStatus === 4 ? 'text-ok' : 'text-muted'}`}
                    >
                      {CQT_LABELS[selectedInvoice.cqtStatus] ?? `Cơ quan thuế: mã ${selectedInvoice.cqtStatus}`}
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
                    ? `Đã gửi email hoá đơn${selectedInvoice.emailedAt ? ` lúc ${format(new Date(selectedInvoice.emailedAt), 'dd/MM/yyyy HH:mm')}` : ''}`
                    : selectedInvoice.emailStatus === 'FAILED'
                      ? `Gửi email lỗi: ${selectedInvoice.emailError ?? ''}`
                      : selectedInvoice.emailStatus === 'SKIPPED'
                        ? `Không gửi email: ${selectedInvoice.emailError ?? ''}`
                        : 'Đang chờ gửi email hoá đơn cho người mua'}
                </div>
              )}

              {selectedInvoice.publishError && selectedInvoice.status !== 'PUBLISHED' && (
                <div className="p-3 bg-err-soft border border-err/30 rounded-lg text-err text-sm">
                  Lần phát hành trước không thành công: {selectedInvoice.publishError}
                </div>
              )}

              {/* Amount */}
              <div className="bg-info-soft rounded-lg p-6 text-center">
                <p className="text-sm text-muted mb-1">
                  {selectedInvoice.adjustsInvoice ? 'Số tiền điều chỉnh (đã gồm VAT)' : 'Tổng tiền hóa đơn'}
                </p>
                <p className="text-4xl font-bold text-fg">{formatPrice(selectedInvoice.totalAmount)}</p>
                <div className="flex justify-center gap-6 mt-3 text-sm">
                  <div>
                    <span className="text-muted">Thuế ({selectedInvoice.taxRate * 100}%): </span>
                    <span className="font-medium">{formatPrice(selectedInvoice.taxAmount)}</span>
                  </div>
                  <div>
                    <span className="text-muted">Tiền trước thuế: </span>
                    <span className="font-medium">{formatPrice(selectedInvoice.subtotal)}</span>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-fg mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Thông tin công ty
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted">Tên công ty:</span>
                      <p className="font-medium">{selectedInvoice.companyName}</p>
                    </div>
                    <div>
                      <span className="text-muted">Mã số thuế:</span>
                      <p className="font-mono font-medium">{selectedInvoice.taxCode}</p>
                    </div>
                    <div>
                      <span className="text-muted">Địa chỉ:</span>
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
                    Thông tin khách hàng
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted">Tên khách hàng:</span>
                      <p className="font-medium">{selectedInvoice.customerName}</p>
                    </div>
                    <div>
                      <span className="text-muted">Email:</span>
                      <p className="font-medium">{selectedInvoice.customerEmail}</p>
                    </div>
                    {selectedInvoice.customerAddress && (
                      <div>
                        <span className="text-muted">Địa chỉ:</span>
                        <p className="font-medium">{selectedInvoice.customerAddress}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking Info */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-fg mb-3">Thông tin đơn đặt phòng</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted">Mã đặt phòng:</span>
                    <p className="font-medium">{selectedInvoice.booking?.bookingCode}</p>
                  </div>
                  <div>
                    <span className="text-muted">Khách hàng:</span>
                    <p className="font-medium">{selectedInvoice.booking?.guestName}</p>
                  </div>
                  <div>
                    <span className="text-muted">Cơ sở:</span>
                    <p className="font-medium">{selectedInvoice.booking?.property?.name}</p>
                  </div>
                  <div>
                    <span className="text-muted">Nhận phòng:</span>
                    <p className="font-medium">{format(new Date(selectedInvoice.booking?.checkInDate), 'dd/MM/yyyy')}</p>
                  </div>
                  <div>
                    <span className="text-muted">Trả phòng:</span>
                    <p className="font-medium">{format(new Date(selectedInvoice.booking?.checkOutDate), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* E-Invoice Info */}
              {selectedInvoice.eInvoiceProvider && (
                <div className="border rounded-lg p-4 bg-warn-soft">
                  <h4 className="font-medium text-fg mb-3">Thông tin hóa đơn điện tử</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted">Nhà cung cấp:</span>
                      <p className="font-medium">{selectedInvoice.eInvoiceProvider === 'MATBAO' ? 'Mắt Bão' : selectedInvoice.eInvoiceProvider}</p>
                    </div>
                    {selectedInvoice.invoicePattern && (
                      <div>
                        <span className="text-muted">Mẫu số:</span>
                        <p className="font-medium">{selectedInvoice.invoicePattern}</p>
                      </div>
                    )}
                    {selectedInvoice.invoiceSeries && (
                      <div>
                        <span className="text-muted">Ký hiệu:</span>
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
                Đóng
              </Button>
              {selectedInvoice.status === 'PUBLISHED' &&
                selectedInvoice.eInvoiceProvider === 'MATBAO' &&
                !selectedInvoice.replacements?.length &&
                !selectedInvoice.adjustsInvoice &&
                !selectedInvoice.adjustments?.length && (
                  <Button variant="outline" onClick={() => handleReplaceInvoice(selectedInvoice)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Lập hoá đơn thay thế
                  </Button>
                )}
              {selectedInvoice.status === 'PUBLISHED' &&
                selectedInvoice.eInvoiceProvider === 'MATBAO' &&
                !selectedInvoice.replacements?.length &&
                !selectedInvoice.adjustsInvoice &&
                selectedInvoice.adjustments?.every((a) => a.status === 'PUBLISHED') !== false && (
                  <Button variant="outline" onClick={() => handleOpenAdjust(selectedInvoice)}>
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    Lập hoá đơn điều chỉnh
                  </Button>
                )}
              {selectedInvoice.status === 'PUBLISHED' && (
                <Button variant="outline" onClick={() => window.open(`/api/invoices/${selectedInvoice.id}/pdf`, '_blank')}>
                  <Download className="w-4 h-4 mr-2" />
                  Tải PDF
                </Button>
              )}
              {selectedInvoice.xmlUrl && (
                <Button variant="outline" onClick={() => window.open(selectedInvoice.xmlUrl || '', '_blank')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Tải XML
                </Button>
              )}
              {selectedInvoice.status === 'PUBLISHED' && (
                <Button variant="outline" onClick={() => handleEmailInvoice(selectedInvoice)} isLoading={isSubmitting}>
                  <Mail className="w-4 h-4 mr-2" />
                  {selectedInvoice.emailStatus === 'SENT' ? 'Gửi lại email' : 'Gửi email hoá đơn'}
                </Button>
              )}
              {(selectedInvoice.status === 'DRAFT' || selectedInvoice.status === 'PENDING') && (
                <>
                  <Button variant="outline" onClick={() => handleCancelInvoice(selectedInvoice.id)}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Hủy hóa đơn
                  </Button>
                  <Button onClick={() => handlePublishInvoice(selectedInvoice.id)} isLoading={isSubmitting}>
                    <Send className="w-4 h-4 mr-2" />
                    {selectedInvoice.publishError ? 'Phát hành lại' : 'Phát hành'}
                  </Button>
                </>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Adjustment Modal */}
      <Modal
        isOpen={!!adjusting}
        onClose={() => setAdjusting(null)}
        title="Lập hoá đơn điều chỉnh"
        description={adjusting ? `Cho hoá đơn số ${adjusting.einvoiceNumber} (${formatPrice(adjusting.totalAmount)})` : undefined}
        size="lg"
      >
        <div className="space-y-4 p-6 overflow-y-auto">
          <div className="p-3 bg-warn-soft border border-warn/30 rounded-lg text-warn text-sm space-y-1">
            <p>Hoá đơn điều chỉnh chỉ ghi phần chênh lệch; điều chỉnh giảm được ghi số âm. Hoá đơn gốc vẫn giữ nguyên.</p>
            <p>Người mua là doanh nghiệp: cần văn bản thoả thuận với người mua ghi rõ sai sót trước khi lập. Nên hỏi kế toán.</p>
            <p>Sai tên, mã số thuế hay địa chỉ người mua: dùng hoá đơn thay thế.</p>
          </div>
          <Select
            label="Loại điều chỉnh"
            required
            value={adjustForm.direction}
            onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value })}
            options={[
              { value: 'increase', label: 'Điều chỉnh tăng (thu thêm)' },
              { value: 'decrease', label: 'Điều chỉnh giảm (bớt tiền)' },
            ]}
          />
          <Input
            label="Số tiền chênh lệch (đã gồm VAT)"
            required
            type="number"
            min={1}
            value={adjustForm.amount}
            onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
          />
          <Textarea
            label="Lý do điều chỉnh"
            required
            maxLength={150}
            rows={2}
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
            hint="In trên hoá đơn (tối đa 150 ký tự)"
          />
          {adjustError && (
            <div className="p-3 bg-err-soft border border-err/30 rounded-lg text-err text-sm">{adjustError}</div>
          )}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAdjusting(null)}>
            Hủy
          </Button>
          <Button onClick={handleSubmitAdjust} isLoading={isSubmitting} disabled={isSubmitting}>
            Tạo bản nháp
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
