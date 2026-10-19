'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { 
  Search, Calendar, Users, CreditCard, User, Phone, Mail, 
  Home, Check, ArrowLeft, ChevronRight, Clock, Copy, AlertCircle,
  MapPin, Bed, Wifi, UtensilsCrossed, Ban, Bath, Mountain, Tv,
  Coffee, Droplets, Wine, Banknote, Timer, RefreshCw, Workflow, QrCode,
  CreditCard as CreditCardIcon, BedDouble, DoorClosed, Plus, ArrowRight,
  Filter
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
  description?: string
  size?: number
  floorRange?: string
  amenities?: string[]
  pricing: { weekdayPrice: number; weekendPrice: number }[]
}

interface Room {
  id: string
  number: string
  floor: number
  status: string
  isClean?: boolean
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

const bedTypeLabels: Record<string, string> = {
  SINGLE: 'Giường đơn',
  DOUBLE: 'Giường đôi',
  TWIN: 'Hai giường đơn',
  TRIPLE: 'Ba giường',
  KING: 'King Size',
  QUEEN: 'Queen Size',
}

const amenityIcons: Record<string, React.ReactNode> = {
  'wifi': <Wifi className="w-3 h-3" />,
  'breakfast': <UtensilsCrossed className="w-3 h-3" />,
  'non-smoking': <Ban className="w-3 h-3" />,
  'bath': <Bath className="w-3 h-3" />,
  'balcony': <Mountain className="w-3 h-3" />,
  'tv': <Tv className="w-3 h-3" />,
  'coffee': <Coffee className="w-3 h-3" />,
  'shower': <Droplets className="w-3 h-3" />,
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
  
  // Search criteria
  const [checkInDate, setCheckInDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))
  const [checkOutDate, setCheckOutDate] = React.useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [checkInTime, setCheckInTime] = React.useState('14:00')
  const [checkOutTime, setCheckOutTime] = React.useState('12:00')
  const [numAdults, setNumAdults] = React.useState('2')
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
  const [paymentMethod, setPaymentMethod] = React.useState('QR_VIETQR')
  const [paymentScope, setPaymentScope] = React.useState('full')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [bookingResult, setBookingResult] = React.useState<BookingResult | null>(null)
  const [error, setError] = React.useState('')
  
  // Hold timer
  const [holdTime, setHoldTime] = React.useState(14 * 60 + 59) // 14:59
  const [bookingCode, setBookingCode] = React.useState('')

  React.useEffect(() => {
    fetchProperties()
    // Generate booking code on client side only to avoid hydration mismatch
    setBookingCode(`WK-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`)
  }, [])

  React.useEffect(() => {
    if (selectedProperty && checkInDate && checkOutDate) {
      searchAvailability()
    }
  }, [selectedProperty, checkInDate, checkOutDate])

