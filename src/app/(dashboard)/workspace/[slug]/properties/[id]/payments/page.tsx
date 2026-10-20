'use client'

import * as React from 'react'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Select, Modal, ModalFooter } from '@/components/ui'
import { 
  Search, Filter, CreditCard, Smartphone, Banknote, Building, 
  Clock, CheckCircle, XCircle, AlertCircle, Download, RefreshCw,
  Plus, Eye, QrCode, FileText, Copy, Check, TrendingUp, Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

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

interface Booking {
  id: string
  bookingCode: string
  guestName: string
}

const paymentMethodOptions = [
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
  { value: 'QR_VIETQR', label: 'QR VietQR' },
  { value: 'CARD', label: 'Thẻ nội địa' },
  { value: 'CREDIT_CARD', label: 'Thẻ quốc tế' },
  { value: 'E_WALLET', label: 'Ví điện tử' },
  { value: 'CASH', label: 'Tiền mặt' },
]

const paymentMethodLabels: Record<string, { label: string; icon: any }> = {
  BANK_TRANSFER: { label: 'Chuyển khoản', icon: Building },
  QR_VIETQR: { label: 'QR VietQR', icon: QrCode },
  CARD: { label: 'Thẻ nội địa', icon: CreditCard },
  CREDIT_CARD: { label: 'Thẻ quốc tế', icon: CreditCard },
  E_WALLET: { label: 'Ví điện tử', icon: Smartphone },
  CASH: { label: 'Tiền mặt', icon: Banknote },
}

const paymentStatusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: any }> = {
  PENDING: { label: 'Chờ thanh toán', color: 'text-warn', bgColor: 'bg-warn-soft', borderColor: 'border-warn/30', icon: Clock },
  PAID: { label: 'Đã thanh toán', color: 'text-ok', bgColor: 'bg-ok-soft', borderColor: 'border-ok/30', icon: CheckCircle },
  FAILED: { label: 'Thất bại', color: 'text-err', bgColor: 'bg-err-soft', borderColor: 'border-err/30', icon: XCircle },
  EXPIRED: { label: 'Hết hạn', color: 'text-fg', bgColor: 'bg-fg/5', borderColor: 'border-line', icon: AlertCircle },
  REFUNDED: { label: 'Đã hoàn tiền', color: 'text-info', bgColor: 'bg-info-soft', borderColor: 'border-info/30', icon: RefreshCw },
}

