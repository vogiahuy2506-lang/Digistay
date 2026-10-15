'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Building2, 
  Bed,
  BookOpen, 
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  BarChart3,
  Users,
  Globe,
  Settings,
  TrendingUp,
  Clock,
  Plus,
  BedDouble,
  DollarSign,
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
  Bell,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
} from 'lucide-react'

// Navigation items for sidebar
const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Cơ sở', href: '/properties', icon: Building2 },
  { name: 'Hạng Phòng', href: '/properties/room-types', icon: Bed },
  { name: 'Đặt Phòng', href: '/bookings', icon: BookOpen },
  { name: 'Lịch Phòng', href: '/calendar', icon: Calendar },
  { name: 'Walk-in', href: '/bookings/new', icon: ClipboardList },
  { name: 'Thanh Toán', href: '/payments', icon: CreditCard },
  { name: 'Hóa Đơn', href: '/invoices', icon: FileText },
  { name: 'Báo Cáo', href: '/reports', icon: BarChart3 },
  { name: 'Thành Viên', href: '/members', icon: Users },
  { name: 'Website', href: '/website', icon: Globe },
  { name: 'Cài Đặt', href: '/settings', icon: Settings },
]

// Sample KPI data
const kpiStats = [
  {
    title: 'Phòng trống hôm nay',
    value: '12',
    sub: 'trên 16 phòng',
    icon: BedDouble,
    trend: '+2 so với tuần trước',
    trendUp: true,
    color: 'blue',
  },
  {
    title: 'Check-in hôm nay',
    value: '4',
    sub: '3 khách quốc tế',
    icon: Calendar,
    trend: '+1 so với hôm qua',
    trendUp: true,
    color: 'green',
  },
  {
    title: 'Check-out hôm nay',
    value: '3',
    sub: 'Doanh thu dự kiến 8.5M',
    icon: Clock,
    trend: '2 phòng cần dọn',
    trendUp: false,
    color: 'orange',
  },
  {
    title: 'Đặt phòng tuần này',
    value: '18',
    sub: 'Tỷ lệ lấp đầy 78%',
    icon: BookOpen,
    trend: '6 đơn chờ xác nhận',
    trendUp: true,
    color: 'purple',
  },
]