  // Hold timer countdown
  React.useEffect(() => {
    const interval = setInterval(() => {
      setHoldTime(prev => prev > 0 ? prev - 1 : 0)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatHoldTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

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

  const calculatePrice = (): { subtotal: number; vat: number; total: number; breakdown: Array<{label: string; amount: number}> } => {
    if (!selectedRoomType) return { subtotal: 0, vat: 0, total: 0, breakdown: [] }
    
    const nights = calculateNights()
    const pricing = selectedRoomType.pricing[0]
    if (!pricing) return { subtotal: 0, vat: 0, total: 0, breakdown: [] }
    
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
    const subtotal = weekdayTotal + weekendTotal
    const vat = Math.round(subtotal * 0.08)
    const total = subtotal + vat
    
    return {
      subtotal,
      vat,
      total,
      breakdown: [
        { label: `${weekdayNights} đêm ngày thường x ${formatPrice(pricing.weekdayPrice)}`, amount: weekdayTotal },
        { label: `${weekendNights} đêm cuối tuần x ${formatPrice(pricing.weekendPrice)}`, amount: weekendTotal },
        { label: 'Thuế GTGT (VAT 8%) & Phí dịch vụ', amount: vat },
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
      setBookingResult({ id: booking.id, bookingCode: booking.bookingCode, status: booking.status })
      
      // Navigate to booking confirmation
      router.push(routes.propertyBooking(params.slug, propertyIdFromUrl!, booking.id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setSelectedRoomType(null)
    setSelectedRoom(null)
    setGuestInfo({ name: '', phone: '', email: '', note: '' })
    setPaymentMethod('QR_VIETQR')
    setPaymentScope('full')
    setHoldTime(14 * 60 + 59)
  }

  const pricing = calculatePrice()

  return (
    <div className="min-h-screen bg-[#fbf9f6]">
      {/* BEGIN: CRM Global Top Bar */}
      <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
        {/* Breadcrumb & Context Navigation */}
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <span className="">Lễ tân & Vận hành</span>
          <ChevronRight className="w-2.5 h-2.5 text-gray-400" />
          <span className="text-gray-900 font-bold">Đặt phòng Walk-in</span>
          <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            Khách Vãng Lai / Trực Tiếp
          </span>
        </div>
        {/* Quick Topbar Utilities */}
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-xs font-semibold shadow-xs transition-colors">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            Tra cứu khách cũ (CRM Fast Lookup)
          </button>
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-100 text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-gray-400" />
            Quay lại Lịch phòng
          </button>
        </div>
      </header>
      {/* END: CRM Global Top Bar */}

      {/* Main Scrollable Content Area */}
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* BEGIN: Page Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tạo Đặt Phòng Walk-in</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-md font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <span className="mr-1">⚡</span>
                Giữ phòng tức thì
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Tạo đơn đặt phòng nhanh cho khách ghé trực tiếp tại quầy lễ tân - Tự động đồng bộ khóa phòng và doanh thu ca trực.
            </p>
          </div>
          {/* Room Status Quick Stats Pill */}
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Tỷ lệ phòng trống hôm nay</span>
              <span className="text-sm font-bold text-gray-800">48 / 60 phòng khả dụng</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm border border-emerald-100">
              80%
            </div>
          </div>
        </div>
        {/* END: Page Header Title Section */}

        {/* BEGIN: Interactive 4-Step Booking Workflow Stepper */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
            {/* Step 1: Active */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-orange-50 border border-orange-200 transition-all">
              <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <Bed className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block">Bước 1 (Hiện tại)</span>
                <span className="text-xs font-extrabold text-gray-900 truncate block">1. Chọn phòng & Thời gian</span>
              </div>
            </div>
            {/* Step 2: Inactive */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/50 border border-transparent opacity-70 hover:opacity-100 transition-all">
              <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-semibold text-gray-400 block">Bước 2</span>
                <span className="text-xs font-semibold text-gray-700 truncate block">2. Thông tin khách & Dịch vụ</span>
              </div>
            </div>
            {/* Step 3: Inactive */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/50 border border-transparent opacity-70 hover:opacity-100 transition-all">
              <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">
                <CreditCardIcon className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-semibold text-gray-400 block">Bước 3</span>
                <span className="text-xs font-semibold text-gray-700 truncate block">3. Thanh toán & Hóa đơn</span>
              </div>
            </div>
            {/* Step 4: Inactive */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/50 border border-transparent opacity-70 hover:opacity-100 transition-all">
              <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-semibold text-gray-400 block">Bước 4</span>
                <span className="text-xs font-semibold text-gray-700 truncate block">4. Hoàn tất & In thẻ phòng</span>
              </div>
            </div>
          </div>
        </section>
        {/* END: Interactive 4-Step Booking Workflow Stepper */}

        {/* BEGIN: Room Availability Search & Filter Control Bar */}
        <section className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200/60">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-orange-600" />
              Tìm kiếm phòng trống khả dụng theo thời gian thực
            </h2>
            <span className="text-xs text-gray-500">Hôm nay: <strong className="text-gray-800">{format(new Date(), 'dd/MM/yyyy')}</strong></span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            {/* Property selector */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                <MapPin className="w-3 h-3 inline mr-1" />
                Cơ sở lưu trú
              </label>
              <select 
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="block w-full px-3 py-2.5 bg-[#fbf9f6]/50 text-xs font-semibold text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                {properties.length === 0 && (
                  <option>Khách sạn Demo Hà Nội - Phố Cổ</option>
                )}
              </select>
            </div>
            
            {/* Check-in datetime */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-gray-700">Ngày & Giờ nhận</label>
                <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.2 rounded">{checkInTime}</span>
              </div>
              <input 
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
                className="block w-full px-3 py-2.5 bg-[#fbf9f6]/50 text-xs font-semibold text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            
            {/* Check-out datetime */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-gray-700">Ngày & Giờ trả</label>
                <span className="text-[10px] text-gray-500 font-medium">{checkOutTime}</span>
              </div>
              <input 
                type="date" 
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                min={checkInDate}
                className="block w-full px-3 py-2.5 bg-[#fbf9f6]/50 text-xs font-semibold text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            
            {/* Adults */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                <Users className="w-3 h-3 inline mr-1" />
                Người lớn
              </label>
              <select 
                value={numAdults}
                onChange={(e) => setNumAdults(e.target.value)}
                className="block w-full px-3 py-2.5 bg-[#fbf9f6]/50 text-xs font-semibold text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option>1</option>
                <option>2</option>
                <option>3</option>
                <option>4+</option>
              </select>
            </div>
            
            {/* Children */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                <Users className="w-3 h-3 inline mr-1" />
                Trẻ em (&lt;12t)
              </label>
              <select 
                value={numChildren}
                onChange={(e) => setNumChildren(e.target.value)}
                className="block w-full px-3 py-2.5 bg-[#fbf9f6]/50 text-xs font-semibold text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option>0</option>
                <option>1</option>
                <option>2</option>
              </select>
            </div>
          </div>

          {/* Filter tags & Search Action Bar */}
          <div className="mt-4 pt-3 border-t border-gray-200/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-500 mr-1">Bộ lọc nhanh:</span>
              <button className="px-2.5 py-1 text-xs rounded-lg bg-[#f5f2eb] border border-gray-200 text-gray-700 hover:border-orange-500 font-medium transition-colors">
                Tất cả các tầng
              </button>
              <button className="px-2.5 py-1 text-xs rounded-lg bg-[#f5f2eb] border border-gray-200 text-gray-700 hover:border-orange-500 font-medium transition-colors">
                <Ban className="w-3 h-3 inline mr-1 text-gray-400" /> Không hút thuốc
              </button>
              <button className="px-2.5 py-1 text-xs rounded-lg bg-[#f5f2eb] border border-gray-200 text-gray-700 hover:border-orange-500 font-medium transition-colors">
                <Bath className="w-3 h-3 inline mr-1 text-gray-400" /> Có bồn tắm
              </button>
              <button className="px-2.5 py-1 text-xs rounded-lg bg-[#f5f2eb] border border-gray-200 text-gray-700 hover:border-orange-500 font-medium transition-colors">
                <Mountain className="w-3 h-3 inline mr-1 text-gray-400" /> Ban công / View phố
              </button>
            </div>
            {/* Primary Search Trigger Button */}
            <button 
              onClick={searchAvailability}
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {isLoading ? 'Đang tìm...' : `Tìm Phòng Khả Dụng (${calculateNights()} Đêm)`}
            </button>
          </div>
        </section>
        {/* END: Room Availability Search & Filter Control Bar */}

        {/* BEGIN: 2-Column Main Workspace (65% Room List + 35% Live Summary Panel) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Column Left: Available Room Categories (65% Width) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                Danh sách phòng trống 
                <span className="inline-flex items-center justify-center bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {roomTypes.length} Hạng phòng
                </span>
              </h3>
              <span className="text-xs text-gray-400 font-medium">Báo giá theo đêm chưa bao gồm VAT & Dịch vụ</span>
            </div>

            {/* Room Cards */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-500">Đang tìm kiếm phòng trống...</p>
              </div>
            ) : roomTypes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Bed className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">
                  {selectedProperty ? 'Không có phòng trống trong khoảng thời gian này' : 'Vui lòng chọn cơ sở'}
                </p>
              </div>
            ) : (
              roomTypes.map((roomType, index) => {
                const isSelected = selectedRoomType?.id === roomType.id
                return (
                  <div 
                    key={roomType.id}
                    className={`bg-white rounded-2xl overflow-hidden transition-all ${
                      isSelected 
                        ? 'border-2 border-orange-600 shadow-md' 
                        : 'border border-gray-200 hover:border-gray-300 shadow-sm'
                    }`}
                  >
                    {/* Active Highlight Banner */}
                    {isSelected && (
                      <div className="bg-orange-600 text-white px-4 py-1.5 flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3 h-3" /> ĐANG ĐƯỢC CHỌN CHO ĐƠN WALK-IN
                        </span>
                        <span className="bg-white/20 text-white text-[11px] px-2 py-0.5 rounded">Ưu tiên lễ tân</span>
                      </div>
                    )}
                    
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row gap-4 items-start">
                        {/* Thumbnail Placeholder */}
                        <div className="w-full sm:w-36 h-28 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 border border-orange-200 shrink-0 overflow-hidden relative flex flex-col justify-end p-2.5">
                          <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {roomType.floorRange || 'Tầng 3 - 5'}
                          </span>
                          <BedDouble className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl text-orange-500/40" />
                          <span className="text-[11px] font-bold text-orange-900 bg-white/90 px-1.5 py-0.5 rounded w-fit">
                            {roomType.size || 35} m²
                          </span>
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-extrabold text-gray-900">{roomType.name}</h4>
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  Còn {roomType.availableRooms} phòng trống
                                </span>
                                {index === 0 && (
                                  <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Được ưa chuộng
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Giường {bedTypeLabels[roomType.bedType] || 'King Size'} • Ban công view phố cổ thoáng mát
                              </p>
                            </div>
                            {/* Pricing */}
                            <div className="text-right shrink-0">
                              <div className="text-lg font-black text-orange-600">
                                {formatPrice(roomType.pricing[0]?.weekdayPrice || 0)}
                              </div>
                              <div className="text-[10px] font-medium text-gray-400">/ đêm</div>
                            </div>
                          </div>
                          
                          {/* Amenities Tags */}
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-gray-600">
                            <span className="bg-[#f5f2eb] px-2 py-1 rounded-md border border-gray-200/60 flex items-center gap-1">
                              <Users className="w-3 h-3 text-gray-400" /> {roomType.baseOccupancy} - {roomType.maxOccupancy} khách
                            </span>
                            <span className="bg-[#f5f2eb] px-2 py-1 rounded-md border border-gray-200/60 flex items-center gap-1">
                              <Wifi className="w-3 h-3 text-gray-400" /> Wifi Free
                            </span>
                            <span className="bg-[#f5f2eb] px-2 py-1 rounded-md border border-gray-200/60 flex items-center gap-1">
                              <UtensilsCrossed className="w-3 h-3 text-gray-400" /> Buffet sáng free
                            </span>
                            <span className="bg-[#f5f2eb] px-2 py-1 rounded-md border border-gray-200/60 flex items-center gap-1">
                              <Ban className="w-3 h-3 text-gray-400" /> Không khói thuốc
                            </span>
                          </div>
                          
                          {/* Room Assignment Selector Section */}
                          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <label className="text-xs font-bold text-gray-700 whitespace-nowrap">Chọn số phòng:</label>
                              <select 
                                value={selectedRoom?.id || ''}
                                onChange={(e) => {
                                  const room = availableRooms.find(r => r.id === e.target.value)
                                  if (room) handleSelectRoom(room)
                                }}
                                className="text-xs font-bold text-orange-800 bg-orange-50 border-orange-300 rounded-lg py-1.5 pl-3 pr-8 focus:ring-orange-500 focus:border-orange-500"
                              >
                                <option value="">-- Chọn phòng --</option>
                                {availableRooms.map((room) => (
                                  <option key={room.id} value={room.id}>
                                    Phòng {room.number} (Tầng {room.floor} - {room.isClean ? 'Đã dọn sạch' : 'Sạch sẵn'})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button 
                              onClick={() => handleSelectRoomType(roomType)}
                              className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs shadow-xs transition-colors ${
                                isSelected
                                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                                  : 'border border-orange-600 text-orange-600 hover:bg-orange-50'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3 h-3" /> Đã chọn phòng này
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" /> Chọn hạng phòng này
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {/* END: Column Left: Available Rooms List */}

          {/* BEGIN: Column Right: Walk-in Live Summary Panel (35% Width) */}
          <div className="lg:col-span-5 sticky top-20">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Summary Card Header with Hold Timer */}
              <div className="bg-[#f5f2eb]/80 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Chi Tiết Giữ Phòng Tạm Thời</h3>
                  <p className="text-[11px] text-gray-500">Khóa phòng Walk-in tự động</p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  <Timer className="w-3 h-3 animate-spin" />
                  <span>{formatHoldTime(holdTime)}</span>
                </div>
              </div>

              {/* Selected Stay Specs */}
              <div className="p-5 space-y-4">
                {/* Quick Room Tag */}
                {selectedRoomType && selectedRoom ? (
                  <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-100 flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block">Phòng đã chọn</span>
                      <h5 className="text-sm font-extrabold text-gray-900">{selectedRoomType.name} • P.{selectedRoom.number}</h5>
                      <p className="text-xs text-gray-600 mt-0.5">Tầng {selectedRoom.floor} (Phòng sạch sẵn sàng đón khách)</p>
                    </div>
                    <span className="px-2 py-1 bg-white text-orange-700 text-xs font-bold rounded-lg border border-orange-200 shadow-xs">
                      {calculateNights()} Đêm
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-500">Chưa chọn phòng</span>
                  </div>
                )}

                {/* Stay Schedule Row */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[#fbf9f6] p-3 rounded-xl border border-gray-200/80">
                  <div>
                    <span className="text-gray-400 block text-[10px] font-semibold uppercase">Nhận phòng</span>
                    <span className="font-bold text-gray-800">{checkInTime} - {format(new Date(checkInDate), 'dd/MM/yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-semibold uppercase">Trả phòng</span>
                    <span className="font-bold text-gray-800">{checkOutTime} - {format(new Date(checkOutDate), 'dd/MM/yyyy')}</span>
                  </div>
                </div>

                {/* Fast Guest Information Input Form */}
                <div className="pt-2 border-t border-gray-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">Thông tin nhanh khách tại quầy</label>
                    <span className="text-[10px] text-orange-600 cursor-pointer hover:underline font-semibold">Quét CCCD chip</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <input 
                        className="block w-full text-xs font-semibold px-3 py-2 bg-[#fbf9f6]/40 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                        placeholder="Họ và tên khách hàng *"
                        value={guestInfo.name}
                        onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                        type="text"
                      />
                    </div>
                    <div>
                      <input 
                        className="block w-full text-xs font-semibold px-3 py-2 bg-[#fbf9f6]/40 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                        placeholder="Số điện thoại nhận mã đặt phòng *"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                        type="tel"
                      />
                    </div>
                    <div>
                      <input 
                        className="block w-full text-xs font-semibold px-3 py-2 bg-[#fbf9f6]/40 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                        placeholder="Email (tùy chọn)"
                        value={guestInfo.email}
                        onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                        type="email"
                      />
                    </div>
                  </div>
                </div>

                {/* Bill Calculation Table */}
                <div className="pt-3 border-t border-gray-200/60 space-y-2 text-xs">
                  {selectedRoomType && (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span className="">Tiền phòng ({calculateNights()} đêm x {selectedRoomType.name}):</span>
                        <span className="font-semibold text-gray-900">{formatPrice(pricing.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span className="flex items-center gap-1">
                          Buffet sáng tiêu chuẩn ({parseInt(numAdults)} khách):
                        </span>
                        <span className="font-semibold text-emerald-600">Miễn phí tặng kèm</span>
                      </div>
                    </>
                  )}
                  {pricing.vat > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span className="">Thuế GTGT (VAT 8%) & Phí dịch vụ:</span>
                      <span className="font-semibold text-gray-900">{formatPrice(pricing.vat)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-dashed border-gray-200 flex justify-between items-baseline">
                    <div>
                      <span className="text-sm font-black text-gray-900 block">Tổng tiền thanh toán</span>
                      <span className="text-[10px] text-gray-400">Đã bao gồm tất cả chi phí</span>
                    </div>
                    <span className="text-xl font-black text-orange-600 tracking-tight">{formatPrice(pricing.total)}</span>
                  </div>
                </div>

                {/* Walk-in Payment Method Quick Selection */}
                <div className="pt-3 border-t border-gray-200/60">
                  <label className="block text-xs font-bold text-gray-800 mb-2 uppercase tracking-wider">Phương thức thu tiền tại quầy</label>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {/* VietQR Option */}
                    <button 
                      onClick={() => setPaymentMethod('QR_VIETQR')}
                      className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'QR_VIETQR'
                          ? 'border-2 border-orange-600 bg-orange-50/50'
                          : 'border border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      type="button"
                    >
                      <QrCode className={`text-base ${paymentMethod === 'QR_VIETQR' ? 'text-orange-600' : 'text-gray-500'}`} />
                      <span className={`font-bold text-[11px] ${paymentMethod === 'QR_VIETQR' ? 'text-orange-900' : 'text-gray-700'}`}>VietQR 247</span>
                    </button>
                    {/* Cash Option */}
                    <button 
                      onClick={() => setPaymentMethod('CASH')}
                      className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'CASH'
                          ? 'border-2 border-orange-600 bg-orange-50/50'
                          : 'border border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      type="button"
                    >
                      <Banknote className={`text-base ${paymentMethod === 'CASH' ? 'text-orange-600' : 'text-gray-500'}`} />
                      <span className={`font-semibold text-[11px] ${paymentMethod === 'CASH' ? 'text-orange-900' : 'text-gray-700'}`}>Tiền mặt</span>
                    </button>
                    {/* POS Card Option */}
                    <button 
                      onClick={() => setPaymentMethod('POS')}
                      className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'POS'
                          ? 'border-2 border-orange-600 bg-orange-50/50'
                          : 'border border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      type="button"
                    >
                      <CreditCardIcon className={`text-base ${paymentMethod === 'POS' ? 'text-orange-600' : 'text-gray-500'}`} />
                      <span className={`font-semibold text-[11px] ${paymentMethod === 'POS' ? 'text-orange-900' : 'text-gray-700'}`}>Cà thẻ POS</span>
                    </button>
                  </div>

                  {/* Collection Amount Radio Options */}
                  <div className="mt-3 flex items-center justify-between text-xs bg-[#f5f2eb] p-2 rounded-xl">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input 
                        checked={paymentScope === 'full'}
                        onChange={() => setPaymentScope('full')}
                        className="text-orange-600 focus:ring-orange-500 h-3.5 w-3.5" 
                        name="payment_scope" 
                        type="radio" 
                      />
                      <span className="font-bold text-gray-800">Thu đủ 100% ({formatPrice(pricing.total)})</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input 
                        checked={paymentScope === 'deposit'}
                        onChange={() => setPaymentScope('deposit')}
                        className="text-orange-600 focus:ring-orange-500 h-3.5 w-3.5" 
                        name="payment_scope" 
                        type="radio" 
                      />
                      <span className="font-medium text-gray-600">Đặt cọc 50%</span>
                    </label>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {/* Final Action Buttons CTA */}
                <div className="space-y-2 pt-2">
                  <button 
                    onClick={handleSubmitBooking}
                    disabled={!selectedRoomType || !selectedRoom || !guestInfo.name || !guestInfo.phone || isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    <span className="">Tiếp tục: Điền Thông Tin & Check-in</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className="py-2 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors" 
                      type="button"
                    >
                      <Clock className="w-3 h-3 inline mr-1 text-gray-400" /> Giữ chỗ 15 phút
                    </button>
                    <button 
                      onClick={resetForm}
                      className="py-2 px-3 rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-100/50 text-red-700 font-semibold text-xs transition-colors" 
                      type="button"
                    >
                      <RefreshCw className="w-3 h-3 inline mr-1" /> Làm mới đơn
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Synchronized System Footer Tag */}
              <div className="px-5 py-2.5 bg-[#f5f2eb]/50 border-t border-gray-200 text-[11px] text-gray-500 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Workflow className="w-3 h-3 text-emerald-500" />
                  Đồng bộ tức thì với Sơ đồ phòng
                </span>
                <span className="font-mono text-[10px] text-gray-400">#{bookingCode}</span>
              </div>
            </div>
          </div>
          {/* END: Column Right: Walk-in Live Summary Panel */}
        </div>
        {/* END: 2-Column Main Workspace */}
      </div>
      {/* END: Main Scrollable Content Area */}
    </div>
  )
}
