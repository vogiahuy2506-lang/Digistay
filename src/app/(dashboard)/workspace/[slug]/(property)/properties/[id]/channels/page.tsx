'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'
import { useCan } from '@/components/layout/workspace-context'
import { toast } from '@/components/ui/toast'
import {
  Share2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Power,
  ShieldCheck,
  Building2,
  BedDouble,
  Sliders,
  Key,
  Webhook,
  HelpCircle,
  Unplug,
  Percent,
} from 'lucide-react'
import {
  OtaChannel,
  OTA_CHANNELS_META,
  ChannelAccountSummary,
  ChannelAccountDetail,
  ChannelRoomMappingData,
} from '@/lib/ota/types'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ink/10 rounded-lg ${className || ''}`} />
}

export default function OtaChannelsPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  const canEdit = useCan('property_edit')

  const [isLoading, setIsLoading] = React.useState(true)
  const [channels, setChannels] = React.useState<ChannelAccountSummary[]>([])
  const [propertyName, setPropertyName] = React.useState('')

  // Modal State
  const [selectedChannel, setSelectedChannel] = React.useState<OtaChannel | null>(null)
  const [channelDetail, setChannelDetail] = React.useState<ChannelAccountDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'credentials' | 'mapping'>('credentials')
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState(false)
  const [copiedField, setCopiedField] = React.useState<string | null>(null)

  // Form Fields for Selected Channel
  const [hotelId, setHotelId] = React.useState('')
  const [apiKey, setApiKey] = React.useState('')
  const [apiSecret, setApiSecret] = React.useState('')
  const [webhookSecret, setWebhookSecret] = React.useState('')
  const [isActive, setIsActive] = React.useState(false)
  const [rateMultiplierDefault, setRateMultiplierDefault] = React.useState(1.0)
  const [mappings, setMappings] = React.useState<ChannelRoomMappingData[]>([])

  const fetchChannels = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/properties/${propertyId}/channels`)
      const json = await res.json()
      if (res.ok && json.success) {
        setChannels(json.data.channels)
        setPropertyName(json.data.propertyName)
      } else {
        toast.error(json.error || 'Không thể tải danh sách kênh OTA')
      }
    } catch {
      toast.error('Lỗi kết nối khi tải danh sách kênh OTA')
    } finally {
      setIsLoading(false)
    }
  }, [propertyId])

  React.useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const handleOpenChannel = async (channel: OtaChannel) => {
    setSelectedChannel(channel)
    setActiveTab('credentials')
    setIsLoadingDetail(true)

    try {
      const res = await fetch(`/api/properties/${propertyId}/channels/${channel}`)
      const json = await res.json()
      if (res.ok && json.success) {
        const detail: ChannelAccountDetail = json.data.channel
        setChannelDetail(detail)
        setHotelId(detail.hotelIdentifier || '')
        setApiKey('') // Always blank for security (maskedApiKey displayed as placeholder)
        setApiSecret('')
        setWebhookSecret(detail.webhookSecret || '')
        setIsActive(detail.isActive)
        setRateMultiplierDefault(detail.rateMultiplierDefault || 1.0)
        setMappings(detail.mappings || [])
      } else {
        toast.error(json.error || 'Không thể tải chi tiết kênh OTA')
      }
    } catch {
      toast.error('Lỗi khi tải chi tiết kênh OTA')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const handleCloseModal = () => {
    setSelectedChannel(null)
    setChannelDetail(null)
    setIsSaving(false)
    setIsTesting(false)
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`Đã sao chép ${fieldName} vào bộ nhớ tạm!`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleTestConnection = async () => {
    if (!selectedChannel) return
    if (!hotelId.trim()) {
      toast.error('Vui lòng nhập Mã khách sạn (Hotel ID / Property ID) để kiểm tra')
      return
    }

    setIsTesting(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/channels/${selectedChannel}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelIdentifier: hotelId.trim(),
          apiKey: apiKey.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(json.message || 'Kết nối thành công!')
      } else {
        toast.error(json.error || json.message || 'Không thể kết nối đến sàn OTA')
      }
    } catch {
      toast.error('Lỗi mạng khi kiểm tra kết nối với sàn OTA')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!selectedChannel) return
    if (!hotelId.trim()) {
      toast.error('Vui lòng nhập Mã khách sạn (Hotel ID / Property ID)')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        hotelIdentifier: hotelId.trim(),
        apiKey: apiKey.trim() || undefined,
        apiSecret: apiSecret.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        rateMultiplierDefault,
        isActive,
        mappings: mappings.map((m) => ({
          roomTypeId: m.roomTypeId,
          channelRoomId: m.channelRoomId.trim(),
          channelRoomName: m.channelRoomName?.trim() || undefined,
          channelRatePlanId: m.channelRatePlanId?.trim() || undefined,
          rateMultiplier: m.rateMultiplier,
          isSyncEnabled: m.isSyncEnabled,
        })),
      }

      const res = await fetch(`/api/properties/${propertyId}/channels/${selectedChannel}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã lưu cấu hình kênh thành công!')
        handleCloseModal()
        fetchChannels()
      } else {
        toast.error(json.error || 'Không thể lưu cấu hình kênh')
      }
    } catch {
      toast.error('Lỗi mạng khi lưu cấu hình kênh')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!selectedChannel) return
    if (!confirm(`Bạn có chắc chắn muốn ngắt kết nối kênh ${OTA_CHANNELS_META[selectedChannel].name}? Tất cả ánh xạ phòng và tự động đồng bộ sẽ bị tạm dừng.`)) {
      return
    }

    try {
      const res = await fetch(`/api/properties/${propertyId}/channels/${selectedChannel}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(json.message || 'Đã ngắt kết nối kênh')
        handleCloseModal()
        fetchChannels()
      } else {
        toast.error(json.error || 'Không thể ngắt kết nối kênh')
      }
    } catch {
      toast.error('Lỗi mạng khi ngắt kết nối kênh')
    }
  }

  const updateMappingRow = (
    roomTypeId: string,
    field: keyof ChannelRoomMappingData,
    value: string | number | boolean
  ) => {
    setMappings((prev) =>
      prev.map((item) => (item.roomTypeId === roomTypeId ? { ...item, [field]: value } : item))
    )
  }

  return (
    <PageContainer>
      <Header
        title="Kênh bán phòng trực tuyến (OTA Channel Manager)"
        description={`Quản lý kết nối các sàn Agoda, Booking.com, Airbnb, Traveloka, Expedia cho ${propertyName || 'cơ sở'}. Đồng bộ tồn kho và nhận đơn tự động 2 chiều.`}
      />

      {/* Info Architecture Alert */}
      <div className="mb-6 p-4 rounded-xl border border-line bg-panel shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-acc/10 flex items-center justify-center text-acc shrink-0 mt-0.5">
            <Share2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-fg flex items-center gap-2">
              Đồng bộ đa kênh tự động hai chiều (Zero Overbooking)
              <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-xs">
                AES-256-GCM Encrypted
              </Badge>
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              Khi khách đặt phòng trên website riêng, Digistay sẽ lập tức trừ tồn kho trên các sàn OTA.
              Ngược lại, khi có đơn mới từ Agoda hoặc Booking.com, phòng sẽ được tự động khóa trên website riêng để tránh bán trùng.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchChannels}
          isLoading={isLoading}
          className="shrink-0 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Làm mới trạng thái
        </Button>
      </div>

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))
          : channels.map((item) => {
              const meta = OTA_CHANNELS_META[item.channel]
              return (
                <Card
                  key={item.channel}
                  className="flex flex-col justify-between border-line hover:border-acc/40 transition-all duration-200 shadow-xs"
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Channel Top Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-xs"
                          style={{ backgroundColor: meta.accentColor }}
                        >
                          {meta.name.slice(0, 1)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-fg text-sm">{meta.name}</h3>
                          <span className="text-[11px] text-muted">Hoa hồng sàn ~{meta.defaultCommissionRate}%</span>
                        </div>
                      </div>

                      {item.isActive ? (
                        <Badge
                          variant="outline"
                          className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-xs flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Đang kết nối
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted border-line text-xs">
                          Chưa kích hoạt
                        </Badge>
                      )}
                    </div>

                    {/* Short Description */}
                    <p className="text-xs text-muted line-clamp-2 min-h-[32px]">
                      {meta.shortDescription}
                    </p>

                    {/* Metrics / Info */}
                    <div className="p-3 rounded-lg bg-ink/5 border border-line space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Mã khách sạn:</span>
                        <span className="font-mono font-medium text-fg">
                          {item.hotelIdentifier || 'Chưa cấu hình'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Ánh xạ hạng phòng:</span>
                        <span className="font-medium text-fg">
                          {item.mappedRoomsCount}/{item.totalPropertyRoomsCount} phòng
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Lần đồng bộ gần nhất:</span>
                        <span className="text-muted font-medium">
                          {item.lastSyncedAt
                            ? new Date(item.lastSyncedAt).toLocaleString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })
                            : 'Chưa có dữ liệu'}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  {/* Actions Footer */}
                  <div className="p-4 border-t border-line bg-panel/50 flex items-center gap-2">
                    <Button
                      variant={item.isActive ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => handleOpenChannel(item.channel)}
                      className="w-full text-xs"
                      disabled={!canEdit}
                    >
                      <Sliders className="w-3.5 h-3.5 mr-1.5" />
                      {item.isActive ? 'Cấu hình & Ánh xạ phòng' : 'Kết nối kênh này'}
                    </Button>
                    <a
                      href={meta.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg border border-line text-muted hover:text-fg hover:bg-ink/5 transition-colors"
                      title={`Mở trang quản trị ${meta.name}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </Card>
              )
            })}
      </div>

      {/* Detail / Room Mapping Modal */}
      {selectedChannel && (
        <Modal isOpen={Boolean(selectedChannel)} onClose={handleCloseModal} size="xl">
          <ModalHeader className="border-b border-line pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-xs"
                  style={{ backgroundColor: OTA_CHANNELS_META[selectedChannel].accentColor }}
                >
                  {OTA_CHANNELS_META[selectedChannel].name.slice(0, 1)}
                </div>
                <div>
                  <h3 className="font-semibold text-fg flex items-center gap-2">
                    Kết nối kênh {OTA_CHANNELS_META[selectedChannel].name}
                    {isActive ? (
                      <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-xs">
                        Đang kích hoạt
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted border-line text-xs">
                        Tạm dừng
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-muted">
                    {OTA_CHANNELS_META[selectedChannel].shortDescription}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  isLoading={isTesting}
                  disabled={!hotelId.trim()}
                  className="text-xs"
                >
                  Kiểm tra kết nối
                </Button>
              </div>
            </div>
          </ModalHeader>

          <ModalBody className="py-4 space-y-5 max-h-[75vh] overflow-y-auto">
            {isLoadingDetail ? (
              <div className="space-y-4 py-8">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                {/* Tabs Switcher */}
                <div className="flex items-center gap-2 border-b border-line pb-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('credentials')}
                    className={`flex items-center gap-2 py-1.5 px-3 rounded-lg font-medium transition-colors ${
                      activeTab === 'credentials'
                        ? 'bg-acc text-acc-fg'
                        : 'text-muted hover:text-fg hover:bg-ink/5'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    1. Tài khoản & Khóa bảo mật (API Credentials)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('mapping')}
                    className={`flex items-center gap-2 py-1.5 px-3 rounded-lg font-medium transition-colors ${
                      activeTab === 'mapping'
                        ? 'bg-acc text-acc-fg'
                        : 'text-muted hover:text-fg hover:bg-ink/5'
                    }`}
                  >
                    <BedDouble className="w-3.5 h-3.5" />
                    2. Ánh xạ Hạng phòng & Markup ({mappings.filter((m) => m.channelRoomId.trim().length > 0).length}/{mappings.length})
                  </button>
                </div>

                {/* TAB 1: CREDENTIALS */}
                {activeTab === 'credentials' && (
                  <div className="space-y-4">
                    {/* Hotel Identifier */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-fg">
                        {OTA_CHANNELS_META[selectedChannel].hotelIdLabel}{' '}
                        <span className="text-err">*</span>
                      </label>
                      <Input
                        value={hotelId}
                        onChange={(e) => setHotelId(e.target.value)}
                        placeholder={OTA_CHANNELS_META[selectedChannel].hotelIdPlaceholder}
                        className="text-xs font-mono"
                      />
                      <p className="text-[11px] text-muted">
                        Mã định danh khách sạn do {OTA_CHANNELS_META[selectedChannel].name} cung cấp trong thư xác nhận hoặc trên thanh URL trang quản trị.
                      </p>
                    </div>

                    {/* API Key / Username */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-fg">
                          API Key / Tên tài khoản kết nối
                        </label>
                        <Input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={
                            channelDetail?.maskedApiKey
                              ? `Đang dùng key đã lưu (${channelDetail.maskedApiKey})`
                              : 'Nhập API Key hoặc Partner Username'
                          }
                          className="text-xs font-mono"
                        />
                        <p className="text-[11px] text-muted">
                          Để trống nếu muốn giữ nguyên khóa đã mã hóa trước đó.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-fg">
                          Secret Token / Mật khẩu kết nối
                        </label>
                        <Input
                          type="password"
                          value={apiSecret}
                          onChange={(e) => setApiSecret(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="text-xs font-mono"
                        />
                        <p className="text-[11px] text-muted">
                          Mã xác thực bí mật để ký kết các lệnh đồng bộ phòng tự động.
                        </p>
                      </div>
                    </div>

                    {/* Webhook Configuration Box */}
                    <div className="p-4 rounded-xl border border-line bg-ink/5 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-fg flex items-center gap-1.5">
                          <Webhook className="w-3.5 h-3.5 text-acc" />
                          Địa chỉ Webhook nhận đơn từ {OTA_CHANNELS_META[selectedChannel].name}
                        </span>
                        <a
                          href={OTA_CHANNELS_META[selectedChannel].helpDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-acc hover:underline flex items-center gap-1"
                        >
                          Hướng dẫn dán Webhook <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <p className="text-[11px] text-muted leading-relaxed">
                        Sao chép đường dẫn này và dán vào phần <strong>Webhook / Push Notification</strong> trong trang quản trị đối tác của {OTA_CHANNELS_META[selectedChannel].name} để Digistay tự động nhận đơn đặt phòng ngay khi có khách đặt.
                      </p>

                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={channelDetail?.webhookUrl || ''}
                          className="text-xs font-mono bg-panel select-all"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(channelDetail?.webhookUrl || '', 'Webhook URL')}
                          className="shrink-0 text-xs"
                        >
                          {copiedField === 'Webhook URL' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          Sao chép
                        </Button>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted">
                          Webhook Secret Key:{' '}
                          <code className="text-fg font-mono bg-ink/10 px-1.5 py-0.5 rounded">
                            {webhookSecret || '••••••••'}
                          </code>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(webhookSecret, 'Webhook Secret')}
                          className="text-[11px] text-acc hover:underline"
                        >
                          Sao chép Secret
                        </button>
                      </div>
                    </div>

                    {/* Settings Toggles */}
                    <div className="p-4 rounded-xl border border-line bg-panel space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-fg">Kích hoạt đồng bộ kênh này</p>
                          <p className="text-[11px] text-muted">
                            Cho phép hệ thống đẩy tồn kho và nhận đơn tự động với {OTA_CHANNELS_META[selectedChannel].name}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="w-4 h-4 rounded text-acc accent-acc cursor-pointer"
                        />
                      </div>

                      <div className="border-t border-line pt-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-fg">Tự động xác nhận đơn OTA (Auto-Confirm)</p>
                          <p className="text-[11px] text-muted">
                            Tự động chuyển trạng thái đơn sang ĐÃ XÁC NHẬN (CONFIRMED) và khóa phòng ngay khi nhận webhook
                          </p>
                        </div>
                        <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-xs">
                          Bật tự động
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ROOM MAPPING */}
                {activeTab === 'mapping' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-acc/10 border border-acc/20 text-xs text-acc-fg space-y-1">
                      <p className="font-medium flex items-center gap-1.5 text-acc">
                        <HelpCircle className="w-4 h-4" />
                        Hướng dẫn ánh xạ hạng phòng:
                      </p>
                      <p className="text-[11px] text-muted leading-relaxed">
                        Nhập <strong>Mã phòng trên sàn OTA</strong> (Room ID) cho từng hạng phòng tương ứng trên Digistay.
                        Bạn cũng có thể cài đặt <strong>Hệ số giá (Markup)</strong> để bù phí hoa hồng của sàn (ví dụ: đặt hệ số <code>1.15</code> để giá trên sàn tự động cao hơn 15% so với giá bán trên web riêng).
                      </p>
                    </div>

                    {/* Mapping Table */}
                    <div className="overflow-x-auto border border-line rounded-xl">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-ink/5 border-b border-line text-muted font-medium">
                          <tr>
                            <th className="py-2.5 px-3">Hạng phòng Digistay</th>
                            <th className="py-2.5 px-3">
                              Mã phòng trên {OTA_CHANNELS_META[selectedChannel].name} <span className="text-err">*</span>
                            </th>
                            <th className="py-2.5 px-3">Tên phòng đối soát trên sàn</th>
                            <th className="py-2.5 px-3">Gói giá (Rate Plan)</th>
                            <th className="py-2.5 px-3 w-28">Markup</th>
                            <th className="py-2.5 px-3 text-center w-20">Đồng bộ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {mappings.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-muted">
                                Khách sạn chưa có hạng phòng nào được kích hoạt. Hãy tạo hạng phòng trước khi ánh xạ.
                              </td>
                            </tr>
                          ) : (
                            mappings.map((item) => (
                              <tr key={item.roomTypeId} className="hover:bg-ink/5 transition-colors">
                                <td className="py-2.5 px-3 font-medium text-fg whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <BedDouble className="w-3.5 h-3.5 text-muted" />
                                    <span>{item.roomTypeName || item.roomTypeSlug}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <Input
                                    value={item.channelRoomId}
                                    onChange={(e) =>
                                      updateMappingRow(item.roomTypeId, 'channelRoomId', e.target.value)
                                    }
                                    placeholder="vd: AG_DLX_01"
                                    className="text-xs font-mono h-8"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <Input
                                    value={item.channelRoomName || ''}
                                    onChange={(e) =>
                                      updateMappingRow(item.roomTypeId, 'channelRoomName', e.target.value)
                                    }
                                    placeholder="vd: Deluxe Ocean View"
                                    className="text-xs h-8"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <Input
                                    value={item.channelRatePlanId || ''}
                                    onChange={(e) =>
                                      updateMappingRow(item.roomTypeId, 'channelRatePlanId', e.target.value)
                                    }
                                    placeholder="vd: STANDARD"
                                    className="text-xs font-mono h-8"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      step="0.05"
                                      min="0.5"
                                      max="3.0"
                                      value={item.rateMultiplier}
                                      onChange={(e) =>
                                        updateMappingRow(
                                          item.roomTypeId,
                                          'rateMultiplier',
                                          parseFloat(e.target.value) || 1.0
                                        )
                                      }
                                      className="text-xs font-mono h-8 w-20"
                                    />
                                    <span className="text-[11px] text-muted">
                                      {item.rateMultiplier > 1
                                        ? `+${Math.round((item.rateMultiplier - 1) * 100)}%`
                                        : item.rateMultiplier < 1
                                        ? `-${Math.round((1 - item.rateMultiplier) * 100)}%`
                                        : 'Gốc'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={item.isSyncEnabled}
                                    onChange={(e) =>
                                      updateMappingRow(item.roomTypeId, 'isSyncEnabled', e.target.checked)
                                    }
                                    className="w-4 h-4 rounded text-acc accent-acc cursor-pointer"
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </ModalBody>

          <ModalFooter className="border-t border-line pt-3 flex items-center justify-between">
            {channelDetail?.hotelIdentifier ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="text-xs text-err border-err/30 hover:bg-err/10"
              >
                <Unplug className="w-3.5 h-3.5 mr-1" />
                Ngắt kết nối kênh
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCloseModal} className="text-xs">
                Đóng
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                isLoading={isSaving}
                className="text-xs bg-acc text-acc-fg hover:bg-acc/90 shadow-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Lưu cấu hình & Ánh xạ
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </PageContainer>
  )
}
