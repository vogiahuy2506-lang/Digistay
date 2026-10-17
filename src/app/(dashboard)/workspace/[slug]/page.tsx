'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'
import {
  Building2,
  Users,
  Calendar,
  CreditCard,
  TrendingUp,
  ArrowRight,
  Bed,
  BookOpen,
} from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalProperties: number
  activeProperties: number
  totalBookings: number
  pendingBookings: number
  monthlyRevenue: number
}

interface Property {
  id: string
  name: string
  type: string
  isActive: boolean
  _count: { roomTypes: number }
}

interface Booking {
  id: string
  bookingCode: string
  status: string
  totalAmount: number
  checkInDate: string
  checkOutDate: string
  property: { id: string; name: string }
  customerName: string
}

export default function WorkspaceDashboardPage() {
  const { workspace, loading: wsLoading } = useWorkspace()
  const [stats, setStats] = useState<Stats | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspace?.id) return
    fetchDashboard()
  }, [workspace?.id])

  const fetchDashboard = async () => {
    if (!workspace?.id) return
    setLoading(true)
    try {
      const [propsRes, statsRes, bookingsRes] = await Promise.all([
        fetch(`/api/properties?workspaceId=${workspace.id}`),
        fetch(`/api/workspaces/${workspace.id}/stats`).catch(() => null),
        fetch(`/api/bookings?workspaceId=${workspace.id}&limit=5`).catch(() => null),
      ])

      const propsData = await propsRes.json()
      if (propsData?.success) {
        setProperties(propsData.data || [])
      }

      const statsData = await statsRes?.json()
      if (statsData?.success) {
        setStats(statsData.data)
      }

      const bookingsData = await bookingsRes?.json()
      if (bookingsData?.success) {
        setRecentBookings(bookingsData.data || [])
      }

      // Calculate basic stats from properties if no stats API
      if (!statsData?.success) {
        const props = propsData.data || []
        setStats({
          totalProperties: props.length,
          activeProperties: props.filter((p: Property) => p.isActive).length,
          totalBookings: 0,
          pendingBookings: 0,
          monthlyRevenue: 0,
        })
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (wsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!workspace) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      PENDING: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-700' },
      CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700' },
      CHECKED_IN: { label: 'Đã nhận phòng', color: 'bg-green-100 text-green-700' },
      CHECKED_OUT: { label: 'Đã trả phòng', color: 'bg-gray-100 text-gray-700' },
      CANCELLED: { label: 'Đã hủy', color: 'bg-red-100 text-red-700' },
    }
    return badges[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-gray-500 mt-1">Xem nhanh tình trạng workspace của bạn</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tổng cơ sở</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.totalProperties || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-green-600 mt-2">
              {stats?.activeProperties || 0} đang hoạt động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Đặt phòng</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.totalBookings || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-yellow-600 mt-2">
              {stats?.pendingBookings || 0} chờ xử lý
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Doanh thu tháng</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats?.monthlyRevenue || 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Thành viên</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">-</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <Link
              href={routes.members(workspace.slug)}
              className="text-sm text-primary hover:underline mt-2 inline-block"
            >
              Quản lý thành viên
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Cơ sở của bạn</CardTitle>
            <Link href={routes.properties(workspace.slug)}>
              <Button variant="outline" size="sm">
                Xem tất cả
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {properties.length > 0 ? (
              <div className="space-y-3">
                {properties.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={routes.property(workspace.slug, p.id)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-sm text-gray-500">{p._count?.roomTypes || 0} hạng phòng</p>
                      </div>
                    </div>
                    <Badge variant={p.isActive ? 'success' : 'gray'}>
                      {p.isActive ? 'Hoạt động' : 'Tạm dừng'}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">Chưa có cơ sở nào</p>
                <Link href={routes.properties(workspace.slug)}>
                  <Button size="sm">Tạo cơ sở đầu tiên</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Đặt phòng gần đây</CardTitle>
            <Button variant="outline" size="sm">
              Xem tất cả
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentBookings.length > 0 ? (
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{booking.customerName}</p>
                      <p className="text-sm text-gray-500">
                        {booking.property?.name} • {booking.bookingCode}
                      </p>
                    </div>
                    <Badge className={getStatusBadge(booking.status).color}>
                      {getStatusBadge(booking.status).label}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có đặt phòng nào</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href={routes.properties(workspace.slug)}>
              <div className="p-4 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors cursor-pointer text-center">
                <Building2 className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-medium text-gray-900">Quản lý cơ sở</p>
              </div>
            </Link>
            <Link href={routes.members(workspace.slug)}>
              <div className="p-4 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors cursor-pointer text-center">
                <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-medium text-gray-900">Thành viên</p>
              </div>
            </Link>
            <Link href={routes.properties(workspace.slug)}>
              <div className="p-4 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors cursor-pointer text-center">
                <Bed className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-medium text-gray-900">Hạng phòng</p>
              </div>
            </Link>
            <Link href={routes.properties(workspace.slug)}>
              <div className="p-4 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors cursor-pointer text-center">
                <Calendar className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-medium text-gray-900">Lịch phòng</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
