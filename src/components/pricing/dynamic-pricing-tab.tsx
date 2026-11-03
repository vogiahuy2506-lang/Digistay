'use client'

import * as React from 'react'
import { Card, CardContent, Button, Badge } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Calendar,
  RefreshCw,
  Info,
  DollarSign,
  Clock,
  Layers,
} from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

interface RoomTypeMini {
  id: string
  name: string
  slug: string
  bedType: string
}

interface DynamicPricingItem {
  id: string
  propertyId: string
  roomTypeId: string
  targetDate: string
  currentPrice: number
  suggestedPrice: number
  percentageChange: number
  reasoningVi: string
  reasoningEn: string | null
  status: 'PENDING' | 'APPLIED' | 'DISMISSED'
  appliedAt: string | null
  roomType: RoomTypeMini
}

interface DynamicPricingMetrics {
  total: number
  pendingCount: number
  appliedCount: number
  avgChange: number
}

interface DynamicPricingTabProps {
  propertyId: string
  propertyCurrency?: string
}

export function DynamicPricingTab({ propertyId, propertyCurrency = 'VND' }: DynamicPricingTabProps) {
  const [loading, setLoading] = React.useState(true)
  const [generating, setGenerating] = React.useState(false)
  const [actingId, setActingId] = React.useState<string | null>(null)
  const [suggestions, setSuggestions] = React.useState<DynamicPricingItem[]>([])
  const [metrics, setMetrics] = React.useState<DynamicPricingMetrics>({
    total: 0,
    pendingCount: 0,
    appliedCount: 0,
    avgChange: 0,
  })
  const [filterStatus, setFilterStatus] = React.useState<'ALL' | 'PENDING' | 'APPLIED' | 'DISMISSED'>('PENDING')

  const fetchSuggestions = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/pricing/ai-suggestions?status=${filterStatus}`)
      const data = await res.json()
      if (data.success) {
        setSuggestions(data.data.suggestions || [])
        setMetrics(data.data.metrics || { total: 0, pendingCount: 0, appliedCount: 0, avgChange: 0 })
      } else {
        toast.error('Lỗi', data.error)
      }
    } catch {
      toast.error('Lỗi', 'Không thể kết nối đến máy chủ')
    } finally {
      setLoading(false)
    }
  }, [propertyId, filterStatus])

  React.useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/pricing/ai-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysAhead: 30 }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(
          'Phân tích thành công',
          data.message || 'Đã cập nhật các đề xuất định giá mới'
        )
        fetchSuggestions()
      } else {
        toast.error('Lỗi', data.error)
      }
    } catch {
      toast.error('Lỗi', 'Không thể tạo gợi ý định giá')
    } finally {
      setGenerating(false)
    }
  }

  const handleAction = async (suggestionId: string, action: 'apply' | 'dismiss') => {
    setActingId(suggestionId)
    try {
      const res = await fetch(`/api/properties/${propertyId}/pricing/ai-suggestions/${suggestionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(
          action === 'apply' ? 'Đã áp dụng giá' : 'Đã bỏ qua gợi ý',
          data.message
        )
        fetchSuggestions()
      } else {
        toast.error('Lỗi', data.error)
      }
    } catch {
      toast.error('Lỗi', 'Không thể cập nhật gợi ý')
    } finally {
      setActingId(null)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' ' + propertyCurrency
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Định giá phòng linh hoạt bằng AI (Dynamic Pricing)</h3>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                Gemini 3.1 Flash-Lite
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Tự động phân tích tỷ lệ lấp đầy phòng 30 ngày tới, lịch lễ Tết quốc gia và cuối tuần để đề xuất mức giá tối ưu doanh thu (RevPAR).
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 shadow-sm shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Đang phân tích...' : 'Phân tích & Quét gợi ý mới'}
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng số đề xuất</p>
              <p className="text-2xl font-bold">{metrics.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-amber-600 font-medium">Chờ duyệt</p>
              <p className="text-2xl font-bold text-amber-700">{metrics.pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-emerald-600 font-medium">Đã áp dụng</p>
              <p className="text-2xl font-bold text-emerald-700">{metrics.appliedCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mức tăng bình quân</p>
              <p className="text-2xl font-bold text-blue-600">
                {metrics.avgChange > 0 ? `+${metrics.avgChange}%` : `${metrics.avgChange}%`}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          {(['PENDING', 'ALL', 'APPLIED', 'DISMISSED'] as const).map((status) => {
            const labels = {
              PENDING: 'Đang chờ duyệt',
              ALL: 'Tất cả',
              APPLIED: 'Đã áp dụng',
              DISMISSED: 'Đã bỏ qua',
            }
            const isActive = filterStatus === status
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {labels[status]}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Hiển thị {suggestions.length} đề xuất
        </p>
      </div>

      {/* Suggestion List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mb-2" />
          <p className="text-sm">Đang tải danh sách đề xuất giá...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h4 className="font-semibold text-base">Chưa có đề xuất định giá nào trong bộ lọc này</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Bấm &ldquo;Phân tích &amp; Quét gợi ý mới&rdquo; để AI phân tích phòng trống và đề xuất điều chỉnh giá theo nhu cầu.
          </p>
          <Button onClick={handleGenerate} disabled={generating} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            Phân tích ngay
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {suggestions.map((item) => {
            const isSurge = item.percentageChange > 0
            const dateObj = new Date(item.targetDate)
            const dateFormatted = format(dateObj, 'EEEE, dd/MM/yyyy', { locale: vi })
            const isActing = actingId === item.id

            return (
              <Card
                key={item.id}
                className={`p-4 transition-all hover:shadow-md ${
                  item.status === 'APPLIED'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : item.status === 'DISMISSED'
                    ? 'opacity-60 bg-muted/30'
                    : 'border-border'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Left Column: Date and Room */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold capitalize">
                        <Calendar className="h-4 w-4 text-primary" />
                        {dateFormatted}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {item.roomType.name}
                      </Badge>
                      {item.status === 'APPLIED' && (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          ✓ Đã áp dụng
                        </Badge>
                      )}
                      {item.status === 'DISMISSED' && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Đã bỏ qua
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {item.reasoningVi}
                    </p>
                  </div>

                  {/* Middle Column: Price Delta */}
                  <div className="flex items-center gap-4 shrink-0 bg-muted/40 px-3.5 py-2 rounded-lg border">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground line-through">
                        {formatPrice(item.currentPrice)}
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        {formatPrice(item.suggestedPrice)}
                      </p>
                    </div>

                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isSurge
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {isSurge ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {isSurge ? `+${item.percentageChange}%` : `${item.percentageChange}%`}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  {item.status === 'PENDING' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="primary"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
                        onClick={() => handleAction(item.id, 'apply')}
                        disabled={isActing}
                      >
                        <Check className="h-4 w-4" />
                        Áp dụng ngay
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleAction(item.id, 'dismiss')}
                        disabled={isActing}
                      >
                        <X className="h-4 w-4" />
                        Bỏ qua
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
