'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Bed, Users, BedDouble,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface RoomType {
  id: string
  name: string
  totalRooms: number
}

interface Booking {
  id: string
  bookingCode: string
  guestName: string
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'
  checkInDate: string
  checkOutDate: string
  bookingItems: Array<{
    id: string
    roomTypeId: string
    roomNumber: string | null
  }>
}

const STATUS_LABEL: Record<Booking['status'], string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã nhận phòng',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Không đến',
}

const STATUS_VARIANT: Record<Booking['status'], 'warning' | 'primary' | 'success' | 'gray' | 'danger'> = {
  PENDING: 'warning',
  CONFIRMED: 'primary',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'gray',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Build the 6×7 grid for the calendar (always 42 cells)
function buildMonthGrid(date: Date): { date: Date; isCurrentMonth: boolean }[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startingDay = firstDay.getDay() // 0 = Sun

  const days: { date: Date; isCurrentMonth: boolean }[] = []
  // previous month padding
  for (let i = 0; i < startingDay; i++) {
    days.push({ date: new Date(year, month, -startingDay + i + 1), isCurrentMonth: false })
  }
  // current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }
  // next month padding
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
  }
  return days
}

export default function CalendarPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id

  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([])
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (propertyId) {
      fetchCalendarData()
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, currentDate.getFullYear(), currentDate.getMonth()])

  const fetchCalendarData = async () => {
    setIsLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const start = startOfDay(new Date(year, month, 1)).toISOString()
      const end = startOfDay(new Date(year, month + 1, 0)).toISOString()

      const [roomTypesRes, bookingsRes] = await Promise.all([
        fetch(`/api/room-types?propertyId=${propertyId}`),
        fetch(`/api/bookings?propertyId=${propertyId}&startDate=${start}&endDate=${end}&limit=200`),
      ])
      const [roomTypesData, bookingsData] = await Promise.all([
        roomTypesRes.json(),
        bookingsRes.json(),
      ])

      if (roomTypesData.success) {
        setRoomTypes(roomTypesData.data ?? [])
      } else {
        toast.error(roomTypesData.error || 'Không thể tải hạng phòng')
      }

      if (bookingsData.success) {
        // Filter to active bookings (skip cancelled/no-show for the bar overlay)
        setBookings(bookingsData.data ?? [])
      } else {
        toast.error(bookingsData.error || 'Không thể tải đặt phòng')
      }
    } catch (err) {
      console.error('Calendar fetch error:', err)
      toast.error('Đã xảy ra lỗi khi tải lịch')
    } finally {
      setIsLoading(false)
    }
  }

  // Bookings that overlap a given day. Cancelled/No-show are excluded
  // because they don't actually consume room inventory.
  const bookingsForDay = (day: Date) => {
    const dayStart = startOfDay(day).getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1
    return bookings.filter(b => {
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') return false
      const inStart = new Date(b.checkInDate).getTime()
      const outEnd = new Date(b.checkOutDate).getTime()
      return inStart <= dayEnd && outEnd >= dayStart
    })
  }

  // Occupied-room count for a day per room type.
  const occupancyForDay = (day: Date) => {
    const result = new Map<string, number>()
    for (const b of bookingsForDay(day)) {
      for (const item of b.bookingItems) {
        result.set(item.roomTypeId, (result.get(item.roomTypeId) ?? 0) + 1)
      }
    }
    return result
  }

  const monthLabel = formatDate(currentDate, { month: 'long', year: 'numeric' })
  const today = startOfDay(new Date())
  const days = buildMonthGrid(currentDate)
  const totalRooms = roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)

  // Aggregate stats for the current month
  const stats = React.useMemo(() => {
    let activeBookings = 0
    let checkedIn = 0
    let pending = 0
    for (const b of bookings) {
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') continue
      activeBookings++
      if (b.status === 'CHECKED_IN') checkedIn++
      if (b.status === 'PENDING') pending++
    }
    return { totalRooms, activeBookings, checkedIn, pending }
  }, [bookings, totalRooms])

  return (
    <PageContainer>
      <Header
        title="Lịch Phòng"
        description={`${stats.totalRooms} phòng • ${monthLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              aria-label="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date())}
            >
              Hôm nay
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              aria-label="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Tổng phòng</p>
              <p className="text-2xl font-bold text-blue-700">{stats.totalRooms}</p>
            </div>
            <Bed className="w-8 h-8 text-blue-600" />
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Đặt phòng trong tháng</p>
              <p className="text-2xl font-bold text-purple-700">{stats.activeBookings}</p>
            </div>
            <BedDouble className="w-8 h-8 text-purple-600" />
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 font-medium">Đang ở</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.checkedIn}</p>
            </div>
            <Users className="w-8 h-8 text-emerald-600" />
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 font-medium">Chờ xác nhận</p>
              <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
            </div>
            <CalendarIcon className="w-8 h-8 text-amber-600" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {days.map((day, index) => {
                    const dayBookings = bookingsForDay(day.date)
                    const occupancy = occupancyForDay(day.date)
                    const occupiedCount = Array.from(occupancy.values()).reduce((a, b) => a + b, 0)
                    const isToday = isSameDay(day.date, today)
                    return (
                      <div
                        key={index}
                        className={`min-h-[96px] p-2 rounded-lg border ${
                          day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                        } ${isToday ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'}`}
                      >
                        <div
                          className={`text-sm font-medium mb-1 ${
                            day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                          } ${isToday ? 'text-primary' : ''}`}
                        >
                          {day.date.getDate()}
                        </div>
                        {day.isCurrentMonth && (
                          <div className="space-y-1">
                            {occupiedCount > 0 && (
                              <div
                                className="text-[10px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200"
                                title={`${occupiedCount} phòng đang sử dụng`}
                              >
                                {occupiedCount}/{stats.totalRooms || 0} bận
                              </div>
                            )}
                            {dayBookings.slice(0, 2).map((b) => (
                              <div
                                key={b.id}
                                title={`${b.guestName} - ${STATUS_LABEL[b.status]}`}
                                className="text-[10px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 truncate"
                              >
                                {b.bookingCode}
                              </div>
                            ))}
                            {dayBookings.length > 2 && (
                              <div className="text-[10px] text-gray-400">
                                +{dayBookings.length - 2} đơn
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Hạng phòng</CardTitle>
            </CardHeader>
            <CardContent>
              {roomTypes.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có hạng phòng nào.</p>
              ) : (
                <div className="space-y-2">
                  {roomTypes.map((rt) => (
                    <div
                      key={rt.id}
                      className="p-3 rounded-lg border border-gray-200 bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{rt.name}</p>
                          <p className="text-xs text-gray-500">{rt.totalRooms} phòng</p>
                        </div>
                        <Badge variant="outline">{rt.totalRooms}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
