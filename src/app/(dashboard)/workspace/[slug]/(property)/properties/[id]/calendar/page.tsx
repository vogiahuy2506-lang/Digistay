'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Modal, PaymentStatusBadge } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Bed, Users, BedDouble, Plus, DoorOpen, Bell, Receipt,
  Building2, PieChart, CheckCircle, Key, RefreshCw,
  Clock, ListChecks, Eye, Loader2, XCircle
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { useProperty } from '@/lib/hooks/use-property'
import { escapeHtml } from '@/lib/bookings/display'
import { CheckOutDialog } from '@/components/bookings/check-out-dialog'
import { fetchWindow, staysNight, toCsv } from '@/lib/bookings/calendar'
import { format, addDays, parseISO } from 'date-fns'

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

export default function CalendarPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  const { property } = useProperty()

  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([])
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [showCreateBookingModal, setShowCreateBookingModal] = React.useState(false)
  const [showBookingDetailModal, setShowBookingDetailModal] = React.useState(false)
  const [showExportModal, setShowExportModal] = React.useState(false)
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null)
  const [isActionLoading, setIsActionLoading] = React.useState(false)
  const [actionLoadingType, setActionLoadingType] = React.useState('')
  // Set in the browser only: the server's clock (UTC on the VPS) never matches
  // the guest's, and the mismatch broke hydration (React error #418).
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null)
  const [exportType, setExportType] = React.useState<'pdf' | 'excel' | 'csv'>('pdf')
  // The hotel's check-in / check-out times (Policy); the dialog said 14:00 / 12:00 whatever they were.
  const [stayTimes, setStayTimes] = React.useState<{ checkIn: string; checkOut: string } | null>(null)

  // Update time every minute
  React.useEffect(() => {
    setCurrentTime(new Date())
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

  /**
   * Every booking the list API returns for a widened window, all pages: it
   * caps a page at 100 (this asked for 200 and silently got 100), and only
   * returns stays inside the window, so it is asked wider than the days
   * shown (src/lib/bookings/calendar.ts).
   */
  const fetchBookingsAround = async (from: Date, to: Date): Promise<Booking[]> => {
    const { startDate, endDate } = fetchWindow(from, to)
    const found: Booking[] = []
    for (let page = 1, pages = 1; page <= pages && page <= 20; page++) {
      const res = await fetch(
        `/api/bookings?propertyId=${propertyId}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=100&page=${page}`
      )
      const data = await res.json()
      if (!data.success) break
      found.push(...(data.data ?? []))
      pages = data.pagination?.totalPages ?? 1
    }
    return found
  }

  const fetchCalendarData = async () => {
    setIsLoading(true)
    try {
      const grid = buildMonthGrid(currentDate)
      const gridStart = grid[0].date
      const gridEnd = addDays(grid[grid.length - 1].date, 1)
      const now = startOfDay(new Date())
      // Today's arrivals and departures stay listed while another month is shown.
      const todayOutside = now < gridStart || now >= gridEnd

      const [roomTypesData, shown, aroundToday, policyData] = await Promise.all([
        fetch(`/api/room-types?propertyId=${propertyId}`).then((r) => r.json()),
        fetchBookingsAround(gridStart, gridEnd),
        todayOutside ? fetchBookingsAround(now, addDays(now, 1)) : Promise.resolve([]),
        fetch(`/api/properties/${propertyId}/policy`).then((r) => r.json()).catch(() => null),
      ])

      if (roomTypesData.success) {
        setRoomTypes(roomTypesData.data ?? [])
      }
      setBookings([...new Map([...shown, ...aroundToday].map((b) => [b.id, b])).values()])
      const policy = policyData?.data
      setStayTimes(policy ? { checkIn: policy.checkInTime, checkOut: policy.checkOutTime } : null)
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

  /** Rooms taken the night of `day`, per room type (a booking's check-out day is free). */
  const occupancyForDay = (day: Date) => {
    const result = new Map<string, number>()
    for (const b of bookings) {
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW' || !staysNight(b, day)) continue
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

  // Check-out goes through the dialog that settles the late fee (check-out-dialog.tsx).
  const [checkOutBooking, setCheckOutBooking] = React.useState<{ id: string; code: string } | null>(null)
  const handleCheckOut = (bookingId: string, bookingCode: string) => setCheckOutBooking({ id: bookingId, code: bookingCode })

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
      const occupancyRate = Math.round(monthOccupancy)

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
          totalRevenue: stats.revenue,
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
        
        // Quoted and formula-safe: a comma in a guest name shifted the columns (calendar.ts).
        const csvContent = toCsv([csvHeaders, ...csvRows])
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
                    <td>${escapeHtml(b.bookingCode)}</td>
                    <td>${escapeHtml(b.guestName)}</td>
                    <td>${new Date(b.checkIn).toLocaleDateString('vi-VN')}</td>
                    <td>${new Date(b.checkOut).toLocaleDateString('vi-VN')}</td>
                    <td>${escapeHtml(b.status)}</td>
                    <td>${escapeHtml(b.rooms)}</td>
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
                      <td>${escapeHtml(b.bookingCode)}</td>
                      <td>${escapeHtml(b.guestName)}</td>
                      <td>${new Date(b.checkIn).toLocaleDateString('vi-VN')}</td>
                      <td>${new Date(b.checkOut).toLocaleDateString('vi-VN')}</td>
                      <td>${escapeHtml(b.status)}</td>
                      <td>${escapeHtml(b.rooms)}</td>
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

  // formatDate adds day / month / year unless they are turned off: this read "20 tháng 10, 2026".
  const monthLabel = formatDate(currentDate, { day: undefined, month: 'long', year: 'numeric' })
  const today = startOfDay(new Date())
  const days = buildMonthGrid(currentDate)
  const totalRooms = roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)

  const stats = React.useMemo(() => {
    let activeBookings = 0
    let checkedIn = 0
    let guestsInHouse = 0
    let pending = 0
    let revenue = 0

    // Bookings are loaded around the month (and today), so the month's figures
    // take the bookings arriving in it; who is in house is as of now.
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    for (const b of bookings) {
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') continue
      if (b.status === 'CHECKED_IN') {
        checkedIn++
        guestsInHouse += (b.numAdults ?? 0) + (b.numChildren ?? 0)
      }
      const arrival = new Date(b.checkInDate)
      if (arrival.getFullYear() !== year || arrival.getMonth() !== month) continue
      activeBookings++
      if (b.status === 'PENDING') pending++
      revenue += Number(b.totalAmount) || 0
    }

    const checkInsToday = bookings.filter(b => {
      if (b.status !== 'CONFIRMED' && b.status !== 'PENDING') return false
      return isSameDay(new Date(b.checkInDate), today)
    }).length

    return {
      totalRooms,
      activeBookings,
      checkedIn,
      guestsInHouse,
      pending,
      revenue,
      checkInsToday
    }
  }, [bookings, totalRooms, today, currentDate])

  // Booked room-nights over room-nights available in the month shown, in %.
  const monthOccupancy = (() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    if (totalRooms === 0) return 0
    let occupied = 0
    for (let d = 1; d <= daysInMonth; d++) {
      for (const taken of occupancyForDay(new Date(year, month, d)).values()) occupied += taken
    }
    return (occupied / (totalRooms * daysInMonth)) * 100
  })()

  const occupancyToday = occupancyForDay(today)

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

  const getOccupancyBadge = (day: Date) => {
    const occupied = Array.from(occupancyForDay(day).values()).reduce((a, b) => a + b, 0)
    if (occupied === 0) return null
    const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0
    
    if (percent >= 80) {
      return { label: `${occupied}/${totalRooms} bận`, className: 'bg-warn-soft text-warn border-warn/30' }
    }
    if (occupied >= totalRooms * 0.5) {
      return { label: `${occupied}/${totalRooms} bận`, className: 'bg-ok-soft text-ok border-ok/30' }
    }
    return { label: `${occupied}/${totalRooms} bận`, className: 'bg-fg/5 text-muted border-line' }
  }

  const isWeekend = (day: Date) => {
    const d = day.getDay()
    return d === 0 || d === 6
  }

  return (
    <div className="min-h-full bg-page text-fg antialiased flex flex-col font-sans">
      {/* Top Hospitality CRM App Bar */}
      <header className="bg-panel border-b border-line sticky top-0 z-40">
        {/* Main Header */}
        <div className="px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Brand / Workspace & Breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pr-4 border-r border-line">
              <div className="w-8 h-8 rounded-lg bg-ink text-on-ink flex items-center justify-center font-black text-sm shadow-sm">
                D
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-bold text-sm tracking-tight text-fg">DigiStay Hotel OS</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted mt-0.5">
                  <Building2 className="w-3 h-3 text-[10px] text-muted" />
                  <span>{property?.name ?? '…'}</span>
                </div>
              </div>
            </div>
            {/* CRM Breadcrumbs */}
            <nav className="hidden md:flex items-center gap-2 text-xs text-muted pl-1 font-medium">
              <span>Quản lý vận hành</span>
              <i className="fa-solid fa-chevron-right text-[9px] text-muted" />
              <span className="text-acc font-semibold">Lịch phòng trực quan</span>
            </nav>
          </div>

          {/* Right: Real-time Date/Clock */}
          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-ok-soft border border-ok/30 rounded-lg text-ok text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
              {currentTime && (
                <span>Trực tuyến: <strong>{formatDate(currentTime, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</strong> • {formatDate(currentTime, { day: undefined, month: undefined, year: undefined, hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>
        </div>

        {/* Sub Action Bar: Controls, Views & Operations */}
        <div className="px-6 py-2 bg-panel border-t border-line flex flex-wrap items-center justify-between gap-3">
          {/* Left side of Toolbar: month navigator */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Navigation */}
            <div className="flex items-center bg-panel border border-line rounded-lg shadow-xs p-0.5">
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="w-7 h-7 rounded hover:bg-fg/[0.03] flex items-center justify-center text-muted transition-colors" 
                title="Tháng trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 text-xs font-bold text-fg tracking-tight flex items-center gap-1.5">
                <CalendarIcon className="w-3 h-3 text-acc" />
                {monthLabel}
              </span>
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="w-7 h-7 rounded hover:bg-fg/[0.03] flex items-center justify-center text-muted transition-colors" 
                title="Tháng sau"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1.5 bg-panel border border-line hover:bg-fg/[0.03] rounded-lg text-xs font-semibold text-fg shadow-xs transition-colors"
            >
              Hôm nay
            </button>
          </div>

          {/* Right side of Toolbar: CTA Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              className="px-3 py-1.5 rounded-lg border border-line bg-panel text-fg hover:bg-fg/[0.03] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden md:inline">Làm mới</span>
            </button>
            <button 
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1.5 rounded-lg border border-line bg-panel text-fg hover:bg-fg/[0.03] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              title="Xuất báo cáo công suất"
            >
              <Receipt className="w-3 h-3 text-ok" />
              <span className="hidden md:inline">Xuất báo cáo</span>
            </button>
            <button 
              onClick={() => setShowCreateBookingModal(true)}
              className="px-3 py-1.5 rounded-lg border border-line bg-panel text-fg hover:bg-fg/[0.03] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle className="w-3 h-3 text-acc" />
              <span>Khách Walk-in</span>
            </button>
            <button 
              onClick={() => setShowCreateBookingModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-ink hover:bg-ink/90 text-on-ink text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
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
          <div className="bg-panel rounded-xl border border-line p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Tổng số phòng</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-fg">{stats.totalRooms}</span>
                <span className="text-[11px] text-muted font-medium">phòng vật lý</span>
            </div>
              <div className="text-[11px] text-ok font-semibold mt-0.5 flex items-center gap-1">
                <PieChart className="w-3 h-3 text-ok" />
                <span>Công suất tháng: <strong className="text-acc">{monthOccupancy.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</strong></span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-info-soft text-info border border-info/30 flex items-center justify-center text-base shrink-0">
              <DoorOpen className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Đang lưu trú (In-house) */}
          <div className="bg-panel rounded-xl border border-line p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Đang ở (In-House)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-ok">{stats.checkedIn}</span>
                <span className="text-[11px] text-muted font-medium">/ {stats.totalRooms} phòng</span>
            </div>
              <div className="text-[11px] text-muted font-medium mt-0.5 flex items-center gap-1">
                <Users className="w-3 h-3 text-ok" />
                <span>{stats.guestsInHouse} khách đang lưu trú</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-ok-soft text-ok border border-ok/30 flex items-center justify-center text-base shrink-0">
              <Bed className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Dự kiến đến hôm nay (Check-in) */}
          <div className="bg-panel rounded-xl border border-line p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Dự kiến đến hôm nay</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-warn">{todayCheckIns.length}</span>
                <span className="text-[11px] text-warn bg-warn-soft px-1.5 py-0.2 rounded font-bold border border-warn/30">Lượt check-in</span>
            </div>
              <div className="text-[11px] text-warn font-medium mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{todayCheckIns.filter(b => b.status === 'PENDING').length} đơn chờ thanh toán</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-warn-soft text-warn border border-warn/30 flex items-center justify-center text-base shrink-0">
              <Bell className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Doanh thu dự kiến */}
          <div className="bg-panel rounded-xl border border-line p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Doanh thu dự kiến T{currentDate.getMonth() + 1}</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-fg">{(stats.revenue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr</span>
            </div>
              <div className="text-[11px] text-muted font-medium mt-0.5 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-acc" />
                <span>{stats.activeBookings - stats.pending} booking đã xác nhận</span>
      </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-refund-soft text-refund border border-refund/30 flex items-center justify-center text-base shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Balanced 2-Column CRM Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT: Interactive CRM Room Calendar Grid */}
          <section className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 bg-panel rounded-xl border border-line shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex flex-col overflow-hidden">
            {/* Calendar Matrix Header Bar */}
            <div className="px-4 py-2.5 bg-panel border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-fg">Lưới Lịch Đặt Buồng Theo Tháng</span>
                <span className="text-[10px] text-muted bg-fg/5 px-2 py-0.5 rounded-full font-medium">{days.length} ngày hiển thị</span>
                  </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-line bg-fg/[0.03] text-center text-xs font-bold text-muted divide-x divide-line">
              {['Thứ 2 (T2)', 'Thứ 3 (T3)', 'Thứ 4 (T4)', 'Thứ 5 (T5)', 'Thứ 6 (T6)', 'Thứ 7 (T7)', 'Chủ Nhật (CN)'].map((day, i) => (
                <div key={day} className={`py-2 ${i >= 5 ? 'text-acc' : ''}`}>{day}</div>
                ))}
              </div>

            {/* Calendar Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc" />
              </div>
            ) : (
              <div className="grid grid-cols-7 divide-x divide-y divide-line bg-fg/5">
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
                        ${isToday ? 'bg-acc-soft/50 ring-2 ring-acc ring-inset shadow-sm' : ''}
                        ${weekend && day.isCurrentMonth ? 'bg-panel' : ''}
                        ${isPastMonth ? 'bg-page/70' : 'bg-panel'}
                        ${!isPastMonth ? 'hover:bg-page transition-colors' : ''}
                        group
                      `}
                    >
                      <div>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold text-xs ${
                            isToday ? 'text-acc text-sm' : 
                            weekend && day.isCurrentMonth ? 'text-acc' : 
                            isPastMonth ? 'text-muted' : 'text-fg'
                          }`}>
                      {day.date.getDate()}
                          </span>
                          {occupancyBadge && day.isCurrentMonth && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${occupancyBadge.className}`}>
                              {occupancyBadge.label}
                            </span>
                          )}
                          {!day.isCurrentMonth && (
                            <span className="text-[10px] text-muted">{formatDate(day.date, { day: undefined, year: undefined, month: 'short' })}</span>
                          )}
                    </div>

                        {day.isCurrentMonth && dayBookings.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {dayBookings.slice(0, 2).map((b) => (
                              <div
                                key={b.id}
                                onClick={() => handleViewBooking(b.id)}
                                title={`${b.guestName} - ${b.bookingCode}`}
                                className="booking-bar bg-info-soft border border-info/30 text-info text-[10px] px-1.5 py-0.5 rounded truncate font-medium cursor-pointer hover:border-info/30 transition-all flex items-center justify-between"
                              >
                                <span className="truncate flex items-center gap-1">
                                  <i className="fa-solid fa-circle text-[5px] text-info" />
                                  {b.guestName}
                                </span>
                                {b.bookingItems[0]?.roomNumber && (
                                  <span className="text-[9px] bg-info-soft px-1 rounded shrink-0">
                                    P.{b.bookingItems[0].roomNumber}
                                  </span>
                                )}
                        </div>
                      ))}
                            {dayBookings.length > 2 && (
                              <div className="text-[10px] text-muted text-center">
                                +{dayBookings.length - 2} đơn
                              </div>
                      )}
                    </div>
                        )}
                  </div>

                      {day.isCurrentMonth && (
                        <span 
                          onClick={() => openCreateBookingForDate(day.date)}
                          className="text-[10px] text-muted group-hover:text-acc cursor-pointer font-medium mt-1"
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
            <div className="bg-panel rounded-xl border border-line p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)]">
              <div className="flex items-center justify-between pb-2.5 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-acc-soft text-acc flex items-center justify-center text-xs">
                    <BedDouble className="w-3 h-3" />
                  </div>
                  <h2 className="font-bold text-xs text-fg">Tình Trạng Hạng Phòng</h2>
                </div>
                <span className="text-[11px] font-semibold text-muted">{totalRooms} phòng • hôm nay</span>
              </div>

              <div className="divide-y divide-line text-xs">
                {roomTypes.length === 0 ? (
                  <p className="py-4 text-center text-muted text-xs">Chưa có hạng phòng nào.</p>
                ) : (
                  roomTypes.map((rt) => {
                    const occupied = Math.min(rt.totalRooms, occupancyToday.get(rt.id) ?? 0)
                    const empty = rt.totalRooms - occupied
                    const percent = rt.totalRooms > 0 ? Math.round((occupied / rt.totalRooms) * 100) : 0
                    return (
                      <div key={rt.id} className="py-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                            <h3 className="font-bold text-fg">{rt.name}</h3>
                            <p className="text-[11px] text-muted">
                              {rt.totalRooms} phòng
                            </p>
                            </div>
                          <div className="text-right">
                            <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[11px] border ${
                              empty === 0 ? 'bg-err-soft text-err border-err/30' :
                              empty <= 3 ? 'bg-warn-soft text-warn border-warn/30' :
                              'bg-ok-soft text-ok border-ok/30'
                            }`}>
                              Trống {empty}p
                            </span>
                            <div className="text-[10px] text-muted mt-0.5">{percent}% kín</div>
                          </div>
                        </div>
                        <div className="w-full bg-fg/5 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              percent >= 90 ? 'bg-err' :
                              percent >= 70 ? 'bg-warn' :
                              'bg-ok'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* SECTION 2: Khách Check-in / Check-out trong ngày */}
            <div className="bg-panel rounded-xl border border-line p-3.5 shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)]">
              <div className="flex items-center justify-between pb-2.5 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-info-soft text-info flex items-center justify-center text-xs">
                    <ListChecks className="w-3 h-3" />
                  </div>
                  <h2 className="font-bold text-xs text-fg">Lượt Đến & Đi Hôm Nay</h2>
                </div>
                <Link
                  href={routes.propertyBookings(params.slug, params.id)}
                  className="text-[11px] text-acc font-semibold hover:underline"
                >
                  Xem tất cả ({todayCheckIns.length + todayCheckOuts.length})
                </Link>
              </div>

              <div className="space-y-2 mt-2.5">
                {/* Check-ins */}
                {todayCheckIns.length === 0 ? (
                  <div className="text-center py-4 text-muted text-xs">Không có lượt đến nào hôm nay</div>
                ) : (
                  todayCheckIns.slice(0, 3).map((b) => (
                    <div key={`in-${b.id}`} className="p-2.5 rounded-lg border border-line bg-page/60 hover:bg-panel hover:border-acc/40 transition-all">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-fg text-xs">{b.guestName}</span>
                            <span className="text-[9px] bg-ok-soft text-ok border border-ok/30 px-1 rounded font-bold">Check-in</span>
                          </div>
                          <p className="text-[11px] text-muted mt-0.5">
                            Phòng {b.bookingItems[0]?.roomNumber || '---'} • #{b.bookingCode}
                          </p>
                        </div>
                        <PaymentStatusBadge status={b.paymentStatus} className="shrink-0" />
                      </div>
                    </div>
                  ))
                )}

                {/* Check-outs */}
                {todayCheckOuts.length > 0 && todayCheckOuts.slice(0, 2).map((b) => (
                  <div key={`out-${b.id}`} className="p-2.5 rounded-lg border border-line bg-page/60 hover:bg-panel hover:border-acc/40 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-fg text-xs">{b.guestName}</span>
                          <span className="text-[9px] bg-warn-soft text-warn border border-warn/30 px-1 rounded font-bold">Check-out</span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">
                          Phòng {b.bookingItems[0]?.roomNumber || '---'} • #{b.bookingCode}
                        </p>
                      </div>
                      <PaymentStatusBadge status={b.paymentStatus} className="shrink-0" />
                    </div>
                        </div>
                      ))}
                    </div>
                  </div>

          </aside>
        </div>
      </main>

      {/* Create booking: the shared Modal (it was a hand-made overlay with no
          dialog role, no Esc or focus handling, and an ink backdrop that
          turned light in the dark theme). */}
      <Modal
        isOpen={showCreateBookingModal}
        onClose={() => setShowCreateBookingModal(false)}
        title="Tạo đặt phòng mới"
        size="full"
      >
            {/* Modal Header */}
            <header className="px-7 py-4 border-b border-line bg-warn-soft/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-err-soft border border-err/30 flex items-center justify-center text-err shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl font-bold text-fg tracking-tight">Tạo Đặt Phòng Mới</h1>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ok-soft text-ok border border-ok/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-ok mr-1.5 animate-pulse"></span> Lễ tân / Walk-in
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowCreateBookingModal(false)}
                  className="p-2 text-muted hover:text-muted hover:bg-fg/10 rounded-xl transition"
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
                  <div className="bg-panel rounded-xl border border-line/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-line">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-err"></span>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-fg">1. Thông tin khách lưu trú</h2>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Họ và tên */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-fg">
                          Họ và tên khách hàng <span className="text-err">*</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <input
                            className="block w-full pl-9 pr-3 py-2 text-sm text-fg rounded-lg border-line focus:ring-2 focus:ring-err/30 focus:border-err/30 transition placeholder:text-muted"
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
                        <label className="block text-xs font-semibold text-fg">
                          Số điện thoại liên hệ <span className="text-err">*</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs flex">
                          <span className="inline-flex items-center px-2.5 rounded-l-lg border border-r-0 border-line bg-fg/[0.03] text-muted text-xs font-medium">
                            🇻🇳 +84
                          </span>
                          <input
                            className="block w-full rounded-none rounded-r-lg border-line py-2 px-3 text-sm text-fg focus:ring-2 focus:ring-err/30 focus:border-err/30 transition"
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
                        <label className="block text-xs font-semibold text-fg">
                          Email <span className="text-err">*</span> <span className="text-xs font-normal text-muted">(Nhận email xác nhận)</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <input
                            className="block w-full pl-9 pr-3 py-2 text-sm text-fg rounded-lg border-line focus:ring-2 focus:ring-err/30 focus:border-err/30 transition"
                            placeholder="an.nguyen@example.com"
                            required
                            type="email"
                            value={newBooking.guestEmail}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, guestEmail: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Thông tin phòng & Thời gian lưu trú */}
                  <div className="bg-panel rounded-xl border border-line/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-line">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-err"></span>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-fg">2. Lịch trình & Xếp phòng</h2>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-warn-soft text-warn border border-warn/30">
                        Lưu trú: {Math.ceil((new Date(newBooking.checkOutDate).getTime() - new Date(newBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))} đêm
                      </span>
                    </div>

                    {/* Thời gian check-in / check-out */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {/* Check-in */}
                      <div className="bg-fg/[0.03] p-3.5 rounded-xl border border-line/70">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-ok"></span> Nhận phòng (Check-in) *
                          </span>
                          {stayTimes && <span className="text-[11px] text-muted">Nhận từ {stayTimes.checkIn}</span>}
                        </div>
                        <input
                          className="w-full text-xs font-medium rounded-lg border-line py-1.5 px-2 bg-panel focus:ring-err/30 focus:border-err/30"
                          type="date"
                          value={newBooking.checkInDate}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, checkInDate: e.target.value }))}
                          required
                        />
                      </div>
                      {/* Check-out */}
                      <div className="bg-fg/[0.03] p-3.5 rounded-xl border border-line/70">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-err"></span> Trả phòng (Check-out) *
                          </span>
                          {stayTimes && <span className="text-[11px] text-muted">Trả trước {stayTimes.checkOut}</span>}
                        </div>
                        <input
                          className="w-full text-xs font-medium rounded-lg border-line py-1.5 px-2 bg-panel focus:ring-err/30 focus:border-err/30"
                          type="date"
                          value={newBooking.checkOutDate}
                            onChange={(e) => setNewBooking(prev => ({ ...prev, checkOutDate: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    {/* Chọn hạng phòng */}
                    <div className="mb-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-fg">
                          Hạng phòng <span className="text-err">*</span>
                        </label>
                        <select
                          className="block w-full rounded-lg border-line py-2.5 px-3 text-xs font-medium text-fg focus:ring-2 focus:ring-err/30 focus:border-err/30"
                          value={newBooking.roomTypeId}
                          onChange={(e) => setNewBooking(prev => ({ ...prev, roomTypeId: e.target.value }))}
                          required
                        >
                          <option value="">Chọn hạng phòng</option>
                          {roomTypes.map(rt => (
                            <option key={rt.id} value={rt.id}>{rt.name} — {rt.totalRooms} phòng</option>
                          ))}
                        </select>
              </div>
      </div>

                    {/* Số lượng khách */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-muted mb-1">Người lớn</label>
                        <div className="flex items-center border border-line rounded-lg overflow-hidden bg-panel">
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 text-muted hover:bg-fg/5 font-bold"
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
                            className="px-2.5 py-1.5 text-muted hover:bg-fg/5 font-bold"
                            onClick={() => setNewBooking(prev => ({ ...prev, numAdults: Math.min(10, prev.numAdults + 1) }))}
                          >+</button>
            </div>
              </div>
                  <div>
                        <label className="block text-[11px] font-medium text-muted mb-1">Trẻ em (&lt;12t)</label>
                        <div className="flex items-center border border-line rounded-lg overflow-hidden bg-panel">
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 text-muted hover:bg-fg/5 font-bold"
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
                            className="px-2.5 py-1.5 text-muted hover:bg-fg/5 font-bold"
                            onClick={() => setNewBooking(prev => ({ ...prev, numChildren: Math.min(6, prev.numChildren + 1) }))}
                          >+</button>
                        </div>
                  </div>
                    </div>
                  </div>

                  {/* Card: Dịch vụ & Yêu cầu đặc biệt */}
                  <div className="bg-panel rounded-xl border border-line/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-line">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-err"></span>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-fg">3. Dịch vụ & Ghi chú</h2>
                      </div>
                    </div>
                    {/* Ghi chú / Special request */}
                  <div>
                      <label className="block text-xs font-semibold text-fg mb-1">
                        Ghi chú nội bộ / Yêu cầu từ khách:
                      </label>
                      <textarea
                        className="block w-full text-xs rounded-lg border-line shadow-xs focus:ring-2 focus:ring-err/30 focus:border-err/30 placeholder:text-muted"
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
                    <div className="bg-warn-soft/40 rounded-xl border border-warn/30 p-4 shadow-xs">
                      <div className="flex items-start justify-between">
                  <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-warn bg-warn-soft/70 px-2 py-0.5 rounded">Chi tiết lưu trú</span>
                          <h3 className="text-base font-bold text-fg mt-1">
                            {roomTypes.find(rt => rt.id === newBooking.roomTypeId)?.name || 'Chọn hạng phòng'}
                          </h3>
                  </div>
                        <div className="text-right">
                          <span className="text-xs text-muted block">Thời gian</span>
                          <span className="text-sm font-bold text-fg">
                            {Math.ceil((new Date(newBooking.checkOutDate).getTime() - new Date(newBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))} đêm
                          </span>
                </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-warn/30 text-xs">
                        <div>
                          <span className="text-muted text-[11px] block">Nhận:</span>
                          <span className="font-semibold text-fg">{newBooking.checkInDate ? format(parseISO(newBooking.checkInDate), 'dd/MM/yyyy') : '--'}{stayTimes ? ` • ${stayTimes.checkIn}` : ''}</span>
                        </div>
                        <div>
                          <span className="text-muted text-[11px] block">Trả:</span>
                          <span className="font-semibold text-fg">{newBooking.checkOutDate ? format(parseISO(newBooking.checkOutDate), 'dd/MM/yyyy') : '--'}{stayTimes ? ` • ${stayTimes.checkOut}` : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Tip / Policy info */}
                    <div className="text-[11px] text-muted bg-fg/[0.03] px-3.5 py-2.5 rounded-lg border border-line/60 flex items-center gap-2">
                      <svg className="w-4 h-4 text-warn shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                      <span>Tiền phòng được tính theo giá ngày thường / cuối tuần của hạng phòng khi tạo đơn.</span>
                    </div>
                  </div>
                </aside>
              </form>
            </main>

            {/* Modal Footer */}
            <footer className="px-7 py-4 bg-warn-soft/50 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="w-2 h-2 rounded-full bg-ok"></span>
                <span>Điền thông tin và nhấn &quot;Tạo đơn&quot; để hoàn tất</span>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {/* Nút Hủy */}
                <button 
                  type="button"
                  onClick={() => setShowCreateBookingModal(false)}
                  className="w-1/3 sm:w-auto px-4 py-2 text-xs font-semibold text-muted bg-panel border border-line rounded-lg hover:bg-fg/5 hover:text-fg transition"
                >
                  Hủy bỏ
                </button>
                {/* Nút Tạo đơn chính */}
                <button 
                  type="submit"
                  form="reservation-form"
                  disabled={isActionLoading}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-on-ink bg-ink hover:bg-ink/90 rounded-lg shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
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
                  <span>Tạo đơn</span>
                </button>
            </div>
            </footer>
      </Modal>

      {/* Booking Detail Modal */}
      <Modal
        isOpen={showBookingDetailModal}
        onClose={() => setShowBookingDetailModal(false)}
        title={`Chi tiết đơn #${selectedBooking?.bookingCode || ''}`}
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="bg-fg/[0.03] rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted">Trạng thái:</span>
                <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                  selectedBooking.status === 'CHECKED_IN' ? 'bg-ok-soft text-ok' :
                  selectedBooking.status === 'CONFIRMED' ? 'bg-info-soft text-info' :
                  selectedBooking.status === 'PENDING' ? 'bg-warn-soft text-warn' :
                  selectedBooking.status === 'CHECKED_OUT' ? 'bg-fg/5 text-fg' :
                  'bg-err-soft text-err'
                }`}>
                  {selectedBooking.status === 'CHECKED_IN' ? 'Đã nhận phòng' :
                   selectedBooking.status === 'CONFIRMED' ? 'Đã xác nhận' :
                   selectedBooking.status === 'PENDING' ? 'Chờ thanh toán' :
                   selectedBooking.status === 'CHECKED_OUT' ? 'Đã trả phòng' :
                   selectedBooking.status === 'CANCELLED' ? 'Đã hủy' : 'Không đến'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Khách:</span>
                <span className="text-sm font-medium">{selectedBooking.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Điện thoại:</span>
                <span className="text-sm">{selectedBooking.guestPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Email:</span>
                <span className="text-sm">{selectedBooking.guestEmail}</span>
              </div>
            </div>

            <div className="bg-fg/[0.03] rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted">Nhận phòng:</span>
                <span className="text-sm font-medium">
                  {selectedBooking.checkInDate ? format(new Date(selectedBooking.checkInDate), 'dd/MM/yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Trả phòng:</span>
                <span className="text-sm font-medium">
                  {selectedBooking.checkOutDate ? format(new Date(selectedBooking.checkOutDate), 'dd/MM/yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Phòng:</span>
                <span className="text-sm font-medium">
                  {selectedBooking.bookingItems[0]?.roomNumber || 'Chưa gán'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Người lớn:</span>
                <span className="text-sm">{selectedBooking.numAdults}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Trẻ em:</span>
                <span className="text-sm">{selectedBooking.numChildren}</span>
              </div>
            </div>

            <div className="bg-fg/[0.03] rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted">Tổng tiền:</span>
                <span className="text-lg font-bold text-acc">
                  {selectedBooking.totalAmount?.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Đã cọc:</span>
                <span className="text-sm text-ok font-medium">
                  {selectedBooking.depositAmount?.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Còn lại:</span>
                <span className="text-sm font-medium">
                  {(selectedBooking.totalAmount - selectedBooking.depositAmount)?.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
            </div>

            {selectedBooking.guestNote && (
              <div className="bg-warn-soft rounded-lg p-4">
                <span className="text-sm font-medium text-warn">Ghi chú:</span>
                <p className="text-sm text-warn mt-1">{selectedBooking.guestNote}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t">
              {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'CONFIRMED') && (
                <Button
                  onClick={() => handleCheckIn(selectedBooking.id)}
                  disabled={isActionLoading}
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
                  onClick={() => handleCheckOut(selectedBooking.id, selectedBooking.bookingCode)}
                  disabled={isActionLoading}
                  className="bg-warn hover:bg-warn"
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
                  className="text-err hover:bg-err-soft"
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
          <div className="bg-warn-soft border border-warn/30 rounded-lg p-4">
            <p className="text-sm text-warn">
              <strong>Báo cáo tháng {currentDate.getMonth() + 1}/{currentDate.getFullYear()}</strong>
            </p>
            <p className="text-xs text-warn mt-1">
              Tổng đơn: {bookings.length} | Đã xác nhận: {bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN').length} | Công suất: {Math.round(monthOccupancy)}%
            </p>
        </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-2">Chọn định dạng xuất:</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setExportType('pdf')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  exportType === 'pdf' 
                    ? 'border-acc bg-acc-soft' 
                    : 'border-line hover:border-line'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-err-soft rounded-lg flex items-center justify-center mb-2">
                    <span className="text-err font-bold text-lg">PDF</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    exportType === 'pdf' ? 'text-acc' : 'text-fg'
                  }`}>PDF</span>
                  <p className="text-[10px] text-muted mt-1">In và lưu PDF</p>
                </div>
              </button>
              
              <button
                onClick={() => setExportType('excel')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  exportType === 'excel' 
                    ? 'border-acc bg-acc-soft' 
                    : 'border-line hover:border-line'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-ok-soft rounded-lg flex items-center justify-center mb-2">
                    <span className="text-ok font-bold text-lg">XLS</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    exportType === 'excel' ? 'text-acc' : 'text-fg'
                  }`}>Excel</span>
                  <p className="text-[10px] text-muted mt-1">Bảng tính Excel</p>
                </div>
              </button>
              
              <button
                onClick={() => setExportType('csv')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  exportType === 'csv' 
                    ? 'border-acc bg-acc-soft' 
                    : 'border-line hover:border-line'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-info-soft rounded-lg flex items-center justify-center mb-2">
                    <span className="text-info font-bold text-lg">CSV</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    exportType === 'csv' ? 'text-acc' : 'text-fg'
                  }`}>CSV</span>
                  <p className="text-[10px] text-muted mt-1">Dữ liệu text</p>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-fg/[0.03] rounded-lg p-3">
            <h4 className="text-sm font-medium text-fg mb-2">Nội dung báo cáo:</h4>
            <ul className="text-xs text-muted space-y-1">
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
      {checkOutBooking && (
        <CheckOutDialog
          bookingId={checkOutBooking.id}
          bookingCode={checkOutBooking.code}
          isOpen
          onClose={() => setCheckOutBooking(null)}
          onDone={(message) => {
            toast.success(message)
            setCheckOutBooking(null)
            setShowBookingDetailModal(false)
            fetchCalendarData()
          }}
        />
      )}
    </div>
  )
}
