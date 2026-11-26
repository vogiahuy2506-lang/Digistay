'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import {
  Card,
  Button,
  Input,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'
import { useCan } from '@/components/layout/workspace-context'
import { toast } from '@/components/ui/toast'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Calendar,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-fg/10 rounded-lg ${className || ''}`} />
}

const ICAL_CHANNEL_LABELS: Record<string, string> = {
  AIRBNB: 'Airbnb',
  BOOKING_COM: 'Booking.com',
  AGODA: 'Agoda Homes',
  VRBO: 'Vrbo / Expedia',
  TRAVELOKA: 'Traveloka',
  GOOGLE: 'Google Calendar',
  OTHER: 'Kênh khác',
}

const ICAL_CHANNEL_GUIDES: Record<string, string> = {
  AIRBNB: 'Trên Airbnb: Vào Lịch (Calendar) → Cài đặt khả năng đặt phòng → Đồng bộ lịch (Calendar sync) → Xuất lịch (Export calendar) để lấy link .ics.',
  BOOKING_COM: 'Trên Booking.com: Vào Lịch & Giá (Calendar & Pricing) → Đồng bộ lịch (Sync calendars) → Thêm liên kết lịch → Sao chép link xuất.',
  AGODA: 'Trên Agoda Homes: Vào Danh sách chỗ ở → Lịch → Đồng bộ lịch (Calendar Sync) → Xuất lịch iCal.',
  VRBO: 'Trên Vrbo / Expedia: Vào Lịch (Calendar) → Nhập/Xuất lịch (Import/Export) → Sao chép URL xuất lịch.',
  GOOGLE: 'Trên Google Calendar: Cài đặt lịch → Tích hợp lịch → Địa chỉ bí mật ở định dạng iCal (.ics).',
  TRAVELOKA: 'Lấy đường dẫn lịch .ics xuất từ trang quản trị căn hộ/villa của bạn và dán vào ô bên trên.',
  OTHER: 'Dán đường dẫn lịch .ics từ bất kỳ sàn OTA hoặc ứng dụng lịch nào hỗ trợ chuẩn iCalendar.',
}

export default function OtaChannelsPage() {
  const t = useTranslations('dash.channels')
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  const canEdit = useCan('property_edit')

  const [propertyName, setPropertyName] = React.useState('')
  const [icalFeeds, setIcalFeeds] = React.useState<any[]>([])
  const [roomTypes, setRoomTypes] = React.useState<{ id: string; name: string }[]>([])
  const [isLoadingIcal, setIsLoadingIcal] = React.useState(true)
  const [isIcalModalOpen, setIsIcalModalOpen] = React.useState(false)
  const [editingFeed, setEditingFeed] = React.useState<any | null>(null)
  const [isCreatingIcal, setIsCreatingIcal] = React.useState(false)
  const [isSyncingAllIcal, setIsSyncingAllIcal] = React.useState(false)
  const [syncingFeedId, setSyncingFeedId] = React.useState<string | null>(null)
  const [copiedFeedId, setCopiedFeedId] = React.useState<string | null>(null)

  // iCal Feed Form (Create & Edit)
  const [newFeedRoomTypeId, setNewFeedRoomTypeId] = React.useState('')
  const [newFeedName, setNewFeedName] = React.useState('')
  const [newFeedChannel, setNewFeedChannel] = React.useState<string>('AIRBNB')
  const [newFeedImportUrl, setNewFeedImportUrl] = React.useState('')
  const [newFeedActive, setNewFeedActive] = React.useState(true)

  const fetchIcalFeeds = React.useCallback(async () => {
    try {
      setIsLoadingIcal(true)
      const res = await fetch(`/api/properties/${propertyId}/channels/ical`)
      const json = await res.json()
      if (res.ok && json.success) {
        if (json.data.propertyName) setPropertyName(json.data.propertyName)
        setIcalFeeds(json.data.feeds || [])
        setRoomTypes(json.data.roomTypes || [])
        if (json.data.roomTypes?.length > 0) {
          setNewFeedRoomTypeId((prev) => prev || json.data.roomTypes[0].id)
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingIcal(false)
    }
  }, [propertyId])

  React.useEffect(() => {
    fetchIcalFeeds()
  }, [fetchIcalFeeds])

  const openCreateIcalModal = () => {
    setEditingFeed(null)
    setNewFeedRoomTypeId(roomTypes[0]?.id || '')
    setNewFeedChannel('AIRBNB')
    setNewFeedName('')
    setNewFeedImportUrl('')
    setNewFeedActive(true)
    setIsIcalModalOpen(true)
  }

  const openEditIcalModal = (feed: any) => {
    setEditingFeed(feed)
    setNewFeedRoomTypeId(feed.roomTypeId)
    setNewFeedChannel(feed.channel || 'AIRBNB')
    setNewFeedName(feed.name || '')
    setNewFeedImportUrl(feed.importUrl || '')
    setNewFeedActive(feed.isActive !== false)
    setIsIcalModalOpen(true)
  }

  const handleSaveIcalFeed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFeed && !newFeedRoomTypeId) {
      toast.error('Vui lòng chọn loại phòng')
      return
    }
    if (!newFeedName.trim()) {
      toast.error('Vui lòng nhập tên gợi nhớ cho tài khoản OTA này')
      return
    }

    try {
      setIsCreatingIcal(true)
      const url = editingFeed
        ? `/api/properties/${propertyId}/channels/ical/${editingFeed.id}`
        : `/api/properties/${propertyId}/channels/ical`
      const method = editingFeed ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingFeed
            ? {
                name: newFeedName.trim(),
                channel: newFeedChannel,
                importUrl: newFeedImportUrl.trim(),
                isActive: newFeedActive,
              }
            : {
                roomTypeId: newFeedRoomTypeId,
                name: newFeedName.trim(),
                channel: newFeedChannel,
                importUrl: newFeedImportUrl.trim() || undefined,
              }
        ),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(editingFeed ? 'Đã cập nhật liên kết OTA' : 'Đã thêm tài khoản OTA thành công')
        setIsIcalModalOpen(false)
        setEditingFeed(null)
        setNewFeedName('')
        setNewFeedImportUrl('')
        fetchIcalFeeds()
      } else {
        toast.error(json.error || 'Không thể lưu liên kết iCal')
      }
    } catch {
      toast.error('Không thể lưu liên kết iCal lúc này')
    } finally {
      setIsCreatingIcal(false)
    }
  }

  const handleSyncAllIcal = async () => {
    try {
      setIsSyncingAllIcal(true)
      const res = await fetch(`/api/properties/${propertyId}/channels/ical/sync-all`, {
        method: 'POST',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        const d = json.data
        toast.success(`Đã đồng bộ ${d.synced}/${d.total} tài khoản OTA`)
        fetchIcalFeeds()
      } else {
        toast.error(json.error || 'Không thể đồng bộ tất cả lúc này')
      }
    } catch {
      toast.error('Lỗi kết nối khi đồng bộ')
    } finally {
      setIsSyncingAllIcal(false)
    }
  }

  const handleDeleteIcalFeed = async (feedId: string, feedName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa liên kết "${feedName}"? Các phòng bị khóa tự động từ liên kết này sẽ được giải phóng.`)) {
      return
    }

    try {
      const res = await fetch(`/api/properties/${propertyId}/channels/ical/${feedId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã xóa liên kết iCal')
        fetchIcalFeeds()
      } else {
        toast.error(json.error || 'Không thể xóa liên kết')
      }
    } catch {
      toast.error('Lỗi khi xóa liên kết')
    }
  }

  const handleSyncIcalFeed = async (feedId: string) => {
    try {
      setSyncingFeedId(feedId)
      const res = await fetch(`/api/properties/${propertyId}/channels/ical/${feedId}/sync`, {
        method: 'POST',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(`Đã đồng bộ xong! Khóa tự động ${json.data.eventsCount} kỳ nghỉ từ sàn.`)
        fetchIcalFeeds()
      } else {
        toast.error(json.error || 'Lỗi khi đồng bộ lịch')
      }
    } catch {
      toast.error('Lỗi khi gọi đồng bộ lịch')
    } finally {
      setSyncingFeedId(null)
    }
  }

  return (
    <PageContainer>
      <Header
        title={t('title')}
        description={`Đồng bộ lịch phòng trống 2 chiều với Airbnb, Booking.com, Agoda Homes, Google Calendar... (${propertyName || t('propertyLabel')})`}
      />

      {/* iCalendar 2-Way Calendar Sync (Multi-Account) */}
      <div id="ical-sync-section" className="space-y-4">
        <div className="p-4 rounded-box border border-line bg-panel shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-ctl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-fg flex flex-wrap items-center gap-2">
                <span>Đồng bộ lịch OTA 2 chiều (iCal .ics)</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Hoạt động ngay · Nhiều tài khoản
                </span>
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Gắn 1 hoặc nhiều tài khoản Airbnb, Booking.com, Agoda Homes, Vrbo, Google Calendar... vào từng hạng phòng để tự động khóa ngày có khách, chống trùng phòng 2 chiều.
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              {icalFeeds.some((f) => f.importUrl) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncAllIcal}
                  isLoading={isSyncingAllIcal}
                  className="text-xs border-line bg-panel hover:bg-fg/5 text-fg"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Đồng bộ tất cả
                </Button>
              )}
              <Button
                size="sm"
                onClick={openCreateIcalModal}
                className="text-xs bg-acc text-acc-fg hover:bg-acc/90 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Thêm tài khoản OTA
              </Button>
            </div>
          )}
        </div>

        <Card className="border-line overflow-hidden shadow-xs bg-panel">
          {isLoadingIcal ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : icalFeeds.length === 0 ? (
            <div className="py-12 text-center space-y-3 px-4">
              <div className="w-12 h-12 rounded-full bg-acc/10 text-acc flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-sm font-semibold text-fg">Chưa có tài khoản OTA nào được kết nối</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Bấm nút bên dưới để thêm tài khoản Airbnb, Booking.com, Agoda Homes... Bạn có thể thêm nhiều tài khoản OTA khác nhau cho mỗi hạng phòng.
                </p>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={openCreateIcalModal}
                  className="text-xs bg-acc text-acc-fg hover:bg-acc/90 mt-2"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Thêm tài khoản OTA đầu tiên
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-fg/[0.03] border-b border-line text-muted font-medium">
                  <tr>
                    <th className="py-3 px-4">Tài khoản &amp; Sàn OTA</th>
                    <th className="py-3 px-4">Hạng phòng</th>
                    <th className="py-3 px-4 min-w-[220px]">Link xuất từ Digistay (Dán lên sàn)</th>
                    <th className="py-3 px-4 min-w-[200px]">Link nhận từ sàn (Import URL)</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {icalFeeds.map((feed) => {
                    const exportUrl = typeof window !== 'undefined'
                      ? `${window.location.origin}/api/channels/ical/export/${feed.exportToken}`
                      : `https://digistay.vn/api/channels/ical/export/${feed.exportToken}`
                    const isCopied = copiedFeedId === feed.id
                    const isSyncing = syncingFeedId === feed.id

                    return (
                      <tr key={feed.id} className="hover:bg-fg/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="font-semibold text-fg text-xs block">
                              {feed.name}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-fg/5 text-muted border border-line">
                              {ICAL_CHANNEL_LABELS[feed.channel] || feed.channel}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-fg">
                          {feed.roomType?.name || '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 max-w-[260px]">
                            <Input
                              value={exportUrl}
                              readOnly
                              className="h-7 text-[11px] font-mono bg-fg/[0.03] text-muted border-line truncate cursor-text"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 shrink-0 border-line hover:bg-fg/5 text-fg text-xs"
                              title="Sao chép link dán vào sàn OTA"
                              onClick={() => {
                                navigator.clipboard.writeText(exportUrl)
                                setCopiedFeedId(feed.id)
                                toast.success('Đã sao chép link lịch Digistay')
                                setTimeout(() => setCopiedFeedId(null), 2000)
                              }}
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {feed.importUrl ? (
                            <div className="max-w-[220px] truncate font-mono text-[11px] text-muted" title={feed.importUrl}>
                              {feed.importUrl}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => canEdit && openEditIcalModal(feed)}
                              className="text-[11px] text-acc hover:underline italic"
                            >
                              + Dán link lịch từ sàn
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {!feed.isActive ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-fg/10 text-muted border border-line">
                                Tạm dừng
                              </span>
                            ) : feed.lastError ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" title={feed.lastError}>
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                Lỗi đồng bộ
                              </span>
                            ) : feed.lastSyncedAt ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                Đã khóa {feed.eventsCount} kỳ nghỉ
                              </span>
                            ) : (
                              <span className="text-muted text-[11px]">Chưa đồng bộ</span>
                            )}
                            {feed.lastSyncedAt && (
                              <span className="text-[10px] text-muted block">
                                {new Date(feed.lastSyncedAt).toLocaleString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {feed.importUrl && canEdit && feed.isActive !== false && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border-line hover:bg-fg/5 text-fg"
                                onClick={() => handleSyncIcalFeed(feed.id)}
                                isLoading={isSyncing}
                                title="Đồng bộ ngay từ sàn OTA"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Đồng bộ
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border-line hover:bg-fg/5 text-fg"
                                onClick={() => openEditIcalModal(feed)}
                                title="Chỉnh sửa liên kết"
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                                onClick={() => handleDeleteIcalFeed(feed.id, feed.name)}
                                title="Xóa liên kết"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modal: Thêm / Sửa liên kết iCal */}
      <Modal
        isOpen={isIcalModalOpen}
        onClose={() => {
          setIsIcalModalOpen(false)
          setEditingFeed(null)
        }}
        size="md"
      >
        <form onSubmit={handleSaveIcalFeed}>
          <ModalHeader className="border-b border-line pb-3">
            <div>
              <h3 className="font-semibold text-fg">
                {editingFeed ? 'Chỉnh sửa liên kết tài khoản OTA' : 'Thêm tài khoản / liên kết OTA (iCal)'}
              </h3>
              <p className="text-xs text-muted">
                Mỗi hạng phòng có thể gắn nhiều tài khoản Airbnb, Booking.com, Agoda Homes... cùng lúc.
              </p>
            </div>
          </ModalHeader>
          <ModalBody className="py-4 space-y-4">
            {!editingFeed && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg">Hạng phòng áp dụng *</label>
                <select
                  value={newFeedRoomTypeId}
                  onChange={(e) => setNewFeedRoomTypeId(e.target.value)}
                  className="w-full h-9 rounded-ctl border border-line bg-panel text-fg text-xs px-3 focus:outline-none focus:border-acc"
                  required
                >
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted">
                  Lịch phòng này sẽ tự động khóa ngày khi có đơn từ tài khoản OTA bên dưới.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg">Sàn OTA / Ứng dụng lịch</label>
              <select
                value={newFeedChannel}
                onChange={(e) => setNewFeedChannel(e.target.value)}
                className="w-full h-9 rounded-ctl border border-line bg-panel text-fg text-xs px-3 focus:outline-none focus:border-acc"
              >
                <option value="AIRBNB">Airbnb</option>
                <option value="BOOKING_COM">Booking.com</option>
                <option value="AGODA">Agoda Homes</option>
                <option value="VRBO">Vrbo / Expedia</option>
                <option value="TRAVELOKA">Traveloka</option>
                <option value="GOOGLE">Google Calendar</option>
                <option value="OTHER">Kênh khác (.ics)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg">Tên gợi nhớ tài khoản OTA *</label>
              <Input
                value={newFeedName}
                onChange={(e) => setNewFeedName(e.target.value)}
                placeholder="VD: Airbnb - Tài khoản anh Minh / Booking.com - Villa 01"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg">Link lịch từ sàn OTA (Import URL - Tùy chọn)</label>
              <Input
                value={newFeedImportUrl}
                onChange={(e) => setNewFeedImportUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                className="text-xs font-mono"
              />
              <div className="p-2.5 rounded-ctl bg-fg/[0.03] border border-line text-[11px] text-muted leading-relaxed">
                <strong>Hướng dẫn lấy link:</strong> {ICAL_CHANNEL_GUIDES[newFeedChannel] || ICAL_CHANNEL_GUIDES.OTHER}
              </div>
            </div>

            {editingFeed && (
              <label className="flex items-center gap-2 text-xs text-fg cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newFeedActive}
                  onChange={(e) => setNewFeedActive(e.target.checked)}
                  className="rounded border-line accent-acc"
                />
                <span>Đang bật đồng bộ tự động cho liên kết này</span>
              </label>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsIcalModalOpen(false)
                setEditingFeed(null)
              }}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreatingIcal}
              className="text-xs bg-acc text-acc-fg hover:bg-acc/90"
            >
              {editingFeed ? 'Lưu thay đổi' : 'Tạo liên kết'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </PageContainer>
  )
}
