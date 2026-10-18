'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'
import {
  Wallet, DollarSign, CreditCard, Banknote, Calendar,
  Printer, Download, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

interface DailyTransaction {
  id: string
  type: 'IN' | 'OUT'
  category: string
  description: string
  amount: number
  paymentMethod: string
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
  label: string
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
  CASH: 'text-green-600',
  BANK_TRANSFER: 'text-blue-600',
  QR_VIETQR: 'text-purple-600',
  CARD: 'text-blue-600',
  CREDIT_CARD: 'text-blue-600',
  E_WALLET: 'text-purple-600',
}

export default function DailyReportPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id

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
        toast.error(json.error || 'Không thể tải sổ quỹ')
        setSummary(null)
        setTransactions([])
        setMethodBreakdown([])
      }
    } catch (err) {
      console.error('Fetch daily report error:', err)
      toast.error('Đã xảy ra lỗi khi tải sổ quỹ')
      setSummary(null)
      setTransactions([])
      setMethodBreakdown([])
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount)

  if (!propertyId) {
    return (
      <PageContainer>
        <Header title="Sổ Quỹ" description="Theo dõi thu chi hàng ngày" />
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Không xác định được cơ sở.</p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Sổ Quỹ"
        description={formatDate(selectedDate)}
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
              In sổ quỹ
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Xuất Excel
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Tiền vào</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {summary ? formatCurrency(summary.totalIn) : '0 đ'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Tiền ra</p>
                <p className="text-2xl font-bold text-red-700 mt-1">
                  {summary ? formatCurrency(summary.totalOut) : '0 đ'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Số dư</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">
                  {summary ? formatCurrency(summary.balance) : '0 đ'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Đặt phòng hôm nay</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {summary?.bookings || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {summary?.checkIns || 0} check-in • {summary?.checkOuts || 0} check-out
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-gray-600" />
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
            Giao dịch trong ngày
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Chưa có giao dịch nào trong ngày này.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Giờ</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
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
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }
                      >
                        {tx.type === 'IN' ? 'Tiền vào' : 'Tiền ra'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-sm text-gray-500">{tx.category}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {tx.paymentMethod === 'Tiền mặt' && <Banknote className="w-4 h-4 text-gray-400" />}
                        {tx.paymentMethod === 'Chuyển khoản' && <CreditCard className="w-4 h-4 text-gray-400" />}
                        {tx.paymentMethod === 'QR VietQR' && <DollarSign className="w-4 h-4 text-gray-400" />}
                        {tx.paymentMethod}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        tx.type === 'IN' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.type === 'IN' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
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
            const color = METHOD_COLORS[m.method] ?? 'text-gray-600'
            return (
              <Card key={m.method}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${color}`} />
                    {m.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${color}`}>{formatCurrency(m.amount)}</p>
                  <p className="text-sm text-gray-500">{m.count} giao dịch</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
