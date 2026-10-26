'use client'

import * as React from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button, Modal, ModalBody } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { Header, PageContainer } from '@/components/layout'
import { NoAccess } from '@/components/layout/no-access'
import { canManageBookings, useWorkspaceRole } from '@/components/layout/workspace-context'
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Plus, DoorOpen, Receipt,
  Key, RefreshCw,
  Eye, Loader2, XCircle
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { routes } from '@/lib/utils/routes'
import { useDashLabels } from '@/lib/i18n/dash'
import { useProperty } from '@/lib/hooks/use-property'
import { escapeHtml } from '@/lib/bookings/display'
import { CheckOutDialog } from '@/components/bookings/check-out-dialog'
import { CancelDialog } from '@/components/bookings/cancel-dialog'
import { CheckInDialog } from '@/components/bookings/check-in-dialog'
import { RoomTimeline } from '@/components/bookings/room-timeline'
import { BookingsViews, calendarViewParam, type CalendarView } from '@/components/bookings/bookings-views'
import { BookingActions, BookingDetailContent, useBooking } from '@/components/bookings/booking-detail'
import { SidePanel, SidePanelBody, SidePanelFooter, SidePanelHeader, BookingStatusBadge, Loading } from '@/components/ui'
import { fetchBookingsAround, monthOccupancy as occupancyOfMonth, nightOccupancy, roomOn, toCsv } from '@/lib/bookings/calendar'
import { planNumbers, roomPlan } from '@/lib/bookings/room-plan'
import { format, addDays, parseISO } from 'date-fns'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'

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
    roomId?: string | null
    roomNumber: string | null
    basePrice: number
    totalPrice: number
  }>
  /** a stay that changes rooms part way, in night order (room-plan.ts) */
  roomSegments?: Array<{ roomId: string | null; roomNumber: string; roomTypeId: string; fromDate: string; toDate: string }>
  property?: {
    id: string
    name: string
    subdomain: string
  }
  payments?: any[]
  invoices?: any[]
  createdAt?: string
}

