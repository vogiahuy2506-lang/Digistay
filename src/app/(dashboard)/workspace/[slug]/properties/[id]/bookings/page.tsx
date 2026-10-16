'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Select, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { routes } from '@/lib/utils/routes'
import { 
  Search, Filter, Plus, Calendar, Clock, CheckCircle, XCircle, 
  Users, CreditCard, Eye, MoreVertical, ArrowRightLeft, Wrench
} from 'lucide-react'

interface Booking {
  id: string
  bookingCode: string
  guestName: string
  guestEmail: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  numAdults: number
  numChildren: number
  status: string
  totalAmount: number
  paymentStatus: string
  source: string
  createdAt: string
  property: {
    id: string
    name: string
    subdomain: string
  }
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800' },
  CHECKED_IN: { label: 'Đã nhận phòng', color: 'bg-green-100 text-green-800' },
  CHECKED_OUT: { label: 'Đã trả phòng', color: 'bg-gray-100 text-gray-800' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Không đến', color: 'bg-orange-100 text-orange-800' },
}

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chưa thanh toán', color: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: 'Đã thanh toán', color: 'bg-green-100 text-green-800' },
  PARTIAL: { label: 'Thanh toán một phần', color: 'bg-blue-100 text-blue-800' },
  REFUNDED: { label: 'Đã hoàn tiền', color: 'bg-orange-100 text-orange-800' },
}

export default function BookingsPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('all')

  React.useEffect(() => {
    fetchBookings()
  }, [propertyId, statusFilter, activeTab])

  const fetchBookings = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (propertyId) params.set('propertyId', propertyId)
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/bookings?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setBookings(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckIn = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-in`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        fetchBookings()
      } else {
        alert(data.error)
      }
    } catch (err) {
      console.error('Check-in failed:', err)
    }
  }

  const handleCheckOut = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-out`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        fetchBookings()
      } else {
        alert(data.error)
      }
    } catch (err) {
      console.error('Check-out failed:', err)
    }
  }

  const filteredBookings = bookings.filter(booking => {
    if (activeTab === 'all') return true
    if (activeTab === 'upcoming') {
      return ['PENDING', 'CONFIRMED'].includes(booking.status)
    }
    if (activeTab === 'checked-in') {
      return booking.status === 'CHECKED_IN'
    }
    if (activeTab === 'checked-out') {
      return booking.status === 'CHECKED_OUT'
    }
    return true
  }).filter(booking => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      booking.bookingCode.toLowerCase().includes(query) ||
      booking.guestName.toLowerCase().includes(query) ||
      booking.guestPhone.includes(query)
    )
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <PageContainer>
      <Header
        title="Quản lý đặt phòng"
        description="Xem và quản lý tất cả đơn đặt phòng"
        actions={
          <Button onClick={() => router.push(routes.propertyBookingNew(params.slug, propertyId!))}>
            <Plus className="w-4 h-4 mr-2" />
            Tạo đặt phòng
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Tìm mã đặt phòng, tên khách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Select
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'PENDING', label: 'Chờ thanh toán' },
                { value: 'CONFIRMED', label: 'Đã xác nhận' },
                { value: 'CHECKED_IN', label: 'Đã nhận phòng' },
                { value: 'CHECKED_OUT', label: 'Đã trả phòng' },
                { value: 'CANCELLED', label: 'Đã hủy' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="upcoming">Sắp tới</TabsTrigger>
          <TabsTrigger value="checked-in">Đang ở</TabsTrigger>
          <TabsTrigger value="checked-out">Đã trả</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Bookings List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Chưa có đơn đặt phòng nào</p>
            <Button onClick={() => router.push(routes.propertyBookingNew(params.slug, propertyId!))} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Tạo đặt phòng mới
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <Card key={booking.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Booking Info */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono font-semibold text-primary">
                        {booking.bookingCode}
                      </span>
                      <Badge className={statusConfig[booking.status]?.color}>
                        {statusConfig[booking.status]?.label}
                      </Badge>
                      <Badge className={paymentStatusConfig[booking.paymentStatus]?.color}>
                        {paymentStatusConfig[booking.paymentStatus]?.label}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-gray-900">{booking.guestName}</h3>
                    <p className="text-sm text-gray-500">{booking.guestPhone}</p>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Nhận phòng</p>
                      <p className="font-semibold">{formatDate(booking.checkInDate)}</p>
                    </div>
                    <ArrowRightLeft className="w-5 h-5 text-gray-300" />
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Trả phòng</p>
                      <p className="font-semibold">{formatDate(booking.checkOutDate)}</p>
                    </div>
                  </div>

                  {/* Guests & Amount */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end text-sm text-gray-500 mb-1">
                      <Users className="w-4 h-4" />
                      {booking.numAdults} người lớn
                      {booking.numChildren > 0 && `, ${booking.numChildren} trẻ em`}
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(booking.totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    {formatDate(booking.createdAt)}
                    <span>•</span>
                    <span>{booking.source === 'DIRECT' ? 'Đặt trực tuyến' : 'Tại quầy'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(routes.propertyBooking(params.slug, propertyId!, booking.id))}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Chi tiết
                    </Button>
                    
                    {booking.status === 'CONFIRMED' || booking.status === 'PENDING' ? (
                      <Button 
                        size="sm"
                        onClick={() => handleCheckIn(booking.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Check-in
                      </Button>
                    ) : booking.status === 'CHECKED_IN' ? (
                      <Button 
                        size="sm"
                        onClick={() => handleCheckOut(booking.id)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Check-out
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
