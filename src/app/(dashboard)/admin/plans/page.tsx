'use client'

import * as React from 'react'
import {
  AlertTriangle,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  Edit3,
  ExternalLink,
  Globe,
  HardDrive,
  Headphones,
  HelpCircle,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Button, Input, Modal, ModalBody, ModalFooter, toast } from '@/components/ui'
import { formatVnd } from '@/lib/bookings/display'
import type { FullPlatformPlan } from '@/lib/plans/dynamic-plans'

const EMPTY_PLAN: FullPlatformPlan = {
  id: '',
  name: '',
  description: '',
  price: 299_000,
  priceYearly: 2_990_000,
  trialDays: 14,
  properties: 2,
  rooms: 30,
  maxRoomTypes: 10,
  staff: 5,
  maxMonthlyBookings: -1,
  transactionFeePercent: 0,
  hasCustomDomain: true,
  allowRemoveDigistayBranding: false,
  hasMultiLanguage: true,
  maxCustomPages: 10,
  allowCustomTrackingCode: true,
  monthlyAiContentQuota: 50,
  hasChatbotAi: true,
  monthlyChatbotMessages: 500,
  hasAiSmartPricing: true,
  hasOtaIcalSync: true,
  maxIcalFeeds: 10,
  hasDirectApiChannels: false,
  hasPayOsOnlineDeposit: true,
  hasCashbookReports: true,
  hasAdvancedAnalytics: true,
  allowDataExport: true,
  invoices: 50,
  maxStorageMb: 2048,
  maxImageUploadSizeMb: 15,
  supportPriority: 'PRIORITY',
  hasDedicatedOnboarding: false,
  isPublic: true,
  isActive: true,
  isFeatured: false,
  displayOrder: 10,
}

