'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Select, Input } from '@/components/ui'
import { useTranslations } from 'next-intl'
import { routes } from '@/lib/utils/routes'
import { useDashLabels } from '@/lib/i18n/dash'
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
  const t = useTranslations('dash.reports.revenue')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  // The API's days are "YYYY-MM-DD" (UTC midnight): shown in Vietnam time, as dd/mm/yyyy.
  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(labels.locale === 'en' ? 'en-GB' : 'vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(date))

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
          title={t('title')}
          description={t('noPropertyDescription')}
        />
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingUp className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted mb-4">{t('selectProperty')}</p>
            <Button onClick={() => router.push(routes.properties(params.slug))}>
              {t('chooseProperty')}
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title={t('title')}
        description={t('description')}
        actions={
          <div className="flex items-center gap-4">
            <Select
              options={[7, 30, 90].map((count) => ({ value: String(count), label: t('range', { count }) }))}
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-[140px]"
            />
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              {tc('actions.export')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc"></div>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted">{t('totalRevenue')}</p>
                    <p className="text-2xl font-bold text-fg mt-1">
                      {labels.money(report.summary.totalRevenue)}
                    </p>
                    <p className="text-sm text-ok mt-1 flex items-center">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      {t('lastDays', { count: Number(dateRange) })}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-ok-soft flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-ok" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted">{t('bookings')}</p>
                    <p className="text-2xl font-bold text-fg mt-1">
                      {report.summary.totalBookings}
                    </p>
                    <p className="text-sm text-muted mt-1">
                      {t('average', { amount: labels.money(report.summary.averageBookingValue) })}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-info-soft flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted">{t('rooms')}</p>
                    <p className="text-2xl font-bold text-fg mt-1">
                      {report.summary.totalRooms}
                    </p>
                    <p className="text-sm text-muted mt-1">
                      {t('occupancy', { percent: report.summary.occupancyRate })}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-refund-soft flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-refund" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted">{t('dailyAverage')}</p>
                    <p className="text-2xl font-bold text-fg mt-1">
                      {labels.money(report.summary.totalRevenue / parseInt(dateRange))}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-warn-soft flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-warn" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>{t('chart')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {report.daily.slice(-14).map((day, index) => {
                  const maxRevenue = Math.max(...report.daily.map(d => d.revenue), 1)
                  const height = (day.revenue / maxRevenue) * 100
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-ink rounded-t transition-all hover:bg-ink"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={labels.money(day.revenue)}
                      />
                      <span className="text-xs text-muted">
                        {dayLabel(day.date)}
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
                  {t('byMethod')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{labels.paymentMethod('BANK_TRANSFER')}</span>
                      <span className="font-medium">{labels.money(report.summary.bankRevenue)}</span>
                    </div>
                    <div className="h-2 bg-fg/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-info rounded-full"
                        style={{ width: `${(report.summary.bankRevenue / report.summary.totalRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{t('qr')}</span>
                      <span className="font-medium">{labels.money(report.summary.qrRevenue)}</span>
                    </div>
                    <div className="h-2 bg-fg/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-ok rounded-full"
                        style={{ width: `${(report.summary.qrRevenue / report.summary.totalRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{t('card')}</span>
                      <span className="font-medium">{labels.money(report.summary.cardRevenue)}</span>
                    </div>
                    <div className="h-2 bg-fg/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-refund rounded-full"
                        style={{ width: `${(report.summary.cardRevenue / report.summary.totalRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{labels.paymentMethod('CASH')}</span>
                      <span className="font-medium">{labels.money(report.summary.cashRevenue)}</span>
                    </div>
                    <div className="h-2 bg-fg/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-warn rounded-full"
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
                <CardTitle>{t('daily')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {report.daily.slice().reverse().slice(0, 10).map((day) => (
                    <div key={day.date} className="flex items-center justify-between p-3 bg-fg/[0.03] rounded-lg">
                      <div>
                        <p className="font-medium">{dayLabel(day.date)}</p>
                        <p className="text-sm text-muted">{t('dayBookings', { count: day.bookings })}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-ok">{labels.money(day.revenue)}</p>
                        {day.checkedIn > 0 && (
                          <p className="text-sm text-muted">{t('dayCheckedIn', { count: day.checkedIn })}</p>
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
            <p className="text-muted">{t('empty')}</p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
