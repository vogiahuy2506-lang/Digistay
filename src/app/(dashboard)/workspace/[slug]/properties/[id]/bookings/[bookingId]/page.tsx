'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Textarea } from '@/components/ui'
import { routes } from '@/lib/utils/routes'
import { 
  ArrowLeft, Calendar, Clock, Users, CreditCard, FileText, 
  CheckCircle, XCircle, Printer, Mail, ArrowRightLeft, User
} from 'lucide-react'

interface Booking {
  id: string
  bookingCode: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestNote: string
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
  actualCheckIn: string
  actualCheckOut: string
  vatCompany: string
  vatTaxCode: string
  source: string
  createdAt: string
  bookingItems: any[]
  property: {
    id: string
    name: string
    subdomain: string
    address: string
    phone: string
    policy: {
      checkInTime: string
      checkOutTime: string
    }
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
      }
    } catch (err) {
      console.error('Failed to fetch booking:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckIn = async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-in`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        fetchBooking()
      } else {
        alert(data.error)
      }
    } catch (err) {
      console.error('Check-in failed:', err)
    }
  }

  const handleCheckOut = async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-out`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        fetchBooking()
      } else {
        alert(data.error)
      }
    } catch (err) {
      console.error('Check-out failed:', err)
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
                      <p className="text-xs text-gray-500 mt-1">
                        Thực tế: {formatDate(booking.actualCheckIn)}
                      </p>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Giờ trả phòng</p>
                    <p className="font-semibold text-lg">{booking.property.policy?.checkOutTime || '12:00'}</p>
                    {booking.actualCheckOut && (
                      <p className="text-xs text-gray-500 mt-1">
                        Thực tế: {formatDate(booking.actualCheckOut)}
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
              {booking.status === 'CONFIRMED' || booking.status === 'PENDING' ? (
                <Button className="w-full" onClick={handleCheckIn}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Check-in khách
                </Button>
              ) : booking.status === 'CHECKED_IN' ? (
                <Button className="w-full" onClick={handleCheckOut}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Check-out khách
                </Button>
              ) : null}

              <Button variant="outline" className="w-full">
                <Printer className="w-4 h-4 mr-2" />
                In phiếu
              </Button>
              
              <Button variant="outline" className="w-full">
                <Mail className="w-4 h-4 mr-2" />
                Gửi email xác nhận
              </Button>
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
    </PageContainer>
  )
}
