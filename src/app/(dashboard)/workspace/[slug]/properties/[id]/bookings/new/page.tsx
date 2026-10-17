'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Select, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { 
  Search, Calendar, Users, CreditCard, User, Phone, Mail, 
  Home, Check, ArrowLeft, Baby, ChevronRight, Clock
} from 'lucide-react'
import { format, addDays, differenceInDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import { routes } from '@/lib/utils/routes'

interface RoomType {
  id: string
  name: string
  bedType: string
  baseOccupancy: number
  maxOccupancy: number
  totalRooms: number
  availableRooms: number
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

const bedTypeLabels: Record<string, string> = {
  SINGLE: 'Giường đơn',
  DOUBLE: 'Giường đôi',
  TWIN: 'Hai giường đơn',
  TRIPLE: 'Ba giường',
  QUADRUPLE: 'Bốn giường',
}

export default function WalkinBookingPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyIdFromUrl = params.id
  
  const [properties, setProperties] = React.useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = React.useState(propertyIdFromUrl || '')
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([])
  const [availableRooms, setAvailableRooms] = React.useState<Room[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  
  // Booking steps: guest -> room -> payment
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
    try {
      const res = await fetch(
        `/api/room-types?propertyId=${selectedProperty}&checkIn=${checkInDate}&checkOut=${checkOutDate}&adults=${numAdults}&children=${numChildren}`
      )
      const data = await res.json()
      if (data.success) {
        setRoomTypes(data.data.filter((rt: RoomType) => rt.availableRooms > 0))
      }
    } catch (err) {
      console.error('Failed to search availability:', err)
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
    
    // Count weekdays vs weekends
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
    setCurrentStep(2) // Go to guest info
  }

  const handleSubmitBooking = async () => {
    if (!guestInfo.name || !guestInfo.phone) {
      alert('Vui lòng nhập đầy đủ thông tin khách hàng')
      return
    }
    
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedProperty,
          roomTypeId: selectedRoomType?.id,
          roomId: selectedRoom?.id,
          guestName: guestInfo.name,
          guestPhone: guestInfo.phone,
          guestEmail: guestInfo.email,
          checkInDate,
          checkOutDate,
          numAdults: parseInt(numAdults),
          numChildren: parseInt(numChildren),
          paymentMethod,
          paymentStatus: paymentMethod === 'CASH' ? 'PAID' : 'PENDING',
          source: 'WALKIN',
          note: guestInfo.note,
        }),
      })
      const data = await res.json()
      if (data.success) {
        alert('Đặt phòng thành công!')
        router.push(`/bookings/${data.data.id}`)
      } else {
        alert(data.error || 'Đặt phòng thất bại')
      }
    } catch (err) {
      console.error('Failed to create booking:', err)
      alert('Đã xảy ra lỗi')
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    { number: 1, title: 'Chọn phòng', icon: Home },
    { number: 2, title: 'Thông tin khách', icon: User },
    { number: 3, title: 'Thanh toán', icon: CreditCard },
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
                      if (!next) {
                        setCheckInDate('')
                        return
                      }
                      setCheckInDate(next)
                      // If checkout is missing or already on/before
                      // the new check-in, push it one day forward so
                      // the search has a valid range.
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
                          {availableRooms.length === 0 && (
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
                    label="Họ tên khách"
                    value={guestInfo.name}
                    onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                  <Input
                    label="Số điện thoại"
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
                  <label className={`
                    flex items-center p-4 border rounded-lg cursor-pointer transition-all
                    ${paymentMethod === 'CASH' ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}
                  `}>
                    <input
                      type="radio"
                      name="payment"
                      value="CASH"
                      checked={paymentMethod === 'CASH'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-4 h-4 text-primary"
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-medium">Tiền mặt</p>
                      <p className="text-sm text-gray-500">Thanh toán bằng tiền mặt tại quầy</p>
                    </div>
                    <span className="text-2xl">💵</span>
                  </label>
                  
                  <label className={`
                    flex items-center p-4 border rounded-lg cursor-pointer transition-all
                    ${paymentMethod === 'BANKING' ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}
                  `}>
                    <input
                      type="radio"
                      name="payment"
                      value="BANKING"
                      checked={paymentMethod === 'BANKING'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-4 h-4 text-primary"
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-medium">Chuyển khoản ngân hàng</p>
                      <p className="text-sm text-gray-500">Chuyển khoản trước qua QR hoặc tài khoản</p>
                    </div>
                    <span className="text-2xl">🏦</span>
                  </label>
                  
                  <label className={`
                    flex items-center p-4 border rounded-lg cursor-pointer transition-all
                    ${paymentMethod === 'CARD' ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}
                  `}>
                    <input
                      type="radio"
                      name="payment"
                      value="CARD"
                      checked={paymentMethod === 'CARD'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-4 h-4 text-primary"
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-medium">Thẻ</p>
                      <p className="text-sm text-gray-500">Thanh toán bằng thẻ ATM, Visa, Mastercard</p>
                    </div>
                    <span className="text-2xl">💳</span>
                  </label>
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
                    {isSubmitting ? 'Đang xử lý...' : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Xác nhận đặt phòng
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </PageContainer>
    </div>
  )
}
