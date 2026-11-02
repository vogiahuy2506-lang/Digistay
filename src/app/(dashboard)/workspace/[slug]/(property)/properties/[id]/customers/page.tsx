'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Header, PageContainer } from '@/components/layout'
import { useCan } from '@/components/layout/workspace-context'
import { Badge, Button, Input, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { formatVnd } from '@/lib/bookings/display'
import {
  Users,
  Search,
  Sparkles,
  Mail,
  Phone,
  RefreshCw,
  Crown,
  CalendarCheck,
  CreditCard,
  Pencil,
  Tag,
  ChevronRight,
  ExternalLink,
  History,
  FileText,
  X,
  Plus,
} from 'lucide-react'

interface Customer {
  id: string
  propertyId: string
  name: string
  phone: string
  email: string
  notes: string | null
  tags: string[]
  totalStays: number
  totalSpent: number
  lastStayAt: string | null
  createdAt: string
  updatedAt: string
}

interface BookingHistoryItem {
  id: string
  bookingCode: string
  status: string
  paymentStatus: string
  totalAmount: number
  depositAmount: number
  checkInDate: string
  checkOutDate: string
  createdAt: string
  roomNames: string
  roomNumbers: string
}

interface Summary {
  totalCustomers: number
  vipCount: number
  totalStays: number
  totalRevenue: number
}

const PRESET_TAGS = ['VIP', 'Khách quen', 'Gia đình', 'Doanh nhân', 'Khách đoàn', 'Cần chăm sóc']

export default function CustomersPage() {
  const t = useTranslations('dash.customers')
  const tc = useTranslations('dash.common')
  const { slug, id: propertyId } = useParams<{ slug: string; id: string }>()
  const canEdit = useCan('bookings_edit')

  const [customers, setCustomers] = React.useState<Customer[] | null>(null)
  const [summary, setSummary] = React.useState<Summary>({
    totalCustomers: 0,
    vipCount: 0,
    totalStays: 0,
    totalRevenue: 0,
  })
  const [loading, setLoading] = React.useState(true)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [selectedTag, setSelectedTag] = React.useState<string>('all')
  const [sortBy, setSortBy] = React.useState<string>('lastStayAt')
  const [page, setPage] = React.useState(1)
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 })
  const [syncing, setSyncing] = React.useState(false)

  // Detail Modal
  const [activeCustomerId, setActiveCustomerId] = React.useState<string | null>(null)
  const [detailCustomer, setDetailCustomer] = React.useState<Customer | null>(null)
  const [detailBookings, setDetailBookings] = React.useState<BookingHistoryItem[]>([])
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [editNotes, setEditNotes] = React.useState('')
  const [editTags, setEditTags] = React.useState<string[]>([])
  const [newTagInput, setNewTagInput] = React.useState('')
  const [savingDetail, setSavingDetail] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = React.useCallback(async () => {
    if (!propertyId) return
    try {
      setLoadFailed(false)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      params.set('sortBy', sortBy)
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (selectedTag !== 'all') params.set('tag', selectedTag)

      const res = await fetch(`/api/properties/${propertyId}/customers?${params.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        setCustomers(json.data)
        setPagination(json.pagination)
        if (json.summary) setSummary(json.summary)
      } else {
        setLoadFailed(true)
        toast.error(json.error || 'Lỗi khi tải danh bạ khách hàng')
      }
    } catch {
      setLoadFailed(true)
      toast.error('Lỗi khi tải danh bạ khách hàng')
    } finally {
      setLoading(false)
    }
  }, [propertyId, page, debouncedQuery, selectedTag, sortBy])

  React.useEffect(() => {
    load()
  }, [load])

  const handleSync = async () => {
    if (!propertyId || syncing) return
    setSyncing(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/customers/sync`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        toast.success(json.message || t('syncSuccess'))
        load()
      } else {
        toast.error(json.error || 'Lỗi khi đồng bộ khách hàng')
      }
    } catch {
      toast.error('Lỗi khi kết nối máy chủ')
    } finally {
      setSyncing(false)
    }
  }

  const openCustomerDetail = async (customerId: string) => {
    setActiveCustomerId(customerId)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/customers/${customerId}`)
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        setDetailCustomer(json.data.customer)
        setDetailBookings(json.data.bookings || [])
        setEditNotes(json.data.customer.notes || '')
        setEditTags(json.data.customer.tags || [])
      } else {
        toast.error(json.error || 'Không thể tải thông tin chi tiết')
        setActiveCustomerId(null)
      }
    } catch {
      toast.error('Lỗi kết nối')
      setActiveCustomerId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSaveDetail = async () => {
    if (!propertyId || !activeCustomerId || savingDetail) return
    setSavingDetail(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/customers/${activeCustomerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: editNotes,
          tags: editTags,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        toast.success(json.message || 'Cập nhật thành công')
        setCustomers((prev) =>
          prev
            ? prev.map((c) => (c.id === activeCustomerId ? { ...c, notes: editNotes, tags: editTags } : c))
            : null
        )
        setActiveCustomerId(null)
      } else {
        toast.error(json.error || 'Lỗi khi lưu thông tin')
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setSavingDetail(false)
    }
  }

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim()
    if (!trimmed || editTags.includes(trimmed)) return
    setEditTags([...editTags, trimmed])
    setNewTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter((t) => t !== tagToRemove))
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('table.never')
    try {
      const d = new Date(dateStr)
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    } catch {
      return dateStr
    }
  }

  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <PageContainer>
      <Header
        title={t('title')}
        description={t('subtitle')}
        actions={
          canEdit ? (
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? t('syncing') : t('sync')}</span>
            </Button>
          ) : undefined
        }
      />

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border border-line bg-card/60 backdrop-blur-sm shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-acc/10 text-acc flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted truncate">{t('metrics.totalCustomers')}</p>
            <p className="text-xl font-bold text-fg">{summary.totalCustomers.toLocaleString('vi-VN')}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-line bg-card/60 backdrop-blur-sm shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted truncate">{t('metrics.vipCustomers')}</p>
            <p className="text-xl font-bold text-fg">{summary.vipCount.toLocaleString('vi-VN')}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-line bg-card/60 backdrop-blur-sm shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted truncate">{t('metrics.totalStays')}</p>
            <p className="text-xl font-bold text-fg">{summary.totalStays.toLocaleString('vi-VN')}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-line bg-card/60 backdrop-blur-sm shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted truncate">{t('metrics.totalRevenue')}</p>
            <p className="text-xl font-bold text-fg truncate">{formatVnd(summary.totalRevenue, 'vi')}</p>
          </div>
        </div>
      </div>

      {/* Search, Filter & Sort */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-card text-fg focus:outline-none focus:ring-2 focus:ring-acc/30 placeholder:text-muted"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            className="px-3 py-2 text-sm rounded-lg border border-line bg-card text-fg focus:outline-none focus:ring-2 focus:ring-acc/30 shrink-0"
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">{t('tags.all')}</option>
            <option value="VIP">{t('tags.vip')}</option>
            <option value="Khách quen">{t('tags.frequent')}</option>
            <option value="Gia đình">{t('tags.family')}</option>
            <option value="Doanh nhân">{t('tags.business')}</option>
            <option value="Khách đoàn">{t('tags.group')}</option>
          </select>

          <select
            className="px-3 py-2 text-sm rounded-lg border border-line bg-card text-fg focus:outline-none focus:ring-2 focus:ring-acc/30 shrink-0"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="lastStayAt">Lần ở gần nhất</option>
            <option value="totalSpent">Chi tiêu cao nhất</option>
            <option value="totalStays">Số lần ở nhiều nhất</option>
            <option value="name">Tên A-Z</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-line bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-subtle/50 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">{t('table.customer')}</th>
                <th className="px-4 py-3.5">{t('table.contact')}</th>
                <th className="px-4 py-3.5">{t('table.tags')}</th>
                <th className="px-4 py-3.5 text-center">{t('table.stays')}</th>
                <th className="px-4 py-3.5 text-right">{t('table.spent')}</th>
                <th className="px-4 py-3.5">{t('table.lastStay')}</th>
                <th className="px-4 py-3.5">{t('table.notes')}</th>
                <th className="px-4 py-3.5 text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                    <span>Đang tải danh bạ khách hàng...</span>
                  </td>
                </tr>
              ) : loadFailed ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    <p className="text-destructive mb-2">Không thể tải dữ liệu danh bạ</p>
                    <Button variant="outline" size="sm" onClick={load}>
                      Thử lại
                    </Button>
                  </td>
                </tr>
              ) : !customers || customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Users className="w-10 h-10 text-muted/40 mx-auto mb-3" />
                    <p className="text-base font-medium text-fg mb-1">{t('table.empty')}</p>
                    <p className="text-xs text-muted max-w-md mx-auto mb-4">{t('table.emptyHint')}</p>
                    {canEdit && (
                      <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                        <span>{t('sync')}</span>
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-bg-subtle/50 transition-colors cursor-pointer group"
                    onClick={() => openCustomerDetail(c.id)}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-acc/10 text-acc font-semibold text-xs flex items-center justify-center shrink-0 border border-acc/20">
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-fg truncate group-hover:text-acc transition-colors">
                            {c.name}
                          </p>
                          <p className="text-xs text-muted">Mã: #{c.id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-fg">
                            <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted truncate max-w-[180px]">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {c.tags && c.tags.length > 0 ? (
                          c.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                tag === 'VIP'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  : tag === 'Khách quen'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-bg-subtle text-muted border border-line'
                              }`}
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted/60">—</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-bg-subtle font-semibold text-xs text-fg">
                        {c.totalStays}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium text-fg">
                      {formatVnd(c.totalSpent, 'vi')}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-muted whitespace-nowrap">
                      {formatDate(c.lastStayAt)}
                    </td>

                    <td className="px-4 py-3.5">
                      {c.notes ? (
                        <p className="text-xs text-muted line-clamp-1 max-w-[180px]" title={c.notes}>
                          {c.notes}
                        </p>
                      ) : (
                        <span className="text-xs text-muted/50 italic">Chưa có ghi chú</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-70 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          openCustomerDetail(c.id)
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-line text-xs text-muted bg-bg-subtle/30">
            <span>
              Trang {pagination.page} / {pagination.totalPages} ({pagination.total} khách hàng)
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Detail & Stay History Modal */}
      {activeCustomerId && (
        <Modal isOpen={true} onClose={() => setActiveCustomerId(null)} size="lg">
          <div className="p-6 max-w-2xl w-full">
            <div className="flex items-start justify-between pb-4 border-b border-line mb-4">
              <div>
                <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                  <span>{detailCustomer?.name || t('detail.title')}</span>
                  {detailCustomer?.tags.includes('VIP') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      <Crown className="w-3 h-3" /> VIP
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {detailCustomer?.phone} {detailCustomer?.email ? `• ${detailCustomer.email}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCustomerId(null)}
                className="text-muted hover:text-fg p-1 rounded-lg hover:bg-bg-subtle transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-muted">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                <span>Đang tải thông tin khách hàng...</span>
              </div>
            ) : detailCustomer ? (
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
                {/* Stats summary */}
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-bg-subtle/60 border border-line text-center">
                  <div>
                    <p className="text-xs text-muted">Số lần lưu trú</p>
                    <p className="text-base font-bold text-fg mt-0.5">{detailCustomer.totalStays} lần</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Tổng chi tiêu</p>
                    <p className="text-base font-bold text-acc mt-0.5">
                      {formatVnd(detailCustomer.totalSpent, 'vi')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Lần ở gần nhất</p>
                    <p className="text-xs font-medium text-fg mt-1">
                      {formatDate(detailCustomer.lastStayAt)}
                    </p>
                  </div>
                </div>

                {/* Tags management */}
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-muted" />
                    <span>{t('detail.editTags')}</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-acc/10 text-acc border border-acc/20"
                      >
                        {tag}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-destructive p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {canEdit && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-line bg-card text-fg focus:outline-none focus:ring-1 focus:ring-acc"
                          placeholder="Nhập tên thẻ phân loại..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddTag(newTagInput)
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddTag(newTagInput)}
                          disabled={!newTagInput.trim()}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Thêm
                        </Button>
                      </div>

                      {/* Quick preset suggestions */}
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[11px] text-muted mr-1">Gợi ý nhanh:</span>
                        {PRESET_TAGS.filter((pt) => !editTags.includes(pt)).map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => handleAddTag(pt)}
                            className="text-[11px] px-2 py-0.5 rounded border border-dashed border-line hover:border-acc hover:text-acc transition-colors text-muted"
                          >
                            + {pt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes / Preferences */}
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted" />
                    <span>{t('detail.editNotes')}</span>
                  </label>
                  {canEdit ? (
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-card text-fg focus:outline-none focus:ring-2 focus:ring-acc/30 placeholder:text-muted"
                      placeholder={t('detail.notesPlaceholder')}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  ) : (
                    <div className="p-3 rounded-lg border border-line bg-bg-subtle text-xs text-muted">
                      {detailCustomer.notes || 'Chưa có ghi chú nội bộ'}
                    </div>
                  )}
                </div>

                {/* Stay History */}
                <div>
                  <h4 className="text-xs font-semibold text-fg mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-muted" />
                    <span>{t('detail.history')} ({detailBookings.length})</span>
                  </h4>

                  {detailBookings.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-line text-center text-xs text-muted">
                      {t('detail.noHistory')}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {detailBookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-lg border border-line bg-card hover:border-acc/40 transition-colors flex items-center justify-between text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-fg">#{b.bookingCode}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  b.status === 'CHECKED_OUT'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : b.status === 'CHECKED_IN'
                                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                      : 'bg-bg-subtle text-muted'
                                }`}
                              >
                                {b.status}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  b.paymentStatus === 'PAID'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : 'bg-amber-500/15 text-amber-600'
                                }`}
                              >
                                {b.paymentStatus}
                              </span>
                            </div>
                            <p className="text-muted truncate">
                              {b.roomNames} {b.roomNumbers ? `(Phòng ${b.roomNumbers})` : ''} •{' '}
                              {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                            </p>
                          </div>

                          <div className="text-right shrink-0 ml-3">
                            <p className="font-semibold text-fg">{formatVnd(b.totalAmount, 'vi')}</p>
                            <Link
                              href={`/workspace/${slug}/properties/${propertyId}/bookings`}
                              className="text-[11px] text-acc hover:underline flex items-center justify-end gap-0.5 mt-0.5"
                            >
                              <span>{t('detail.viewBooking')}</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-line">
              <Button variant="outline" onClick={() => setActiveCustomerId(null)}>
                {t('detail.close')}
              </Button>
              {canEdit && (
                <Button onClick={handleSaveDetail} disabled={savingDetail}>
                  {savingDetail ? t('detail.saving') : t('detail.save')}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  )
}