export default function AdminPlansPage() {
  const [plans, setPlans] = React.useState<FullPlatformPlan[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'public' | 'custom' | 'inactive'>('all')
  const [searchQuery, setSearchQuery] = React.useState('')

  // Modal states
  const [modalOpen, setModalOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [activeModalTab, setActiveModalTab] = React.useState<'general' | 'limits' | 'website_ai' | 'finance_sla'>('general')
  const [formData, setFormData] = React.useState<FullPlatformPlan>(EMPTY_PLAN)
  const [saving, setSaving] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const loadPlans = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/plans', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (json?.success && Array.isArray(json.data)) {
        setPlans(json.data)
      } else {
        setError(json?.error || 'Không tải được danh sách gói cước')
      }
    } catch {
      setError('Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadPlans()
  }, [loadPlans])

  // Open Create Modal
  const handleOpenCreate = (isPrivate = false) => {
    setIsCreating(true)
    setFormData({
      ...EMPTY_PLAN,
      id: isPrivate ? 'vip-' : '',
      name: isPrivate ? 'Gói Khách VIP ' : '',
      isPublic: !isPrivate,
      isFeatured: false,
      displayOrder: plans.length + 1,
    })
    setActiveModalTab('general')
    setModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (plan: FullPlatformPlan) => {
    setIsCreating(false)
    setFormData({ ...plan })
    setActiveModalTab('general')
    setModalOpen(true)
  }

  // Save (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const method = isCreating ? 'POST' : 'PUT'
      const res = await fetch('/api/admin/plans', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Không thể lưu gói cước')
        return
      }

      toast.success(isCreating ? `Đã tạo gói ${formData.name} thành công!` : `Đã cập nhật gói ${formData.name}!`)
      setModalOpen(false)
      await loadPlans()
    } catch {
      toast.error('Lỗi kết nối máy chủ khi lưu gói')
    } finally {
      setSaving(false)
    }
  }

  // Toggle active status
  const handleToggleActive = async (plan: FullPlatformPlan) => {
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, isActive: !plan.isActive }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Không thể đổi trạng thái gói')
        return
      }
      toast.success(`Đã ${!plan.isActive ? 'kích hoạt' : 'tạm dừng'} gói ${plan.name}`)
      await loadPlans()
    } catch {
      toast.error('Lỗi kết nối')
    }
  }

  // Delete plan
  const handleDeletePlan = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa gói "${name}" (${id})? Hành động này không thể hoàn tác.`)) {
      return
    }

    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/plans/${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Không thể xóa gói cước')
        return
      }
      toast.success(`Đã xóa gói "${name}" thành công!`)
      await loadPlans()
    } catch {
      toast.error('Lỗi kết nối khi xóa gói')
    } finally {
      setDeletingId(null)
    }
  }

  // Filtered plans
  const filteredPlans = React.useMemo(() => {
    return plans.filter((p) => {
      if (activeFilter === 'public' && !p.isPublic) return false
      if (activeFilter === 'custom' && p.isPublic) return false
      if (activeFilter === 'inactive' && p.isActive) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      }
      return true
    })
  }, [plans, activeFilter, searchQuery])

  // Count metrics
  const stats = React.useMemo(() => {
    return {
      total: plans.length,
      publicCount: plans.filter((p) => p.isPublic).length,
      customCount: plans.filter((p) => !p.isPublic).length,
      activeCount: plans.filter((p) => p.isActive).length,
    }
  }, [plans])

  const isCorePlan = (id: string) => ['starter', 'growth', 'business'].includes(id)

  const handleCopyPlanLink = (planId: string, planName: string) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/billing/checkout?plan=${planId}`
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
      toast.success(`Đã sao chép liên kết thanh toán riêng cho "${planName}"`)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              Quản lý Bảng giá & Gói cước Digistay
            </h1>
            <span className="rounded-full bg-acc/10 px-2.5 py-0.5 text-xs font-semibold text-acc border border-acc/20">
              V2.0 Dynamic Engine
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            Thiết lập gói cước linh hoạt, tạo gói tùy chỉnh (Custom / VIP) riêng cho chuỗi khách sạn và kiểm soát chi tiết 8 nhóm hạn mức tính năng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadPlans()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenCreate(true)}
            className="gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
          >
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            Tạo gói VIP riêng
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenCreate(false)}
            className="gap-1.5 bg-acc text-acc-fg hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Tạo gói cước mới
          </Button>
        </div>
      </div>

      {/* 2. Stats Bar */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-panel p-4 shadow-xs">
          <p className="text-xs font-medium text-muted">Tổng số gói</p>
          <p className="mt-1 text-2xl font-bold text-fg">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-xs">
          <p className="text-xs font-medium text-muted">Gói công khai (Bảng giá)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.publicCount}</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-xs">
          <p className="text-xs font-medium text-muted">Gói riêng VIP / Custom</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.customCount}</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 shadow-xs">
          <p className="text-xs font-medium text-muted">Đang mở bán</p>
          <p className="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-400">{stats.activeCount}</p>
        </div>
      </div>

      {/* 3. Search & Tabs */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel p-1 text-xs">
          {[
            { id: 'all', label: `Tất cả (${stats.total})` },
            { id: 'public', label: `Công khai (${stats.publicCount})` },
            { id: 'custom', label: `Gói VIP / Custom (${stats.customCount})` },
            { id: 'inactive', label: `Đã dừng (${stats.total - stats.activeCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeFilter === tab.id
                  ? 'bg-acc text-acc-fg font-semibold shadow-xs'
                  : 'text-muted hover:text-fg hover:bg-fg/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã gói..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-ctl border border-line bg-panel pl-9 pr-3 py-1.5 text-xs text-fg placeholder:text-muted focus:outline-none focus:border-acc"
          />
        </div>
      </div>

      {/* 4. Plans Grid */}
      {loading ? (
        <div className="mt-12 flex flex-col items-center justify-center gap-3 text-muted">
          <RefreshCw className="h-6 w-6 animate-spin text-acc" />
          <p className="text-xs">Đang tải danh sách gói cước...</p>
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={() => loadPlans()}>Thử lại</Button>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-line bg-panel/50 p-12 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-muted" />
          <h3 className="mt-3 text-sm font-semibold text-fg">Không tìm thấy gói cước nào</h3>
          <p className="mt-1 text-xs text-muted">Không có gói nào khớp với bộ lọc hiện tại của bạn.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border bg-panel transition-all shadow-xs hover:shadow-md relative overflow-hidden ${
                plan.isFeatured ? 'border-acc ring-1 ring-acc' : 'border-line'
              } ${!plan.isActive ? 'opacity-70 bg-fg/[0.01]' : ''}`}
            >
              {/* Badges bar */}
              <div className="flex items-center justify-between px-5 pt-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-fg/10 px-2 py-0.5 text-[11px] font-mono font-medium text-fg">
                    {plan.id}
                  </span>
                  {!plan.isPublic && (
                    <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 border border-amber-500/20">
                      <Crown className="h-3 w-3" /> Gói riêng VIP
                    </span>
                  )}
                  {plan.isFeatured && (
                    <span className="flex items-center gap-1 rounded-md bg-acc/10 px-2 py-0.5 text-[11px] font-semibold text-acc border border-acc/20">
                      <Sparkles className="h-3 w-3" /> Nổi bật
                    </span>
                  )}
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    plan.isActive
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-muted/20 text-muted'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${plan.isActive ? 'bg-emerald-500' : 'bg-muted'}`} />
                  {plan.isActive ? 'Mở bán' : 'Tạm dừng'}
                </span>
              </div>

              {/* Title & Price */}
              <div className="px-5 pt-3 pb-4 border-b border-line">
                <h3 className="text-lg font-bold text-fg tracking-tight">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted line-clamp-2 min-h-[32px]">
                  {plan.description || 'Chưa có mô tả chi tiết cho gói cước này.'}
                </p>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-fg">{formatVnd(plan.price)}</span>
                  <span className="text-xs text-muted font-medium">/ tháng</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted">
                  Thanh toán năm: <strong className="text-fg">{formatVnd(plan.priceYearly)}</strong> / năm (tiết kiệm 2 tháng)
                </div>
              </div>

              {/* 8 Limits Highlights */}
              <div className="flex-1 p-5 space-y-4 text-xs">
                {/* 1. Scale Limits */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">Quy mô tài nguyên</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-fg">
                      <Building2 className="h-3.5 w-3.5 text-muted shrink-0" />
                      <span>{plan.properties === -1 ? 'Vô hạn' : plan.properties} cơ sở</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-fg">
                      <Layers className="h-3.5 w-3.5 text-muted shrink-0" />
                      <span>{plan.rooms === -1 ? 'Vô hạn' : plan.rooms} phòng</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-fg">
                      <Users className="h-3.5 w-3.5 text-muted shrink-0" />
                      <span>{plan.staff === -1 ? 'Vô hạn' : plan.staff} nhân sự</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-fg">
                      <Calendar className="h-3.5 w-3.5 text-muted shrink-0" />
                      <span>{plan.maxMonthlyBookings === -1 ? 'Vô hạn' : plan.maxMonthlyBookings} đơn/tháng</span>
                    </div>
                  </div>
                </div>

                {/* 2. Feature Flags Matrix */}
                <div className="space-y-2 border-t border-line/60 pt-3">
                  <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">Tính năng nổi bật</p>
                  <ul className="space-y-1.5 text-[11px]">
                    <li className="flex items-center justify-between">
                      <span className="text-muted flex items-center gap-1.5">
                        <Globe className="h-3 w-3" /> Tên miền riêng
                      </span>
                      {plan.hasCustomDomain ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500 font-bold" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted/50" />
                      )}
                    </li>

                    <li className="flex items-center justify-between">
                      <span className="text-muted flex items-center gap-1.5">
                        <Bot className="h-3 w-3" /> AI Chatbot tư vấn 24/7
                      </span>
                      {plan.hasChatbotAi ? (
                        <span className="font-medium text-fg">{plan.monthlyChatbotMessages === -1 ? 'Vô hạn' : `${plan.monthlyChatbotMessages} tin`}</span>
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted/50" />
                      )}
                    </li>

                    <li className="flex items-center justify-between">
                      <span className="text-muted flex items-center gap-1.5">
                        <Zap className="h-3 w-3" /> AI Smart Pricing
                      </span>
                      {plan.hasAiSmartPricing ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500 font-bold" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted/50" />
                      )}
                    </li>

                    <li className="flex items-center justify-between">
                      <span className="text-muted flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Đồng bộ OTA iCal
                      </span>
                      {plan.hasOtaIcalSync ? (
                        <span className="font-medium text-fg">{plan.maxIcalFeeds === -1 ? 'Vô hạn' : `${plan.maxIcalFeeds} feeds`}</span>
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted/50" />
                      )}
                    </li>

                    <li className="flex items-center justify-between">
                      <span className="text-muted flex items-center gap-1.5">
                        <ShieldCheck className="h-3 w-3" /> Gỡ nhãn Digistay (White-label)
                      </span>
                      {plan.allowRemoveDigistayBranding ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500 font-bold" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted/50" />
                      )}
                    </li>

                    <li className="flex items-center justify-between">
                      <span className="text-muted flex items-center gap-1.5">
                        <HardDrive className="h-3 w-3" /> Lưu trữ & SLA
                      </span>
                      <span className="font-medium text-fg">
                        {plan.maxStorageMb >= 1024 ? `${(plan.maxStorageMb / 1024).toFixed(0)} GB` : `${plan.maxStorageMb} MB`} • {plan.supportPriority}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="flex items-center justify-between border-t border-line bg-fg/[0.02] p-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleActive(plan)}
                  className="text-xs"
                >
                  {plan.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyPlanLink(plan.id, plan.name)}
                    className="gap-1 text-xs text-muted hover:text-fg px-2"
                    title="Sao chép link thanh toán trực tiếp"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Link</span>
                  </Button>

                  {!isCorePlan(plan.id) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletePlan(plan.id, plan.name)}
                      disabled={deletingId === plan.id}
                      className="text-rose-600 hover:bg-rose-500/10 p-1.5"
                      title="Xóa gói"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => handleOpenEdit(plan)}
                    className="gap-1.5 text-xs bg-acc text-acc-fg hover:opacity-90"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Cấu hình
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Comprehensive Create / Edit Modal (4 Tabs for 8 Groups) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={isCreating ? (formData.isPublic ? 'Tạo gói cước mới' : 'Tạo gói tùy chỉnh / VIP riêng') : `Cấu hình gói: ${formData.name}`}
        description="Quản lý chi tiết giá bán, chu kỳ thanh toán và đầy đủ 8 nhóm hạn mức tài nguyên."
        size="xl"
      >
        <form onSubmit={handleSave}>
          <ModalBody className="space-y-5">
            {/* Tab navigation */}
            <div className="flex items-center gap-1 border-b border-line pb-2 text-xs overflow-x-auto">
              {[
                { id: 'general', label: '1. Cơ bản & Giá bán' },
                { id: 'limits', label: '2. Quy mô & Đặt phòng' },
                { id: 'website_ai', label: '3. Website & AI' },
                { id: 'finance_sla', label: '4. Kênh bán, Tài chính & SLA' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveModalTab(tab.id as any)}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                    activeModalTab === tab.id
                      ? 'bg-acc text-acc-fg font-semibold shadow-xs'
                      : 'text-muted hover:text-fg hover:bg-fg/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: General & Pricing */}
            {activeModalTab === 'general' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-fg">Mã định danh gói (Slug ID) *</label>
                    <input
                      type="text"
                      required
                      disabled={!isCreating}
                      placeholder="vd: starter, vip-phuquoc"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().trim() })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg disabled:opacity-60"
                    />
                    <p className="mt-1 text-[10px] text-muted">Chỉ gồm chữ thường, số và gạch ngang (không thể đổi sau khi tạo).</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg">Tên hiển thị gói *</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: Gói VIP Chuỗi Khách Sạn"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg">Mô tả gói</label>
                  <textarea
                    rows={2}
                    placeholder="Mô tả đối tượng khách hàng phù hợp hoặc quyền lợi nổi bật..."
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold text-fg">Giá theo tháng (VNĐ) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={1000}
                      value={formData.price}
                      onChange={(e) => {
                        const p = parseInt(e.target.value, 10) || 0
                        setFormData({ ...formData, price: p, priceYearly: p * 10 })
                      }}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                    <p className="mt-1 text-[11px] font-medium text-emerald-600">{formatVnd(formData.price)}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg">Giá theo năm (VNĐ) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={1000}
                      value={formData.priceYearly}
                      onChange={(e) => setFormData({ ...formData, priceYearly: parseInt(e.target.value, 10) || 0 })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                    <p className="mt-1 text-[11px] font-medium text-emerald-600">{formatVnd(formData.priceYearly)}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg">Số ngày dùng thử (Trial)</label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={formData.trialDays}
                      onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value, 10) || 0 })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                  </div>
                </div>

                {/* Visibility toggles */}
                <div className="rounded-xl border border-line bg-fg/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-fg">Gói công khai trên Bảng giá (/pricing)</p>
                      <p className="text-[10px] text-muted">Nếu tắt, đây sẽ là Gói riêng (Private / Custom) chỉ Super Admin mới gán được cho khách VIP.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="h-4 w-4 rounded text-acc focus:ring-acc"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5">
                    <div>
                      <p className="text-xs font-semibold text-fg">Gắn huy hiệu Nổi bật / Khuyên dùng</p>
                      <p className="text-[10px] text-muted">Hiển thị viền nổi bật thu hút khách hàng đăng ký.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="h-4 w-4 rounded text-acc focus:ring-acc"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5">
                    <div>
                      <p className="text-xs font-semibold text-fg">Trạng thái mở bán</p>
                      <p className="text-[10px] text-muted">Bật để khách hàng có thể mua hoặc gia hạn gói này.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 rounded text-acc focus:ring-acc"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Scale & Booking Limits */}
            {activeModalTab === 'limits' && (
              <div className="space-y-4">
                <div className="rounded-lg bg-acc/10 p-3 text-[11px] text-acc border border-acc/20">
                  💡 Nhập <strong>-1</strong> nếu muốn thiết lập <strong>Không giới hạn (Unlimited)</strong> cho hạn mức đó.
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-fg">Số cơ sở tối đa (Properties)</label>
                    <input
                      type="number"
                      required
                      min={-1}
                      value={formData.properties}
                      onChange={(e) => setFormData({ ...formData, properties: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                    <p className="mt-1 text-[10px] text-muted">-1 là vô hạn cơ sở</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg">Số phòng vật lý tối đa toàn workspace</label>
                    <input
                      type="number"
                      required
                      min={-1}
                      value={formData.rooms}
                      onChange={(e) => setFormData({ ...formData, rooms: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                    <p className="mt-1 text-[10px] text-muted">-1 là vô hạn phòng</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg">Số hạng phòng tối đa mỗi cơ sở</label>
                    <input
                      type="number"
                      required
                      min={-1}
                      value={formData.maxRoomTypes}
                      onChange={(e) => setFormData({ ...formData, maxRoomTypes: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg">Số tài khoản nhân viên (Staff accounts)</label>
                    <input
                      type="number"
                      required
                      min={-1}
                      value={formData.staff}
                      onChange={(e) => setFormData({ ...formData, staff: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-line pt-4">
                  <div>
                    <label className="text-xs font-semibold text-fg">Số đơn đặt phòng tối đa mỗi tháng</label>
                    <input
                      type="number"
                      required
                      min={-1}
                      value={formData.maxMonthlyBookings}
                      onChange={(e) => setFormData({ ...formData, maxMonthlyBookings: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                    <p className="mt-1 text-[10px] text-muted">-1 là vô hạn đơn</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg">% Phí hoa hồng giao dịch nền tảng</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      step={0.1}
                      value={formData.transactionFeePercent}
                      onChange={(e) => setFormData({ ...formData, transactionFeePercent: parseFloat(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                    />
                    <p className="mt-1 text-[10px] text-muted">Mặc định 0% (không thu hoa hồng)</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Website & AI */}
            {activeModalTab === 'website_ai' && (
              <div className="space-y-4">
                {/* Website & Branding */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-fg uppercase tracking-wider text-muted">Website & Nhận diện thương hiệu</h4>
                  
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border border-line p-3 cursor-pointer hover:bg-fg/5">
                      <input
                        type="checkbox"
                        checked={formData.hasCustomDomain}
                        onChange={(e) => setFormData({ ...formData, hasCustomDomain: e.target.checked })}
                        className="h-4 w-4 rounded text-acc focus:ring-acc"
                      />
                      <span className="text-xs text-fg font-medium">Gắn tên miền riêng (.vn, .com)</span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-line p-3 cursor-pointer hover:bg-fg/5">
                      <input
                        type="checkbox"
                        checked={formData.allowRemoveDigistayBranding}
                        onChange={(e) => setFormData({ ...formData, allowRemoveDigistayBranding: e.target.checked })}
                        className="h-4 w-4 rounded text-acc focus:ring-acc"
                      />
                      <span className="text-xs text-fg font-medium">Gỡ nhãn Powered by Digistay (White-label)</span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-line p-3 cursor-pointer hover:bg-fg/5">
                      <input
                        type="checkbox"
                        checked={formData.hasMultiLanguage}
                        onChange={(e) => setFormData({ ...formData, hasMultiLanguage: e.target.checked })}
                        className="h-4 w-4 rounded text-acc focus:ring-acc"
                      />
                      <span className="text-xs text-fg font-medium">Website đa ngôn ngữ (Việt - Anh)</span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-line p-3 cursor-pointer hover:bg-fg/5">
                      <input
                        type="checkbox"
                        checked={formData.allowCustomTrackingCode}
                        onChange={(e) => setFormData({ ...formData, allowCustomTrackingCode: e.target.checked })}
                        className="h-4 w-4 rounded text-acc focus:ring-acc"
                      />
                      <span className="text-xs text-fg font-medium">Chèn mã tiếp thị (GA4, FB Pixel, GTM)</span>
                    </label>
                  </div>
                </div>

                {/* AI Limits */}
                <div className="space-y-3 border-t border-line pt-4">
                  <h4 className="text-xs font-bold text-fg uppercase tracking-wider text-muted">Trí tuệ Nhân tạo (Gemini AI)</h4>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-fg">Quota bài viết / nội dung AI mỗi tháng</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.monthlyAiContentQuota}
                        onChange={(e) => setFormData({ ...formData, monthlyAiContentQuota: parseInt(e.target.value, 10) || 0 })}
                        className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-fg">Số tin nhắn AI Chatbot tư vấn mỗi tháng</label>
                      <input
                        type="number"
                        min={-1}
                        value={formData.monthlyChatbotMessages}
                        onChange={(e) => setFormData({ ...formData, monthlyChatbotMessages: parseInt(e.target.value, 10) || 0 })}
                        className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                      />
                      <p className="mt-1 text-[10px] text-muted">-1 là không giới hạn tin</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                    <label className="flex items-center gap-2 rounded-lg border border-line p-3 cursor-pointer hover:bg-fg/5">
                      <input
                        type="checkbox"
                        checked={formData.hasChatbotAi}
                        onChange={(e) => setFormData({ ...formData, hasChatbotAi: e.target.checked })}
                        className="h-4 w-4 rounded text-acc focus:ring-acc"
                      />
                      <span className="text-xs text-fg font-medium">Bật Trợ lý ảo AI Chatbot 24/7</span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-line p-3 cursor-pointer hover:bg-fg/5">
                      <input
                        type="checkbox"
                        checked={formData.hasAiSmartPricing}
                        onChange={(e) => setFormData({ ...formData, hasAiSmartPricing: e.target.checked })}
                        className="h-4 w-4 rounded text-acc focus:ring-acc"
                      />
                      <span className="text-xs text-fg font-medium">Bật Gợi ý Định giá thông minh AI</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Channels, Finance & SLA */}
            {activeModalTab === 'finance_sla' && (
              <div className="space-y-4">
                {/* OTA & Channels */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-fg uppercase tracking-wider text-muted">Kênh bán phòng & OTA</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-fg">Số luồng đồng bộ iCal (.ics) tối đa</label>
                      <input
                        type="number"
                        min={-1}
                        value={formData.maxIcalFeeds}
                        onChange={(e) => setFormData({ ...formData, maxIcalFeeds: parseInt(e.target.value, 10) || 0 })}
                        className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                      />
                      <p className="mt-1 text-[10px] text-muted">-1 là không giới hạn</p>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.hasDirectApiChannels}
                          onChange={(e) => setFormData({ ...formData, hasDirectApiChannels: e.target.checked })}
                          className="h-4 w-4 rounded text-acc focus:ring-acc"
                        />
                        <span className="text-xs text-fg font-medium">Mở khóa kết nối 2 chiều API trực tiếp (Agoda, Booking.com)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Finance & Storage */}
                <div className="space-y-3 border-t border-line pt-4">
                  <h4 className="text-xs font-bold text-fg uppercase tracking-wider text-muted">Tài chính, Dung lượng & Hỗ trợ SLA</h4>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-fg">Dung lượng lưu trữ ảnh (MB)</label>
                      <input
                        type="number"
                        min={100}
                        value={formData.maxStorageMb}
                        onChange={(e) => setFormData({ ...formData, maxStorageMb: parseInt(e.target.value, 10) || 1024 })}
                        className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                      />
                      <p className="mt-1 text-[10px] text-muted">1024 MB = 1 GB</p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-fg">File ảnh tải lên tối đa (MB)</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={formData.maxImageUploadSizeMb}
                        onChange={(e) => setFormData({ ...formData, maxImageUploadSizeMb: parseInt(e.target.value, 10) || 10 })}
                        className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-fg">Mức độ hỗ trợ SLA</label>
                      <select
                        value={formData.supportPriority}
                        onChange={(e) => setFormData({ ...formData, supportPriority: e.target.value as any })}
                        className="mt-1 w-full rounded-ctl border border-line bg-page px-3 py-2 text-xs text-fg"
                      >
                        <option value="STANDARD">STANDARD (Email 24h)</option>
                        <option value="PRIORITY">PRIORITY (Zalo / Hotline 2h)</option>
                        <option value="DEDICATED">DEDICATED (CSKH 1-1 riêng)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                    <label className="flex items-center gap-2 rounded-lg border border-line p-3 cursor-pointer hover:bg-fg/5">
                      <input
                        type="checkbox"
                        checked={formData.hasAdvancedAnalytics}
                        onChange={(e) => setFormData({ ...formData, hasAdvancedAnalytics: e.target.checked })}
                        className="h-4 w-4 rounded text-acc focus:ring-acc"
                      />
                      <span className="text-xs text-fg font-medium">Báo cáo tài chính & Công suất chuyên sâu</span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-line p-3 cursor-pointer hover:bg-fg/5">
                      <input
                        type="checkbox"
                        checked={formData.hasDedicatedOnboarding}
                        onChange={(e) => setFormData({ ...formData, hasDedicatedOnboarding: e.target.checked })}
                        className="h-4 w-4 rounded text-acc focus:ring-acc"
                      />
                      <span className="text-xs text-fg font-medium">Dịch vụ Onboarding & Nhập phòng 1-1</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-acc text-acc-fg hover:opacity-90 gap-1.5"
            >
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isCreating ? 'Tạo gói cước' : 'Lưu thay đổi'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}
