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
import { apiError } from '@/lib/i18n/api-errors'
import { NoAccess, useHasRole } from '@/components/payment/no-access'

interface DailyTransaction {
  id: string
  /** EVENT: a check-in or check-out, no money */
  type: 'IN' | 'OUT' | 'EVENT'
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

/** Today in Vietnam time, yyyy-mm-dd. */
const vnToday = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)

export default function DailyReportPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  const t = useTranslations('dash.reports.cashbook')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  // The API serves the cash book to staff (the menu lists it for the owner and the front desk).
  const allowed = useHasRole(['ADMIN', 'MANAGER', 'RECEPTIONIST'])

  const [selectedDate, setSelectedDate] = React.useState(vnToday)
  const [summary, setSummary] = React.useState<DailySummary | null>(null)
  const [transactions, setTransactions] = React.useState<DailyTransaction[]>([])
  const [methodBreakdown, setMethodBreakdown] = React.useState<MethodBreakdown[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (propertyId && allowed && selectedDate) {
      fetchDailyData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, selectedDate, allowed])

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
        toast.error(apiError(json.error) || t('loadError'))
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

  // The picked day, "Thứ Hai, 26/10/2026" (by hand: Intl differs between Node and browsers).
  const dayTitle = selectedDate ? labels.longDate(`${selectedDate}T12:00:00+07:00`) : ''

  if (!allowed) return <NoAccess title={t('title')} />

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
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label={t('date')}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[170px]"
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

      {/* Summary Cards: two per row on a phone, four from md */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6">
        <SummaryCard tone="ok" label={t('moneyIn')} value={labels.money(summary ? summary.totalIn : 0)} icon={ArrowDownRight} />
        <SummaryCard tone="err" label={t('moneyOut')} value={labels.money(summary ? summary.totalOut : 0)} icon={ArrowUpRight} />
        <SummaryCard tone="info" label={t('balance')} value={labels.money(summary ? summary.balance : 0)} icon={Wallet} />
        <SummaryCard
          label={t('bookingsToday')}
          value={String(summary?.bookings || 0)}
          note={t('checkInsOuts', { checkIns: summary?.checkIns || 0, checkOuts: summary?.checkOuts || 0 })}
          icon={Calendar}
        />
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
            <>
              {/* Phone: one block per movement, nothing pushed off the screen */}
              <ul className="sm:hidden divide-y divide-line">
                {transactions.map((tx) => (
                  <li key={tx.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-small text-muted">{tx.createdAt}</span>
                        <TypeBadge tx={tx} />
                      </div>
                      <p className="font-medium text-fg break-words">{tx.description ?? t('paymentNumber', { id: tx.id })}</p>
                      <p className="text-small text-muted">
                        {t(`category.${tx.category}`)}
                        {tx.method && ` · ${labels.paymentMethod(tx.method)}`}
                      </p>
                    </div>
                    <Amount tx={tx} />
                  </li>
                ))}
              </ul>
              <Table className="hidden sm:block">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">{t('columns.time')}</TableHead>
                    <TableHead className="w-32">{t('columns.type')}</TableHead>
                    <TableHead>{t('columns.description')}</TableHead>
                    <TableHead className="w-40">{t('columns.payment')}</TableHead>
                    <TableHead className="text-right w-40">{t('columns.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono">{tx.createdAt}</TableCell>
                      <TableCell>
                        <TypeBadge tx={tx} />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{tx.description ?? t('paymentNumber', { id: tx.id })}</p>
                        <p className="text-sm text-muted">{t(`category.${tx.category}`)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          {tx.method === 'CASH' && <Banknote className="w-4 h-4 text-muted" aria-hidden="true" />}
                          {tx.method === 'BANK_TRANSFER' && <CreditCard className="w-4 h-4 text-muted" aria-hidden="true" />}
                          {tx.method === 'QR_VIETQR' && <DollarSign className="w-4 h-4 text-muted" aria-hidden="true" />}
                          {tx.method ? labels.paymentMethod(tx.method) : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Amount tx={tx} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary by Payment Method — derived from real data */}
      {methodBreakdown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mt-6">
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

const TONES = {
  ok: { card: 'bg-ok-soft border-ok/30', text: 'text-ok' },
  err: { card: 'bg-err-soft border-err/30', text: 'text-err' },
  info: { card: 'bg-info-soft border-info/30', text: 'text-info' },
} as const

function SummaryCard({
  tone,
  label,
  value,
  note,
  icon: Icon,
}: {
  tone?: keyof typeof TONES
  label: string
  value: string
  note?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const text = tone ? TONES[tone].text : 'text-fg'
  return (
    <Card className={tone ? TONES[tone].card : undefined}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-sm font-medium ${tone ? text : 'text-muted'}`}>{label}</p>
            <p className={`text-lg md:text-2xl font-bold mt-1 break-words ${text}`}>{value}</p>
            {note && <p className="text-xs text-muted mt-1">{note}</p>}
          </div>
          <div className="hidden lg:flex w-12 h-12 shrink-0 rounded-full bg-fg/5 items-center justify-center">
            <Icon className={`w-6 h-6 ${tone ? text : 'text-muted'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Money in / money out, or the event (check-in, check-out) for a movement without money. */
function TypeBadge({ tx }: { tx: DailyTransaction }) {
  const t = useTranslations('dash.reports.cashbook')
  if (tx.type === 'EVENT') return <Badge className="bg-fg/5 text-muted whitespace-nowrap">{t(`category.${tx.category}`)}</Badge>
  return (
    <Badge className={`whitespace-nowrap ${tx.type === 'IN' ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'}`}>
      {tx.type === 'IN' ? t('moneyIn') : t('moneyOut')}
    </Badge>
  )
}

function Amount({ tx }: { tx: DailyTransaction }) {
  const labels = useDashLabels()
  if (tx.type === 'EVENT') return <span className="text-muted">—</span>
  return (
    <span className={`font-semibold whitespace-nowrap ${tx.type === 'IN' ? 'text-ok' : 'text-err'}`}>
      {tx.type === 'IN' ? '+' : '-'}
      {labels.money(tx.amount)}
    </span>
  )
}
