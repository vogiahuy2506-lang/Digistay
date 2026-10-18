'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Select, Modal } from '@/components/ui'
import { VietQRDisplay } from '@/components/payment/VietQRDisplay'
import { 
  Search, Calendar, Users, CreditCard, User, Phone, Mail, 
  Home, Check, ArrowLeft, ChevronRight, Clock, Copy, AlertCircle
} from 'lucide-react'
import { format, addDays, differenceInDays } from 'date-fns'
import { routes } from '@/lib/utils/routes'

interface RoomType {
  id: string
  name: string
  bedType: string
  baseOccupancy: number
  maxOccupancy: number
  totalRooms: number
  availableRooms: number
  isActive: boolean
  isAvailable?: boolean
  pricing: { weekdayPrice: number; weekendPrice: number }[]
}

interface Room {
  id: string
  number: string
  floor: number
  status: string
}

interface Property {
  id: string
  name: string
  subdomain: string
}

interface GuestInfo {
  name: string
  phone: string
  email: string
  note: string
}

interface BookingResult {
  id: string
  bookingCode: string
  status: string
}

interface PaymentInfo {
  id: string
  amount: number
  method: string
  qrCodeUrl: string | null
  transferContent: string
  bankAccount: {
    bankName: string
    accountNumber: string
    accountHolder: string
  } | null
  expiresAt: string
}

const bedTypeLabels: Record<string, string> = {
  SINGLE: 'Giường đơn',
  DOUBLE: 'Giường đôi',
  TWIN: 'Hai giường đơn',
  TRIPLE: 'Ba giường',
  QUADRUPLE: 'Bốn giường',
}

