'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Select, Input } from '@/components/ui'
import { routes } from '@/lib/utils/routes'
import { formatCurrency, formatDate } from '@/lib/utils'
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Users, 
  CreditCard, Building2, Download
} from 'lucide-react'

interface RevenueReport {
  summary: {
    totalRevenue: number
    totalBookings: number
    averageBookingValue: number
    cashRevenue: number
    bankRevenue: number
    qrRevenue: number
    cardRevenue: number
    totalRooms: number
    occupancyRate: number
  }
  daily: {
    date: string
    revenue: number
    bookings: number
    checkedIn: number
  }[]
}

export default function ReportsPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyIdFromUrl = params.id

  const [report, setReport] = React.useState<RevenueReport | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [propertyId, setPropertyId] = React.useState(propertyIdFromUrl || '')
  const [dateRange, setDateRange] = React.useState('30')

  React.useEffect(() => {
    if (propertyId) {
      fetchReport()
    }
  }, [propertyId, dateRange])

  const fetchReport = async () => {
    setIsLoading(true)
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(dateRange))

      const params = new URLSearchParams({
        propertyId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      const response = await fetch(`/api/reports/revenue?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setReport(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch report:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!propertyId) {
    return (
      <PageContainer>
        <Header
          title="Báo cáo doanh thu"
          description="Xem thống kê và báo cáo tài chính"
        />
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Vui lòng chọn cơ sở để xem báo cáo</p>
            <Button onClick={() => router.push(routes.properties(params.slug))}>
              Chọn cơ sở
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Báo cáo doanh thu"
        description="Thống kê doanh thu và hoạt động kinh doanh"
        actions={
          <div className="flex items-center gap-4">
            <Select
              options={[
                { value: '7', label: '7 ngày' },
                { value: '30', label: '30 ngày' },
                { value: '90', label: '90 ngày' },
              ]}
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-[140px]"
            />
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Xuất Excel
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tổng doanh thu</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {formatCurrency(report.summary.totalRevenue)}
                    </p>
                    <p className="text-sm text-green-600 mt-1 flex items-center">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      {dateRange} ngày qua
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Số đơn đặt phòng</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {report.summary.totalBookings}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      TB: {formatCurrency(report.summary.averageBookingValue)}/đơn
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Số phòng</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {report.summary.totalRooms}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Tỷ lệ lấp đầy: {report.summary.occupancyRate}%
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Doanh thu trung bình/ngày</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {formatCurrency(report.summary.totalRevenue / parseInt(dateRange))}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Biểu đồ doanh thu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {report.daily.slice(-14).map((day, index) => {
                  const maxRevenue = Math.max(...report.daily.map(d => d.revenue), 1)
                  const height = (day.revenue / maxRevenue) * 100
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-primary rounded-t transition-all hover:bg-primary-600"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={formatCurrency(day.revenue)}
                      />
                      <span className="text-xs text-gray-500">
                        {formatDate(day.date, { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Doanh thu theo hình thức thanh toán
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Chuyển khoản</span>
                      <span className="font-medium">{formatCurrency(report.summary.bankRevenue)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(report.summary.bankRevenue / report.summary.totalRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>QR VietQR</span>
                      <span className="font-medium">{formatCurrency(report.summary.qrRevenue)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(report.summary.qrRevenue / report.summary.totalRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Thẻ</span>
                      <span className="font-medium">{formatCurrency(report.summary.cardRevenue)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${(report.summary.cardRevenue / report.summary.totalRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Tiền mặt</span>
                      <span className="font-medium">{formatCurrency(report.summary.cashRevenue)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500 rounded-full"
                        style={{ width: `${(report.summary.cashRevenue / report.summary.totalRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Chi tiết theo ngày</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {report.daily.slice().reverse().slice(0, 10).map((day) => (
                    <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{formatDate(day.date, { day: '2-digit', month: '2-digit' })}</p>
                        <p className="text-sm text-gray-500">{day.bookings} đơn</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{formatCurrency(day.revenue)}</p>
                        {day.checkedIn > 0 && (
                          <p className="text-sm text-gray-500">{day.checkedIn} đã nhận</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Không có dữ liệu báo cáo</p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
