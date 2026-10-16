'use client'

import * as React from 'react'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui'
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Bed, Users, Clock, Eye, Edit
} from 'lucide-react'

interface RoomBooking {
  id: string
  roomNumber: string
  roomType: string
  guestName: string
  checkIn: string
  checkOut: string
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'PENDING'
}

interface Room {
  id: string
  number: string
  type: string
  floor: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING'
  booking?: RoomBooking
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [selectedRoom, setSelectedRoom] = React.useState<Room | null>(null)

  // Mock room data
  const rooms: Room[] = [
    { id: '1', number: '101', type: 'Standard', floor: 1, status: 'OCCUPIED', booking: { id: '1', roomNumber: '101', roomType: 'Standard', guestName: 'Nguyễn Văn A', checkIn: '2024-10-13', checkOut: '2024-10-15', status: 'CHECKED_IN' } },
    { id: '2', number: '102', type: 'Standard', floor: 1, status: 'AVAILABLE' },
    { id: '3', number: '103', type: 'Superior', floor: 1, status: 'OCCUPIED', booking: { id: '2', roomNumber: '103', roomType: 'Superior', guestName: 'Trần Thị B', checkIn: '2024-10-14', checkOut: '2024-10-16', status: 'CONFIRMED' } },
    { id: '4', number: '104', type: 'Standard', floor: 1, status: 'CLEANING' },
    { id: '5', number: '201', type: 'Deluxe', floor: 2, status: 'AVAILABLE' },
    { id: '6', number: '202', type: 'Deluxe', floor: 2, status: 'OCCUPIED', booking: { id: '3', roomNumber: '202', roomType: 'Deluxe', guestName: 'Lê Văn C', checkIn: '2024-10-12', checkOut: '2024-10-15', status: 'CHECKED_IN' } },
    { id: '7', number: '203', type: 'Superior', floor: 2, status: 'MAINTENANCE' },
    { id: '8', number: '204', type: 'Deluxe', floor: 2, status: 'AVAILABLE' },
    { id: '9', number: '301', type: 'Suite', floor: 3, status: 'OCCUPIED', booking: { id: '4', roomNumber: '301', roomType: 'Suite', guestName: 'Phạm Thị D', checkIn: '2024-10-14', checkOut: '2024-10-17', status: 'CONFIRMED' } },
    { id: '10', number: '302', type: 'Suite', floor: 3, status: 'AVAILABLE' },
  ]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days = []
    
    // Previous month days
    for (let i = 0; i < startingDay; i++) {
      const prevDate = new Date(year, month, -startingDay + i + 1)
      days.push({ date: prevDate, isCurrentMonth: false })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    // Next month days to fill grid
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }

    return days
  }

  const days = getDaysInMonth(currentDate)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-700 border-green-200'
      case 'OCCUPIED': return 'bg-red-100 text-red-700 border-red-200'
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'CLEANING': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-gray-100'
    }
  }

  const getBookingStatusBadge = (status: string) => {
    switch (status) {
      case 'CHECKED_IN': return <Badge variant="success">Đã nhận</Badge>
      case 'CONFIRMED': return <Badge variant="primary">Đã xác nhận</Badge>
      case 'PENDING': return <Badge variant="warning">Chờ</Badge>
      case 'CHECKED_OUT': return <Badge variant="gray">Đã trả</Badge>
      default: return null
    }
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const today = new Date()
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString()
  }

  const stats = {
    available: rooms.filter(r => r.status === 'AVAILABLE').length,
    occupied: rooms.filter(r => r.status === 'OCCUPIED').length,
    cleaning: rooms.filter(r => r.status === 'CLEANING').length,
    maintenance: rooms.filter(r => r.status === 'MAINTENANCE').length,
  }

  return (
    <PageContainer>
      <Header
        title="Lịch Phòng"
        description={`${rooms.length} phòng • ${currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Phòng trống</p>
              <p className="text-2xl font-bold text-green-700">{stats.available}</p>
            </div>
            <Bed className="w-8 h-8 text-green-600" />
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Đang sử dụng</p>
              <p className="text-2xl font-bold text-red-700">{stats.occupied}</p>
            </div>
            <Users className="w-8 h-8 text-red-600" />
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Đang dọn</p>
              <p className="text-2xl font-bold text-blue-700">{stats.cleaning}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Bảo trì</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.maintenance}</p>
            </div>
            <Edit className="w-8 h-8 text-yellow-600" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => (
                  <div
                    key={index}
                    className={`min-h-[80px] p-2 rounded-lg border ${
                      day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                    } ${isToday(day.date) ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    } ${isToday(day.date) ? 'text-primary' : ''}`}>
                      {day.date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {rooms.slice(0, 2).map((room) => (
                        <div
                          key={room.id}
                          className={`text-xs px-1 py-0.5 rounded truncate ${getStatusColor(room.status)}`}
                        >
                          {room.number}
                        </div>
                      ))}
                      {rooms.length > 2 && (
                        <div className="text-xs text-gray-400">+{rooms.length - 2}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Room List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách phòng</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2 max-h-[600px] overflow-y-auto p-4">
                {[1, 2, 3].map((floor) => (
                  <div key={floor}>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Tầng {floor}</p>
                    <div className="space-y-1 mb-4">
                      {rooms.filter(r => r.floor === floor).map((room) => (
                        <div
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                            getStatusColor(room.status)
                          } ${selectedRoom?.id === room.id ? 'ring-2 ring-primary' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">Phòng {room.number}</p>
                              <p className="text-xs opacity-75">{room.type}</p>
                            </div>
                            {room.booking && getBookingStatusBadge(room.booking.status)}
                          </div>
                          {room.booking && (
                            <p className="text-xs mt-1 opacity-75">
                              {room.booking.guestName}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Room Detail Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRoom(null)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold">Phòng {selectedRoom.number}</h2>
              <p className="text-gray-500">{selectedRoom.type} - Tầng {selectedRoom.floor}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Trạng thái:</span>
                <Badge variant={selectedRoom.status === 'AVAILABLE' ? 'success' : selectedRoom.status === 'OCCUPIED' ? 'danger' : 'warning'}>
                  {selectedRoom.status === 'AVAILABLE' && 'Trống'}
                  {selectedRoom.status === 'OCCUPIED' && 'Có khách'}
                  {selectedRoom.status === 'CLEANING' && 'Đang dọn'}
                  {selectedRoom.status === 'MAINTENANCE' && 'Bảo trì'}
                </Badge>
              </div>
              {selectedRoom.booking ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Khách:</p>
                    <p className="font-medium">{selectedRoom.booking.guestName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Trạng thái đặt:</p>
                    {getBookingStatusBadge(selectedRoom.booking.status)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Nhận phòng:</p>
                    <p className="font-medium">{selectedRoom.booking.checkIn}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Trả phòng:</p>
                    <p className="font-medium">{selectedRoom.booking.checkOut}</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">Phòng trống</p>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedRoom(null)}>
                Đóng
              </Button>
              <Button>Chi tiết đặt phòng</Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
