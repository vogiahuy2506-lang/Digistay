'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent, Badge, BookingStatusBadge, Button } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'
import { useDashLabels } from '@/lib/i18n/dash'
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
  const t = useTranslations('dash.workspace')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc"></div>
      </div>
    )
  }

  if (!workspace) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-fg">{tc('nav.overview')}</h1>
        <p className="text-muted mt-1">{t('overview.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{t('overview.totalProperties')}</p>
                <p className="text-3xl font-bold text-fg mt-1">{stats?.totalProperties || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-info-soft flex items-center justify-center">
                <Building2 className="w-6 h-6 text-info" />
              </div>
            </div>
            <p className="text-sm text-ok mt-2">
              {t('overview.activeCount', { count: stats?.activeProperties || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{tc('nav.bookings')}</p>
                <p className="text-3xl font-bold text-fg mt-1">{stats?.totalBookings || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-refund-soft flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-refund" />
              </div>
            </div>
            <p className="text-sm text-warn mt-2">
              {t('pendingCount', { count: stats?.pendingBookings || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{t('overview.monthlyRevenue')}</p>
                <p className="text-2xl font-bold text-fg mt-1">
                  {labels.money(stats?.monthlyRevenue || 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-ok-soft flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-ok" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{tc('nav.members')}</p>
                <p className="text-3xl font-bold text-fg mt-1">-</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-warn-soft flex items-center justify-center">
                <Users className="w-6 h-6 text-warn" />
              </div>
            </div>
            <Link
              href={routes.members(workspace.slug)}
              className="text-sm text-acc hover:underline mt-2 inline-block"
            >
              {t('overview.manageMembers')}
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('overview.yourProperties')}</CardTitle>
            <Link href={routes.properties(workspace.slug)}>
              <Button variant="outline" size="sm">
                {t('overview.viewAll')}
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
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-fg/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-acc-soft flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-acc" />
                      </div>
                      <div>
                        <p className="font-medium text-fg">{p.name}</p>
                        <p className="text-sm text-muted">{t('roomTypeCount', { count: p._count?.roomTypes || 0 })}</p>
                      </div>
                    </div>
                    <Badge variant={p.isActive ? 'success' : 'gray'}>
                      {p.isActive ? t('propertyStatus.active') : t('propertyStatus.paused')}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-muted mx-auto mb-3" />
                <p className="text-muted mb-3">{t('overview.noProperties')}</p>
                <Link href={routes.properties(workspace.slug)}>
                  <Button size="sm">{t('createFirstProperty')}</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('overview.recentBookings')}</CardTitle>
            <Button variant="outline" size="sm">
              {t('overview.viewAll')}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentBookings.length > 0 ? (
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-fg/[0.03] transition-colors"
                  >
                    <div>
                      <p className="font-medium text-fg">{booking.customerName}</p>
                      <p className="text-sm text-muted">
                        {booking.property?.name} • {booking.bookingCode}
                      </p>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-muted mx-auto mb-3" />
                <p className="text-muted">{t('overview.noBookings')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('overview.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href={routes.properties(workspace.slug)}>
              <div className="p-4 rounded-lg border hover:border-acc hover:bg-acc-soft transition-colors cursor-pointer text-center">
                <Building2 className="w-8 h-8 text-acc mx-auto mb-2" />
                <p className="font-medium text-fg">{t('overview.manageProperties')}</p>
              </div>
            </Link>
            <Link href={routes.members(workspace.slug)}>
              <div className="p-4 rounded-lg border hover:border-acc hover:bg-acc-soft transition-colors cursor-pointer text-center">
                <Users className="w-8 h-8 text-acc mx-auto mb-2" />
                <p className="font-medium text-fg">{tc('nav.members')}</p>
              </div>
            </Link>
            <Link href={routes.properties(workspace.slug)}>
              <div className="p-4 rounded-lg border hover:border-acc hover:bg-acc-soft transition-colors cursor-pointer text-center">
                <Bed className="w-8 h-8 text-acc mx-auto mb-2" />
                <p className="font-medium text-fg">{tc('nav.rooms')}</p>
              </div>
            </Link>
            <Link href={routes.properties(workspace.slug)}>
              <div className="p-4 rounded-lg border hover:border-acc hover:bg-acc-soft transition-colors cursor-pointer text-center">
                <Calendar className="w-8 h-8 text-acc mx-auto mb-2" />
                <p className="font-medium text-fg">{tc('nav.calendar')}</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
