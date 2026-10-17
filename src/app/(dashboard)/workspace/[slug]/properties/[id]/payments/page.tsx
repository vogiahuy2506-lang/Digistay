'use client'

import * as React from 'react'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Select, Modal, ModalFooter } from '@/components/ui'
import { 
  Search, Filter, CreditCard, Smartphone, Banknote, Building, 
  Clock, CheckCircle, XCircle, AlertCircle, Download, RefreshCw,
  Plus, Eye, QrCode, FileText, Copy, Check
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

const paymentStatusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  PENDING: { label: 'Chờ thanh toán', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Clock },
  PAID: { label: 'Đã thanh toán', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  FAILED: { label: 'Thất bại', color: 'text-red-600', bgColor: 'bg-red-50', icon: XCircle },
  EXPIRED: { label: 'Hết hạn', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: AlertCircle },
  REFUNDED: { label: 'Đã hoàn tiền', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: RefreshCw },
}

export default function PaymentsPage() {
  const [payments, setPayments] = React.useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = React.useState<Payment[]>([])
  const [properties, setProperties] = React.useState<Property[]>([])
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreating, setIsCreating] = React.useState(false)
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
    setStats({ total, pending, paid, failed })
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
    try {
      const res = await fetch(`/api/payments/${paymentId}/confirm`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
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
    <div>
      <Header
        title="Thanh Toán"
        description="Quản lý các khoản thanh toán"
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
              Tạo thanh toán
            </Button>
          </div>
        }
      />

      <PageContainer>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Tổng thanh toán</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.total)}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Đã thanh toán</p>
                  <p className="text-2xl font-bold text-green-600">{formatPrice(stats.paid)}</p>
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
                  <p className="text-sm text-gray-500">Chờ thanh toán</p>
                  <p className="text-2xl font-bold text-amber-600">{formatPrice(stats.pending)}</p>
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
                  <p className="text-sm text-gray-500">Thất bại/Hết hạn</p>
                  <p className="text-2xl font-bold text-red-600">{formatPrice(stats.failed)}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <Input
                placeholder="Mã GD, tên khách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="md:col-span-2"
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'Tất cả trạng thái' },
                  ...Object.entries(paymentStatusConfig).map(([key, { label }]) => ({ value: key, label })),
                ]}
              />
              <Select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                options={[
                  { value: '', label: 'Tất cả phương thức' },
                  ...paymentMethodOptions,
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

        {/* Payments List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-500">Đang tải...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-8 text-center">
                <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Chưa có thanh toán nào</p>
                <Button onClick={handleOpenCreateModal} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo thanh toán
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã GD</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đặt phòng</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số tiền</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phương thức</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPayments.map((payment) => {
                      const statusInfo = paymentStatusConfig[payment.status] || paymentStatusConfig.PENDING
                      const methodInfo = paymentMethodLabels[payment.method] || { label: payment.method, icon: CreditCard }
                      const MethodIcon = methodInfo.icon
                      const StatusIcon = statusInfo.icon
                      
                      return (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{payment.id.slice(-8).toUpperCase()}</span>
                              <button
                                onClick={() => handleCopyToClipboard(payment.id, payment.id)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                {copiedId === payment.id ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Copy className="w-3 h-3 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium">{payment.booking?.bookingCode}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span>{payment.booking?.guestName}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold">{formatPrice(payment.amount)}</span>
                            {payment.fee > 0 && (
                              <span className="block text-xs text-gray-400">Phí: {formatPrice(payment.fee)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <MethodIcon className="w-4 h-4 text-gray-400" />
                              <span>{methodInfo.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-500">
                              {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="ghost" onClick={() => handleViewPayment(payment)}>
                              <Eye className="w-4 h-4" />
                            </Button>
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

      {/* Create Payment Modal */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Tạo thanh toán mới"
        description="Tạo yêu cầu thanh toán cho đơn đặt phòng"
        size="md"
      >
        {createSuccess ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{createSuccess}</h3>
            <p className="text-gray-500">Đang chuyển hướng...</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {createError}
                </div>
              )}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setIsCreating(false)}>
                Hủy
              </Button>
              <Button onClick={handleCreatePayment}>
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-lg font-semibold">
                    {selectedPayment.id.slice(-8).toUpperCase()}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Tạo lúc: {format(new Date(selectedPayment.createdAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <Badge className={`${paymentStatusConfig[selectedPayment.status]?.bgColor} ${paymentStatusConfig[selectedPayment.status]?.color}`}>
                  {paymentStatusConfig[selectedPayment.status]?.label}
                </Badge>
              </div>

              {/* Amount */}
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Số tiền thanh toán</p>
                <p className="text-3xl font-bold text-gray-900">{formatPrice(selectedPayment.amount)}</p>
                {selectedPayment.fee > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    Phí: {formatPrice(selectedPayment.fee)} | Thực nhận: {formatPrice(selectedPayment.netAmount)}
                  </p>
                )}
              </div>

              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Phương thức</p>
                  <div className="flex items-center gap-2">
                    {React.createElement(paymentMethodLabels[selectedPayment.method]?.icon || CreditCard, { className: 'w-5 h-5 text-gray-400' })}
                    <span className="font-medium">{paymentMethodLabels[selectedPayment.method]?.label}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Đơn đặt phòng</p>
                  <span className="font-medium">{selectedPayment.booking?.bookingCode}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Khách hàng</p>
                  <span className="font-medium">{selectedPayment.booking?.guestName}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Cơ sở</p>
                  <span className="font-medium">{selectedPayment.booking?.property?.name}</span>
                </div>
              </div>

              {/* Bank Transfer Info */}
              {(selectedPayment.method === 'BANK_TRANSFER' || selectedPayment.method === 'QR_VIETQR') && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Thông tin chuyển khoản</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ngân hàng:</span>
                      <span className="font-medium">{selectedPayment.bankCode || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Số tài khoản:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{selectedPayment.bankAccount || 'N/A'}</span>
                        {selectedPayment.bankAccount && (
                          <button
                            onClick={() => handleCopyToClipboard(selectedPayment.bankAccount!, 'bankAccount')}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {copiedId === 'bankAccount' ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Tên tài khoản:</span>
                      <span className="font-medium">{selectedPayment.accountHolder || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-50 -mx-4 -mb-4 p-4 mt-2 rounded-b-lg">
                      <span className="text-gray-500">Nội dung CK:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary">{selectedPayment.transferContent || 'N/A'}</span>
                        {selectedPayment.transferContent && (
                          <button
                            onClick={() => handleCopyToClipboard(selectedPayment.transferContent!, 'transferContent')}
                            className="p-1 hover:bg-blue-100 rounded"
                          >
                            {copiedId === 'transferContent' ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-blue-400" />
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
                <div className="border rounded-lg p-4 text-center">
                  <h4 className="font-medium mb-3">Quét mã QR để thanh toán</h4>
                  <div className="bg-gray-100 rounded-lg p-8 inline-block">
                    <QrCode className="w-48 h-48 text-gray-800" />
                  </div>
                  {selectedPayment.expiresAt && (
                    <p className="text-sm text-amber-600 mt-3">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Hết hạn: {format(new Date(selectedPayment.expiresAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                </div>
              )}

              {/* Paid Info */}
              {selectedPayment.paidAt && (
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-medium">
                    Đã thanh toán lúc {format(new Date(selectedPayment.paidAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              )}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setSelectedPayment(null)}>
                Đóng
              </Button>
              {selectedPayment.status === 'PENDING' && (
                <Button onClick={() => handleConfirmPayment(selectedPayment.id)}>
                  <CheckCircle className="w-4 h-4 mr-2" />
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