export default function PaymentsPage() {
  const [payments, setPayments] = React.useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = React.useState<Payment[]>([])
  const [properties, setProperties] = React.useState<Property[]>([])
  const [bookings, setBookings] = React.useState<Booking[]>([])
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
  
  // Create payment form
  const [createForm, setCreateForm] = React.useState({
    bookingId: '',
    method: 'QR_VIETQR',
    amount: '',
  })
  const [createError, setCreateError] = React.useState('')
  const [createSuccess, setCreateSuccess] = React.useState('')

  // Stats
  const [stats, setStats] = React.useState({
    total: 0,
    pending: 0,
    paid: 0,
    failed: 0,
    pendingCount: 0,
    paidCount: 0,
    failedCount: 0,
  })

  React.useEffect(() => {
    fetchProperties()
  }, [])

  React.useEffect(() => {
    applyFilters()
  }, [payments, selectedProperty, statusFilter, methodFilter, searchQuery, dateFrom, dateTo])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setProperties(data.data)
        setSelectedProperty(data.data[0].id)
        fetchPayments(data.data[0].id)
      } else {
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
      setIsLoading(false)
    }
  }

  const fetchPayments = async (propertyId: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/payments?propertyId=${propertyId}`)
      const data = await res.json()
      if (data.success) {
        setPayments(data.data)
        calculateStats(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err)
    } finally {
      setIsLoading(false)
    }
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

  const calculateStats = (paymentsData: Payment[]) => {
    const total = paymentsData.reduce((sum, p) => sum + p.amount, 0)
    const pending = paymentsData.filter((p) => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0)
    const paid = paymentsData.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0)
    const failed = paymentsData.filter((p) => p.status === 'FAILED' || p.status === 'EXPIRED').reduce((sum, p) => sum + p.amount, 0)
    const pendingCount = paymentsData.filter((p) => p.status === 'PENDING').length
    const paidCount = paymentsData.filter((p) => p.status === 'PAID').length
    const failedCount = paymentsData.filter((p) => p.status === 'FAILED' || p.status === 'EXPIRED').length
    setStats({ total, pending, paid, failed, pendingCount, paidCount, failedCount })
  }

  const applyFilters = () => {
    let filtered = [...payments]
    
    if (selectedProperty) {
      filtered = filtered.filter((p) => p.booking?.property?.id === selectedProperty)
    }
    if (statusFilter) {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }
    if (methodFilter) {
      filtered = filtered.filter((p) => p.method === methodFilter)
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.booking?.bookingCode?.toLowerCase().includes(query) ||
          p.booking?.guestName?.toLowerCase().includes(query) ||
          p.transferContent?.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
      )
    }
    if (dateFrom) {
      filtered = filtered.filter((p) => new Date(p.createdAt) >= new Date(dateFrom))
    }
    if (dateTo) {
      filtered = filtered.filter((p) => new Date(p.createdAt) <= new Date(dateTo + 'T23:59:59'))
    }
    
    setFilteredPayments(filtered)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price)
  }

  const handleRefresh = () => {
    if (selectedProperty) {
      fetchPayments(selectedProperty)
    }
  }

  const handlePropertyChange = (propertyId: string) => {
    setSelectedProperty(propertyId)
    fetchPayments(propertyId)
    fetchBookings(propertyId)
  }

  const handleOpenCreateModal = () => {
    if (selectedProperty) {
      fetchBookings(selectedProperty)
    }
    setCreateForm({ bookingId: '', method: 'QR_VIETQR', amount: '' })
    setCreateError('')
    setCreateSuccess('')
    setIsCreating(true)
  }

  const handleCreatePayment = async () => {
    if (!createForm.bookingId) {
      setCreateError('Vui lòng chọn đơn đặt phòng')
      return
    }
    if (!createForm.amount || parseFloat(createForm.amount) <= 0) {
      setCreateError('Vui lòng nhập số tiền hợp lệ')
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

      if (data.success) {
        setCreateSuccess('Tạo thanh toán thành công!')
        setTimeout(() => {
          setIsCreating(false)
          if (selectedProperty) {
            fetchPayments(selectedProperty)
          }
        }, 1500)
      } else {
        setCreateError(data.error || 'Có lỗi xảy ra')
      }
    } catch (err) {
      setCreateError('Có lỗi xảy ra, vui lòng thử lại')
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
    if (!confirm('Xác nhận đã nhận đủ tiền cho khoản thanh toán này? Thao tác sẽ được ghi lại tên bạn.')) {
      return
    }
    try {
      const res = await fetch(`/api/payments/${paymentId}/confirm`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        if (data.warning) {
          alert(data.warning)
        }
        if (selectedProperty) {
          fetchPayments(selectedProperty)
        }
        setSelectedPayment(null)
      } else {
        alert(data.error || 'Có lỗi xảy ra')
      }
    } catch (err) {
      alert('Có lỗi xảy ra')
    }
  }

  return (
    <div className="min-h-screen">
      <PageContainer>
        <Header
          title="Thanh Toán"
          description="Quản lý các khoản thanh toán"
          actions={
            <div className="flex items-center gap-2 shrink-0">
              <Select
                value={selectedProperty}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="w-44 text-sm shrink-0"
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
              />
              <Button size="sm" variant="secondary" onClick={handleRefresh} className="gap-1.5 shrink-0">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Làm mới</span>
              </Button>
              <Button size="sm" onClick={handleOpenCreateModal} className="gap-1.5 shrink-0">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Tạo thanh toán</span>
              </Button>
            </div>
          }
        />

        {/* Stats Cards - CRM Style */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {/* Total Card */}
          <div className="bg-panel rounded-xl p-4 shadow-sm border border-line hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fg/5 flex items-center justify-center shadow-sm shrink-0">
                <TrendingUp className="w-5 h-5 text-fg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted truncate">Tổng thanh toán</p>
                <p className="text-lg font-bold text-fg truncate">{formatPrice(stats.total)}</p>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">{filteredPayments.length} giao dịch</p>
          </div>

          {/* Paid Card */}
          <div className="bg-panel rounded-xl p-4 shadow-sm border border-ok/30 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-ok-soft flex items-center justify-center shadow-sm shrink-0">
                <CheckCircle className="w-5 h-5 text-ok" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ok truncate">Đã thanh toán</p>
                <p className="text-lg font-bold text-ok truncate">{formatPrice(stats.paid)}</p>
              </div>
            </div>
            <p className="text-xs text-ok mt-2 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              {stats.paidCount} giao dịch
            </p>
          </div>

          {/* Pending Card */}
          <div className="bg-panel rounded-xl p-4 shadow-sm border border-warn/30 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warn-soft flex items-center justify-center shadow-sm shrink-0">
                <Clock className="w-5 h-5 text-warn" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-warn truncate">Chờ thanh toán</p>
                <p className="text-lg font-bold text-warn truncate">{formatPrice(stats.pending)}</p>
              </div>
            </div>
            <p className="text-xs text-warn mt-2 flex items-center gap-1">
              <Wallet className="w-3 h-3" />
              {stats.pendingCount} giao dịch
            </p>
          </div>

          {/* Failed Card */}
          <div className="bg-panel rounded-xl p-4 shadow-sm border border-err/30 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-err-soft flex items-center justify-center shadow-sm shrink-0">
                <XCircle className="w-5 h-5 text-err" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-err truncate">Thất bại/Hết hạn</p>
                <p className="text-lg font-bold text-err truncate">{formatPrice(stats.failed)}</p>
              </div>
            </div>
            <p className="text-xs text-err mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {stats.failedCount} giao dịch
            </p>
          </div>
        </div>

        {/* Filters - CRM Style */}
        <div className="bg-panel rounded-xl p-4 shadow-sm border border-line mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-fg/5 flex items-center justify-center">
                <Filter className="w-3.5 h-3.5 text-muted" />
              </div>
              <span className="text-sm font-semibold text-fg">Bộ lọc</span>
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
                Xóa
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Mã GD, tên khách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition appearance-none cursor-pointer"
            >
              <option value="">Trạng thái</option>
              {Object.entries(paymentStatusConfig).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition appearance-none cursor-pointer"
            >
              <option value="">Phương thức</option>
              {paymentMethodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm bg-fg/[0.03] border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-acc/20 focus:border-acc transition"
            />
            <input
              type="date"
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
              <div className="w-7 h-7 rounded-lg bg-ink/10 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-acc" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-fg">Danh sách thanh toán</h3>
                <p className="text-xs text-muted">{filteredPayments.length} giao dịch</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="gap-2 text-muted hover:text-fg">
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Xuất Excel</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="p-10 text-center">
              <div className="w-10 h-10 border-3 border-acc/20 border-t-acc rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted">Đang tải dữ liệu...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-fg/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-muted" />
              </div>
              <h3 className="text-base font-semibold text-fg mb-1">Chưa có thanh toán nào</h3>
              <p className="text-sm text-muted mb-4">Tạo thanh toán mới để bắt đầu</p>
              <Button onClick={handleOpenCreateModal} className="gap-2">
                <Plus className="w-4 h-4" />
                Tạo thanh toán
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-fg/[0.03] border-b border-line">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Mã GD</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Đặt phòng</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Khách hàng</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Số tiền</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Phương thức</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Ngày</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredPayments.map((payment, index) => {
                    const statusInfo = paymentStatusConfig[payment.status] || paymentStatusConfig.PENDING
                    const methodInfo = paymentMethodLabels[payment.method] || { label: payment.method, icon: CreditCard }
                    const MethodIcon = methodInfo.icon
                    const StatusIcon = statusInfo.icon
                    
                    return (
                      <tr key={payment.id} className={`hover:bg-fg/[0.03] transition-colors ${index % 2 === 0 ? 'bg-panel' : 'bg-fg/[0.03]'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium text-fg bg-fg/5 px-2 py-1 rounded-lg">
                              {payment.id.slice(-8).toUpperCase()}
                            </span>
                            <button
                              onClick={() => handleCopyToClipboard(payment.id, payment.id)}
                              className="p-1 hover:bg-fg/10 rounded transition"
                              title="Sao chép"
                            >
                              {copiedId === payment.id ? (
                                <Check className="w-3 h-3 text-ok" />
                              ) : (
                                <Copy className="w-3 h-3 text-muted" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-fg">{payment.booking?.bookingCode}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-ink/10 text-acc font-semibold text-xs flex items-center justify-center">
                              {payment.booking?.guestName?.charAt(0)?.toUpperCase() || 'G'}
                            </div>
                            <span className="text-sm text-fg">{payment.booking?.guestName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-fg">{formatPrice(payment.amount)}</span>
                          {payment.fee > 0 && (
                            <span className="block text-xs text-muted">Phí: {formatPrice(payment.fee)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded bg-fg/5 flex items-center justify-center">
                              <MethodIcon className="w-3 h-3 text-muted" />
                            </div>
                            <span className="text-xs text-muted">{methodInfo.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted">
                            {format(new Date(payment.createdAt), 'dd/MM/yyyy')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleViewPayment(payment)} className="gap-1.5 text-muted hover:text-acc">
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Chi tiết</span>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContainer>

      {/* Create Payment Modal */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Tạo thanh toán mới"
        size="md"
      >
        {createSuccess ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-ok-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-ok" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">{createSuccess}</h3>
            <p className="text-muted">Đang chuyển hướng...</p>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              <Select
                label="Đơn đặt phòng"
                required
                value={createForm.bookingId}
                onChange={(e) => setCreateForm({ ...createForm, bookingId: e.target.value })}
                options={[
                  { value: '', label: 'Chọn đơn đặt phòng' },
                  ...bookings.map((b) => ({ value: b.id, label: `${b.bookingCode} - ${b.guestName}` })),
                ]}
              />
              
              <Select
                label="Phương thức thanh toán"
                required
                value={createForm.method}
                onChange={(e) => setCreateForm({ ...createForm, method: e.target.value })}
                options={paymentMethodOptions}
              />
              
              <Input
                label="Số tiền (VNĐ)"
                required
                type="number"
                min="0"
                step="1000"
                value={createForm.amount}
                onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                placeholder="Nhập số tiền"
              />

              {createError && (
                <div className="p-3 bg-err-soft border border-err/30 rounded-xl text-err text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {createError}
                </div>
              )}
            </div>
            <ModalFooter className="mt-6">
              <Button variant="secondary" onClick={() => setIsCreating(false)}>
                Hủy bỏ
              </Button>
              <Button onClick={handleCreatePayment} isLoading={isSubmitting} disabled={isSubmitting} className="gap-2">
                <Plus className="w-4 h-4" />
                Tạo thanh toán
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* View Payment Modal */}
      <Modal
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title="Chi tiết thanh toán"
        size="lg"
      >
        {selectedPayment && (
          <>
            <div className="space-y-6">
              {/* Payment Header */}
              <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-2xl border border-line/60">
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
                    Tạo lúc: {format(new Date(selectedPayment.createdAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border ${paymentStatusConfig[selectedPayment.status]?.bgColor} ${paymentStatusConfig[selectedPayment.status]?.color} ${paymentStatusConfig[selectedPayment.status]?.borderColor}`}>
                  {React.createElement(paymentStatusConfig[selectedPayment.status]?.icon, { className: 'w-4 h-4' })}
                  {paymentStatusConfig[selectedPayment.status]?.label}
                </span>
              </div>

              {/* Amount */}
              <div className="bg-acc-soft rounded-2xl p-6 text-center border border-acc/30">
                <p className="text-sm text-acc mb-2 font-medium">Số tiền thanh toán</p>
                <p className="text-4xl font-bold text-acc">{formatPrice(selectedPayment.amount)}</p>
                {selectedPayment.fee > 0 && (
                  <p className="text-sm text-acc mt-3 flex items-center justify-center gap-4">
                    <span>Phí: {formatPrice(selectedPayment.fee)}</span>
                    <span className="text-acc">•</span>
                    <span className="font-semibold">Thực nhận: {formatPrice(selectedPayment.netAmount)}</span>
                  </p>
                )}
              </div>

              {/* Payment Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-fg/[0.03] rounded-xl border border-line/60">
                  <div className="flex items-center gap-2 mb-2">
                    {React.createElement(paymentMethodLabels[selectedPayment.method]?.icon || CreditCard, { className: 'w-4 h-4 text-acc' })}
                    <span className="text-xs font-semibold text-muted uppercase">Phương thức</span>
                  </div>
                  <p className="font-semibold text-fg">{paymentMethodLabels[selectedPayment.method]?.label}</p>
                </div>
                <div className="p-4 bg-fg/[0.03] rounded-xl border border-line/60">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-acc" />
                    <span className="text-xs font-semibold text-muted uppercase">Đơn đặt phòng</span>
                  </div>
                  <p className="font-semibold text-fg">{selectedPayment.booking?.bookingCode}</p>
                </div>
                <div className="p-4 bg-fg/[0.03] rounded-xl border border-line/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-4 h-4 text-acc" />
                    <span className="text-xs font-semibold text-muted uppercase">Cơ sở</span>
                  </div>
                  <p className="font-semibold text-fg">{selectedPayment.booking?.property?.name}</p>
                </div>
                <div className="p-4 bg-fg/[0.03] rounded-xl border border-line/60">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-acc" />
                    <span className="text-xs font-semibold text-muted uppercase">Khách hàng</span>
                  </div>
                  <p className="font-semibold text-fg">{selectedPayment.booking?.guestName}</p>
                </div>
              </div>

              {/* Bank Transfer Info */}
              {(selectedPayment.method === 'BANK_TRANSFER' || selectedPayment.method === 'QR_VIETQR') && (
                <div className="border border-line/60 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-fg/[0.03] border-b border-line/60">
                    <h4 className="font-semibold text-fg flex items-center gap-2">
                      <Building className="w-4 h-4 text-acc" />
                      Thông tin chuyển khoản
                    </h4>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-line">
                      <span className="text-muted">Ngân hàng</span>
                      <span className="font-semibold text-fg">{selectedPayment.bankCode || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-line">
                      <span className="text-muted">Số tài khoản</span>
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
                      <span className="text-muted">Tên tài khoản</span>
                      <span className="font-semibold text-fg">{selectedPayment.accountHolder || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-acc-soft -mx-4 -mb-4 px-4 mt-2">
                      <span className="text-acc font-medium">Nội dung CK</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-acc text-lg">{selectedPayment.transferContent || 'N/A'}</span>
                        {selectedPayment.transferContent && (
                          <button
                            onClick={() => handleCopyToClipboard(selectedPayment.transferContent!, 'transferContent')}
                            className="p-1.5 hover:bg-acc-soft rounded-lg transition"
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
                <div className="border border-line/60 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-fg/[0.03] border-b border-line/60">
                    <h4 className="font-semibold text-fg flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-acc" />
                      Quét mã QR để thanh toán
                    </h4>
                  </div>
                  <div className="p-6 text-center bg-fg/[0.03]">
                    <div className="w-48 h-48 mx-auto bg-panel rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-line/40">
                      <QrCode className="w-36 h-36 text-fg" />
                    </div>
                    {selectedPayment.expiresAt && (
                      <p className="text-sm text-warn flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Hết hạn: {format(new Date(selectedPayment.expiresAt), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Paid Info */}
              {selectedPayment.paidAt && (
                <div className="bg-ok-soft rounded-2xl p-5 text-center border border-ok/30">
                  <CheckCircle className="w-10 h-10 text-ok mx-auto mb-3" />
                  <p className="text-ok font-semibold text-lg">
                    Thanh toán thành công
                  </p>
                  <p className="text-ok text-sm mt-1">
                    Lúc {format(new Date(selectedPayment.paidAt), 'HH:mm')} ngày {format(new Date(selectedPayment.paidAt), 'dd/MM/yyyy')}
                  </p>
                </div>
              )}
            </div>
            <ModalFooter className="mt-6">
              <Button variant="secondary" onClick={() => setSelectedPayment(null)} className="gap-2">
                Đóng
              </Button>
              {selectedPayment.status === 'PENDING' && (
                <Button onClick={() => handleConfirmPayment(selectedPayment.id)} className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Xác nhận đã thanh toán
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  )
}
