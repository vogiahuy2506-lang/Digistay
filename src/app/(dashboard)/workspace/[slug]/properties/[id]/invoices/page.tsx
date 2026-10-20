'use client'

import * as React from 'react'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Select, Modal, ModalFooter } from '@/components/ui'
import { 
  Search, FileText, Plus, Eye, Download, RefreshCw,
  Clock, CheckCircle, XCircle, AlertCircle, Send, Printer,
  Building, Copy, Check, Mail, Edit, Trash2
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
  DRAFT: { label: 'Nháp', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: FileText },
  PENDING: { label: 'Chờ phát hành', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Clock },
  PUBLISHING: { label: 'Đang phát hành', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
  PUBLISHED: { label: 'Đã phát hành', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-600', bgColor: 'bg-red-50', icon: XCircle },
  REPLACED: { label: 'Đã thay thế', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: AlertCircle },
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
    applyFilters()
  }, [invoices, selectedProperty, statusFilter, searchQuery, dateFrom, dateTo])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setProperties(data.data)
        setSelectedProperty(data.data[0].id)
        fetchInvoices(data.data[0].id)
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
      const res = await fetch(`/api/invoices?propertyId=${propertyId}`)
      const data = await res.json()
      if (data.success) {
        setInvoices(data.data)
        calculateStats(data.data)
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

  const calculateStats = (invoicesData: Invoice[]) => {
    const draftCount = invoicesData.filter((i) => i.status === 'DRAFT').length
    const pendingCount = invoicesData.filter((i) => i.status === 'PENDING').length
    const publishedCount = invoicesData.filter((i) => i.status === 'PUBLISHED').length
    const totalAmount = invoicesData.reduce((sum, i) => sum + i.totalAmount, 0)
    setStats({
      totalInvoices: invoicesData.length,
      draftCount,
      pendingCount,
      publishedCount,
      totalAmount,
    })
  }

  const applyFilters = () => {
    let filtered = [...invoices]
    
    if (selectedProperty) {
      filtered = filtered.filter((i) => i.booking?.property?.id === selectedProperty)
    }
    if (statusFilter) {
      filtered = filtered.filter((i) => i.status === statusFilter)
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (i) =>
          i.invoiceNumber?.toLowerCase().includes(query) ||
          i.companyName?.toLowerCase().includes(query) ||
          i.customerName?.toLowerCase().includes(query) ||
          i.taxCode?.toLowerCase().includes(query) ||
          i.booking?.bookingCode?.toLowerCase().includes(query)
      )
    }
    if (dateFrom) {
      filtered = filtered.filter((i) => new Date(i.createdAt) >= new Date(dateFrom))
    }
    if (dateTo) {
      filtered = filtered.filter((i) => new Date(i.createdAt) <= new Date(dateTo + 'T23:59:59'))
    }
    
    setFilteredInvoices(filtered)
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
    fetchInvoices(propertyId)
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
      <Header
        title="Hóa Đơn"
        description="Quản lý hóa đơn điện tử"
        actions={
          <div className="flex items-center gap-3">
            <Select
              value={selectedProperty}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className="w-64"
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

      <PageContainer>
        {selectedProperty && <EinvoiceCard key={selectedProperty} propertyId={selectedProperty} onStatus={setEinvoice} />}
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Tổng hóa đơn</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Nháp</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.draftCount}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Chờ phát hành</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pendingCount}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Đã phát hành</p>
                  <p className="text-2xl font-bold text-green-600">{stats.publishedCount}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Tổng tiền</p>
                  <p className="text-xl font-bold text-gray-900">{formatPrice(stats.totalAmount)}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Building className="w-6 h-6 text-purple-600" />
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
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-500">Đang tải...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Chưa có hóa đơn nào</p>
                <Button onClick={handleOpenCreateModal} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo hóa đơn
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã HĐ</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đơn đặt phòng</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Công ty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã số thuế</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tổng tiền</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày tạo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInvoices.map((invoice) => {
                      const statusInfo = invoiceStatusConfig[invoice.status] || invoiceStatusConfig.DRAFT
                      const StatusIcon = statusInfo.icon
                      
                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">{invoice.invoiceNumber}</span>
                              <button
                                onClick={() => handleCopyToClipboard(invoice.invoiceNumber, invoice.id)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                {copiedId === invoice.id ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Copy className="w-3 h-3 text-gray-400" />
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
                              <span className="block text-xs text-gray-500">{invoice.customerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm">{invoice.taxCode}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold">{formatPrice(invoice.totalAmount)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-500">
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
                                  <Button size="sm" variant="ghost" onClick={() => handleOpenEditModal(invoice)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteInvoice(invoice.id)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
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
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{formSuccess}</h3>
            <p className="text-gray-500">Đang chuyển hướng...</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
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
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  Khách sạn chưa kết nối hoá đơn điện tử Mắt Bão (thẻ phía trên trang), nên chưa tạo được hoá đơn.
                </div>
              )}
              <InvoiceFormFields
                value={formData}
                onChange={(v) => setFormData({ ...formData, ...v })}
                vatCode={einvoice?.vatCode}
              />

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
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
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{formSuccess}</h3>
            <p className="text-gray-500">Đang chuyển hướng...</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <InvoiceFormFields
                value={formData}
                onChange={(v) => setFormData({ ...formData, ...v })}
                vatCode={einvoice?.vatCode}
              />

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
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
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-xl font-bold">{selectedInvoice.invoiceNumber}</h3>
                    <button
                      onClick={() => handleCopyToClipboard(selectedInvoice.invoiceNumber, 'invoiceNumber')}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {copiedId === 'invoiceNumber' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Tạo: {format(new Date(selectedInvoice.createdAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={`${invoiceStatusConfig[selectedInvoice.status]?.bgColor} ${invoiceStatusConfig[selectedInvoice.status]?.color}`}>
                    {React.createElement(invoiceStatusConfig[selectedInvoice.status]?.icon || FileText, { className: 'w-3 h-3 mr-1' })}
                    {invoiceStatusConfig[selectedInvoice.status]?.label}
                  </Badge>
                  {selectedInvoice.publishedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Phát hành: {format(new Date(selectedInvoice.publishedAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                  {selectedInvoice.einvoiceNumber && (
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      Số hoá đơn: {selectedInvoice.einvoiceNumber}
                      {selectedInvoice.invoiceSeries && ` · Ký hiệu ${selectedInvoice.invoiceSeries}`}
                    </p>
                  )}
                  {selectedInvoice.cqtStatus != null && (
                    <p
                      className={`text-xs mt-1 ${selectedInvoice.cqtStatus === 6 ? 'text-red-600 font-semibold' : selectedInvoice.cqtStatus === 4 ? 'text-green-700' : 'text-gray-500'}`}
                    >
                      {CQT_LABELS[selectedInvoice.cqtStatus] ?? `Cơ quan thuế: mã ${selectedInvoice.cqtStatus}`}
                      {selectedInvoice.cqtNote && ` — ${selectedInvoice.cqtNote}`}
                    </p>
                  )}
                </div>
              </div>

              {selectedInvoice.publishError && selectedInvoice.status !== 'PUBLISHED' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  Lần phát hành trước không thành công: {selectedInvoice.publishError}
                </div>
              )}

              {/* Amount */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-600 mb-1">Tổng tiền hóa đơn</p>
                <p className="text-4xl font-bold text-gray-900">{formatPrice(selectedInvoice.totalAmount)}</p>
                <div className="flex justify-center gap-6 mt-3 text-sm">
                  <div>
                    <span className="text-gray-500">Thuế ({selectedInvoice.taxRate * 100}%): </span>
                    <span className="font-medium">{formatPrice(selectedInvoice.taxAmount)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tiền trước thuế: </span>
                    <span className="font-medium">{formatPrice(selectedInvoice.subtotal)}</span>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Thông tin công ty
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Tên công ty:</span>
                      <p className="font-medium">{selectedInvoice.companyName}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Mã số thuế:</span>
                      <p className="font-mono font-medium">{selectedInvoice.taxCode}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Địa chỉ:</span>
                      <p className="font-medium">{selectedInvoice.companyAddress}</p>
                    </div>
                    {selectedInvoice.companyEmail && (
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <p className="font-medium">{selectedInvoice.companyEmail}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Thông tin khách hàng
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Tên khách hàng:</span>
                      <p className="font-medium">{selectedInvoice.customerName}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <p className="font-medium">{selectedInvoice.customerEmail}</p>
                    </div>
                    {selectedInvoice.customerAddress && (
                      <div>
                        <span className="text-gray-500">Địa chỉ:</span>
                        <p className="font-medium">{selectedInvoice.customerAddress}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking Info */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Thông tin đơn đặt phòng</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Mã đặt phòng:</span>
                    <p className="font-medium">{selectedInvoice.booking?.bookingCode}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Khách hàng:</span>
                    <p className="font-medium">{selectedInvoice.booking?.guestName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Cơ sở:</span>
                    <p className="font-medium">{selectedInvoice.booking?.property?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nhận phòng:</span>
                    <p className="font-medium">{format(new Date(selectedInvoice.booking?.checkInDate), 'dd/MM/yyyy')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Trả phòng:</span>
                    <p className="font-medium">{format(new Date(selectedInvoice.booking?.checkOutDate), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* E-Invoice Info */}
              {selectedInvoice.eInvoiceProvider && (
                <div className="border rounded-lg p-4 bg-amber-50">
                  <h4 className="font-medium text-gray-900 mb-3">Thông tin hóa đơn điện tử</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Nhà cung cấp:</span>
                      <p className="font-medium">{selectedInvoice.eInvoiceProvider === 'MATBAO' ? 'Mắt Bão' : selectedInvoice.eInvoiceProvider}</p>
                    </div>
                    {selectedInvoice.invoicePattern && (
                      <div>
                        <span className="text-gray-500">Mẫu số:</span>
                        <p className="font-medium">{selectedInvoice.invoicePattern}</p>
                      </div>
                    )}
                    {selectedInvoice.invoiceSeries && (
                      <div>
                        <span className="text-gray-500">Ký hiệu:</span>
                        <p className="font-medium">{selectedInvoice.invoiceSeries}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setSelectedInvoice(null)}>
                Đóng
              </Button>
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
              {selectedInvoice.customerEmail && (
                <Button variant="outline" onClick={() => window.open(`mailto:${selectedInvoice.customerEmail}`, '_blank')}>
                  <Mail className="w-4 h-4 mr-2" />
                  Gửi Email
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
    </div>
  )
}