/** Every room of a stay, in night order ("101 → 205"). */
const roomsOf = (b: Booking) => (b.roomSegments?.length ? planNumbers(roomPlan(b)) : b.bookingItems.map((i) => i.roomNumber).filter(Boolean).join(', '))

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
  // The calendar is for staff (bookings-views.tsx); a USER has the list.
  const role = useWorkspaceRole()
  const t = useTranslations('dash.calendar')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const intlLocale = labels.locale === 'en' ? 'en-GB' : 'vi-VN'
  // Local (browser) dates, as the grid is built: no time zone, like before.
  const formatLocal = (d: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale, options).format(d)

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
  const [exportType, setExportType] = React.useState<'pdf' | 'excel' | 'csv'>('pdf')
  // The hotel's check-in / check-out times (Policy); the dialog said 14:00 / 12:00 whatever they were.
  const [stayTimes, setStayTimes] = React.useState<{ checkIn: string; checkOut: string } | null>(null)

  // Month grid or room timeline (room-timeline.tsx): the address says which
  // (?view=, the switcher on the bookings list links here), else the one last
  // chosen in this browser.
  const pathname = usePathname()
  const urlView = calendarViewParam(useSearchParams().get('view'))
  const [view, setView] = React.useState<CalendarView>(urlView ?? 'month')
  React.useEffect(() => {
    try {
      if (urlView) {
        setView(urlView)
        localStorage.setItem('ds-calendar-view', urlView)
      } else if (localStorage.getItem('ds-calendar-view') === 'rooms') {
        setView('rooms')
      }
    } catch {}
  }, [urlView])
  // In place, at once; the address follows (replace: no history entry per click).
  const chooseView = (next: CalendarView) => {
    setView(next)
    try {
      localStorage.setItem('ds-calendar-view', next)
    } catch {}
    router.replace(`${pathname}?view=${next}`, { scroll: false })
  }
  const [timelineKey, setTimelineKey] = React.useState(0)
  // A booking opened from the timeline: the shared booking panel.
  const [panelId, setPanelId] = React.useState<string | null>(null)
  const panel = useBooking(panelId)
  const refreshAfterPanel = () => {
    panel.reload()
    setTimelineKey((k) => k + 1)
    fetchCalendarData()
  }
  // The room picked on the timeline for a walk-in (shown in the form).
  const [presetRoom, setPresetRoom] = React.useState<{ id: string; number: string } | null>(null)

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
      const grid = buildMonthGrid(currentDate)
      const gridStart = grid[0].date
      const gridEnd = addDays(grid[grid.length - 1].date, 1)

      const [roomTypesData, shown, policyData] = await Promise.all([
        fetch(`/api/room-types?propertyId=${propertyId}`).then((r) => r.json()),
        // Every page, asked wider than the days shown (src/lib/bookings/calendar.ts).
        fetchBookingsAround<Booking>(propertyId, gridStart, gridEnd),
        // The property (with its policy) is readable by every member; /policy is for those who edit it (receptionists got 403).
        fetch(`/api/properties/${propertyId}`).then((r) => r.json()).catch(() => null),
      ])

      if (roomTypesData.success) {
        setRoomTypes(roomTypesData.data ?? [])
      }
      setBookings(shown)
      const policy = policyData?.data?.policy
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
  const occupancyForDay = (day: Date) => nightOccupancy(bookings, day)

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
          ...(presetRoom && { roomId: presetRoom.id }),
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(t('create.success'))
        setShowCreateBookingModal(false)
        setPresetRoom(null)
        setTimelineKey((k) => k + 1)
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
        toast.error(apiError(data.error) || t('create.error'))
      }
    } catch (err) {
      console.error('Create booking error:', err)
      toast.error(t('create.error'))
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
        toast.error(apiError(data.error) || t('detail.loadError'))
      }
    } catch (err) {
      console.error('Fetch booking error:', err)
      toast.error(t('detail.loadError'))
    }
  }

  // Check-in is confirmed in a dialog that also settles the room (check-in-dialog.tsx); it was one click.
  const [checkingIn, setCheckingIn] = React.useState(false)

  // Check-out goes through the dialog that settles the late fee (check-out-dialog.tsx).
  const [checkOutBooking, setCheckOutBooking] = React.useState<{ id: string; code: string } | null>(null)
  const handleCheckOut = (bookingId: string, bookingCode: string) => setCheckOutBooking({ id: bookingId, code: bookingCode })

  // Cancelling goes through the dialog that settles the refund (cancel-dialog.tsx).
  const [cancelBooking, setCancelBooking] = React.useState<{ id: string; code: string } | null>(null)


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
        title: t('export.doc.title', { month: currentDate.getMonth() + 1, year: String(currentDate.getFullYear()) }),
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
        },
        bookings: monthBookings.map(b => ({
          bookingCode: b.bookingCode,
          guestName: b.guestName,
          checkIn: b.checkInDate,
          checkOut: b.checkOutDate,
          status: b.status,
          rooms: roomsOf(b) || t('unassigned'),
        })),
      }

      const doc = (key: 'code' | 'guest' | 'checkIn' | 'checkOut' | 'status' | 'room' | 'totalRooms' | 'totalBookings' | 'checkedIn' | 'checkedOut' | 'occupancy' | 'titleShort') =>
        escapeHtml(t(`export.doc.${key}`))
      const fileName = t('export.fileName', { month: currentDate.getMonth() + 1, year: String(currentDate.getFullYear()) })

      // Export based on selected type
      if (exportType === 'csv') {
        // Generate CSV
        const csvHeaders = (['code', 'guest', 'checkIn', 'checkOut', 'status', 'room'] as const).map((key) => t(`export.doc.${key}`))
        const csvRows = reportData.bookings.map(b => [
          b.bookingCode,
          b.guestName,
          new Date(b.checkIn).toLocaleDateString(intlLocale),
          new Date(b.checkOut).toLocaleDateString(intlLocale),
          b.status,
          b.rooms,
        ])
        
        // Quoted and formula-safe: a comma in a guest name shifted the columns (calendar.ts).
        const csvContent = toCsv([csvHeaders, ...csvRows])
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${fileName}.csv`
        link.click()
        URL.revokeObjectURL(url)
        toast.success(t('export.csvDone'))
      } else if (exportType === 'excel') {
        // For Excel, we'll create a simple HTML table that Excel can open
        const excelHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${doc('titleShort')}</title>
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
            <h1>${escapeHtml(reportData.title)}</h1>
            <div class="summary">
              <div class="summary-item"><strong>${doc('totalRooms')}:</strong> ${reportData.summary.totalRooms}</div>
              <div class="summary-item"><strong>${doc('totalBookings')}:</strong> ${reportData.summary.totalBookings}</div>
              <div class="summary-item"><strong>${escapeHtml(labels.bookingStatus('CONFIRMED'))}:</strong> ${reportData.summary.confirmedBookings}</div>
              <div class="summary-item"><strong>${doc('checkedIn')}:</strong> ${reportData.summary.checkedInBookings}</div>
              <div class="summary-item"><strong>${doc('checkedOut')}:</strong> ${reportData.summary.checkedOutBookings}</div>
              <div class="summary-item"><strong>${doc('occupancy')}:</strong> ${reportData.summary.occupancyRate}%</div>
          </div>
            <table>
              <thead>
                <tr>
                  <th>${doc('code')}</th>
                  <th>${doc('guest')}</th>
                  <th>${doc('checkIn')}</th>
                  <th>${doc('checkOut')}</th>
                  <th>${doc('status')}</th>
                  <th>${doc('room')}</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.bookings.map(b => `
                  <tr>
                    <td>${escapeHtml(b.bookingCode)}</td>
                    <td>${escapeHtml(b.guestName)}</td>
                    <td>${new Date(b.checkIn).toLocaleDateString(intlLocale)}</td>
                    <td>${new Date(b.checkOut).toLocaleDateString(intlLocale)}</td>
                    <td>${escapeHtml(b.status)}</td>
                    <td>${escapeHtml(b.rooms)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p style="margin-top: 20px; color: #666;">${escapeHtml(t('export.doc.exportedAt', { time: new Date().toLocaleString(intlLocale) }))}</p>
          </body>
          </html>
        `
        const blob = new Blob([excelHTML], { type: 'application/vnd.ms-excel' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${fileName}.xls`
        link.click()
        URL.revokeObjectURL(url)
        toast.success(t('export.excelDone'))
      } else {
        // PDF - show print dialog which can save as PDF
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>${doc('titleShort')}</title>
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
              <h1>${escapeHtml(reportData.title)}</h1>
              <div class="summary">
                <div class="summary-item">
                  <strong>${reportData.summary.totalRooms}</strong>
                  <span>${doc('totalRooms')}</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.totalBookings}</strong>
                  <span>${doc('totalBookings')}</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.occupancyRate}%</strong>
                  <span>${doc('occupancy')}</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.confirmedBookings}</strong>
                  <span>${escapeHtml(labels.bookingStatus('CONFIRMED'))}</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.checkedInBookings}</strong>
                  <span>${escapeHtml(labels.bookingStatus('CHECKED_IN'))}</span>
                </div>
                <div class="summary-item">
                  <strong>${reportData.summary.checkedOutBookings}</strong>
                  <span>${escapeHtml(labels.bookingStatus('CHECKED_OUT'))}</span>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>${doc('code')}</th>
                    <th>${doc('guest')}</th>
                    <th>${doc('checkIn')}</th>
                    <th>${doc('checkOut')}</th>
                    <th>${doc('status')}</th>
                    <th>${doc('room')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.bookings.map(b => `
                    <tr>
                      <td>${escapeHtml(b.bookingCode)}</td>
                      <td>${escapeHtml(b.guestName)}</td>
                      <td>${new Date(b.checkIn).toLocaleDateString(intlLocale)}</td>
                      <td>${new Date(b.checkOut).toLocaleDateString(intlLocale)}</td>
                      <td>${escapeHtml(b.status)}</td>
                      <td>${escapeHtml(b.rooms)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="footer">
                ${escapeHtml(t('export.doc.generatedAt', { time: new Date().toLocaleString(intlLocale) }))}
              </div>
            </body>
            </html>
          `)
          printWindow.document.close()
          setTimeout(() => {
            printWindow.print()
          }, 500)
        }
        toast.success(t('export.pdfOpening'))
      }
      
      setShowExportModal(false)
    } catch (err) {
      console.error('Export error:', err)
      toast.error(t('export.error'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchCalendarData()
    toast.success(t('toolbar.refreshed'))
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

  // Month and year only ("tháng 10 năm 2026" / "October 2026").
  const monthLabel = formatLocal(currentDate, { month: 'long', year: 'numeric' })
  const today = startOfDay(new Date())
  const days = buildMonthGrid(currentDate)
  const totalRooms = roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)

  // Booked room-nights over room-nights available in the month shown, in %
  // (the export's summary; the day's figures are on the overview now).
  const monthOccupancy = occupancyOfMonth(bookings, totalRooms, currentDate.getFullYear(), currentDate.getMonth())

  const dayOfWeekLabel = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

  const getOccupancyBadge = (day: Date) => {
    const occupied = Array.from(occupancyForDay(day).values()).reduce((a, b) => a + b, 0)
    if (occupied === 0) return null
    const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0
    
    if (percent >= 80) {
      return { label: t('grid.busy', { occupied, total: totalRooms }), className: 'bg-warn-soft text-warn border-warn/30' }
    }
    if (occupied >= totalRooms * 0.5) {
      return { label: t('grid.busy', { occupied, total: totalRooms }), className: 'bg-ok-soft text-ok border-ok/30' }
    }
    return { label: t('grid.busy', { occupied, total: totalRooms }), className: 'bg-fg/5 text-muted border-line' }
  }

  const isWeekend = (day: Date) => {
    const d = day.getDay()
    return d === 0 || d === 6
  }

  const ctl = 'h-9 sm:h-8 px-3 rounded-ctl border border-line bg-panel text-fg hover:bg-fg/[0.03] text-xs font-semibold transition-colors inline-flex items-center gap-1.5'

  // Opened by its address by a USER (the menu and the switcher only show it to staff).
  if (!canManageBookings(role)) {
    return (
      <PageContainer>
        <NoAccess backHref={routes.propertyBookings(params.slug, propertyId)} backLabel={tc('nav.bookings')} />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="max-w-none">
      {/* The standard page header (it had its own "Digistay Hotel OS" bar and a live clock);
          one "Đặt phòng" with the list (bookings-views.tsx). */}
      <Header
        eyebrow={labels.longDate(new Date())}
        title={tc('nav.bookings')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button aria-label={tc('actions.refresh')} onClick={handleRefresh} className={ctl} title={t('toolbar.refreshTitle')}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden md:inline">{tc('actions.refresh')}</span>
            </button>
            <button aria-label={t('toolbar.export')} onClick={() => setShowExportModal(true)} className={ctl} title={t('toolbar.exportTitle')}>
              <Receipt className="w-3.5 h-3.5 text-ok" aria-hidden="true" />
              <span className="hidden md:inline">{t('toolbar.export')}</span>
            </button>
            {/* One way to create a booking, the same page as "Đặt phòng" opens (real
                availability and payment); a click on an empty night still opens the quick dialog. */}
            <Button size="sm" onClick={() => router.push(routes.propertyBookingNew(params.slug, propertyId))}>
              <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              {t('toolbar.createBooking')}
            </Button>
          </div>
        }
      />

      {/* The view (list, month, room plan) and the month */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <BookingsViews slug={params.slug} propertyId={propertyId} current={view} onCalendarView={chooseView} />
        {view === 'month' && (
          <>
            <div className="flex items-center bg-panel border border-line rounded-ctl p-0.5">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="w-8 h-8 rounded hover:bg-fg/[0.03] flex items-center justify-center text-muted transition-colors"
                aria-label={t('toolbar.prevMonth')}
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <span className="px-2.5 text-xs font-bold text-fg tracking-tight flex items-center gap-1.5">
                <CalendarIcon className="w-3 h-3 text-acc" aria-hidden="true" />
                {monthLabel}
              </span>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="w-8 h-8 rounded hover:bg-fg/[0.03] flex items-center justify-center text-muted transition-colors"
                aria-label={t('toolbar.nextMonth')}
              >
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            <button onClick={() => setCurrentDate(new Date())} className={ctl}>
              {t('toolbar.today')}
            </button>
          </>
        )}
      </div>

      <div className="space-y-4">
        {view === 'rooms' && propertyId && (
          <RoomTimeline
            propertyId={propertyId}
            refreshKey={timelineKey}
            onOpenBooking={(id) => setPanelId(id)}
            onCreate={({ roomTypeId, room, date }) => {
              setPresetRoom(room ?? null)
              const day = parseISO(date)
              setNewBooking((prev) => ({ ...prev, roomTypeId, checkInDate: date, checkOutDate: format(addDays(day, 1), 'yyyy-MM-dd') }))
              setShowCreateBookingModal(true)
            }}
          />
        )}

        {/* The month grid, the whole width (the day's figures are on the overview). */}
        {view === 'month' && (
          <section className="bg-panel rounded-xl border border-line shadow-[0_2px_8px_-1px_rgba(36,26,24,0.04),0_1px_4px_-1px_rgba(36,26,24,0.02)] flex flex-col overflow-hidden">
            {/* Calendar Matrix Header Bar */}
            <div className="px-4 py-2.5 bg-panel border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-fg">{t('grid.title')}</span>
                <span className="text-[10px] text-muted bg-fg/5 px-2 py-0.5 rounded-full font-medium">{t('grid.daysShown', { count: days.length })}</span>
                  </div>
            </div>

            {/* Days of Week Header (short names until there is room: the long ones wrapped onto 3 lines) */}
            <div className="hidden sm:grid grid-cols-7 border-b border-line bg-fg/[0.03] text-center text-xs font-bold text-muted divide-x divide-line">
              {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day, i) => (
                <div key={day} className={`py-2 ${i >= 5 ? 'text-acc' : ''}`}>
                  <span className="hidden xl:inline">{t(`grid.weekdays.${day}`)}</span>
                  <span className="xl:hidden">{t(`grid.weekdaysShort.${day}`)}</span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc" />
              </div>
            ) : (
              <>
              {/* Phones: the month as a list of days (seven columns of 50 px could not be read). */}
              <ol className="sm:hidden divide-y divide-line">
                {days.filter((day) => day.isCurrentMonth).map((day) => {
                  const dayBookings = bookingsForDay(day.date)
                  const isToday = isSameDay(day.date, today)
                  const badge = getOccupancyBadge(day.date)
                  const weekdayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[day.date.getDay()]
                  return (
                    <li key={day.date.getTime()} className={cn('flex gap-3 px-3 py-2.5', isToday && 'bg-acc-soft/50')}>
                      <div className={cn('w-11 shrink-0 text-center leading-tight', isToday ? 'text-acc' : isWeekend(day.date) ? 'text-acc' : 'text-fg')}>
                        <div className="text-[11px] font-semibold uppercase">{t(`grid.weekdaysShort.${weekdayKey}`)}</div>
                        <div className="text-lg font-bold tabular-nums">{day.date.getDate()}</div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        {badge && <span className={`inline-block text-[11px] px-1.5 rounded font-semibold border ${badge.className}`}>{badge.label}</span>}
                        {dayBookings.slice(0, 3).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleViewBooking(b.id)}
                            className="flex w-full items-center justify-between gap-2 rounded bg-info-soft border border-info/30 px-2 py-1 text-left text-xs text-fg"
                          >
                            <span className="truncate font-medium">{b.guestName}</span>
                            {roomOn(b, day.date) && <span className="shrink-0 text-muted">{t('grid.room', { number: roomOn(b, day.date)! })}</span>}
                          </button>
                        ))}
                        {dayBookings.length > 3 && <p className="text-[11px] text-muted">{t('grid.more', { count: dayBookings.length - 3 })}</p>}
                        {dayBookings.length === 0 && !badge && <p className="text-xs text-muted py-1">{t('grid.free')}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreateBookingForDate(day.date)}
                        aria-label={t('grid.addOn', { date: `${day.date.getDate()}/${day.date.getMonth() + 1}` })}
                        className="h-8 shrink-0 self-start rounded-ctl border border-line px-2.5 text-xs font-medium text-acc"
                      >
                        + {tc('actions.add')}
                      </button>
                    </li>
                  )
                })}
              </ol>
              <div className="hidden sm:grid grid-cols-7 divide-x divide-y divide-line bg-fg/5">
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
                            <span className="text-[10px] text-muted">{formatLocal(day.date, { month: 'short' })}</span>
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
                                {roomOn(b, day.date) && (
                                  <span className="text-[9px] bg-info-soft px-1 rounded shrink-0">
                                    {t('grid.room', { number: roomOn(b, day.date)! })}
                                  </span>
                                )}
                        </div>
                      ))}
                            {dayBookings.length > 2 && (
                              <div className="text-[10px] text-muted text-center">
                                {t('grid.more', { count: dayBookings.length - 2 })}
                              </div>
                      )}
                    </div>
                        )}
                  </div>

                      {day.isCurrentMonth && (
                        <button
                          type="button"
                          onClick={() => openCreateBookingForDate(day.date)}
                          className="self-start text-[10px] text-muted group-hover:text-acc hover:text-acc font-medium mt-1"
                        >
                          + {tc('actions.add')}
                        </button>
                      )}
              </div>
                  )
                })}
        </div>
              </>
            )}
          </section>
        )}
      </div>

      {/* Create booking: the shared Modal (it was a hand-made overlay with no
          dialog role, no Esc or focus handling, and an ink backdrop that
          turned light in the dark theme). */}
      <Modal
        isOpen={showCreateBookingModal}
        onClose={() => setShowCreateBookingModal(false)}
        title={t('create.title')}
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
                    <h1 className="text-xl font-bold text-fg tracking-tight">{t('create.heading')}</h1>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ok-soft text-ok border border-ok/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-ok mr-1.5 animate-pulse"></span> {t('create.badge')}
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
                        <h2 className="text-sm font-bold uppercase tracking-wider text-fg">{t('create.guestSection')}</h2>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Họ và tên */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-fg">
                          {t('create.guestName')} <span className="text-err">*</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <input
                            className="block w-full pl-9 pr-3 py-2 text-sm text-fg rounded-lg border-line focus:ring-2 focus:ring-err/30 focus:border-err/30 transition placeholder:text-muted"
                            placeholder={t('create.guestNamePlaceholder')}
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
                          {t('create.phone')} <span className="text-err">*</span>
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
                        {/* Optional: walk-in guests often have none (the API takes an empty one). */}
                        <label htmlFor="create-guest-email" className="block text-xs font-semibold text-fg">
                          {t('create.email')} <span className="text-xs font-normal text-muted">{t('create.emailHint')}</span>
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <input
                            className="block w-full pl-9 pr-3 py-2 text-sm text-fg rounded-lg border-line focus:ring-2 focus:ring-err/30 focus:border-err/30 transition"
                            id="create-guest-email"
                            placeholder="an.nguyen@example.com"
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
                        <h2 className="text-sm font-bold uppercase tracking-wider text-fg">{t('create.staySection')}</h2>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-warn-soft text-warn border border-warn/30">
                        {t('create.stayNights', { count: Math.ceil((new Date(newBooking.checkOutDate).getTime() - new Date(newBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)) })}
                      </span>
                    </div>

                    {/* Thời gian check-in / check-out */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {/* Check-in */}
                      <div className="bg-fg/[0.03] p-3.5 rounded-xl border border-line/70">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-ok"></span> {t('create.checkIn')}
                          </span>
                          {stayTimes && <span className="text-[11px] text-muted">{t('create.checkInFrom', { time: stayTimes.checkIn })}</span>}
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
                            <span className="w-2 h-2 rounded-full bg-err"></span> {t('create.checkOut')}
                          </span>
                          {stayTimes && <span className="text-[11px] text-muted">{t('create.checkOutBy', { time: stayTimes.checkOut })}</span>}
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
                          {t('create.roomType')} <span className="text-err">*</span>
                        </label>
                        <select
                          className="block w-full rounded-lg border-line py-2.5 px-3 text-xs font-medium text-fg focus:ring-2 focus:ring-err/30 focus:border-err/30"
                          value={newBooking.roomTypeId}
                          onChange={(e) => {
                            setPresetRoom(null)
                            setNewBooking(prev => ({ ...prev, roomTypeId: e.target.value }))
                          }}
                          required
                        >
                          <option value="">{t('create.chooseRoomType')}</option>
                          {roomTypes.map(rt => (
                            <option key={rt.id} value={rt.id}>{t('create.roomTypeOption', { name: rt.name, count: rt.totalRooms })}</option>
                          ))}
                        </select>
                        {presetRoom && (
                          <p className="text-xs text-fg">
                            {t('timeline.presetRoom', { room: presetRoom.number })}{' '}
                            <button type="button" onClick={() => setPresetRoom(null)} className="text-acc hover:underline">
                              {t('timeline.presetClear')}
                            </button>
                          </p>
                        )}
              </div>
      </div>

                    {/* Số lượng khách */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-muted mb-1">{t('create.adults')}</label>
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
                        <label className="block text-[11px] font-medium text-muted mb-1">{t('create.children')}</label>
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
                        <h2 className="text-sm font-bold uppercase tracking-wider text-fg">{t('create.notesSection')}</h2>
                      </div>
                    </div>
                    {/* Ghi chú / Special request */}
                  <div>
                      <label className="block text-xs font-semibold text-fg mb-1">
                        {t('create.notes')}
                      </label>
                      <textarea
                        className="block w-full text-xs rounded-lg border-line shadow-xs focus:ring-2 focus:ring-err/30 focus:border-err/30 placeholder:text-muted"
                        placeholder={t('create.notesPlaceholder')}
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
                          <span className="text-[11px] font-bold uppercase tracking-wider text-warn bg-warn-soft/70 px-2 py-0.5 rounded">{t('create.stayDetails')}</span>
                          <h3 className="text-base font-bold text-fg mt-1">
                            {roomTypes.find(rt => rt.id === newBooking.roomTypeId)?.name || t('create.chooseRoomType')}
                          </h3>
                  </div>
                        <div className="text-right">
                          <span className="text-xs text-muted block">{t('create.duration')}</span>
                          <span className="text-sm font-bold text-fg">
                            {labels.nights(Math.ceil((new Date(newBooking.checkOutDate).getTime() - new Date(newBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))}
                          </span>
                </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-warn/30 text-xs">
                        <div>
                          <span className="text-muted text-[11px] block">{t('create.arrive')}</span>
                          <span className="font-semibold text-fg">{newBooking.checkInDate ? format(parseISO(newBooking.checkInDate), 'dd/MM/yyyy') : '--'}{stayTimes ? ` • ${stayTimes.checkIn}` : ''}</span>
                        </div>
                        <div>
                          <span className="text-muted text-[11px] block">{t('create.depart')}</span>
                          <span className="font-semibold text-fg">{newBooking.checkOutDate ? format(parseISO(newBooking.checkOutDate), 'dd/MM/yyyy') : '--'}{stayTimes ? ` • ${stayTimes.checkOut}` : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Tip / Policy info */}
                    <div className="text-[11px] text-muted bg-fg/[0.03] px-3.5 py-2.5 rounded-lg border border-line/60 flex items-center gap-2">
                      <svg className="w-4 h-4 text-warn shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                      <span>{t('create.priceTip')}</span>
                    </div>
                  </div>
                </aside>
              </form>
            </main>

            {/* Modal Footer */}
            <footer className="px-7 py-4 bg-warn-soft/50 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="w-2 h-2 rounded-full bg-ok"></span>
                <span>{t('create.footerHint')}</span>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {/* Nút Hủy */}
                <button 
                  type="button"
                  onClick={() => setShowCreateBookingModal(false)}
                  className="w-1/3 sm:w-auto px-4 py-2 text-xs font-semibold text-muted bg-panel border border-line rounded-lg hover:bg-fg/5 hover:text-fg transition"
                >
                  {t('create.cancel')}
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
                  <span>{t('create.submit')}</span>
                </button>
            </div>
            </footer>
      </Modal>

      {/* Booking Detail Modal */}
      <Modal showHeader
        isOpen={showBookingDetailModal}
        onClose={() => setShowBookingDetailModal(false)}
        title={t('detail.title', { code: selectedBooking?.bookingCode || '' })}
      >
        {selectedBooking && (
          <ModalBody className="space-y-4">
            <div className="bg-fg/[0.03] rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.status')}</span>
                <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                  selectedBooking.status === 'CHECKED_IN' ? 'bg-ok-soft text-ok' :
                  selectedBooking.status === 'CONFIRMED' ? 'bg-info-soft text-info' :
                  selectedBooking.status === 'PENDING' ? 'bg-warn-soft text-warn' :
                  selectedBooking.status === 'CHECKED_OUT' ? 'bg-fg/5 text-fg' :
                  'bg-err-soft text-err'
                }`}>
                  {labels.bookingStatus(selectedBooking.status)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.guest')}</span>
                <span className="text-sm font-medium">{selectedBooking.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.phone')}</span>
                <span className="text-sm">{selectedBooking.guestPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.email')}</span>
                <span className="text-sm">{selectedBooking.guestEmail}</span>
              </div>
            </div>

            <div className="bg-fg/[0.03] rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.checkIn')}</span>
                <span className="text-sm font-medium">
                  {selectedBooking.checkInDate ? format(new Date(selectedBooking.checkInDate), 'dd/MM/yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.checkOut')}</span>
                <span className="text-sm font-medium">
                  {selectedBooking.checkOutDate ? format(new Date(selectedBooking.checkOutDate), 'dd/MM/yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.room')}</span>
                <span className="text-sm font-medium">
                  {roomsOf(selectedBooking) || t('unassigned')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.adults')}</span>
                <span className="text-sm">{selectedBooking.numAdults}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.children')}</span>
                <span className="text-sm">{selectedBooking.numChildren}</span>
              </div>
            </div>

            <div className="bg-fg/[0.03] rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.total')}</span>
                <span className="text-lg font-bold text-acc">
                  {labels.money(selectedBooking.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.deposit')}</span>
                <span className="text-sm text-ok font-medium">
                  {labels.money(selectedBooking.depositAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('detail.remaining')}</span>
                <span className="text-sm font-medium">
                  {labels.money(selectedBooking.totalAmount - selectedBooking.depositAmount)}
                </span>
              </div>
            </div>

            {selectedBooking.guestNote && (
              <div className="bg-warn-soft rounded-lg p-4">
                <span className="text-sm font-medium text-warn">{t('detail.note')}</span>
                <p className="text-sm text-warn mt-1">{selectedBooking.guestNote}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t">
              {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'CONFIRMED') && (
                <Button onClick={() => setCheckingIn(true)} disabled={isActionLoading}>
                  <Key className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t('checkIn')}
                </Button>
              )}
              
              {selectedBooking.status === 'CHECKED_IN' && (
                <Button
                  onClick={() => handleCheckOut(selectedBooking.id, selectedBooking.bookingCode)}
                  disabled={isActionLoading}
                  className="bg-warn hover:bg-warn"
                >
                  <DoorOpen className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t('checkOut')}
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
                {t('detail.viewDetails')}
              </Button>

              {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'CONFIRMED') && (
                <Button
                  onClick={() => setCancelBooking({ id: selectedBooking.id, code: selectedBooking.bookingCode })}
                  disabled={isActionLoading}
                  variant="outline"
                  className="text-err hover:bg-err-soft"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {t('detail.cancelBooking')}
                </Button>
              )}
            </div>
          </ModalBody>
        )}
      </Modal>

      {/* Export Report Modal */}
      <Modal showHeader
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={t('toolbar.exportTitle')}
      >
        <ModalBody className="space-y-4">
          <div className="bg-warn-soft border border-warn/30 rounded-lg p-4">
            <p className="text-sm text-warn">
              <strong>{t('export.monthReport', { month: currentDate.getMonth() + 1, year: String(currentDate.getFullYear()) })}</strong>
            </p>
            <p className="text-xs text-warn mt-1">
              {t('export.summaryLine', {
                total: bookings.length,
                confirmed: bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN').length,
                occupancy: Math.round(monthOccupancy),
              })}
            </p>
        </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-2">{t('export.chooseFormat')}</label>
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
                  <p className="text-[10px] text-muted mt-1">{t('export.pdfHint')}</p>
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
                  <p className="text-[10px] text-muted mt-1">{t('export.excelHint')}</p>
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
                  <p className="text-[10px] text-muted mt-1">{t('export.csvHint')}</p>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-fg/[0.03] rounded-lg p-3">
            <h4 className="text-sm font-medium text-fg mb-2">{t('export.contents')}</h4>
            <ul className="text-xs text-muted space-y-1">
              <li>{t('export.contentsOverview')}</li>
              <li>{t('export.contentsList')}</li>
              <li>{t('export.contentsGuests')}</li>
              <li>{t('export.contentsStatus')}</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setShowExportModal(false)}
            >
              {tc('actions.close')}
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
              {t('toolbar.export')}
            </Button>
          </div>
        </ModalBody>
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
      {selectedBooking && checkingIn && (
        <CheckInDialog
          booking={selectedBooking}
          propertyId={propertyId}
          checkInTime={stayTimes?.checkIn}
          isOpen
          onClose={() => setCheckingIn(false)}
          onDone={(message) => {
            toast.success(message)
            setCheckingIn(false)
            setShowBookingDetailModal(false)
            setTimelineKey((k) => k + 1)
            fetchCalendarData()
          }}
        />
      )}
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
      {/* A booking opened from the room timeline: the shared panel (bookings list). */}
      <SidePanel open={!!panelId} onClose={() => setPanelId(null)} label={panel.booking?.bookingCode ?? ''}>
        <SidePanelHeader>
          {panel.booking ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold text-fg">{panel.booking.bookingCode}</span>
              <BookingStatusBadge status={panel.booking.status} />
            </div>
          ) : (
            <span className="text-small text-muted">{tc('states.loading')}</span>
          )}
        </SidePanelHeader>
        <SidePanelBody>
          {panel.error ? (
            <p className="text-small text-err">{panel.error}</p>
          ) : panel.booking ? (
            <BookingDetailContent booking={panel.booking} onChanged={refreshAfterPanel} />
          ) : (
            <Loading className="py-16" />
          )}
        </SidePanelBody>
        {panel.booking && (
          <SidePanelFooter>
            <BookingActions
              booking={panel.booking}
              onChanged={refreshAfterPanel}
              openPageHref={routes.propertyBooking(params.slug, propertyId, panel.booking.id)}
            />
          </SidePanelFooter>
        )}
      </SidePanel>

      {cancelBooking && (
        <CancelDialog
          bookingId={cancelBooking.id}
          bookingCode={cancelBooking.code}
          isOpen
          onClose={() => setCancelBooking(null)}
          onDone={(message) => {
            toast.success(message)
            setCancelBooking(null)
            setShowBookingDetailModal(false)
            fetchCalendarData()
          }}
        />
      )}
    </PageContainer>
  )
}
