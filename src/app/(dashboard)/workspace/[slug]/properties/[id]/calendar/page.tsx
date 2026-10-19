'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Modal, Loading } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Bed, Users, BedDouble, Plus, DoorOpen, Bell, Receipt,
  Search, HelpCircle, Building2, User,
  PieChart, RotateCw, CheckCircle, Key, 
  Trash2, Wrench, Tag, RefreshCw,
  TrendingUp, ArrowUpRight, Clock, ListChecks,
  Sparkles, Package, Armchair, X, Eye,
  Loader2, Save, XCircle
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { format, addDays } from 'date-fns'

interface RoomType {
  id: string
  name: string
  totalRooms: number
}

interface Booking {
  id: string
  bookingCode: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestNote: string | null
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'
  checkInDate: string
  checkOutDate: string
  numAdults: number
  numChildren: number
  totalAmount: number
  depositAmount: number
  subtotal: number
  extraCharges: number
  paymentStatus: string
  source: string
  bookingItems: Array<{
    id: string
    roomTypeId: string
    roomNumber: string | null
    basePrice: number
    totalPrice: number
  }>
  property?: {
    id: string
    name: string
    subdomain: string
  }
  payments?: any[]
  invoices?: any[]
  createdAt?: string
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildMonthGrid(date: Date): { date: Date; isCurrentMonth: boolean }[] {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

  const days: { date: Date; isCurrentMonth: boolean }[] = []
    for (let i = 0; i < startingDay; i++) {
    days.push({ date: new Date(year, month, -startingDay + i + 1), isCurrentMonth: false })
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }
    return days
  }

const ROOM_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ota: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  direct: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800' },
  group: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
}

