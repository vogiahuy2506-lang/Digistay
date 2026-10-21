'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'
import {
  Wallet, DollarSign, CreditCard, Banknote, Calendar,
  Printer, Download, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

interface DailyTransaction {
  id: string
  type: 'IN' | 'OUT'
  category: 'PAYMENT' | 'REFUND' | 'CHECK_IN' | 'CHECK_OUT'
  description: string | null
  amount: number
  method: string | null
  createdAt: string
}

interface DailySummary {
  date: string
  totalIn: number
  totalOut: number
  balance: number
  bookings: number
  checkIns: number
  checkOuts: number
}

interface MethodBreakdown {
  method: string
  amount: number
  count: number
}

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  BANK_TRANSFER: CreditCard,
  QR_VIETQR: DollarSign,
  CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  E_WALLET: DollarSign,
}

const METHOD_COLORS: Record<string, string> = {
  CASH: 'text-ok',
  BANK_TRANSFER: 'text-info',
  QR_VIETQR: 'text-refund',
  CARD: 'text-info',
  CREDIT_CARD: 'text-info',
  E_WALLET: 'text-refund',
}

export default function DailyReportPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  const t = useTranslations('dash.reports.cashbook')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()

  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0])
  const [summary, setSummary] = React.useState<DailySummary | null>(null)
  const [transactions, setTransactions] = React.useState<DailyTransaction[]>([])
  const [methodBreakdown, setMethodBreakdown] = React.useState<MethodBreakdown[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (propertyId) {
      fetchDailyData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, selectedDate])

  const fetchDailyData = async () => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams({ propertyId, date: selectedDate })
      const res = await fetch(`/api/reports/daily?${qs.toString()}`)
      const json = await res.json()
      if (json.success) {
        setSummary(json.data.summary)
        setTransactions(json.data.transactions ?? [])
        setMethodBreakdown(json.data.methodBreakdown ?? [])
      } else {
        toast.error(json.error || t('loadError'))
        setSummary(null)
        setTransactions([])
        setMethodBreakdown([])
      }
    } catch (err) {
      console.error('Fetch daily report error:', err)
      toast.error(t('error'))
      setSummary(null)
      setTransactions([])
      setMethodBreakdown([])
    } finally {
      setIsLoading(false)
    }
  }

  // The picked day ("YYYY-MM-DD"), e.g. "21 tháng 10, 2026" / "21 October 2026".
  const dayTitle = new Intl.DateTimeFormat(labels.locale === 'en' ? 'en-GB' : 'vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(selectedDate))

  if (!propertyId) {
    return (
      <PageContainer>
        <Header title={t('title')} description={t('description')} />
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">{t('noProperty')}</p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title={t('title')}
        description={dayTitle}
        actions={
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[180px]"
            />
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              {t('print')}
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              {tc('actions.export')}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="bg-ok-soft border-ok/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ok font-medium">{t('moneyIn')}</p>
                <p className="text-2xl font-bold text-ok mt-1">
                  {labels.money(summary ? summary.totalIn : 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-ok-soft flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-ok" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-err-soft border-err/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-err font-medium">{t('moneyOut')}</p>
                <p className="text-2xl font-bold text-err mt-1">
                  {labels.money(summary ? summary.totalOut : 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-err-soft flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-err" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-info-soft border-info/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-info font-medium">{t('balance')}</p>
                <p className="text-2xl font-bold text-info mt-1">
                  {labels.money(summary ? summary.balance : 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-info-soft flex items-center justify-center">
                <Wallet className="w-6 h-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{t('bookingsToday')}</p>
                <p className="text-2xl font-bold text-fg mt-1">
                  {summary?.bookings || 0}
                </p>
                <p className="text-xs text-muted mt-1">
                  {t('checkInsOuts', { checkIns: summary?.checkIns || 0, checkOuts: summary?.checkOuts || 0 })}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-fg/5 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-muted" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {t('transactions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted py-8">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.time')}</TableHead>
                  <TableHead>{t('columns.type')}</TableHead>
                  <TableHead>{t('columns.description')}</TableHead>
                  <TableHead>{t('columns.payment')}</TableHead>
                  <TableHead className="text-right">{t('columns.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono">{tx.createdAt}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          tx.type === 'IN'
                            ? 'bg-ok-soft text-ok'
                            : 'bg-err-soft text-err'
                        }
                      >
                        {tx.type === 'IN' ? t('moneyIn') : t('moneyOut')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{tx.description ?? t('paymentNumber', { id: tx.id })}</p>
                      <p className="text-sm text-muted">{t(`category.${tx.category}`)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {tx.method === 'CASH' && <Banknote className="w-4 h-4 text-muted" aria-hidden="true" />}
                        {tx.method === 'BANK_TRANSFER' && <CreditCard className="w-4 h-4 text-muted" aria-hidden="true" />}
                        {tx.method === 'QR_VIETQR' && <DollarSign className="w-4 h-4 text-muted" aria-hidden="true" />}
                        {tx.method ? labels.paymentMethod(tx.method) : '—'}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        tx.type === 'IN' ? 'text-ok' : 'text-err'
                      }`}
                    >
                      {tx.type === 'IN' ? '+' : '-'}
                      {labels.money(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary by Payment Method — derived from real data */}
      {methodBreakdown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {methodBreakdown.map((m) => {
            const Icon = METHOD_ICONS[m.method] ?? DollarSign
            const color = METHOD_COLORS[m.method] ?? 'text-muted'
            return (
              <Card key={m.method}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${color}`} />
                    {labels.paymentMethod(m.method)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${color}`}>{labels.money(m.amount)}</p>
                  <p className="text-sm text-muted">{t('count', { count: m.count })}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
