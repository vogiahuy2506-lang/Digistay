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
import { quoteStay, type Rates } from '@/lib/pricing/quote'
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
  /** from /api/bookings/availability: the rates bookings are charged */
  pricing: Rates & { basePrice: number; total: number }
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

  // The server charges exactly this (src/lib/pricing/quote.ts). Prices include
  // VAT: the estimate used to add 8% on top, which the booking never charged.
  const calculatePrice = () => {
    if (!selectedRoomType) return { subtotal: 0, surcharges: 0, total: 0 }
    const quote = quoteStay({
      rates: selectedRoomType.pricing,
      checkIn: new Date(checkInDate),
      checkOut: new Date(checkOutDate),
      numAdults: parseInt(numAdults) || 1,
      numChildren: parseInt(numChildren) || 0,
      baseOccupancy: selectedRoomType.baseOccupancy,
    })
    return { subtotal: quote.basePrice, surcharges: quote.extraAdultCharge + quote.extraChildCharge, total: quote.total }
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
    <div className="min-h-screen bg-page">
      {/* BEGIN: CRM Global Top Bar */}
      <header className="min-h-16 bg-panel border-b border-line px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sticky top-0 z-30">
        {/* Breadcrumb & Context Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted font-medium">
          <span className="">Lễ tân & Vận hành</span>
          <ChevronRight className="w-2.5 h-2.5 text-muted" />
          <span className="text-fg font-bold">Đặt phòng Walk-in</span>
          <span className="ml-2 hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-err-soft text-err border border-err/30">
            <span className="w-1.5 h-1.5 rounded-full bg-err animate-pulse"></span>
            Khách Vãng Lai / Trực Tiếp
          </span>
        </div>
        {/* Quick Topbar Utilities */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line text-fg bg-panel hover:bg-fg/5 text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-muted" />
            Quay lại Lịch phòng
          </button>
        </div>
      </header>
      {/* END: CRM Global Top Bar */}

      {/* Main Scrollable Content Area */}
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* BEGIN: Page Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-line/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-fg tracking-tight">Tạo Đặt Phòng Walk-in</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-md font-medium bg-warn-soft text-warn border border-warn/30">
                <span className="mr-1">⚡</span>
                Giữ phòng tức thì
              </span>
            </div>
            <p className="text-sm text-muted mt-1">
              Tạo đơn đặt phòng nhanh cho khách ghé trực tiếp tại quầy lễ tân - Tự động đồng bộ khóa phòng và doanh thu ca trực.
            </p>
          </div>
          {/* Room Status Quick Stats Pill */}
          <div className="flex items-center gap-4 bg-panel px-4 py-2 rounded-xl border border-line shadow-xs">
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-muted font-semibold block">Tỷ lệ phòng trống hôm nay</span>
              <span className="text-sm font-bold text-fg">48 / 60 phòng khả dụng</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-ok-soft text-ok flex items-center justify-center font-bold text-sm border border-ok/30">
              80%
            </div>
          </div>
        </div>
        {/* END: Page Header Title Section */}

        {/* BEGIN: Interactive 4-Step Booking Workflow Stepper */}
        <section className="bg-panel rounded-2xl p-4 border border-line shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
            {/* Step 1: Active */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-warn-soft border border-warn/30 transition-all">
              <div className="w-9 h-9 rounded-xl bg-ink text-on-ink flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <Bed className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-warn block">Bước 1 (Hiện tại)</span>
                <span className="text-xs font-extrabold text-fg truncate block">1. Chọn phòng & Thời gian</span>
              </div>
            </div>
            {/* Step 2: Inactive */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-fg/[0.03] border border-transparent opacity-70 hover:opacity-100 transition-all">
              <div className="w-9 h-9 rounded-xl bg-panel border border-line text-muted flex items-center justify-center font-bold text-sm shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-semibold text-muted block">Bước 2</span>
                <span className="text-xs font-semibold text-fg truncate block">2. Thông tin khách & Dịch vụ</span>
              </div>
            </div>
            {/* Step 3: Inactive */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-fg/[0.03] border border-transparent opacity-70 hover:opacity-100 transition-all">
              <div className="w-9 h-9 rounded-xl bg-panel border border-line text-muted flex items-center justify-center font-bold text-sm shrink-0">
                <CreditCardIcon className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-semibold text-muted block">Bước 3</span>
                <span className="text-xs font-semibold text-fg truncate block">3. Thanh toán & Hóa đơn</span>
              </div>
            </div>
            {/* Step 4: Inactive */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-fg/[0.03] border border-transparent opacity-70 hover:opacity-100 transition-all">
              <div className="w-9 h-9 rounded-xl bg-panel border border-line text-muted flex items-center justify-center font-bold text-sm shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-semibold text-muted block">Bước 4</span>
                <span className="text-xs font-semibold text-fg truncate block">4. Hoàn tất & In thẻ phòng</span>
              </div>
            </div>
          </div>
        </section>
        {/* END: Interactive 4-Step Booking Workflow Stepper */}

        {/* BEGIN: Room Availability Search & Filter Control Bar */}
        <section className="bg-panel rounded-2xl p-5 border border-line shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-line/60">
            <h2 className="text-sm font-bold text-fg flex items-center gap-2">
              <Filter className="w-4 h-4 text-warn" />
              Tìm kiếm phòng trống khả dụng theo thời gian thực
            </h2>
            <span className="text-xs text-muted">Hôm nay: <strong className="text-fg">{format(new Date(), 'dd/MM/yyyy')}</strong></span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            {/* Property selector */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-fg mb-1.5">
                <MapPin className="w-3 h-3 inline mr-1" />
                Cơ sở lưu trú
              </label>
              <select 
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="block w-full px-3 py-2.5 bg-page/50 text-xs font-semibold text-fg border border-line rounded-xl focus:ring-2 focus:ring-warn/30 focus:border-warn/30"
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
                <label className="text-xs font-bold text-fg">Ngày & Giờ nhận</label>
                <span className="text-[10px] text-warn font-bold bg-warn-soft px-1.5 py-0.2 rounded">{checkInTime}</span>
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
                className="block w-full px-3 py-2.5 bg-page/50 text-xs font-semibold text-fg border border-line rounded-xl focus:ring-2 focus:ring-warn/30 focus:border-warn/30"
              />
            </div>
            
            {/* Check-out datetime */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-fg">Ngày & Giờ trả</label>
                <span className="text-[10px] text-muted font-medium">{checkOutTime}</span>
              </div>
              <input 
                type="date" 
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                min={checkInDate}
                className="block w-full px-3 py-2.5 bg-page/50 text-xs font-semibold text-fg border border-line rounded-xl focus:ring-2 focus:ring-warn/30 focus:border-warn/30"
              />
            </div>
            
            {/* Adults */}
            <div>
              <label className="block text-xs font-bold text-fg mb-1.5">
                <Users className="w-3 h-3 inline mr-1" />
                Người lớn
              </label>
              <select 
                value={numAdults}
                onChange={(e) => setNumAdults(e.target.value)}
                className="block w-full px-3 py-2.5 bg-page/50 text-xs font-semibold text-fg border border-line rounded-xl focus:ring-2 focus:ring-warn/30 focus:border-warn/30"
              >
                <option>1</option>
                <option>2</option>
                <option>3</option>
                <option>4+</option>
              </select>
            </div>
            
            {/* Children */}
            <div>
              <label className="block text-xs font-bold text-fg mb-1.5">
                <Users className="w-3 h-3 inline mr-1" />
                Trẻ em (&lt;12t)
              </label>
              <select 
                value={numChildren}
                onChange={(e) => setNumChildren(e.target.value)}
                className="block w-full px-3 py-2.5 bg-page/50 text-xs font-semibold text-fg border border-line rounded-xl focus:ring-2 focus:ring-warn/30 focus:border-warn/30"
              >
                <option>0</option>
                <option>1</option>
                <option>2</option>
              </select>
            </div>
          </div>

          {/* Filter tags & Search Action Bar */}
          <div className="mt-4 pt-3 border-t border-line/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted mr-1">Bộ lọc nhanh:</span>
              <button className="px-2.5 py-1 text-xs rounded-lg bg-fg/[0.03] border border-line text-fg hover:border-warn/30 font-medium transition-colors">
                Tất cả các tầng
              </button>
              <button className="px-2.5 py-1 text-xs rounded-lg bg-fg/[0.03] border border-line text-fg hover:border-warn/30 font-medium transition-colors">
                <Ban className="w-3 h-3 inline mr-1 text-muted" /> Không hút thuốc
              </button>
              <button className="px-2.5 py-1 text-xs rounded-lg bg-fg/[0.03] border border-line text-fg hover:border-warn/30 font-medium transition-colors">
                <Bath className="w-3 h-3 inline mr-1 text-muted" /> Có bồn tắm
              </button>
              <button className="px-2.5 py-1 text-xs rounded-lg bg-fg/[0.03] border border-line text-fg hover:border-warn/30 font-medium transition-colors">
                <Mountain className="w-3 h-3 inline mr-1 text-muted" /> Ban công / View phố
              </button>
            </div>
            {/* Primary Search Trigger Button */}
            <button 
              onClick={searchAvailability}
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-ink hover:bg-ink/90 text-on-ink text-xs font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
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
              <h3 className="text-sm font-bold text-fg uppercase tracking-wider flex items-center gap-2">
                Danh sách phòng trống 
                <span className="inline-flex items-center justify-center bg-warn-soft text-warn text-xs px-2 py-0.5 rounded-full font-bold">
                  {roomTypes.length} Hạng phòng
                </span>
              </h3>
              <span className="text-xs text-muted font-medium">Báo giá theo đêm chưa bao gồm VAT & Dịch vụ</span>
            </div>

            {/* Room Cards */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-warn/30 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted">Đang tìm kiếm phòng trống...</p>
              </div>
            ) : roomTypes.length === 0 ? (
              <div className="bg-panel rounded-2xl border border-line p-12 text-center">
                <Bed className="w-12 h-12 mx-auto text-muted mb-4" />
                <p className="text-muted">
                  {selectedProperty ? 'Không có phòng trống trong khoảng thời gian này' : 'Vui lòng chọn cơ sở'}
                </p>
              </div>
            ) : (
              roomTypes.map((roomType, index) => {
                const isSelected = selectedRoomType?.id === roomType.id
                return (
                  <div 
                    key={roomType.id}
                    className={`bg-panel rounded-2xl overflow-hidden transition-all ${
                      isSelected 
                        ? 'border-2 border-warn/30 shadow-md' 
                        : 'border border-line hover:border-line shadow-sm'
                    }`}
                  >
                    {/* Active Highlight Banner */}
                    {isSelected && (
                      <div className="bg-warn-soft text-warn px-4 py-1.5 flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3 h-3" /> ĐANG ĐƯỢC CHỌN CHO ĐƠN WALK-IN
                        </span>
                        <span className="bg-warn/15 text-warn text-[11px] px-2 py-0.5 rounded">Ưu tiên lễ tân</span>
                      </div>
                    )}
                    
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row gap-4 items-start">
                        {/* Thumbnail Placeholder */}
                        <div className="w-full sm:w-36 h-28 rounded-xl bg-warn-soft border border-warn/30 shrink-0 overflow-hidden relative flex flex-col justify-end p-2.5">
                          <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {roomType.floorRange || 'Tầng 3 - 5'}
                          </span>
                          <BedDouble className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl text-warn/40" />
                          <span className="text-[11px] font-bold text-warn bg-panel/90 px-1.5 py-0.5 rounded w-fit">
                            {roomType.size || 35} m²
                          </span>
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-extrabold text-fg">{roomType.name}</h4>
                                <span className="bg-ok-soft text-ok border border-ok/30 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  Còn {roomType.availableRooms} phòng trống
                                </span>
                                {index === 0 && (
                                  <span className="bg-err-soft text-err border border-err/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Được ưa chuộng
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted mt-0.5">
                                Giường {bedTypeLabels[roomType.bedType] || 'King Size'} • Ban công view phố cổ thoáng mát
                              </p>
                            </div>
                            {/* Pricing */}
                            <div className="text-right shrink-0">
                              <div className="text-lg font-black text-warn">
                                {formatPrice(roomType.pricing.weekdayPrice)}
                              </div>
                              <div className="text-[10px] font-medium text-muted">/ đêm</div>
                            </div>
                          </div>
                          
                          {/* Amenities Tags */}
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-muted">
                            <span className="bg-fg/[0.03] px-2 py-1 rounded-md border border-line/60 flex items-center gap-1">
                              <Users className="w-3 h-3 text-muted" /> {roomType.baseOccupancy} - {roomType.maxOccupancy} khách
                            </span>
                            <span className="bg-fg/[0.03] px-2 py-1 rounded-md border border-line/60 flex items-center gap-1">
                              <Wifi className="w-3 h-3 text-muted" /> Wifi Free
                            </span>
                            <span className="bg-fg/[0.03] px-2 py-1 rounded-md border border-line/60 flex items-center gap-1">
                              <UtensilsCrossed className="w-3 h-3 text-muted" /> Buffet sáng free
                            </span>
                            <span className="bg-fg/[0.03] px-2 py-1 rounded-md border border-line/60 flex items-center gap-1">
                              <Ban className="w-3 h-3 text-muted" /> Không khói thuốc
                            </span>
                          </div>
                          
                          {/* Room Assignment Selector Section */}
                          <div className="mt-4 pt-3 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <label className="text-xs font-bold text-fg whitespace-nowrap">Chọn số phòng:</label>
                              <select 
                                value={selectedRoom?.id || ''}
                                onChange={(e) => {
                                  const room = availableRooms.find(r => r.id === e.target.value)
                                  if (room) handleSelectRoom(room)
                                }}
                                className="text-xs font-bold text-warn bg-warn-soft border-warn/30 rounded-lg py-1.5 pl-3 pr-8 focus:ring-warn/30 focus:border-warn/30"
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
                                  ? 'bg-ink text-on-ink hover:bg-ink/90'
                                  : 'border border-warn/30 text-warn hover:bg-warn-soft'
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
            <div className="bg-panel rounded-2xl border border-line shadow-sm overflow-hidden">
              {/* Summary Card Header with Hold Timer */}
              <div className="bg-fg/[0.03] px-5 py-4 border-b border-line flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-fg uppercase tracking-wider">Chi Tiết Giữ Phòng Tạm Thời</h3>
                  <p className="text-[11px] text-muted">Khóa phòng Walk-in tự động</p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warn-soft border border-warn/30 text-warn text-xs font-bold">
                  <Timer className="w-3 h-3 animate-spin" />
                  <span>{formatHoldTime(holdTime)}</span>
                </div>
              </div>

              {/* Selected Stay Specs */}
              <div className="p-5 space-y-4">
                {/* Quick Room Tag */}
                {selectedRoomType && selectedRoom ? (
                  <div className="p-3 bg-warn-soft/60 rounded-xl border border-warn/30 flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-warn block">Phòng đã chọn</span>
                      <h5 className="text-sm font-extrabold text-fg">{selectedRoomType.name} • P.{selectedRoom.number}</h5>
                      <p className="text-xs text-muted mt-0.5">Tầng {selectedRoom.floor} (Phòng sạch sẵn sàng đón khách)</p>
                    </div>
                    <span className="px-2 py-1 bg-panel text-warn text-xs font-bold rounded-lg border border-warn/30 shadow-xs">
                      {calculateNights()} Đêm
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-fg/[0.03] rounded-xl border border-line flex items-center justify-center">
                    <span className="text-xs text-muted">Chưa chọn phòng</span>
                  </div>
                )}

                {/* Stay Schedule Row */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-page p-3 rounded-xl border border-line/80">
                  <div>
                    <span className="text-muted block text-[10px] font-semibold uppercase">Nhận phòng</span>
                    <span className="font-bold text-fg">{checkInTime} - {format(new Date(checkInDate), 'dd/MM/yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[10px] font-semibold uppercase">Trả phòng</span>
                    <span className="font-bold text-fg">{checkOutTime} - {format(new Date(checkOutDate), 'dd/MM/yyyy')}</span>
                  </div>
                </div>

                {/* Fast Guest Information Input Form */}
                <div className="pt-2 border-t border-line/60">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-fg uppercase tracking-wider">Thông tin nhanh khách tại quầy</label>
                    <span className="text-[10px] text-warn cursor-pointer hover:underline font-semibold">Quét CCCD chip</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <input 
                        className="block w-full text-xs font-semibold px-3 py-2 bg-page/40 border border-line rounded-xl focus:ring-2 focus:ring-warn/30 focus:border-warn/30" 
                        placeholder="Họ và tên khách hàng *"
                        value={guestInfo.name}
                        onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                        type="text"
                      />
                    </div>
                    <div>
                      <input 
                        className="block w-full text-xs font-semibold px-3 py-2 bg-page/40 border border-line rounded-xl focus:ring-2 focus:ring-warn/30 focus:border-warn/30" 
                        placeholder="Số điện thoại nhận mã đặt phòng *"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                        type="tel"
                      />
                    </div>
                    <div>
                      <input 
                        className="block w-full text-xs font-semibold px-3 py-2 bg-page/40 border border-line rounded-xl focus:ring-2 focus:ring-warn/30 focus:border-warn/30" 
                        placeholder="Email (tùy chọn)"
                        value={guestInfo.email}
                        onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                        type="email"
                      />
                    </div>
                  </div>
                </div>

                {/* Bill Calculation Table */}
                <div className="pt-3 border-t border-line/60 space-y-2 text-xs">
                  {selectedRoomType && (
                    <>
                      <div className="flex justify-between text-muted">
                        <span className="">Tiền phòng ({calculateNights()} đêm x {selectedRoomType.name}):</span>
                        <span className="font-semibold text-fg">{formatPrice(pricing.subtotal)}</span>
                      </div>
                      {pricing.surcharges > 0 && (
                        <div className="flex justify-between text-muted">
                          <span>Phụ thu khách thêm:</span>
                          <span className="font-semibold text-fg">{formatPrice(pricing.surcharges)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="pt-2 border-t border-dashed border-line flex justify-between items-baseline">
                    <div>
                      <span className="text-sm font-black text-fg block">Tổng tiền thanh toán</span>
                      <span className="text-[10px] text-muted">Giá đã gồm VAT</span>
                    </div>
                    <span className="text-xl font-black text-warn tracking-tight">{formatPrice(pricing.total)}</span>
                  </div>
                </div>

                {/* Walk-in Payment Method Quick Selection */}
                <div className="pt-3 border-t border-line/60">
                  <label className="block text-xs font-bold text-fg mb-2 uppercase tracking-wider">Phương thức thu tiền tại quầy</label>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {/* VietQR Option */}
                    <button 
                      onClick={() => setPaymentMethod('QR_VIETQR')}
                      className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'QR_VIETQR'
                          ? 'border-2 border-warn/30 bg-warn-soft/50'
                          : 'border border-line bg-panel hover:bg-fg/[0.03]'
                      }`}
                      type="button"
                    >
                      <QrCode className={`text-base ${paymentMethod === 'QR_VIETQR' ? 'text-warn' : 'text-muted'}`} />
                      <span className={`font-bold text-[11px] ${paymentMethod === 'QR_VIETQR' ? 'text-warn' : 'text-fg'}`}>VietQR 247</span>
                    </button>
                    {/* Cash Option */}
                    <button 
                      onClick={() => setPaymentMethod('CASH')}
                      className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'CASH'
                          ? 'border-2 border-warn/30 bg-warn-soft/50'
                          : 'border border-line bg-panel hover:bg-fg/[0.03]'
                      }`}
                      type="button"
                    >
                      <Banknote className={`text-base ${paymentMethod === 'CASH' ? 'text-warn' : 'text-muted'}`} />
                      <span className={`font-semibold text-[11px] ${paymentMethod === 'CASH' ? 'text-warn' : 'text-fg'}`}>Tiền mặt</span>
                    </button>
                    {/* POS Card Option */}
                    <button 
                      onClick={() => setPaymentMethod('POS')}
                      className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'POS'
                          ? 'border-2 border-warn/30 bg-warn-soft/50'
                          : 'border border-line bg-panel hover:bg-fg/[0.03]'
                      }`}
                      type="button"
                    >
                      <CreditCardIcon className={`text-base ${paymentMethod === 'POS' ? 'text-warn' : 'text-muted'}`} />
                      <span className={`font-semibold text-[11px] ${paymentMethod === 'POS' ? 'text-warn' : 'text-fg'}`}>Cà thẻ POS</span>
                    </button>
                  </div>

                  {/* Collection Amount Radio Options */}
                  <div className="mt-3 flex items-center justify-between text-xs bg-fg/[0.03] p-2 rounded-xl">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input 
                        checked={paymentScope === 'full'}
                        onChange={() => setPaymentScope('full')}
                        className="text-warn focus:ring-warn/30 h-3.5 w-3.5" 
                        name="payment_scope" 
                        type="radio" 
                      />
                      <span className="font-bold text-fg">Thu đủ 100% ({formatPrice(pricing.total)})</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input 
                        checked={paymentScope === 'deposit'}
                        onChange={() => setPaymentScope('deposit')}
                        className="text-warn focus:ring-warn/30 h-3.5 w-3.5" 
                        name="payment_scope" 
                        type="radio" 
                      />
                      <span className="font-medium text-muted">Đặt cọc 50%</span>
                    </label>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-err-soft border border-err/30 text-err text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {/* Final Action Buttons CTA */}
                <div className="space-y-2 pt-2">
                  <button 
                    onClick={handleSubmitBooking}
                    disabled={!selectedRoomType || !selectedRoom || !guestInfo.name || !guestInfo.phone || isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-ink hover:bg-ink/90 text-on-ink font-extrabold text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    <span className="">Tiếp tục: Điền Thông Tin & Check-in</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className="py-2 px-3 rounded-lg border border-line bg-panel hover:bg-fg/[0.03] text-fg font-semibold text-xs transition-colors" 
                      type="button"
                    >
                      <Clock className="w-3 h-3 inline mr-1 text-muted" /> Giữ chỗ 15 phút
                    </button>
                    <button 
                      onClick={resetForm}
                      className="py-2 px-3 rounded-lg border border-err/30 bg-err-soft/50 hover:bg-err-soft/50 text-err font-semibold text-xs transition-colors" 
                      type="button"
                    >
                      <RefreshCw className="w-3 h-3 inline mr-1" /> Làm mới đơn
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Synchronized System Footer Tag */}
              <div className="px-5 py-2.5 bg-fg/[0.03] border-t border-line text-[11px] text-muted flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Workflow className="w-3 h-3 text-ok" />
                  Đồng bộ tức thì với Sơ đồ phòng
                </span>
                <span className="font-mono text-[10px] text-muted">#{bookingCode}</span>
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
