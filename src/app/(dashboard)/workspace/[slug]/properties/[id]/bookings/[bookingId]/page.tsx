'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Modal } from '@/components/ui'
import { routes } from '@/lib/utils/routes'
import { buildPrintSlipHtml } from '@/lib/bookings/print-slip'
import { 
  ArrowLeft, Calendar, Clock, Users, CreditCard, FileText, 
  CheckCircle, XCircle, Printer, Mail, User, AlertTriangle,
  CalendarPlus, Ban, UserX, Loader2
} from 'lucide-react'
import { format, addDays } from 'date-fns'

interface Booking {
  id: string
  bookingCode: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestNote: string | null
  checkInDate: string
  checkOutDate: string
  numAdults: number
  numChildren: number
  status: string
  subtotal: number
  extraCharges: number
  discount: number
  totalAmount: number
  depositAmount: number
  paymentStatus: string
  actualCheckIn: string | null
  actualCheckOut: string | null
  vatCompany: string | null
  vatTaxCode: string | null
  vatAddress: string | null
  vatEmail: string | null
  source: string
  createdAt: string
  bookingItems: any[]
  property: {
    id: string
    name: string
    subdomain: string
    address: string
    phone: string | null
    policy: {
      checkInTime: string | null
      checkOutTime: string | null
    } | null
  }
  payments: any[]
  invoices: any[]
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800' },
  CHECKED_IN: { label: 'Đã nhận phòng', color: 'bg-green-100 text-green-800' },
  CHECKED_OUT: { label: 'Đã trả phòng', color: 'bg-gray-100 text-gray-800' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Không đến', color: 'bg-orange-100 text-orange-800' },
}

export default function BookingDetailPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string; bookingId: string }>()
  const slug = params.slug
  const propertyId = params.id
  const bookingId = params.bookingId

  const [booking, setBooking] = React.useState<Booking | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [roomNumber, setRoomNumber] = React.useState('')
  
  // Modals
  const [showCancelModal, setShowCancelModal] = React.useState(false)
  const [showExtendModal, setShowExtendModal] = React.useState(false)
  const [showPaymentModal, setShowPaymentModal] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState('')
  const [extendDate, setExtendDate] = React.useState('')
  const [actionLoading, setActionLoading] = React.useState('')
  const [error, setError] = React.useState('')
  const [successMessage, setSuccessMessage] = React.useState('')

  React.useEffect(() => {
    fetchBooking()
  }, [bookingId])

  const fetchBooking = async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`)
      const data = await response.json()
      if (data.success) {
        setBooking(data.data)
        if (data.data.bookingItems[0]?.roomNumber) {
          setRoomNumber(data.data.bookingItems[0].roomNumber)
        }
        // Set default extend date to next day after checkout
        if (data.data.checkOutDate) {
          const checkout = new Date(data.data.checkOutDate)
          setExtendDate(format(addDays(checkout, 1), 'yyyy-MM-dd'))
        }
      }
    } catch (err) {
      console.error('Failed to fetch booking:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckIn = async () => {
    setActionLoading('checkin')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-in`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        fetchBooking()
      } else {
        alert(data.error)
      }
    } catch (err) {
      console.error('Check-in failed:', err)
    } finally {
      setActionLoading('')
    }
  }

  const handleCheckOut = async () => {
    setActionLoading('checkout')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-out`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        fetchBooking()
      } else {
        alert(data.error)
      }
    } catch (err) {
      console.error('Check-out failed:', err)
    } finally {
      setActionLoading('')
    }
  }

  const handleNoShow = async () => {
    if (!confirm('Đánh dấu khách không đến?')) return
    setActionLoading('noshow')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/no-show`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        alert('Đã đánh dấu no-show')
        fetchBooking()
      } else {
        alert(data.error)
      }
    } catch (err) {
      console.error('No-show failed:', err)
    } finally {
      setActionLoading('')
    }
  }

  const handleCancel = async () => {
    setActionLoading('cancel')
    setError('')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      })
      const data = await response.json()
      if (data.success) {
        alert('Đã hủy đặt phòng')
        if (data.refundInfo) {
          alert(`Số tiền hoàn: ${data.refundInfo.refundAmount?.toLocaleString('vi-VN')} VNĐ`)
        }
        setShowCancelModal(false)
        fetchBooking()
      } else {
        setError(data.error)
      }
    } catch (err) {
      console.error('Cancel failed:', err)
      setError('Lỗi khi hủy đặt phòng')
    } finally {
      setActionLoading('')
    }
  }

  const handleExtend = async () => {
    if (!extendDate) {
      setError('Vui lòng chọn ngày trả phòng mới')
      return
    }
    setActionLoading('extend')
    setError('')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newCheckOutDate: extendDate,
          addPayment: true,
          paymentMethod: 'CASH',
        }),
      })
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        setShowExtendModal(false)
        fetchBooking()
      } else {
        setError(data.error)
      }
    } catch (err) {
      console.error('Extend failed:', err)
      setError('Lỗi khi gia hạn đặt phòng')
    } finally {
      setActionLoading('')
    }
  }

  const handleUpdateRoomNumber = async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber }),
      })
      const data = await response.json()
      if (data.success) {
        fetchBooking()
      }
    } catch (err) {
      console.error('Update room number failed:', err)
    }
  }

  const handlePrintBooking = () => {
    if (!booking) return
    
    // Every value is escaped inside buildPrintSlipHtml: guest data comes from
    // the public booking form and this window shares the dashboard's origin.
    const printContent = buildPrintSlipHtml(booking, roomNumber, { date: formatDate, money: formatCurrency })
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 250)
    }
  }

  const handleSendConfirmation = async () => {
    setActionLoading('email')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/send-confirmation`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        setSuccessMessage('Đã gửi email xác nhận thành công!')
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        alert(data.error || 'Không thể gửi email')
      }
    } catch (err) {
      console.error('Send email failed:', err)
      alert('Lỗi khi gửi email')
    } finally {
      setActionLoading('')
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const calculateNights = () => {
    if (!booking) return 0
    const checkIn = new Date(booking.checkInDate)
    const checkOut = new Date(booking.checkOutDate)
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageContainer>
    )
  }

  if (!booking) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Không tìm thấy đơn đặt phòng</p>
            <Button onClick={() => router.push(routes.propertyBookings(params.slug, params.id!))} className="mt-4">
              Quay lại
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const canCheckIn = booking.status === 'PENDING' || booking.status === 'CONFIRMED'
  const canCheckOut = booking.status === 'CHECKED_IN'
  const canCancel = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)
  const canNoShow = ['PENDING', 'CONFIRMED'].includes(booking.status)
  const canExtend = booking.status === 'CHECKED_IN' || booking.status === 'CONFIRMED'

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push(routes.propertyBookings(params.slug, params.id!))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
      </div>

      <Header
        title={`Đơn ${booking.bookingCode}`}
        description={booking.property.name}
        actions={
          <div className="flex items-center gap-2">
            <Badge className={`${statusConfig[booking.status]?.color} text-sm px-3 py-1`}>
              {statusConfig[booking.status]?.label}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Guest Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Thông tin khách
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tên khách</p>
                  <p className="font-medium">{booking.guestName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số điện thoại</p>
                  <p className="font-medium">{booking.guestPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{booking.guestEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nguồn đặt</p>
                  <p className="font-medium">
                    {booking.source === 'DIRECT' ? 'Trực tuyến' : 
                     booking.source === 'WALK_IN' ? 'Tại quầy' : booking.source}
                  </p>
                </div>
              </div>
              {booking.guestNote && (
                <div>
                  <p className="text-sm text-gray-500">Ghi chú</p>
                  <p className="font-medium">{booking.guestNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Room Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Thông tin phòng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Ngày nhận</p>
                  <p className="font-semibold">{formatDate(booking.checkInDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ngày trả</p>
                  <p className="font-semibold">{formatDate(booking.checkOutDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số đêm</p>
                  <p className="font-semibold">{calculateNights()} đêm</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Số khách</p>
                  <p className="font-semibold">
                    {booking.numAdults} NL
                    {booking.numChildren > 0 && ` + ${booking.numChildren} TE`}
                  </p>
                </div>
              </div>

              {/* Room Number Assignment */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">Số phòng</label>
                    <Input
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="VD: 101"
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleUpdateRoomNumber}
                    disabled={!roomNumber}
                  >
                    Cập nhật
                  </Button>
                </div>
              </div>

              {/* Check-in/Check-out Times */}
              <div className="pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Giờ nhận phòng</p>
                    <p className="font-semibold text-lg">{booking.property.policy?.checkInTime || '14:00'}</p>
                    {booking.actualCheckIn && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Đã nhận: {formatDate(booking.actualCheckIn)}
                      </p>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Giờ trả phòng</p>
                    <p className="font-semibold text-lg">{booking.property.policy?.checkOutTime || '12:00'}</p>
                    {booking.actualCheckOut && (
                      <p className="text-xs text-blue-600 mt-1">
                        ✓ Đã trả: {formatDate(booking.actualCheckOut)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* VAT Info */}
          {booking.vatCompany && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Thông tin xuất hóa đơn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Tên công ty</p>
                    <p className="font-medium">{booking.vatCompany}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mã số thuế</p>
                    <p className="font-medium">{booking.vatTaxCode}</p>
                  </div>
                  {booking.vatAddress && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Địa chỉ công ty</p>
                      <p className="font-medium">{booking.vatAddress}</p>
                    </div>
                  )}
                  {booking.vatEmail && (
                    <div>
                      <p className="text-sm text-gray-500">Email công ty</p>
                      <p className="font-medium">{booking.vatEmail}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Thao tác</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Primary actions */}
              {canCheckIn && (
                <Button 
                  className="w-full" 
                  onClick={handleCheckIn}
                  isLoading={actionLoading === 'checkin'}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Check-in khách
                </Button>
              )}
              {canCheckOut && (
                <Button 
                  className="w-full" 
                  onClick={handleCheckOut}
                  isLoading={actionLoading === 'checkout'}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Check-out khách
                </Button>
              )}

              {/* Secondary actions */}
              {canExtend && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setShowExtendModal(true)}
                  disabled={!!actionLoading}
                >
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Gia hạn đặt phòng
                </Button>
              )}
              
              {canNoShow && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleNoShow}
                  isLoading={actionLoading === 'noshow'}
                >
                  <UserX className="w-4 h-4 mr-2" />
                  Đánh dấu không đến
                </Button>
              )}
              
              {canCancel && (
                <Button 
                  variant="outline" 
                  className="w-full text-red-600 border-red-200 hover:bg-red-50" 
                  onClick={() => setShowCancelModal(true)}
                  disabled={!!actionLoading}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Hủy đặt phòng
                </Button>
              )}

              <div className="border-t border-gray-100 pt-3">
                <Button variant="outline" className="w-full" onClick={handlePrintBooking}>
                  <Printer className="w-4 h-4 mr-2" />
                  In phiếu
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full mt-2" 
                  onClick={handleSendConfirmation}
                  disabled={actionLoading === 'email'}
                >
                  {actionLoading === 'email' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Gửi email xác nhận
                </Button>
              </div>
              
              {successMessage && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 text-center">
                  {successMessage}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Thanh toán
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tiền phòng</span>
                <span>{formatCurrency(booking.subtotal)}</span>
              </div>
              {booking.extraCharges > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Phụ phí</span>
                  <span>{formatCurrency(booking.extraCharges)}</span>
                </div>
              )}
              {booking.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Giảm giá</span>
                  <span>-{formatCurrency(booking.discount)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between font-semibold">
                  <span>Tổng cộng</span>
                  <span className="text-lg">{formatCurrency(booking.totalAmount)}</span>
                </div>
                {booking.depositAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 mt-1">
                    <span>Đã thanh toán</span>
                    <span>{formatCurrency(booking.depositAmount)}</span>
                  </div>
                )}
              </div>
              
              <Badge 
                className={`w-full justify-center ${booking.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
              >
                {booking.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
              </Badge>
            </CardContent>
          </Card>

          {/* Property Info */}
          <Card>
            <CardHeader>
              <CardTitle>{booking.property.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">{booking.property.address}</p>
              <p className="text-sm text-gray-500 mt-1">{booking.property.phone}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Hủy đặt phòng"
      >
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            Hành động này không thể hoàn tác.
          </div>
          
          {booking.depositAmount > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p className="text-gray-600">Khách đã thanh toán: <strong>{formatCurrency(booking.depositAmount)}</strong></p>
              <p className="text-gray-600">Số tiền hoàn (nếu có) sẽ được xử lý theo chính sách hủy.</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lý do hủy (tùy chọn)</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Nhập lý do hủy đặt phòng..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowCancelModal(false)} className="flex-1">
              Đóng
            </Button>
            <Button 
              variant="danger" 
              onClick={handleCancel}
              isLoading={actionLoading === 'cancel'}
              className="flex-1"
            >
              Xác nhận hủy
            </Button>
          </div>
        </div>
      </Modal>

      {/* Extend Modal */}
      <Modal
        isOpen={showExtendModal}
        onClose={() => setShowExtendModal(false)}
        title="Gia hạn đặt phòng"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="text-gray-600">Ngày trả phòng hiện tại: <strong>{formatDate(booking.checkOutDate)}</strong></p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày trả phòng mới</label>
            <Input
              type="date"
              value={extendDate}
              onChange={(e) => setExtendDate(e.target.value)}
              min={format(addDays(new Date(booking.checkOutDate), 1), 'yyyy-MM-dd')}
            />
            <p className="text-xs text-gray-500 mt-1">Chọn ngày trả phòng mới (phải sau ngày hiện tại)</p>
          </div>
          
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowExtendModal(false)} className="flex-1">
              Đóng
            </Button>
            <Button 
              onClick={handleExtend}
              isLoading={actionLoading === 'extend'}
              className="flex-1"
            >
              Xác nhận gia hạn
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