const paymentMethods = [
  { value: 'CASH', label: 'Tiền mặt', icon: '💵', desc: 'Thanh toán trực tiếp tại quầy' },
  { value: 'QR_VIETQR', label: 'Quét QR VietQR', icon: '📱', desc: 'Chuyển khoản qua mã QR' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản', icon: '🏦', desc: 'Chuyển khoản thủ công' },
]

export default function WalkinBookingPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyIdFromUrl = params.id
  
  const [properties, setProperties] = React.useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = React.useState(propertyIdFromUrl || '')
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([])
  const [availableRooms, setAvailableRooms] = React.useState<Room[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  
  // Booking steps: 1=search, 2=guest info, 3=payment, 4=confirmation
  const [currentStep, setCurrentStep] = React.useState(1)
  
  // Search criteria
  const [checkInDate, setCheckInDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))
  const [checkOutDate, setCheckOutDate] = React.useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [numAdults, setNumAdults] = React.useState('1')
  const [numChildren, setNumChildren] = React.useState('0')
  
  // Selected items
  const [selectedRoomType, setSelectedRoomType] = React.useState<RoomType | null>(null)
  const [selectedRoom, setSelectedRoom] = React.useState<Room | null>(null)
  const [guestInfo, setGuestInfo] = React.useState<GuestInfo>({
    name: '',
    phone: '',
    email: '',
    note: '',
  })
  
  // Payment
  const [paymentMethod, setPaymentMethod] = React.useState('CASH')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [bookingResult, setBookingResult] = React.useState<BookingResult | null>(null)
  const [paymentInfo, setPaymentInfo] = React.useState<PaymentInfo | null>(null)
  const [showQRModal, setShowQRModal] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    fetchProperties()
  }, [])

  React.useEffect(() => {
    if (selectedProperty && checkInDate && checkOutDate) {
      searchAvailability()
    }
  }, [selectedProperty, checkInDate, checkOutDate])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setProperties(data.data)
        if (!selectedProperty) {
          setSelectedProperty(data.data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
    }
  }

  const searchAvailability = async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/bookings/availability?propertyId=${selectedProperty}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&numGuests=${parseInt(numAdults) + parseInt(numChildren)}`
      )
      const data = await res.json()
      if (data.success) {
        setRoomTypes(data.data.filter((rt: RoomType) => rt.isAvailable))
      } else {
        setError(data.error || 'Lỗi khi tìm kiếm')
      }
    } catch (err) {
      console.error('Failed to search availability:', err)
      setError('Lỗi kết nối')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAvailableRooms = async (roomTypeId: string) => {
    try {
      const res = await fetch(
        `/api/rooms/available?propertyId=${selectedProperty}&roomTypeId=${roomTypeId}&checkIn=${checkInDate}&checkOut=${checkOutDate}`
      )
      const data = await res.json()
      if (data.success) {
        setAvailableRooms(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err)
    }
  }

  const calculateNights = () => {
    return differenceInDays(new Date(checkOutDate), new Date(checkInDate))
  }

  const calculatePrice = () => {
    if (!selectedRoomType) return { total: 0, breakdown: [] }
    
    const nights = calculateNights()
    const pricing = selectedRoomType.pricing[0]
    if (!pricing) return { total: 0, breakdown: [] }
    
    let weekdayNights = 0
    let weekendNights = 0
    
    let current = new Date(checkInDate)
    while (current < new Date(checkOutDate)) {
      const day = current.getDay()
      if (day === 0 || day === 6) {
        weekendNights++
      } else {
        weekdayNights++
      }
      current = addDays(current, 1)
    }
    
    const weekdayTotal = weekdayNights * pricing.weekdayPrice
    const weekendTotal = weekendNights * pricing.weekendPrice
    const total = weekdayTotal + weekendTotal
    
    return {
      total,
      breakdown: [
        { label: `${weekdayNights} đêm ngày thường x ${formatPrice(pricing.weekdayPrice)}`, amount: weekdayTotal },
        { label: `${weekendNights} đêm cuối tuần x ${formatPrice(pricing.weekendPrice)}`, amount: weekendTotal },
      ],
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price)
  }

  const handleSelectRoomType = (roomType: RoomType) => {
    setSelectedRoomType(roomType)
    fetchAvailableRooms(roomType.id)
  }

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room)
    setCurrentStep(2)
  }

  const handleSubmitBooking = async () => {
    if (!guestInfo.name || !guestInfo.phone) {
      setError('Vui lòng nhập đầy đủ thông tin khách hàng')
      return
    }
    
    setIsSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedProperty,
          roomTypeId: selectedRoomType?.id,
          guestName: guestInfo.name,
          guestPhone: guestInfo.phone,
          guestEmail: guestInfo.email,
          guestNote: guestInfo.note,
          checkInDate,
          checkOutDate,
          numAdults: parseInt(numAdults),
          numChildren: parseInt(numChildren),
          roomNumber: selectedRoom?.number,
        }),
      })
      const data = await res.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Đặt phòng thất bại')
      }

      const booking = data.data
      
      // For cash payment, booking is immediately confirmed
      if (paymentMethod === 'CASH') {
        setBookingResult({ id: booking.id, bookingCode: booking.bookingCode, status: booking.status })
        setCurrentStep(4)
      } else {
        // For QR/bank transfer, create payment and show QR code
        const paymentRes = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: booking.id,
            method: paymentMethod,
            amount: calculatePrice().total,
          }),
        })
        const paymentData = await paymentRes.json()
        
        if (!paymentData.success) {
          throw new Error(paymentData.error || 'Tạo thanh toán thất bại')
        }

        setBookingResult({ id: booking.id, bookingCode: booking.bookingCode, status: 'PENDING' })
        setPaymentInfo(paymentData.data)
        
        if (paymentMethod === 'QR_VIETQR' && paymentData.data.qrCodeUrl) {
          setShowQRModal(true)
        }
        setCurrentStep(4)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const steps = [
    { number: 1, title: 'Chọn phòng', icon: Home },
    { number: 2, title: 'Thông tin khách', icon: User },
    { number: 3, title: 'Thanh toán', icon: CreditCard },
    { number: 4, title: 'Hoàn tất', icon: Check },
  ]

  const pricing = calculatePrice()

  return (
    <div>
      <Header
        title="Đặt Phòng Walk-in"
        description="Tạo đặt phòng cho khách đến trực tiếp"
        actions={
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
        }
      />

      <PageContainer>
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                    ${currentStep >= step.number 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-200 text-gray-500'}
                  `}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-20 h-0.5 mx-4 ${
                    currentStep > step.number ? 'bg-primary' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Step 1: Search & Select Room */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Search Card */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Tìm kiếm phòng trống</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <Select
                    label="Cơ sở"
                    value={selectedProperty}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                  <Input
                    label="Ngày nhận phòng"
                    type="date"
                    value={checkInDate}
                    onChange={(e) => {
                      const next = e.target.value
                      setCheckInDate(next)
                      setCheckOutDate((prev) =>
                        !prev || prev <= next
                          ? format(addDays(new Date(next), 1), 'yyyy-MM-dd')
                          : prev
                      )
                    }}
                  />
                  <Input
                    label="Ngày trả phòng"
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    min={checkInDate}
                  />
                  <Input
                    label="Người lớn"
                    type="number"
                    value={numAdults}
                    onChange={(e) => setNumAdults(e.target.value)}
                    min="1"
                    max="10"
                  />
                  <Input
                    label="Trẻ em"
                    type="number"
                    value={numChildren}
                    onChange={(e) => setNumChildren(e.target.value)}
                    min="0"
                    max="10"
                  />
                  <div className="flex items-end">
                    <Button onClick={searchAvailability} disabled={isLoading} className="w-full">
                      <Search className="w-4 h-4 mr-2" />
                      Tìm kiếm
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-500">Đang tìm kiếm phòng trống...</p>
              </div>
            ) : roomTypes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    {selectedProperty ? 'Không có phòng trống trong khoảng thời gian này' : 'Vui lòng chọn cơ sở'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold">Phòng trống ({roomTypes.length})</h3>
                {roomTypes.map((roomType) => (
                  <div
                    key={roomType.id}
                    className={`cursor-pointer transition-all hover:shadow-lg rounded-xl border border-gray-200 bg-white ${
                      selectedRoomType?.id === roomType.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleSelectRoomType(roomType)}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-lg">{roomType.name}</h4>
                            <Badge variant="secondary">{bedTypeLabels[roomType.bedType]}</Badge>
                            <Badge variant="outline">{roomType.availableRooms} phòng trống</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {roomType.baseOccupancy}-{roomType.maxOccupancy} khách
                            </span>
                            <span className="flex items-center gap-1">
                              <Home className="w-4 h-4" />
                              {roomType.totalRooms} phòng
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary-600">
                            {formatPrice(roomType.pricing[0]?.weekdayPrice || 0)}
                          </p>
                          <p className="text-sm text-gray-500">/ đêm</p>
                        </div>
                      </div>
                      
                      {/* Show available rooms if selected */}
                      {selectedRoomType?.id === roomType.id && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-medium mb-3">Chọn phòng cụ thể:</p>
                          {availableRooms.length > 0 ? (
                            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                              {availableRooms.map((room) => (
                                <button
                                  key={room.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSelectRoom(room)
                                  }}
                                  className={`
                                    p-3 rounded-lg border text-center transition-all
                                    ${selectedRoom?.id === room.id 
                                      ? 'border-primary bg-primary-50 text-primary-700' 
                                      : 'border-gray-200 hover:border-primary hover:bg-gray-50'}
                                  `}
                                >
                                  <span className="font-medium">{room.number}</span>
                                  <span className="block text-xs text-gray-500">Tầng {room.floor}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">Đang tải danh sách phòng...</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Guest Information */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Thông tin khách hàng</h3>
                <div className="space-y-4">
                  <Input
                    label="Họ tên khách *"
                    value={guestInfo.name}
                    onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                  <Input
                    label="Số điện thoại *"
                    value={guestInfo.phone}
                    onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                    placeholder="0912345678"
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={guestInfo.email}
                    onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                    <textarea
                      value={guestInfo.note}
                      onChange={(e) => setGuestInfo({ ...guestInfo, note: e.target.value })}
                      placeholder="Yêu cầu đặc biệt..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent"
                    />
                  </div>
                </div>
                
                {/* Booking Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">Tóm tắt đặt phòng</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phòng</span>
                      <span className="font-medium">{selectedRoomType?.name} - Phòng {selectedRoom?.number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Nhận phòng</span>
                      <span>{format(new Date(checkInDate), 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Trả phòng</span>
                      <span>{format(new Date(checkOutDate), 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Số đêm</span>
                      <span>{calculateNights()} đêm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Khách</span>
                      <span>{numAdults} người lớn{numChildren !== '0' ? `, ${numChildren} trẻ em` : ''}</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                      <span>Tổng cộng</span>
                      <span className="text-primary-600">{formatPrice(pricing.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                  </Button>
                  <Button onClick={() => setCurrentStep(3)}>
                    Tiếp tục thanh toán
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Payment */}
        {currentStep === 3 && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Phương thức thanh toán</h3>
                
                <div className="space-y-3 mb-6">
                  {paymentMethods.map((method) => (
                    <label
                      key={method.value}
                      className={`
                        flex items-center p-4 border rounded-lg cursor-pointer transition-all
                        ${paymentMethod === method.value ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}
                      `}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={method.value}
                        checked={paymentMethod === method.value}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-4 h-4 text-primary"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{method.icon}</span>
                          <p className="font-medium">{method.label}</p>
                        </div>
                        <p className="text-sm text-gray-500">{method.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Final Summary */}
                <div className="p-4 bg-gray-50 rounded-lg mb-6">
                  <h4 className="font-medium mb-3">Chi tiết thanh toán</h4>
                  <div className="space-y-2 text-sm">
                    {pricing.breakdown.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-500">{item.label}</span>
                        <span>{formatPrice(item.amount)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                      <span>Tổng cộng</span>
                      <span className="text-primary-600">{formatPrice(pricing.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="secondary" onClick={() => setCurrentStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                  </Button>
                  <Button onClick={handleSubmitBooking} disabled={isSubmitting}>
                    {isSubmitting ? 'Đang xử lý...' : paymentMethod === 'CASH' ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Xác nhận đặt phòng
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Tạo yêu cầu thanh toán
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 4 && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {paymentMethod === 'CASH' ? 'Đặt phòng thành công!' : 'Tạo yêu cầu thanh toán thành công!'}
                </h2>
                
                <p className="text-gray-500 mb-6">
                  Mã đặt phòng: <span className="font-mono font-bold text-primary">{bookingResult?.bookingCode}</span>
                </p>

                {/* VietQR Display */}
                {paymentMethod !== 'CASH' && paymentInfo?.qrCodeUrl && (
                  <div className="mb-6 p-4 bg-white rounded-lg border">
                    <p className="text-sm text-gray-500 mb-3">Quét mã QR để thanh toán:</p>
                    <div className="flex justify-center">
                      <VietQRDisplay qrString={paymentInfo.qrCodeUrl} amount={paymentInfo.amount} />
                    </div>
                    <div className="mt-4 text-left text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Số tiền:</span>
                        <span className="font-bold">{formatPrice(paymentInfo.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Nội dung CK:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{paymentInfo.transferContent}</span>
                          <button
                            onClick={() => copyToClipboard(paymentInfo.transferContent)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Sao chép"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                      {paymentInfo.bankAccount && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Ngân hàng:</span>
                            <span>{paymentInfo.bankAccount.bankName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Số TK:</span>
                            <span className="font-mono">{paymentInfo.bankAccount.accountNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Tên TK:</span>
                            <span>{paymentInfo.bankAccount.accountHolder}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-4">
                      Hết hạn: {paymentInfo.expiresAt ? format(new Date(paymentInfo.expiresAt), 'HH:mm, dd/MM/yyyy') : '30 phút'}
                    </p>
                  </div>
                )}

                {/* Bank Transfer Info */}
                {paymentMethod === 'BANK_TRANSFER' && paymentInfo && (
                  <div className="mb-6 p-4 bg-white rounded-lg border text-left">
                    <p className="text-sm font-medium mb-3">Thông tin chuyển khoản:</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Số tiền:</span>
                        <span className="font-bold">{formatPrice(paymentInfo.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Nội dung CK:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{paymentInfo.transferContent}</span>
                          <button
                            onClick={() => copyToClipboard(paymentInfo.transferContent)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                      {paymentInfo.bankAccount && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Ngân hàng:</span>
                            <span>{paymentInfo.bankAccount.bankName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Số TK:</span>
                            <span className="font-mono">{paymentInfo.bankAccount.accountNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Tên TK:</span>
                            <span>{paymentInfo.bankAccount.accountHolder}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCurrentStep(1)
                      setBookingResult(null)
                      setPaymentInfo(null)
                    }}
                  >
                    Tạo đặt phòng mới
                  </Button>
                  <Button onClick={() => router.push(routes.propertyBookings(params.slug, propertyIdFromUrl!))}>
                    Xem danh sách đặt phòng
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </PageContainer>

      {/* QR Modal for large QR display */}
      {showQRModal && paymentInfo?.qrCodeUrl && (
        <Modal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          title="Quét mã QR để thanh toán"
        >
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg inline-block mb-4">
              <VietQRDisplay qrString={paymentInfo.qrCodeUrl} amount={paymentInfo.amount} size={280} />
            </div>
            <p className="text-lg font-bold mb-2">{formatPrice(paymentInfo.amount)}</p>
            <p className="text-sm text-gray-500 mb-4">
              Nội dung: <span className="font-mono font-bold">{paymentInfo.transferContent}</span>
            </p>
            <Button onClick={() => setShowQRModal(false)}>Đóng</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