export default function CalendarPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id

  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [viewMode, setViewMode] = React.useState<'month' | 'week' | 'day'>('month')
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([])
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = React.useState('all')
  const [selectedFloorFilter, setSelectedFloorFilter] = React.useState('all')
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [showCreateBookingModal, setShowCreateBookingModal] = React.useState(false)
  const [showBookingDetailModal, setShowBookingDetailModal] = React.useState(false)
  const [showExportModal, setShowExportModal] = React.useState(false)
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null)
  const [isActionLoading, setIsActionLoading] = React.useState(false)
  const [actionLoadingType, setActionLoadingType] = React.useState('')
  const [currentTime, setCurrentTime] = React.useState(new Date())
  const [exportType, setExportType] = React.useState<'pdf' | 'excel' | 'csv'>('pdf')

  // Update time every minute
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Create booking form state
  const [newBooking, setNewBooking] = React.useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkInDate: format(new Date(), 'yyyy-MM-dd'),
    checkOutDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    roomTypeId: '',
    numAdults: 2,
    numChildren: 0,
    guestNote: '',
  })

  React.useEffect(() => {
    if (propertyId) {
      fetchCalendarData()
    } else {
      setIsLoading(false)
    }
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
      }

      if (bookingsData.success) {
        setBookings(bookingsData.data ?? [])
      }
    } catch (err) {
      console.error('Calendar fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }

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

  const occupancyForDay = (day: Date) => {
    const result = new Map<string, number>()
    for (const b of bookingsForDay(day)) {
      for (const item of b.bookingItems) {
        result.set(item.roomTypeId, (result.get(item.roomTypeId) ?? 0) + 1)
      }
    }
    return result
  }

  // Handle creating a new booking
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsActionLoading(true)
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          guestName: newBooking.guestName,
          guestEmail: newBooking.guestEmail,
          guestPhone: newBooking.guestPhone,
          guestNote: newBooking.guestNote,
          checkInDate: new Date(newBooking.checkInDate).toISOString(),
          checkOutDate: new Date(newBooking.checkOutDate).toISOString(),
          numAdults: newBooking.numAdults,
          numChildren: newBooking.numChildren,
          roomTypeId: newBooking.roomTypeId,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Tạo đơn đặt phòng thành công')
        setShowCreateBookingModal(false)
        setNewBooking({
          guestName: '',
          guestEmail: '',
          guestPhone: '',
          checkInDate: format(new Date(), 'yyyy-MM-dd'),
          checkOutDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
          roomTypeId: '',
          numAdults: 2,
          numChildren: 0,
          guestNote: '',
        })
        fetchCalendarData()
      } else {
        toast.error(data.error || 'Lỗi khi tạo đơn đặt phòng')
      }
    } catch (err) {
      console.error('Create booking error:', err)
      toast.error('Lỗi khi tạo đơn đặt phòng')
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle viewing booking details
  const handleViewBooking = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`)
      const data = await response.json()
      if (data.success) {
        setSelectedBooking(data.data)
        setShowBookingDetailModal(true)
      } else {
        toast.error(data.error || 'Lỗi khi lấy thông tin đơn đặt phòng')
      }
    } catch (err) {
      console.error('Fetch booking error:', err)
      toast.error('Lỗi khi lấy thông tin đơn đặt phòng')
    }
  }

  // Handle check-in
  const handleCheckIn = async (bookingId: string) => {
    setIsActionLoading(true)
    setActionLoadingType('checkin')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-in`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        toast.success('Check-in thành công')
        setShowBookingDetailModal(false)
        fetchCalendarData()
      } else {
        toast.error(data.error || 'Lỗi khi check-in')
      }
    } catch (err) {
      console.error('Check-in error:', err)
      toast.error('Lỗi khi check-in')
    } finally {
      setIsActionLoading(false)
      setActionLoadingType('')
    }
  }

  // Handle check-out
  const handleCheckOut = async (bookingId: string) => {
    setIsActionLoading(true)
    setActionLoadingType('checkout')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-out`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(data.message || 'Check-out thành công')
        setShowBookingDetailModal(false)
        fetchCalendarData()
      } else {
        toast.error(data.error || 'Lỗi khi check-out')
      }
    } catch (err) {
      console.error('Check-out error:', err)
      toast.error('Lỗi khi check-out')
    } finally {
      setIsActionLoading(false)
      setActionLoadingType('')
    }
  }

  // Handle cancel booking
  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn đặt phòng này?')) return
    setIsActionLoading(true)
    setActionLoadingType('cancel')
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        toast.success('Hủy đơn đặt phòng thành công')
        setShowBookingDetailModal(false)
        fetchCalendarData()
      } else {
        toast.error(data.error || 'Lỗi khi hủy đơn đặt phòng')
      }
    } catch (err) {
      console.error('Cancel booking error:', err)
      toast.error('Lỗi khi hủy đơn đặt phòng')
    } finally {
      setIsActionLoading(false)
      setActionLoadingType('')
    }
  }

  // Handle room action buttons
  const handleRoomAction = async (action: string) => {
    toast.info(`Tính năng "${action}" đang được phát triển`)
  }

  // Handle export report
  const handleExportReport = async () => {
    setIsActionLoading(true)
    try {
      // Calculate report data
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      
      // Filter bookings for current month
      const monthBookings = bookings.filter(b => {
        const checkIn = new Date(b.checkInDate)
        return checkIn >= monthStart && checkIn <= monthEnd
      })

      // Calculate stats
      const totalBookings = monthBookings.length
      const confirmedBookings = monthBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN').length
      const checkedInBookings = monthBookings.filter(b => b.status === 'CHECKED_IN').length
      const checkedOutBookings = monthBookings.filter(b => b.status === 'CHECKED_OUT').length
      const cancelledBookings = monthBookings.filter(b => b.status === 'CANCELLED').length
      
      // Calculate occupancy
      const daysInMonth = monthEnd.getDate()
      const totalRoomNights = totalRooms * daysInMonth
      let occupiedRoomNights = 0
      
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dayBookings = bookingsForDay(new Date(d))
        occupiedRoomNights += dayBookings.reduce((sum, b) => sum + b.bookingItems.length, 0)
      }
      
      const occupancyRate = totalRoomNights > 0 ? Math.round((occupiedRoomNights / totalRoomNights) * 100) : 0

      // Generate report content
      const reportData = {
        title: `Báo Cáo Doanh Thu Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`,
        generatedAt: new Date().toISOString(),
        propertyId,
        summary: {
          totalRooms,
          totalBookings,
          confirmedBookings,
          checkedInBookings,
          checkedOutBookings,
          cancelledBookings,
          occupancyRate,
          totalRevenue: stats.revenue * 1000000,
        },
        bookings: monthBookings.map(b => ({
          bookingCode: b.bookingCode,
          guestName: b.guestName,
          checkIn: b.checkInDate,
          checkOut: b.checkOutDate,
          status: b.status,
          rooms: b.bookingItems.map(i => i.roomNumber || 'Chưa gán').join(', '),
        })),
      }

      // Export based on selected type
      if (exportType === 'csv') {
        // Generate CSV
        const csvHeaders = ['Mã đơn', 'Khách', 'Nhận phòng', 'Trả phòng', 'Trạng thái', 'Phòng']
        const csvRows = reportData.bookings.map(b => [
          b.bookingCode,
          b.guestName,
          new Date(b.checkIn).toLocaleDateString('vi-VN'),
          new Date(b.checkOut).toLocaleDateString('vi-VN'),
          b.status,
          b.rooms,
        ])
        
        const csvContent = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n')
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `bao-cao-${currentDate.getMonth() + 1}-${currentDate.getFullYear()}.csv`
        link.click()
        URL.revokeObjectURL(url)
        toast.success('Đã tải báo cáo CSV!')
      } else if (exportType === 'excel') {
        // For Excel, we'll create a simple HTML table that Excel can open
        const excelHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Báo Cáo Doanh Thu</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #d95338; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #d95338; color: white; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
              .summary-item { display: inline-block; margin-right: 30px; }
            </style>
          </head>
          <body>
            <h1>${reportData.title}</h1>
            <div class="summary">
              <div class="summary-item"><strong>Tổng phòng:</strong> ${reportData.summary.totalRooms}</div>
              <div class="summary-item"><strong>Tổng đơn:</strong> ${reportData.summary.totalBookings}</div>
              <div class="summary-item"><strong>Đã xác nhận:</strong> ${reportData.summary.confirmedBookings}</div>
              <div class="summary-item"><strong>Đã nhận:</strong> ${reportData.summary.checkedInBookings}</div>
              <div class="summary-item"><strong>Đã trả:</strong> ${reportData.summary.checkedOutBookings}</div>
              <div class="summary-item"><strong>Công suất:</strong> ${reportData.summary.occupancyRate}%</div>
          </div>
            <table>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách</th>
                  <th>Nhận phòng</th>
                  <th>Trả phòng</th>
                  <th>Trạng thái</th>
                  <th>Phòng</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.bookings.map(b => `
                  <tr>
                    <td>${b.bookingCode}</td>
                    <td>${b.guestName}</td>
                    <td>${new Date(b.checkIn).toLocaleDateString('vi-VN')}</td>
                    <td>${new Date(b.checkOut).toLocaleDateString('vi-VN')}</td>
                    <td>${b.status}</td>
                    <td>${b.rooms}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p style="margin-top: 20px; color: #666;">Xuất lúc: ${new Date().toLocaleString('vi-VN')}</p>
          </body>
          </html>
        `
        const blob = new Blob([excelHTML], { type: 'application/vnd.ms-excel' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `bao-cao-${currentDate.getMonth() + 1}-${currentDate.getFullYear()}.xls`
        link.click()
        URL.revokeObjectURL(url)
        toast.success('Đã tải báo cáo Excel!')
      } else {
        // PDF - show print dialog which can save as PDF
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Báo Cáo Doanh Thu</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; }
                h1 { color: #d95338; text-align: center; border-bottom: 2px solid #d95338; padding-bottom: 10px; }
                .summary { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
                .summary-item { text-align: center; }
                .summary-item strong { display: block; font-size: 24px; color: #d95338; }
                .summary-item span { color: #666; font-size: 12px; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                th { background-color: #d95338; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
                @media print { body { padding: 20px; } }
              </style>
            </head>
            <body>
              <h1>${reportData.title}</h1>
              <div class="summary">
                <div class="summary-item">
                  <strong>${reportData.summary.totalRooms}</strong>
                  <span>Tổng phòng</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.totalBookings}</strong>
                  <span>Tổng đơn</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.occupancyRate}%</strong>
                  <span>Công suất</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.confirmedBookings}</strong>
                  <span>Đã xác nhận</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.checkedInBookings}</strong>
                  <span>Đã nhận phòng</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.checkedOutBookings}</strong>
                  <span>Đã trả phòng</span>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách</th>
                    <th>Nhận phòng</th>
                    <th>Trả phòng</th>
                    <th>Trạng thái</th>
                    <th>Phòng</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.bookings.map(b => `
                    <tr>
                      <td>${b.bookingCode}</td>
                      <td>${b.guestName}</td>
                      <td>${new Date(b.checkIn).toLocaleDateString('vi-VN')}</td>
                      <td>${new Date(b.checkOut).toLocaleDateString('vi-VN')}</td>
                      <td>${b.status}</td>
                      <td>${b.rooms}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="footer">
                Xuất báo cáo lúc: ${new Date().toLocaleString('vi-VN')}
              </div>
            </body>
            </html>
          `)
          printWindow.document.close()
          setTimeout(() => {
            printWindow.print()
          }, 500)
        }
        toast.success('Đang mở cửa sổ in để lưu PDF...')
      }
      
      setShowExportModal(false)
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Lỗi khi xuất báo cáo')
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchCalendarData()
    toast.success('Đã làm mới dữ liệu')
  }

  // Open create booking modal for a specific date
  const openCreateBookingForDate = (date: Date) => {
    setSelectedDate(date)
    setNewBooking(prev => ({
      ...prev,
      checkInDate: format(date, 'yyyy-MM-dd'),
      checkOutDate: format(addDays(date, 1), 'yyyy-MM-dd'),
    }))
    setShowCreateBookingModal(true)
  }

  const monthLabel = formatDate(currentDate, { month: 'long', year: 'numeric' })
  const today = startOfDay(new Date())
  const days = buildMonthGrid(currentDate)
  const totalRooms = roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)

  const stats = React.useMemo(() => {
    let activeBookings = 0
    let checkedIn = 0
    let pending = 0
    let revenue = 0

    for (const b of bookings) {
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') continue
      activeBookings++
      if (b.status === 'CHECKED_IN') checkedIn++
      if (b.status === 'PENDING') pending++
      revenue += 2800000
    }

    const checkInsToday = bookings.filter(b => {
      if (b.status !== 'CONFIRMED' && b.status !== 'PENDING') return false
      return isSameDay(new Date(b.checkInDate), today)
    }).length

    return { 
      totalRooms, 
      activeBookings, 
      checkedIn, 
      pending,
      revenue: Math.round(revenue / 1000000),
      checkInsToday
    }
  }, [bookings, totalRooms, today])

  const todayCheckIns = React.useMemo(() => {
    return bookings.filter(b => {
      if (b.status !== 'CONFIRMED' && b.status !== 'PENDING') return false
      return isSameDay(new Date(b.checkInDate), today)
    })
  }, [bookings, today])

  const todayCheckOuts = React.useMemo(() => {
    return bookings.filter(b => {
      if (b.status !== 'CHECKED_IN') return false
      return isSameDay(new Date(b.checkOutDate), today)
    })
  }, [bookings, today])

  const dayOfWeekLabel = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

  const getOccupancyPercent = (day: Date) => {
    const occupied = Array.from(occupancyForDay(day).values()).reduce((a, b) => a + b, 0)
    return totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0
  }

  const getOccupancyBadge = (day: Date) => {
    const occupied = Array.from(occupancyForDay(day).values()).reduce((a, b) => a + b, 0)
    if (occupied === 0) return null
    const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0
    
    if (percent >= 80) {
      return { label: `${occupied}/${totalRooms} bận`, className: 'bg-amber-50 text-amber-800 border-amber-200' }
    }
    if (occupied >= totalRooms * 0.5) {
      return { label: `${occupied}/${totalRooms} bận`, className: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
    }
    return { label: `${occupied}/${totalRooms} bận`, className: 'bg-gray-100 text-gray-600 border-gray-200' }
  }

  const isWeekend = (day: Date) => {
    const d = day.getDay()
    return d === 0 || d === 6
  }

  return (
    <div className="min-h-full bg-[#fbf9f6] text-[#241a18] antialiased flex flex-col font-sans">
      {/* Top Hospitality CRM App Bar */}
      <header className="bg-white border-b border-[#eae6de] sticky top-0 z-40">
        {/* Main Header */}
        <div className="px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Brand / Workspace & Breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pr-4 border-r border-[#ece8df]">
              <div className="w-8 h-8 rounded-lg bg-[#d95338] text-white flex items-center justify-center font-black text-sm shadow-sm shadow-[#d95338]/25">
                D
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-bold text-sm tracking-tight text-[#1e1715]">DigiStay Hotel OS</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#fff5f2] text-[#d95338] border border-[#ffe8e2]">PMS Pro</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                  <Building2 className="w-3 h-3 text-[10px] text-gray-400" />
                  <span>Khách sạn Demo Hà Nội • Chi nhánh Phố Cổ</span>
                  <i className="fa-solid fa-chevron-down text-[8px] text-gray-400 ml-0.5 cursor-pointer hover:text-gray-700" />
                </div>
              </div>
            </div>
            {/* CRM Breadcrumbs */}
            <nav className="hidden md:flex items-center gap-2 text-xs text-gray-500 pl-1 font-medium">
              <span>Quản lý vận hành</span>
              <i className="fa-solid fa-chevron-right text-[9px] text-gray-300" />
              <span className="text-[#d95338] font-semibold">Lịch phòng trực quan</span>
            </nav>
          </div>

          {/* Center: Quick Global Search */}
          <div className="flex-1 max-w-md hidden lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3 h-3 text-gray-400" />
              <input 
                className="w-full bg-[#f8f6f2] border border-[#e5e0d6] focus:border-[#d95338] focus:bg-white focus:ring-1 focus:ring-[#d95338] rounded-lg pl-9 pr-12 py-1.5 text-xs text-gray-800 placeholder-gray-400 transition-all" 
                placeholder="Tìm tên khách, số phòng, CCCD, mã #BK / #DSM..." 
                type="text"
              />
              <kbd className="absolute right-2.5 top-2 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-white border border-[#e2ddd5] rounded">⌘K</kbd>
            </div>
          </div>

          {/* Right: Real-time Date/Clock, Alerts & Profile */}
          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Trực tuyến: <strong>{formatDate(currentTime, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</strong> • {formatDate(currentTime, { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <button className="w-8 h-8 rounded-lg border border-[#e5e0d6] bg-white hover:bg-[#f6f3ed] text-gray-600 flex items-center justify-center transition-colors relative" title="Thông báo buồng phòng">
              <Bell className="w-3 h-3" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#d95338] ring-2 ring-white" />
            </button>
            <button className="w-8 h-8 rounded-lg border border-[#e5e0d6] bg-white hover:bg-[#f6f3ed] text-gray-600 flex items-center justify-center transition-colors" title="Trợ giúp & Phím tắt">
              <HelpCircle className="w-3 h-3" />
            </button>
            {/* Receptionist User Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#ece8df] cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-[#241a18] text-white flex items-center justify-center font-bold text-xs ring-2 ring-transparent group-hover:ring-[#d95338] transition-all">
                TL
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold leading-tight text-gray-900 group-hover:text-[#d95338] transition-colors">Thùy Linh</p>
                <p className="text-[10px] text-gray-400 leading-tight">Lễ tân ca sáng</p>
              </div>
              <i className="fa-solid fa-angle-down text-[10px] text-gray-400 ml-0.5" />
            </div>
          </div>
        </div>

        {/* Sub Action Bar: Controls, Views & Operations */}
        <div className="px-6 py-2 bg-[#fdfcfb] border-t border-[#f0ece4] flex flex-wrap items-center justify-between gap-3">
          {/* Left side of Toolbar: View tabs, Navigator, Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Segmented Switcher */}
            <div className="inline-flex p-0.5 bg-[#f0ece4] rounded-lg border border-[#e2ddd5] text-xs font-semibold">
              <button 
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-[6px] transition-colors ${viewMode === 'month' ? 'bg-white text-[#d95338] shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Tháng
              </button>
              <button 
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded-[6px] transition-colors ${viewMode === 'week' ? 'bg-white text-[#d95338] shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Timeline Tuần
              </button>
              <button 
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 rounded-[6px] transition-colors ${viewMode === 'day' ? 'bg-white text-[#d95338] shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Ngày
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center bg-white border border-[#ded9cf] rounded-lg shadow-xs p-0.5">
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="w-7 h-7 rounded hover:bg-[#f6f3ed] flex items-center justify-center text-gray-600 transition-colors" 
                title="Tháng trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
                <CalendarIcon className="w-3 h-3 text-[#d95338]" />
                {monthLabel}
              </span>
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="w-7 h-7 rounded hover:bg-[#f6f3ed] flex items-center justify-center text-gray-600 transition-colors" 
                title="Tháng sau"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1.5 bg-white border border-[#ded9cf] hover:bg-[#f6f3ed] rounded-lg text-xs font-semibold text-gray-700 shadow-xs transition-colors"
            >
              Hôm nay
            </button>

            <div className="h-4 w-[1px] bg-[#e5e0d6] mx-0.5 hidden sm:block" />

            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              {/* Room Type Filter */}
              <div className="relative">
                <select 
                  value={selectedRoomTypeFilter}
                  onChange={(e) => setSelectedRoomTypeFilter(e.target.value)}
                  className="text-xs bg-white border border-[#ded9cf] rounded-lg pl-2.5 pr-7 py-1.5 font-medium text-gray-700 focus:ring-1 focus:ring-[#d95338] focus:border-[#d95338] shadow-xs appearance-none cursor-pointer"
                >
                  <option value="all">Hạng phòng: Tất cả ({totalRooms}p)</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name} ({rt.totalRooms}p)</option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-2.5 top-2.5 text-[8px] text-gray-400 pointer-events-none" />
              </div>

              {/* Floor Filter */}
              <div className="relative hidden sm:block">
                <select 
                  value={selectedFloorFilter}
                  onChange={(e) => setSelectedFloorFilter(e.target.value)}
                  className="text-xs bg-white border border-[#ded9cf] rounded-lg pl-2.5 pr-7 py-1.5 font-medium text-gray-700 focus:ring-1 focus:ring-[#d95338] focus:border-[#d95338] shadow-xs appearance-none cursor-pointer"
                >
                  <option value="all">Tất cả tầng</option>
                  <option value="1-2">Tầng 1-2</option>
                  <option value="3">Tầng 3</option>
                  <option value="4">Tầng 4</option>
                  <option value="penthouse">Tầng Penthouse</option>
                </select>
                <i className="fa-solid fa-chevron-down absolute right-2.5 top-2.5 text-[8px] text-gray-400 pointer-events-none" />
              </div>

              {/* Status Indicator Quick Legend */}
              <div className="hidden xl:flex items-center gap-3 text-[11px] font-medium text-gray-600 pl-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Đã thanh toán
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Chờ cọc VietQR
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#d95338]" />
                  Check-in hôm nay
                </span>
              </div>
            </div>
          </div>

          {/* Right side of Toolbar: CTA Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              className="px-3 py-1.5 rounded-lg border border-[#ded9cf] bg-white text-gray-700 hover:bg-[#f6f3ed] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden md:inline">Làm mới</span>
            </button>
            <button 
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1.5 rounded-lg border border-[#ded9cf] bg-white text-gray-700 hover:bg-[#f6f3ed] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              title="Xuất báo cáo công suất"
            >
              <Receipt className="w-3 h-3 text-emerald-700" />
              <span className="hidden md:inline">Xuất báo cáo</span>
            </button>
            <button 
              onClick={() => setShowCreateBookingModal(true)}
              className="px-3 py-1.5 rounded-lg border border-[#ded9cf] bg-white text-gray-700 hover:bg-[#f6f3ed] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle className="w-3 h-3 text-[#d95338]" />
              <span>Khách Walk-in</span>
            </button>
            <button 
              onClick={() => setShowCreateBookingModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#d95338] hover:bg-[#b83b23] text-white text-xs font-bold transition-all shadow-sm shadow-[#d95338]/25 flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3 text-[10px]" />
              <span>Tạo Đặt Phòng</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Body Workspace */}
      <main className="flex-1 px-6 py-4 space-y-4 max-w-[1720px] w-full mx-auto">
        {/* Executive CRM Stat Badges */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Tổng số phòng */}
          <div className="bg-white rounded-xl border border-[#eae6de] p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tổng số phòng</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-[#1e1715]">{stats.totalRooms}</span>
                <span className="text-[11px] text-gray-400 font-medium">phòng vật lý</span>
            </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                <PieChart className="w-3 h-3 text-emerald-600" />
                <span>Công suất tháng: <strong className="text-[#d95338]">76.4%</strong></span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center text-base shrink-0">
              <DoorOpen className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Đang lưu trú (In-house) */}
          <div className="bg-white rounded-xl border border-[#eae6de] p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Đang ở (In-House)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-emerald-700">{stats.checkedIn}</span>
                <span className="text-[11px] text-gray-400 font-medium">/ {stats.totalRooms} phòng</span>
            </div>
              <div className="text-[11px] text-gray-600 font-medium mt-0.5 flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-600" />
                <span>{stats.checkedIn * 2} khách lưu trú thực tế</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center text-base shrink-0">
              <Bed className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Dự kiến đến hôm nay (Check-in) */}
          <div className="bg-white rounded-xl border border-[#eae6de] p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dự kiến đến hôm nay</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-amber-700">{todayCheckIns.length}</span>
                <span className="text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded font-bold border border-amber-200">Lượt check-in</span>
            </div>
              <div className="text-[11px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{todayCheckIns.filter(b => b.status === 'PENDING').length} cọc VietQR chờ duyệt</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center text-base shrink-0">
              <Bell className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Doanh thu dự kiến */}
          <div className="bg-white rounded-xl border border-[#eae6de] p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Doanh thu tháng {formatDate(currentDate, { month: 'short' })}</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-[#1e1715]">{stats.revenue} tr</span>
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">
                  <TrendingUp className="w-3 h-3 inline" /> +18% MoM
                </span>
            </div>
              <div className="text-[11px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-[#d95338]" />
                <span>{stats.activeBookings} booking đã xác nhận</span>
      </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center text-base shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Balanced 2-Column CRM Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT: Interactive CRM Room Calendar Grid */}
          <section className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 bg-white rounded-xl border border-[#eae6de] shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex flex-col overflow-hidden">
            {/* Calendar Matrix Header Bar */}
            <div className="px-4 py-2.5 bg-[#fdfcfb] border-b border-[#ece7de] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-gray-800">Lưới Lịch Đặt Buồng Theo Tháng</span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">35 ngày hiển thị</span>
                  </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500" /> OTA Agoda/Booking
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-sm bg-sky-500" /> Khách lẻ / Trực tiếp
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-sm bg-amber-500" /> Khách đoàn (Group)
                </span>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-[#eae6de] bg-[#f8f6f2] text-center text-xs font-bold text-gray-600 divide-x divide-[#ece7de]">
              {['Thứ 2 (T2)', 'Thứ 3 (T3)', 'Thứ 4 (T4)', 'Thứ 5 (T5)', 'Thứ 6 (T6)', 'Thứ 7 (T7)', 'Chủ Nhật (CN)'].map((day, i) => (
                <div key={day} className={`py-2 ${i >= 5 ? 'text-[#d95338]' : ''}`}>{day}</div>
                ))}
              </div>

            {/* Calendar Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d95338]" />
              </div>
            ) : (
              <div className="grid grid-cols-7 divide-x divide-y divide-[#ece7de] bg-[#ece7de]">
                {days.map((day, index) => {
                  const dayBookings = bookingsForDay(day.date)
                  const occupancy = occupancyForDay(day.date)
                  const occupiedCount = Array.from(occupancy.values()).reduce((a, b) => a + b, 0)
                  const isToday = isSameDay(day.date, today)
                  const weekend = isWeekend(day.date)
                  const occupancyBadge = getOccupancyBadge(day.date)
                  const isPastMonth = !day.isCurrentMonth

                  return (
                  <div
                    key={index}
                      className={`
                        p-2 flex flex-col justify-between min-h-[96px]
                        ${isToday ? 'bg-[#fff5f2]/50 ring-2 ring-[#d95338] ring-inset shadow-sm' : ''}
                        ${weekend && day.isCurrentMonth ? 'bg-[#fdfbf7]' : ''}
                        ${isPastMonth ? 'bg-[#faf8f5]/70' : 'bg-white'}
                        ${!isPastMonth ? 'hover:bg-[#fbf9f6] transition-colors' : ''}
                        group
                      `}
                    >
                      <div>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold text-xs ${
                            isToday ? 'text-[#d95338] text-sm' : 
                            weekend && day.isCurrentMonth ? 'text-[#d95338]' : 
                            isPastMonth ? 'text-gray-400' : 'text-gray-800'
                          }`}>
                      {day.date.getDate()}
                          </span>
                          {occupancyBadge && day.isCurrentMonth && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${occupancyBadge.className}`}>
                              {occupancyBadge.label}
                            </span>
                          )}
                          {!day.isCurrentMonth && (
                            <span className="text-[10px] text-gray-400">{formatDate(day.date, { month: 'short' })}</span>
                          )}
                    </div>

                        {day.isCurrentMonth && dayBookings.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {dayBookings.slice(0, 2).map((b) => (
                              <div
                                key={b.id}
                                onClick={() => handleViewBooking(b.id)}
                                title={`${b.guestName} - ${b.bookingCode}`}
                                className="booking-bar bg-sky-50 border border-sky-200 text-sky-800 text-[10px] px-1.5 py-0.5 rounded truncate font-medium cursor-pointer hover:border-sky-400 transition-all flex items-center justify-between"
                              >
                                <span className="truncate flex items-center gap-1">
                                  <i className="fa-solid fa-circle text-[5px] text-sky-500" />
                                  {b.guestName}
                                </span>
                                {b.bookingItems[0]?.roomNumber && (
                                  <span className="text-[9px] bg-sky-100 px-1 rounded shrink-0">
                                    P.{b.bookingItems[0].roomNumber}
                                  </span>
                                )}
                        </div>
                      ))}
                            {dayBookings.length > 2 && (
                              <div className="text-[10px] text-gray-400 text-center">
                                +{dayBookings.length - 2} đơn
                              </div>
                      )}
                    </div>
                        )}
                  </div>

                      {day.isCurrentMonth && (
                        <span 
                          onClick={() => openCreateBookingForDate(day.date)}
                          className="text-[10px] text-gray-300 group-hover:text-[#d95338] cursor-pointer font-medium mt-1"
                        >
                          + Thêm
                        </span>
                      )}
              </div>
                  )
                })}
        </div>
            )}
          </section>

          {/* RIGHT: CRM Activity & Room Inventory Panel */}
          <aside className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-3.5">
            {/* SECTION 1: Trạng thái buồng phòng theo hạng */}
            <div className="bg-white rounded-xl border border-[#eae6de] p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)]">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#f0ece4]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#fff5f2] text-[#d95338] flex items-center justify-center text-xs">
                    <BedDouble className="w-3 h-3" />
                  </div>
                  <h2 className="font-bold text-xs text-gray-900">Tình Trạng Hạng Phòng</h2>
                </div>
                <span className="text-[11px] font-semibold text-gray-500">{totalRooms} phòng</span>
              </div>

              <div className="divide-y divide-[#f5f2ec] text-xs">
                {roomTypes.length === 0 ? (
                  <p className="py-4 text-center text-gray-500 text-xs">Chưa có hạng phòng nào.</p>
                ) : (
                  roomTypes.map((rt, idx) => {
                    const occupancy = stats.totalRooms > 0 ? Math.round((rt.totalRooms * 0.7) / rt.totalRooms * 100) : 0
                    const occupied = Math.round(rt.totalRooms * 0.7)
                    const empty = rt.totalRooms - occupied
                    return (
                      <div key={rt.id} className="py-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                            <h3 className="font-bold text-gray-900">{rt.name}</h3>
                            <p className="text-[11px] text-gray-400">
                              {rt.totalRooms} phòng • Tầng {idx + 1}-{idx + 2}
                            </p>
                            </div>
                          <div className="text-right">
                            <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[11px] border ${
                              empty === 0 ? 'bg-red-50 text-red-700 border-red-200' :
                              empty <= 3 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              Trống {empty}p
                            </span>
                            <div className="text-[10px] text-gray-400 mt-0.5">{100 - Math.round(empty / rt.totalRooms * 100)}% kín</div>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              (100 - Math.round(empty / rt.totalRooms * 100)) >= 90 ? 'bg-red-500' :
                              (100 - Math.round(empty / rt.totalRooms * 100)) >= 70 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`} 
                            style={{ width: `${100 - Math.round(empty / rt.totalRooms * 100)}%` }} 
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* SECTION 2: Khách Check-in / Check-out trong ngày */}
            <div className="bg-white rounded-xl border border-[#eae6de] p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)]">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#f0ece4]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center text-xs">
                    <ListChecks className="w-3 h-3" />
                  </div>
                  <h2 className="font-bold text-xs text-gray-900">Lượt Đến & Đi Hôm Nay</h2>
                </div>
                <span className="text-[11px] text-[#d95338] font-semibold hover:underline cursor-pointer">
                  Xem tất cả ({todayCheckIns.length + todayCheckOuts.length})
                </span>
              </div>

              <div className="space-y-2 mt-2.5">
                {/* Check-ins */}
                {todayCheckIns.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-xs">Không có lượt đến nào hôm nay</div>
                ) : (
                  todayCheckIns.slice(0, 3).map((b) => (
                    <div key={`in-${b.id}`} className="p-2.5 rounded-lg border border-[#ede9e1] bg-[#faf8f5]/60 hover:bg-white hover:border-[#d95338]/40 transition-all">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-xs">{b.guestName}</span>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 rounded font-bold">Check-in</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Phòng {b.bookingItems[0]?.roomNumber || '---'} • #{b.bookingCode} • 14:00
                          </p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          {b.status === 'PENDING' ? 'Chờ cọc' : 'Đã cọc 100%'}
                        </span>
                      </div>
                    </div>
                  ))
                )}

                {/* Check-outs */}
                {todayCheckOuts.length > 0 && todayCheckOuts.slice(0, 2).map((b) => (
                  <div key={`out-${b.id}`} className="p-2.5 rounded-lg border border-[#ede9e1] bg-[#faf8f5]/60 hover:bg-white hover:border-[#d95338]/40 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-xs">{b.guestName}</span>
                          <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1 rounded font-bold">Check-out</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Phòng {b.bookingItems[0]?.roomNumber || '---'} • #{b.bookingCode} • 12:00
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
                        Khách Agoda
                      </span>
                    </div>
                        </div>
                      ))}
                    </div>
                  </div>

            {/* SECTION 3: Thao tác buồng phòng nhanh */}
            <div className="bg-white rounded-xl border border-[#eae6de] p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)]">
              <h2 className="font-bold text-[11px] text-gray-500 uppercase tracking-wider mb-2.5">Thao tác buồng phòng</h2>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleRoomAction('Dọn buồng')}
                  className="p-2 rounded-lg border border-[#e5e0d6] hover:border-[#d95338] hover:bg-[#fff5f2]/30 text-left transition-all group"
                >
                  <Trash2 className="w-4 h-4 text-[#d95338] mb-1 group-hover:scale-110 transition-transform" />
                  <span className="block text-xs font-bold text-gray-800">Dọn buồng</span>
                  <span className="text-[10px] text-gray-400">4 phòng chờ dọn</span>
                </button>
                <button 
                  onClick={() => handleRoomAction('Khóa bảo trì')}
                  className="p-2 rounded-lg border border-[#e5e0d6] hover:border-[#d95338] hover:bg-[#fff5f2]/30 text-left transition-all group"
                >
                  <Wrench className="w-4 h-4 text-amber-600 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="block text-xs font-bold text-gray-800">Khóa bảo trì</span>
                  <span className="text-[10px] text-gray-400">1 phòng bảo dưỡng</span>
                </button>
                <button 
                  onClick={() => handleRoomAction('Giá ngày')}
                  className="p-2 rounded-lg border border-[#e5e0d6] hover:border-[#d95338] hover:bg-[#fff5f2]/30 text-left transition-all group"
                >
                  <Tag className="w-4 h-4 text-purple-600 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="block text-xs font-bold text-gray-800">Giá ngày</span>
                  <span className="text-[10px] text-gray-400">Cập nhật cuối tuần</span>
                </button>
                <button 
                  onClick={() => handleRoomAction('Đồng bộ OTA')}
                  className="p-2 rounded-lg border border-[#e5e0d6] hover:border-[#d95338] hover:bg-[#fff5f2]/30 text-left transition-all group"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-600 mb-1 group-hover:rotate-180 transition-transform" />
                  <span className="block text-xs font-bold text-gray-800">Đồng bộ OTA</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Tự động (1 phút)</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Create Booking Modal - Full Screen Custom */}
      {showCreateBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <header className="px-7 py-4 border-b border-slate-200 bg-amber-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tạo Đặt Phòng Mới</h1>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> Lễ tân / Walk-in
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="font-mono font-medium text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded">Mã dự kiến: #RES-{Date.now().toString(36).toUpperCase().slice(-6)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowCreateBookingModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                </button>
              </div>
            </header>

            {/* Modal Body */}
            <main className="flex-1 overflow-y-auto p-6 lg:p-7 custom-scrollbar">
              <form onSubmit={handleCreateBooking} className="grid grid-cols-1 lg:grid-cols-12 gap-7" id="reservation-form">
                {/* Left Column - Guest and Room Details */}
                <section className="lg:col-span-7 space-y-6">
                  {/* Card: Thông tin khách hàng */}
                  <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-600"></span>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">1. Thông tin khách lưu trú</h2>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Họ và tên */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Họ và tên khách hàng <span className="text-red-600">*</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <input
                            className="block w-full pl-9 pr-3 py-2 text-sm text-slate-900 rounded-lg border-slate-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition placeholder:text-slate-400"
                            placeholder="Ví dụ: Nguyễn Văn An"
                            required
                            type="text"
                            value={newBooking.guestName}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, guestName: e.target.value }))}
                          />
                        </div>
                      </div>
                      {/* Số điện thoại */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Số điện thoại liên hệ <span className="text-red-600">*</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs flex">
                          <span className="inline-flex items-center px-2.5 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-600 text-xs font-medium">
                            🇻🇳 +84
                          </span>
                          <input
                            className="block w-full rounded-none rounded-r-lg border-slate-300 py-2 px-3 text-sm text-slate-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition"
                            placeholder="0987 654 321"
                            required
                            type="tel"
                            value={newBooking.guestPhone}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, guestPhone: e.target.value }))}
                          />
                        </div>
                      </div>
                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Email <span className="text-xs font-normal text-slate-400">(Nhận mã QR check-in)</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <input
                            className="block w-full pl-9 pr-3 py-2 text-sm text-slate-900 rounded-lg border-slate-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition"
                            placeholder="an.nguyen@example.com"
                            type="email"
                            value={newBooking.guestEmail}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, guestEmail: e.target.value }))}
                          />
                        </div>
                      </div>
                      {/* CCCD/Passport */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Số CCCD / Hộ chiếu <span className="text-xs font-normal text-slate-400">(Tùy chọn)</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2H9.17A3.001 3.001 0 0112 14z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <input
                            className="block w-full pl-9 pr-3 py-2 text-sm text-slate-900 rounded-lg border-slate-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition"
                            placeholder="00120101xxxx"
                            type="text"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Thông tin phòng & Thời gian lưu trú */}
                  <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-600"></span>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">2. Lịch trình & Xếp phòng</h2>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        Lưu trú: {Math.ceil((new Date(newBooking.checkOutDate).getTime() - new Date(newBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))} đêm
                      </span>
                    </div>

                    {/* Thời gian check-in / check-out */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {/* Check-in */}
                      <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Nhận phòng (Check-in) *
                          </span>
                          <span className="text-[11px] text-slate-500">Giờ chuẩn: 14:00</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          <input 
                            className="col-span-3 text-xs font-medium rounded-lg border-slate-300 py-1.5 px-2 bg-white focus:ring-red-500 focus:border-red-500" 
                            type="date" 
                            value={newBooking.checkInDate}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, checkInDate: e.target.value }))}
                            required
                          />
                          <input 
                            className="col-span-2 text-xs font-medium rounded-lg border-slate-300 py-1.5 px-2 bg-white focus:ring-red-500 focus:border-red-500" 
                            type="time" 
                            value="14:00"
                            readOnly
                          />
                        </div>
                      </div>
                      {/* Check-out */}
                      <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Trả phòng (Check-out) *
                          </span>
                          <span className="text-[11px] text-slate-500">Giờ chuẩn: 12:00</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          <input 
                            className="col-span-3 text-xs font-medium rounded-lg border-slate-300 py-1.5 px-2 bg-white focus:ring-red-500 focus:border-red-500" 
                            type="date" 
                            value={newBooking.checkOutDate}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, checkOutDate: e.target.value }))}
                            required
                          />
                          <input 
                            className="col-span-2 text-xs font-medium rounded-lg border-slate-300 py-1.5 px-2 bg-white focus:ring-red-500 focus:border-red-500" 
                            type="time" 
                            value="12:00"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>

                    {/* Chọn hạng phòng */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-4">
                      <div className="sm:col-span-8 space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Hạng phòng <span className="text-red-600">*</span>
                        </label>
                        <select
                          className="block w-full rounded-lg border-slate-300 py-2.5 px-3 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
                          value={newBooking.roomTypeId}
                          onChange={(e) => setNewBooking(prev => ({ ...prev, roomTypeId: e.target.value }))}
                          required
                        >
                          <option value="">Chọn hạng phòng</option>
                          {roomTypes.map(rt => (
                            <option key={rt.id} value={rt.id}>{rt.name} — Còn {rt.totalRooms} phòng</option>
                          ))}
                        </select>
              </div>
                      <div className="sm:col-span-4 space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Số phòng <span className="text-slate-400 font-normal">(Tùy chọn)</span>
                        </label>
                        <select className="block w-full rounded-lg border-slate-300 py-2.5 px-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-600">
                          <option value="">Chưa gán (Tự động)</option>
                          <option value="302">Phòng 302 (Tầng 3)</option>
                          <option value="305">Phòng 305 (Tầng 3)</option>
                        </select>
        </div>
      </div>

                    {/* Số lượng khách */}
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Người lớn</label>
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 font-bold"
                            onClick={() => setNewBooking(prev => ({ ...prev, numAdults: Math.max(1, prev.numAdults - 1) }))}
                          >-</button>
                          <input 
                            className="w-full text-center border-0 p-1 text-xs font-semibold focus:ring-0" 
                            max="10" 
                            min="1" 
                            type="number" 
                            value={newBooking.numAdults}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, numAdults: parseInt(e.target.value) || 1 }))}
                          />
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 font-bold"
                            onClick={() => setNewBooking(prev => ({ ...prev, numAdults: Math.min(10, prev.numAdults + 1) }))}
                          >+</button>
            </div>
              </div>
                  <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Trẻ em (&lt;12t)</label>
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 font-bold"
                            onClick={() => setNewBooking(prev => ({ ...prev, numChildren: Math.max(0, prev.numChildren - 1) }))}
                          >-</button>
                          <input 
                            className="w-full text-center border-0 p-1 text-xs font-semibold focus:ring-0" 
                            max="6" 
                            min="0" 
                            type="number" 
                            value={newBooking.numChildren}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, numChildren: parseInt(e.target.value) || 0 }))}
                          />
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 font-bold"
                            onClick={() => setNewBooking(prev => ({ ...prev, numChildren: Math.min(6, prev.numChildren + 1) }))}
                          >+</button>
                        </div>
                  </div>
                  <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Extra Bed</label>
                        <select className="w-full text-xs font-medium rounded-lg border-slate-300 py-1.5 px-2 bg-white focus:ring-red-500 focus:border-red-500">
                          <option value="0">Không thêm</option>
                          <option value="1">+1 Giường (+250k)</option>
                        </select>
                  </div>
                    </div>
                  </div>

                  {/* Card: Dịch vụ & Yêu cầu đặc biệt */}
                  <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-600"></span>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">3. Dịch vụ & Ghi chú</h2>
                      </div>
                    </div>
                    {/* Ghi chú / Special request */}
                  <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Ghi chú nội bộ / Yêu cầu từ khách:
                      </label>
                      <textarea
                        className="block w-full text-xs rounded-lg border-slate-300 shadow-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-slate-400"
                        placeholder="Ví dụ: Khách check-in muộn lúc 18h, phòng tầng cao, view thoáng..."
                        rows={3}
                        value={newBooking.guestNote}
                        onChange={(e) => setNewBooking(prev => ({ ...prev, guestNote: e.target.value }))}
                      ></textarea>
                  </div>
                  </div>
                </section>

                {/* Right Column - Billing and Summary */}
                <aside className="lg:col-span-5 space-y-5 flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Thẻ tóm tắt đơn phòng */}
                    <div className="bg-gradient-to-br from-amber-50/40 to-amber-50/20 rounded-xl border border-amber-200 p-4 shadow-xs">
                      <div className="flex items-start justify-between">
                  <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">Chi tiết lưu trú</span>
                          <h3 className="text-base font-bold text-slate-900 mt-1">
                            {roomTypes.find(rt => rt.id === newBooking.roomTypeId)?.name || 'Chọn hạng phòng'}
                          </h3>
                          <p className="text-xs text-slate-600">Phòng • Tầng • Giường</p>
                  </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 block">Thời gian</span>
                          <span className="text-sm font-bold text-slate-900">
                            {Math.ceil((new Date(newBooking.checkOutDate).getTime() - new Date(newBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))} đêm
                          </span>
                </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-amber-200/60 text-xs">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Nhận:</span>
                          <span className="font-semibold text-slate-800">{newBooking.checkInDate ? format(new Date(newBooking.checkInDate), 'HH:mm • dd/MM/yyyy') : '--:--'} 14:00</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block">Trả:</span>
                          <span className="font-semibold text-slate-800">{newBooking.checkOutDate ? format(new Date(newBooking.checkOutDate), 'HH:mm • dd/MM/yyyy') : '--:--'} 12:00</span>
                        </div>
                      </div>
                    </div>

                    {/* Bảng kê chi phí */}
                    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                        <span>Bảng kê chi phí dự kiến</span>
                        <span className="text-[11px] text-slate-400 font-normal">VNĐ</span>
                      </h3>
                      <div className="space-y-2 text-xs divide-y divide-slate-100">
                        <div className="flex justify-between py-1 text-slate-600">
                          <span>Tiền phòng ({Math.ceil((new Date(newBooking.checkOutDate).getTime() - new Date(newBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))} đêm)</span>
                          <span className="font-semibold text-slate-900">1.200.000₫</span>
                        </div>
                        <div className="flex justify-between py-1 text-slate-600">
                          <span>Thuế & Phí phục vụ</span>
                          <span className="text-slate-700">VAT 8% + SVC 5%</span>
                        </div>
                        <div className="flex justify-between py-1 text-slate-600 items-center">
                          <span className="flex items-center gap-1 text-red-600 cursor-pointer hover:underline">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            Mã ưu đãi / Voucher
                          </span>
                          <span className="text-slate-400 font-mono">-0₫</span>
                        </div>
                      </div>
                      {/* Tổng tiền thanh toán */}
                      <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">Tổng tiền phòng:</span>
                          <span className="text-[11px] text-slate-500">Đã gồm thuế & phụ phí</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-extrabold text-red-600">1.200.000₫</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Tip / Policy info */}
                    <div className="text-[11px] text-slate-400 bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200/60 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                      <span>Đơn tạo ở trạng thái Chờ cọc sẽ tự động hủy sau 2 giờ nếu khách chưa thanh toán.</span>
                    </div>
                  </div>
                </aside>
              </form>
            </main>

            {/* Modal Footer */}
            <footer className="px-7 py-4 bg-amber-50/50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Điền thông tin và nhấn &quot;Tạo đơn&quot; để hoàn tất</span>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {/* Nút Hủy */}
                <button 
                  type="button"
                  onClick={() => setShowCreateBookingModal(false)}
                  className="w-1/3 sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition"
                >
                  Hủy bỏ
                </button>
                {/* Nút Tạo đơn chính */}
                <button 
                  type="submit"
                  form="reservation-form"
                  disabled={isActionLoading}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm shadow-red-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isActionLoading ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                  )}
                  <span>Tạo Đơn & Xuất Phiếu</span>
                </button>
            </div>
            </footer>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      <Modal
        isOpen={showBookingDetailModal}
        onClose={() => setShowBookingDetailModal(false)}
        title={`Chi tiết đơn #${selectedBooking?.bookingCode || ''}`}
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Trạng thái:</span>
                <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                  selectedBooking.status === 'CHECKED_IN' ? 'bg-green-100 text-green-800' :
                  selectedBooking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                  selectedBooking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  selectedBooking.status === 'CHECKED_OUT' ? 'bg-gray-100 text-gray-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {selectedBooking.status === 'CHECKED_IN' ? 'Đã nhận phòng' :
                   selectedBooking.status === 'CONFIRMED' ? 'Đã xác nhận' :
                   selectedBooking.status === 'PENDING' ? 'Chờ thanh toán' :
                   selectedBooking.status === 'CHECKED_OUT' ? 'Đã trả phòng' :
                   selectedBooking.status === 'CANCELLED' ? 'Đã hủy' : 'Không đến'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Khách:</span>
                <span className="text-sm font-medium">{selectedBooking.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Điện thoại:</span>
                <span className="text-sm">{selectedBooking.guestPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email:</span>
                <span className="text-sm">{selectedBooking.guestEmail}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Nhận phòng:</span>
                <span className="text-sm font-medium">
                  {selectedBooking.checkInDate ? format(new Date(selectedBooking.checkInDate), 'dd/MM/yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Trả phòng:</span>
                <span className="text-sm font-medium">
                  {selectedBooking.checkOutDate ? format(new Date(selectedBooking.checkOutDate), 'dd/MM/yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Phòng:</span>
                <span className="text-sm font-medium">
                  {selectedBooking.bookingItems[0]?.roomNumber || 'Chưa gán'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Người lớn:</span>
                <span className="text-sm">{selectedBooking.numAdults}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Trẻ em:</span>
                <span className="text-sm">{selectedBooking.numChildren}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Tổng tiền:</span>
                <span className="text-lg font-bold text-[#d95338]">
                  {selectedBooking.totalAmount?.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Đã cọc:</span>
                <span className="text-sm text-emerald-600 font-medium">
                  {selectedBooking.depositAmount?.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Còn lại:</span>
                <span className="text-sm font-medium">
                  {(selectedBooking.totalAmount - selectedBooking.depositAmount)?.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
            </div>

            {selectedBooking.guestNote && (
              <div className="bg-amber-50 rounded-lg p-4">
                <span className="text-sm font-medium text-amber-800">Ghi chú:</span>
                <p className="text-sm text-amber-700 mt-1">{selectedBooking.guestNote}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t">
              {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'CONFIRMED') && (
                <Button
                  onClick={() => handleCheckIn(selectedBooking.id)}
                  disabled={isActionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isActionLoading && actionLoadingType === 'checkin' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  Check-in
              </Button>
              )}
              
              {selectedBooking.status === 'CHECKED_IN' && (
                <Button
                  onClick={() => handleCheckOut(selectedBooking.id)}
                  disabled={isActionLoading}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isActionLoading && actionLoadingType === 'checkout' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <DoorOpen className="w-4 h-4 mr-2" />
                  )}
                  Check-out
                </Button>
              )}

              <Button
                onClick={() => {
                  setShowBookingDetailModal(false)
                  router.push(`/workspace/${params.slug}/properties/${params.id}/bookings/${selectedBooking.id}`)
                }}
                variant="outline"
              >
                <Eye className="w-4 h-4 mr-2" />
                Xem chi tiết
              </Button>

              {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'CONFIRMED') && (
                <Button
                  onClick={() => handleCancelBooking(selectedBooking.id)}
                  disabled={isActionLoading}
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                >
                  {isActionLoading && actionLoadingType === 'cancel' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Hủy đơn
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Export Report Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Xuất báo cáo công suất"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Báo cáo tháng {currentDate.getMonth() + 1}/{currentDate.getFullYear()}</strong>
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Tổng đơn: {bookings.length} | Đã xác nhận: {bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN').length} | Công suất: {getOccupancyPercent(today)}%
            </p>
        </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chọn định dạng xuất:</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setExportType('pdf')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  exportType === 'pdf' 
                    ? 'border-[#d95338] bg-[#fff5f2]' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-red-100 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-red-600 font-bold text-lg">PDF</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    exportType === 'pdf' ? 'text-[#d95338]' : 'text-gray-700'
                  }`}>PDF</span>
                  <p className="text-[10px] text-gray-500 mt-1">In và lưu PDF</p>
                </div>
              </button>
              
              <button
                onClick={() => setExportType('excel')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  exportType === 'excel' 
                    ? 'border-[#d95338] bg-[#fff5f2]' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-green-100 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-green-600 font-bold text-lg">XLS</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    exportType === 'excel' ? 'text-[#d95338]' : 'text-gray-700'
                  }`}>Excel</span>
                  <p className="text-[10px] text-gray-500 mt-1">Bảng tính Excel</p>
                </div>
              </button>
              
              <button
                onClick={() => setExportType('csv')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  exportType === 'csv' 
                    ? 'border-[#d95338] bg-[#fff5f2]' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-blue-600 font-bold text-lg">CSV</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    exportType === 'csv' ? 'text-[#d95338]' : 'text-gray-700'
                  }`}>CSV</span>
                  <p className="text-[10px] text-gray-500 mt-1">Dữ liệu text</p>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Nội dung báo cáo:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Tổng quan: Số phòng, tổng đơn, công suất</li>
              <li>• Danh sách đặt phòng trong tháng</li>
              <li>• Thông tin khách: Tên, ngày nhận/trả phòng</li>
              <li>• Trạng thái và phòng được gán</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setShowExportModal(false)}
            >
              Đóng
            </Button>
            <Button 
              onClick={handleExportReport}
              disabled={isActionLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isActionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Receipt className="w-4 h-4 mr-2" />
              )}
              Xuất báo cáo
            </Button>
          </div>
        </div>
      </Modal>

      <style jsx global>{`
        .booking-bar {
          transition: all 0.15s ease-in-out;
        }
        .booking-bar:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 6px -1px rgba(0, 0, 0, 0.08);
          z-index: 10;
        }
      `}</style>
    </div>
  )
}
