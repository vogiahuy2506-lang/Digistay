'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, addDays, differenceInDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import { 
  Search, Calendar, Users, Check, ChevronLeft, ChevronRight, 
  Wifi, Car, Coffee, Dumbbell, Utensils, Snowflake, Waves, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { useSiteHref } from '../_components/site-base'

interface RoomType {
  id: string
  name: string
  description: string
  area: string
  bedType: string
  maxOccupancy: number
  baseOccupancy: number
  totalRooms: number
  availableRooms: number
  isAvailable: boolean
  image: string | null
  amenities: Array<{ id: string; name: string; icon: string }>
  pricing: {
    basePrice: number
    weekdayPrice: number
    weekendPrice: number
    extraAdultPrice: number
    extraChildPrice: number
  }
  numNights: number
}

interface Property {
  id: string
  name: string
  subdomain: string
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-4 h-4" />,
  pool: <Waves className="w-4 h-4" />,
  parking: <Car className="w-4 h-4" />,
  restaurant: <Utensils className="w-4 h-4" />,
  gym: <Dumbbell className="w-4 h-4" />,
  ac: <Snowflake className="w-4 h-4" />,
  breakfast: <Coffee className="w-4 h-4" />,
}

const BED_LABELS: Record<string, string> = {
  SINGLE: '1 giường đơn',
  DOUBLE: '1 giường đôi',
  TWIN: '2 giường đơn',
  TRIPLE: '3 giường đơn',
  QUADRUPLE: '4 giường đơn',
  KING: '1 giường King',
  QUEEN: '1 giường Queen',
  SUITE: 'Suite',
  BUNK: 'Giường tầng',
}

