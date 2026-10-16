'use client'

import * as React from 'react'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Select } from '@/components/ui'
import { 
  Wallet, DollarSign, CreditCard, Banknote, TrendingUp, Calendar,
  Printer, Download, Filter, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

interface DailyTransaction {
  id: string
  type: 'IN' | 'OUT'
  category: string
  description: string
  amount: number
  paymentMethod: string
  createdAt: string
  createdBy: string
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

export default function DailyReportPage() {
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0])
  const [selectedProperty, setSelectedProperty] = React.useState('')
  const [summary, setSummary] = React.useState<DailySummary | null>(null)
  const [transactions, setTransactions] = React.useState<DailyTransaction[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (selectedProperty) {
      fetchDailyData()
    }
  }, [selectedDate, selectedProperty])

  const fetchDailyData = async () => {
    setIsLoading(true)
    try {
      // Mock data for demo
      setSummary({
        date: selectedDate,
        totalIn: 4500000,
        totalOut: 500000,
        balance: 4000000,
        bookings: 5,
        checkIns: 3,
        checkOuts: 2,
      })
      setTransactions([
        {
          id: '1',
          type: 'IN',
          category: 'Đặt phòng',
          description: 'Phòng 101 - Khách Nguyễn Văn A',
          amount: 850000,
          paymentMethod: 'Chuyển khoản',
          createdAt: '08:30',
          createdBy: 'Lễ tân 1',
        },
        {
          id: '2',
          type: 'IN',
          category: 'Đặt phòng',
          description: 'Phòng 201 - Khách Trần Thị B',
          amount: 1200000,
          paymentMethod: 'Tiền mặt',
          createdAt: '09:15',
          createdBy: 'Lễ tân 2',
        },
        {
          id: '3',
          type: 'IN',
          category: 'Thanh toán',
          description: 'Thanh toán còn lại - Phòng 301',
          amount: 500000,
          paymentMethod: 'QR VietQR',
          createdAt: '10:00',
          createdBy: 'Lễ tân 1',
        },
        {
          id: '4',
          type: 'OUT',
          category: 'Chi phí',
          description: 'Mua vật tư, dụng cụ',
          amount: 200000,
          paymentMethod: 'Tiền mặt',
          createdAt: '11:30',
          createdBy: 'Admin',
        },
        {
          id: '5',
          type: 'OUT',
          category: 'Chi phí',
          description: 'Thanh toán hóa đơn điện nước',
          amount: 300000,
          paymentMethod: 'Chuyển khoản',
          createdAt: '14:00',
          createdBy: 'Admin',
        },
        {
          id: '6',
          type: 'IN',
          category: 'Dịch vụ',
          description: 'Dịch vụ giặt ủi - Phòng 101',
          amount: 150000,
          paymentMethod: 'Tiền mặt',
          createdAt: '15:30',
          createdBy: 'Lễ tân 2',
        },
      ])
    } catch (err) {
      console.error('Failed to fetch daily data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (!selectedProperty) {
    return (
      <PageContainer>
        <Header
          title="Sổ Quay"
          description="Theo dõi thu chi hàng ngày"
        />
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Vui lòng chọn cơ sở để xem sổ quỹ</p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Sổ Quay"
        description={`Ngày ${new Date(selectedDate).toLocaleDateString('vi-VN')}`}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Giờ</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Thanh toán</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Người tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono">{tx.createdAt}</TableCell>
                  <TableCell>
                    <Badge className={tx.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
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
                  <TableCell className={`text-right font-semibold ${tx.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'IN' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell className="text-gray-500">{tx.createdBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary by Payment Method */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-600" />
              Tiền mặt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(1450000)}
            </p>
            <p className="text-sm text-gray-500">2 giao dịch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Chuyển khoản
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(1050000)}
            </p>
            <p className="text-sm text-gray-500">2 giao dịch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              QR VietQR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(500000)}
            </p>
            <p className="text-sm text-gray-500">1 giao dịch</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