const colorMap: Record<string, { bg: string; icon: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
  green: { bg: 'bg-green-50', icon: 'text-green-600' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
}

const recentBookings = [
  {
    id: 'BK-2024-001',
    guest: 'Nguyễn Văn Minh',
    room: 'Deluxe River View',
    checkin: '15/10/2024',
    checkout: '18/10/2024',
    status: 'confirmed',
    amount: '4,350,000',
    avatar: 'NV',
    avatarBg: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'BK-2024-002',
    guest: 'Trần Thị Lan',
    room: 'Garden Villa Heritage',
    checkin: '15/10/2024',
    checkout: '20/10/2024',
    status: 'checked_in',
    amount: '10,750,000',
    avatar: 'TT',
    avatarBg: 'bg-green-100 text-green-600',
  },
  {
    id: 'BK-2024-003',
    guest: 'John Smith',
    room: 'Villa Hồ Bơi Riêng',
    checkin: '16/10/2024',
    checkout: '19/10/2024',
    status: 'pending',
    amount: '12,600,000',
    avatar: 'JS',
    avatarBg: 'bg-orange-100 text-orange-600',
  },
  {
    id: 'BK-2024-004',
    guest: 'Lê Hoàng Nam',
    room: 'Deluxe River View',
    checkin: '17/10/2024',
    checkout: '19/10/2024',
    status: 'pending',
    amount: '2,900,000',
    avatar: 'LH',
    avatarBg: 'bg-purple-100 text-purple-600',
  },
]

const statusMap: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Đã xác nhận', className: 'bg-blue-50 text-blue-600 border-blue-200' },
  checked_in: { label: 'Đã nhận phòng', className: 'bg-green-50 text-green-600 border-green-200' },
  pending: { label: 'Chờ xác nhận', className: 'bg-orange-50 text-orange-600 border-orange-200' },
  checked_out: { label: 'Đã trả phòng', className: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const occupancyData = [
  { date: 'T2', value: 75 },
  { date: 'T3', value: 68 },
  { date: 'T4', value: 72 },
  { date: 'T5', value: 80 },
  { date: 'T6', value: 85 },
  { date: 'T7', value: 92 },
  { date: 'CN', value: 88 },
]

export default function DashboardPage() {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={cn(
          'hidden lg:flex flex-col bg-white border-r border-gray-200 h-screen sticky top-0 transition-all duration-300 shrink-0',
          sidebarCollapsed ? 'w-[72px]' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-16 flex items-center border-b border-gray-100 shrink-0',
          sidebarCollapsed ? 'justify-center px-2' : 'px-4'
        )}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            {!sidebarCollapsed && (
              <div>
                <span className="font-semibold text-gray-900 text-sm">Digistay</span>
                <span className="block text-[10px] text-gray-400 -mt-0.5">Hotel PMS</span>
              </div>
            )}
          </Link>
        </div>

        {/* Workspace Badge */}
        <div className={cn(
          'px-3 py-3 border-b border-gray-100 shrink-0',
          sidebarCollapsed && 'px-2'
        )}>
          <div className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer',
            sidebarCollapsed && 'justify-center px-0'
          )}>
            <div className="w-7 h-7 rounded bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
              A
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">An Nam Hospitality</p>
                <p className="text-[10px] text-gray-500">Quản lý cơ sở</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors group',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    sidebarCollapsed && 'justify-center px-0'
                  )}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Collapse Toggle */}
        <div className="p-2 border-t border-gray-100 shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors w-full',
              sidebarCollapsed && 'justify-center px-0'
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span>Thu gọn</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside 
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-white w-64 h-screen transform transition-transform duration-300 lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <div>
              <span className="font-semibold text-gray-900 text-sm">Digistay</span>
              <span className="block text-[10px] text-gray-400 -mt-0.5">Hotel PMS</span>
            </div>
          </Link>
          <button 
            onClick={() => setMobileSidebarOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-gray-50">
            <div className="w-7 h-7 rounded bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold">
              A
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">An Nam Hospitality</p>
              <p className="text-[10px] text-gray-500">Quản lý cơ sở</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-gray-400">Workspace</span>
              <span className="text-gray-300">›</span>
              <span className="font-medium text-gray-900">Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/bookings/new"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Đặt phòng mới
            </Link>
            <Link 
              href="https://reveriehoian.digistay.vn"
              target="_blank"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>Website</span>
            </Link>
            <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-semibold">
                MP
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">Mai Phương</p>
                <p className="text-[10px] text-gray-500">Quản lý cơ sở</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {/* Page Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Xin chào, Mai Phương 👋</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                The Reverie Hội An Boutique Villa • Thứ 3, 15/10/2024
              </p>
            </div>
          </div>

          {/* KPI Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {kpiStats.map((stat, i) => {
              const colors = colorMap[stat.color]
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('w-10 h-10 rounded-lg', colors.bg, 'flex items-center justify-center')}>
                      <stat.icon className={cn('w-5 h-5', colors.icon)} />
                    </div>
                    {stat.trendUp ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        Tăng
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        Cần lưu ý
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm text-gray-500 mb-1">{stat.title}</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-gray-900">{stat.value}</span>
                    <span className="text-sm text-gray-400 pb-1">{stat.sub}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{stat.trend}</p>
                </div>
              )
            })}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Bookings */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Đặt phòng gần đây</h2>
                  <p className="text-xs text-gray-500 mt-0.5">4 đơn mới trong 24 giờ</p>
                </div>
                <Link href="/bookings" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium">
                  Xem tất cả <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors flex items-center gap-4">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0', booking.avatarBg)}>
                      {booking.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{booking.guest}</p>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0', statusMap[booking.status].className)}>
                          {statusMap[booking.status].label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {booking.room} • {booking.checkin} → {booking.checkout}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{booking.amount}đ</p>
                      <p className="text-[10px] text-gray-400">{booking.id}</p>
                    </div>
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar Stats */}
            <div className="space-y-6">
              {/* Occupancy Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Tỷ lệ lấp đầy tuần này</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Đơn vị: %</p>
                  </div>
                  <span className="text-2xl font-bold text-primary">80%</span>
                </div>
                <div className="flex items-end gap-1.5 h-24">
                  {occupancyData.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-primary/20 hover:bg-primary/30 rounded-sm transition-colors relative group"
                        style={{ height: `${day.value}%`, minHeight: '4px' }}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {day.value}%
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400">{day.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Doanh thu tháng</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-600">Đã thanh toán</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">156,800,000đ</span>
                  </div>
                  <div className="h-px bg-gray-100"></div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="text-sm text-gray-600">Chờ thanh toán</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">42,500,000đ</span>
                  </div>
                  <div className="h-px bg-gray-100"></div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-medium text-gray-700">Tổng cộng</span>
                    <span className="text-base font-bold text-gray-900">199,300,000đ</span>
                  </div>
                </div>
                <Link 
                  href="/reports"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Xem báo cáo chi tiết
                </Link>
              </div>

              {/* Room Status */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Tình trạng phòng hôm nay</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">12</p>
                    <p className="text-xs text-green-600/70">Phòng trống</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">4</p>
                    <p className="text-xs text-blue-600/70">Đang sử dụng</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">2</p>
                    <p className="text-xs text-orange-600/70">Cần dọn phòng</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">0</p>
                    <p className="text-xs text-purple-600/70">Bảo trì</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Tasks */}
          <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Công việc sắp tới</h2>
                <p className="text-xs text-gray-500 mt-0.5">3 việc cần xử lý hôm nay</p>
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" />
                Thêm việc
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Xác nhận đặt phòng của John Smith</p>
                  <p className="text-xs text-gray-500 mt-0.5">Hạn: 14:00 hôm nay</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-medium shrink-0">Khẩn</span>
              </div>
              <div className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Check-in 2 phòng Deluxe River View</p>
                  <p className="text-xs text-gray-500 mt-0.5">Dự kiến đến lúc 15:00</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium shrink-0">Sắp tới</span>
              </div>
              <div className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Gửi email xác nhận cho khách mai</p>
                  <p className="text-xs text-gray-500 mt-0.5">3 booking cần gửi reminder</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-medium shrink-0">Đã xong</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