export default function SearchPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const siteHref = useSiteHref()
  
  const [subdomain, setSubdomain] = React.useState<string>('')
  const [property, setProperty] = React.useState<Property | null>(null)
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  
  // Search form state
  const [checkIn, setCheckIn] = React.useState(searchParams.get('checkIn') || format(new Date(), 'yyyy-MM-dd'))
  const [checkOut, setCheckOut] = React.useState(searchParams.get('checkOut') || format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [guests, setGuests] = React.useState(parseInt(searchParams.get('guests') || '2'))
  const [selectedRoomType, setSelectedRoomType] = React.useState<RoomType | null>(null)
  
  // Lock state
  const [lockInfo, setLockInfo] = React.useState<{ lockId: string; expiresAt: string } | null>(null)
  const [lockError, setLockError] = React.useState('')
  
  // Booking form state
  const [showBookingForm, setShowBookingForm] = React.useState(false)
  const [bookingStep, setBookingStep] = React.useState(1)
  const [guestInfo, setGuestInfo] = React.useState({
    name: '',
    phone: '',
    email: '',
    note: '',
  })
  const [selectedServices, setSelectedServices] = React.useState<Array<{ id: string; name: string; price: number }>>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [bookingResult, setBookingResult] = React.useState<{ bookingCode: string } | null>(null)
  const [bookingError, setBookingError] = React.useState('')

  React.useEffect(() => {
    params.then(p => setSubdomain(p.subdomain))
  }, [params])

  React.useEffect(() => {
    if (subdomain) {
      fetchProperty()
    }
  }, [subdomain])

  React.useEffect(() => {
    if (searchParams.get('checkIn')) {
      setCheckIn(searchParams.get('checkIn')!)
    }
    if (searchParams.get('checkOut')) {
      setCheckOut(searchParams.get('checkOut')!)
    }
    if (searchParams.get('guests')) {
      setGuests(parseInt(searchParams.get('guests')!))
    }
  }, [searchParams])

  React.useEffect(() => {
    if (property && checkIn && checkOut) {
      searchAvailability()
    }
  }, [property, checkIn, checkOut, guests])

  const fetchProperty = async () => {
    try {
      const res = await fetch(`/api/properties/public?subdomain=${subdomain}`)
      const data = await res.json()
      // The API returns one property object. This used to expect an array
      // (data.data.length), never set the property, and the page spun on
      // "Đang tìm kiếm phòng trống..." forever.
      const found = Array.isArray(data.data) ? data.data[0] : data.data
      if (data.success && found) {
        setProperty(found)
      } else {
        setError(data.error || 'Không tìm thấy cơ sở')
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Failed to fetch property:', err)
      setError('Lỗi kết nối')
      setIsLoading(false)
    }
  }

  const searchAvailability = async () => {
    if (!property) return
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/bookings/availability?propertyId=${property.id}&checkInDate=${checkIn}&checkOutDate=${checkOut}&numGuests=${guests}`
      )
      const data = await res.json()
      if (data.success) {
        setRoomTypes(data.data)
        if (data.data.length === 0) {
          setError('Không có phòng trống trong khoảng thời gian này')
        }
      } else {
        setError(data.error || 'Lỗi khi tìm kiếm phòng')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Lỗi kết nối')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkIn || !checkOut) return
    if (new Date(checkOut) <= new Date(checkIn)) {
      setError('Ngày trả phòng phải sau ngày nhận phòng')
      return
    }
    router.push(siteHref(`/search?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`))
  }

  const handleSelectRoom = async (roomType: RoomType) => {
    if (!property) return
    
    setSelectedRoomType(roomType)
    setShowBookingForm(true)
    setBookingStep(1)
    
    // Lock the room
    try {
      const res = await fetch('/api/bookings/room-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          roomTypeId: roomType.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setLockInfo({ lockId: data.data.lockId, expiresAt: data.data.expiresAt })
      } else {
        setLockError(data.error || 'Không thể giữ phòng')
      }
    } catch (err) {
      console.error('Lock error:', err)
      setLockError('Lỗi kết nối')
    }
  }

  const calculateNights = () => differenceInDays(new Date(checkOut), new Date(checkIn))

  const calculatePrice = (roomType: RoomType) => {
    const nights = calculateNights()
    const { weekdayPrice, weekendPrice } = roomType.pricing
    
    let weekdayNights = 0
    let weekendNights = 0
    
    let current = new Date(checkIn)
    while (current < new Date(checkOut)) {
      const day = current.getDay()
      if (day === 0 || day === 6) weekendNights++
      else weekdayNights++
      current = addDays(current, 1)
    }
    
    return {
      weekdayTotal: weekdayNights * weekdayPrice,
      weekendTotal: weekendNights * weekendPrice,
      subtotal: weekdayNights * weekdayPrice + weekendNights * weekendPrice,
      serviceTotal: selectedServices.reduce((sum, s) => sum + s.price, 0),
      total: weekdayNights * weekdayPrice + weekendNights * weekendPrice + selectedServices.reduce((sum, s) => sum + s.price, 0),
    }
  }

  const handleSubmitBooking = async () => {
    if (!guestInfo.name || !guestInfo.phone) {
      setBookingError('Vui lòng nhập đầy đủ thông tin')
      return
    }
    
    setIsSubmitting(true)
    setBookingError('')
    
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property?.id,
          roomTypeId: selectedRoomType?.id,
          guestName: guestInfo.name,
          guestPhone: guestInfo.phone,
          guestEmail: guestInfo.email,
          guestNote: guestInfo.note,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numAdults: guests,
          numChildren: 0,
          extraServices: selectedServices.map(s => ({ serviceId: s.id, quantity: 1 })),
        }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        setBookingResult({ bookingCode: data.data.bookingCode })
        setBookingStep(4)
      } else {
        setBookingError(data.error || 'Đặt phòng thất bại')
      }
    } catch (err) {
      console.error('Booking error:', err)
      setBookingError('Lỗi kết nối')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatPrice = (price: number) => formatCurrency(price)
  const formatDate = (date: string) => format(new Date(date), 'EEE, dd/MM', { locale: vi })

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-page/95 backdrop-blur border-b border-line sticky top-0 z-50">
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-8 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-site text-[22px] leading-tight text-fg">{property?.name || 'Tìm phòng'}</h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Đặt phòng trực tuyến</p>
            </div>
            <a
              href={siteHref('/')}
              className="text-sm text-muted hover:text-fg flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Quay lại
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-8 lg:px-12 py-8">
        {/* Search Form */}
        <div className="bg-panel rounded-box shadow-lg p-6 mb-8">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Nhận phòng</label>
              <input
                type="date"
                value={checkIn}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-ctl focus:ring-2 focus:ring-acc/30 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Trả phòng</label>
              <input
                type="date"
                value={checkOut}
                min={checkIn || format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-ctl focus:ring-2 focus:ring-acc/30 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Số khách</label>
              <div className="flex items-center border border-line rounded-ctl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  className="px-4 py-2 hover:bg-fg/5 border-r"
                >
                  −
                </button>
                <span className="flex-1 text-center">
                  <Users className="w-4 h-4 inline mr-1" />
                  {guests}
                </span>
                <button
                  type="button"
                  onClick={() => setGuests(Math.min(20, guests + 1))}
                  className="px-4 py-2 hover:bg-fg/5 border-l"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" size="lg">
                <Search className="w-4 h-4 mr-2" />
                Tìm kiếm
              </Button>
            </div>
          </form>
        </div>

        {/* Results */}
        {error && (
          <div className="bg-warn-soft border border-warn/30 rounded-ctl p-4 mb-6">
            <p className="text-warn">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-line border-t-fg rounded-full mx-auto mb-4" />
            <p className="text-muted">Đang tìm kiếm phòng trống...</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-fg">
                  {roomTypes.length} hạng phòng có sẵn
                </h2>
                <p className="text-muted">
                  {formatDate(checkIn)} → {formatDate(checkOut)} • {calculateNights()} đêm • {guests} khách
                </p>
              </div>
            </div>

            {/* Room List */}
            <div className="space-y-4">
              {roomTypes.map((roomType) => {
                const pricing = calculatePrice(roomType)
                const isSelected = selectedRoomType?.id === roomType.id
                
                return (
                  <div
                    key={roomType.id}
                    className={`bg-panel rounded-box overflow-hidden shadow-sm hover:shadow-md transition-all ${
                      isSelected ? 'ring-2 ring-info/30' : ''
                    }`}
                  >
                    <div className="md:flex">
                      {/* Image */}
                      <div className="md:w-80 h-48 md:h-auto">
                        {roomType.image ? (
                          <img
                            src={roomType.image}
                            alt={roomType.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-fg/10 flex items-center justify-center">
                            <span className="text-muted">No image</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-fg mb-2">{roomType.name}</h3>
                            <div className="flex flex-wrap gap-2 text-sm text-muted mb-3">
                              <span className="px-2 py-1 bg-fg/5 rounded">{BED_LABELS[roomType.bedType] || roomType.bedType}</span>
                              {roomType.area && <span className="px-2 py-1 bg-fg/5 rounded">{roomType.area}m²</span>}
                              <span className="px-2 py-1 bg-fg/5 rounded">Tối đa {roomType.maxOccupancy} khách</span>
                            </div>
                            
                            {/* Amenities */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {roomType.amenities.slice(0, 5).map((a) => (
                                <span key={a.id} className="text-xs text-muted flex items-center gap-1">
                                  {AMENITY_ICONS[a.icon] || <Sparkles className="w-3 h-3" />}
                                  {a.name}
                                </span>
                              ))}
                            </div>
                            
                            {/* Availability */}
                            <div className="flex items-center gap-2">
                              {roomType.availableRooms > 0 ? (
                                <span className="text-sm text-ok flex items-center gap-1">
                                  <Check className="w-4 h-4" />
                                  {roomType.availableRooms} phòng trống
                                </span>
                              ) : (
                                <span className="text-sm text-err">Hết phòng</span>
                              )}
                            </div>
                          </div>

                          {/* Price */}
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-acc">
                              {formatPrice(pricing.subtotal)}
                            </p>
                            <p className="text-sm text-muted">{calculateNights()} đêm</p>
                            <p className="text-xs text-muted mt-1">
                              {formatPrice(roomType.pricing.weekdayPrice)}/đêm thường
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                          <p className="text-sm text-muted">
                            {/* Used to print a made-up figure (total / nights × an arbitrary 0.4 factor). */}
                            {pricing.weekdayTotal > 0 && `${formatPrice(pricing.weekdayTotal)} ngày thường`}
                            {pricing.weekendTotal > 0 && ` + ${formatPrice(pricing.weekendTotal)} cuối tuần`}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => router.push(siteHref(`/rooms/${roomType.id}?checkIn=${checkIn}&checkOut=${checkOut}`))}
                            >
                              Xem chi tiết
                            </Button>
                            {roomType.isAvailable && (
                              <Button onClick={() => handleSelectRoom(roomType)}>
                                Đặt phòng này
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

      {/* Booking Modal */}
      {showBookingForm && selectedRoomType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-panel rounded-box max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-panel border-b border-line p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Đặt phòng: {selectedRoomType.name}</h3>
                <p className="text-sm text-muted">
                  {formatDate(checkIn)} - {formatDate(checkOut)} • {calculateNights()} đêm
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBookingForm(false)
                  setSelectedRoomType(null)
                }}
                className="p-2 hover:bg-fg/5 rounded-ctl"
              >
                ✕
              </button>
            </div>

            {/* Lock Warning */}
            {lockInfo && (
              <div className="bg-info-soft border-b border-info/30 p-3 text-center text-sm text-info">
                ⏰ Phòng được giữ trong 15 phút. Vui lòng hoàn tất đặt phòng.
              </div>
            )}
            {lockError && (
              <div className="bg-err-soft border-b border-err/30 p-3 text-center text-sm text-err">
                {lockError}
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6">
              {bookingStep === 1 && (
                /* Step 1: Guest Info */
                <div>
                  <h4 className="font-semibold mb-4">Thông tin khách hàng</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">Họ tên *</label>
                      <input
                        type="text"
                        value={guestInfo.name}
                        onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                        placeholder="Nguyễn Văn A"
                        className="w-full px-4 py-2 border border-line rounded-ctl focus:ring-2 focus:ring-acc/30"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">Số điện thoại *</label>
                      <input
                        type="tel"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                        placeholder="0912345678"
                        className="w-full px-4 py-2 border border-line rounded-ctl focus:ring-2 focus:ring-acc/30"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">Email</label>
                      <input
                        type="email"
                        value={guestInfo.email}
                        onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                        placeholder="email@example.com"
                        className="w-full px-4 py-2 border border-line rounded-ctl focus:ring-2 focus:ring-acc/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">Ghi chú</label>
                      <textarea
                        value={guestInfo.note}
                        onChange={(e) => setGuestInfo({ ...guestInfo, note: e.target.value })}
                        placeholder="Yêu cầu đặc biệt..."
                        rows={3}
                        className="w-full px-4 py-2 border border-line rounded-ctl focus:ring-2 focus:ring-acc/30"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => setBookingStep(2)}>
                      Tiếp tục
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {bookingStep === 2 && (
                /* Step 2: Services & Summary */
                <div>
                  <h4 className="font-semibold mb-4">Dịch vụ kèm theo (tùy chọn)</h4>
                  <p className="text-sm text-muted mb-4">
                    Chọn các dịch vụ bổ sung để có trải nghiệm tốt hơn
                  </p>
                  
                  <div className="space-y-3 mb-6">
                    <label className="flex items-center justify-between p-4 border border-line rounded-ctl hover:bg-fg/[0.03] cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedServices.some(s => s.id === 'breakfast')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServices([...selectedServices, { id: 'breakfast', name: 'Ăn sáng', price: 150000 * calculateNights() }])
                            } else {
                              setSelectedServices(selectedServices.filter(s => s.id !== 'breakfast'))
                            }
                          }}
                          className="w-5 h-5 text-info"
                        />
                        <div>
                          <p className="font-medium">Ăn sáng buffet</p>
                          <p className="text-sm text-muted">150.000đ/người/ngày</p>
                        </div>
                      </div>
                      <span className="font-semibold">{formatPrice(150000 * calculateNights() * guests)}</span>
                    </label>
                    
                    <label className="flex items-center justify-between p-4 border border-line rounded-ctl hover:bg-fg/[0.03] cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedServices.some(s => s.id === 'airport')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServices([...selectedServices, { id: 'airport', name: 'Đưa đón sân bay', price: 300000 }])
                            } else {
                              setSelectedServices(selectedServices.filter(s => s.id !== 'airport'))
                            }
                          }}
                          className="w-5 h-5 text-info"
                        />
                        <div>
                          <p className="font-medium">Đưa đón sân bay</p>
                          <p className="text-sm text-muted">300.000đ/chuyến</p>
                        </div>
                      </div>
                      <span className="font-semibold">{formatPrice(300000)}</span>
                    </label>
                  </div>

                  {/* Summary */}
                  <div className="bg-fg/[0.03] rounded-ctl p-4 mb-6">
                    <h5 className="font-medium mb-3">Tóm tắt đặt phòng</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Phòng ({calculateNights()} đêm)</span>
                        <span>{formatPrice(calculatePrice(selectedRoomType).subtotal)}</span>
                      </div>
                      {selectedServices.map(s => (
                        <div key={s.id} className="flex justify-between">
                          <span>{s.name}</span>
                          <span>{formatPrice(s.price)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-base pt-2 border-t">
                        <span>Tổng cộng</span>
                        <span className="text-acc">{formatPrice(calculatePrice(selectedRoomType).total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Policy */}
                  <div className="bg-warn-soft border border-warn/30 rounded-ctl p-4 mb-6">
                    <h5 className="font-medium text-warn mb-2">Chính sách hủy</h5>
                    <ul className="text-sm text-warn space-y-1">
                      <li>• Hủy miễn phí trước 24 giờ check-in</li>
                      <li>• Hủy trong vòng 24h: mất 50% tiền cọc</li>
                      <li>• Không đến: mất toàn bộ tiền cọc</li>
                    </ul>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setBookingStep(1)}>
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Quay lại
                    </Button>
                    <Button onClick={() => setBookingStep(3)}>
                      Tiếp tục thanh toán
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                /* Step 3: Payment */
                <div>
                  <h4 className="font-semibold mb-4">Thanh toán</h4>
                  
                  <div className="space-y-3 mb-6">
                    <label className="flex items-center justify-between p-4 border-2 border-info/30 bg-info-soft rounded-ctl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          value="CASH"
                          defaultChecked
                          className="w-5 h-5 text-info"
                        />
                        <div>
                          <p className="font-medium">Thanh toán tại quầy</p>
                          <p className="text-sm text-muted">Tiền mặt hoặc chuyển khoản khi nhận phòng</p>
                        </div>
                      </div>
                      <span className="text-2xl">💵</span>
                    </label>
                  </div>

                  {/* Final Summary */}
                  <div className="bg-fg/[0.03] rounded-ctl p-4 mb-6">
                    <h5 className="font-medium mb-3">Chi tiết thanh toán</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{selectedRoomType.name} ({calculateNights()} đêm)</span>
                        <span>{formatPrice(calculatePrice(selectedRoomType).subtotal)}</span>
                      </div>
                      {selectedServices.map(s => (
                        <div key={s.id} className="flex justify-between">
                          <span>{s.name}</span>
                          <span>{formatPrice(s.price)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Tổng cộng</span>
                        <span className="text-acc">{formatPrice(calculatePrice(selectedRoomType).total)}</span>
                      </div>
                    </div>
                  </div>

                  {bookingError && (
                    <div className="bg-err-soft border border-err/30 rounded-ctl p-3 text-sm text-err mb-4">
                      {bookingError}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setBookingStep(2)}>
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Quay lại
                    </Button>
                    <Button onClick={handleSubmitBooking} isLoading={isSubmitting}>
                      Xác nhận đặt phòng
                    </Button>
                  </div>
                </div>
              )}

              {bookingStep === 4 && bookingResult && (
                /* Step 4: Success */
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full bg-ok-soft flex items-center justify-center mx-auto mb-6">
                    <Check className="w-10 h-10 text-ok" />
                  </div>
                  <h3 className="text-2xl font-bold text-fg mb-2">Đặt phòng thành công!</h3>
                  <p className="text-muted mb-4">
                    Mã đặt phòng của bạn là
                  </p>
                  <p className="text-3xl font-mono font-bold text-info mb-6">
                    {bookingResult.bookingCode}
                  </p>
                  <p className="text-sm text-muted mb-6">
                    Vui lòng ghi nhớ mã đặt phòng này để check-in
                  </p>
                  <div className="bg-fg/[0.03] rounded-ctl p-4 text-left text-sm mb-6">
                    <p className="font-medium mb-2">Thông tin đặt phòng:</p>
                    <p>• Khách sạn: {property?.name}</p>
                    <p>• Nhận phòng: {formatDate(checkIn)}</p>
                    <p>• Trả phòng: {formatDate(checkOut)}</p>
                    <p>• Phòng: {selectedRoomType?.name}</p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={() => {
                      setShowBookingForm(false)
                      setSelectedRoomType(null)
                      setBookingResult(null)
                    }}>
                      Đặt thêm phòng
                    </Button>
                    <Button onClick={() => router.push(siteHref('/'))}>
                      Quay về trang chủ
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
