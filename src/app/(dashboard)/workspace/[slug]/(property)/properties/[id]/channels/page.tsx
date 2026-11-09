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
import { useTranslations } from 'next-intl'
import {
  Share2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Key,
  Webhook,
  HelpCircle,
  Unplug,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  History,
  XCircle,
  BedDouble,
  Layers,
  Zap,
} from 'lucide-react'
import {
  OtaChannel,
  OTA_CHANNELS_META,
  ChannelAccountSummary,
  ChannelAccountDetail,
  ChannelRoomMappingData,
} from '@/lib/ota/types'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-fg/10 rounded-lg ${className || ''}`} />
}

export default function OtaChannelsPage() {
  const t = useTranslations('dash.channels')
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

  // Global Sync & Logs State
  const [isSyncingAll, setIsSyncingAll] = React.useState(false)
  const [logs, setLogs] = React.useState<any[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = React.useState(false)

  const fetchChannels = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/properties/${propertyId}/channels`)
      const json = await res.json()
      if (res.ok && json.success) {
        setChannels(json.data.channels)
        setPropertyName(json.data.propertyName)
      } else {
        toast.error(json.error || t('toast.loadFailed'))
      }
    } catch {
      toast.error(t('toast.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [propertyId, t])

  const fetchLogs = React.useCallback(async () => {
    try {
      setIsLoadingLogs(true)
      const res = await fetch(`/api/properties/${propertyId}/channels/logs?limit=20`)
      const json = await res.json()
      if (res.ok && json.success) {
        setLogs(json.data.logs || [])
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingLogs(false)
    }
  }, [propertyId])

  React.useEffect(() => {
    fetchChannels()
    fetchLogs()
  }, [fetchChannels, fetchLogs])

  const handleSyncAllChannels = async () => {
    try {
      setIsSyncingAll(true)
      const res = await fetch(`/api/properties/${propertyId}/channels/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(t('toast.syncAllSuccess'))
        fetchChannels()
        fetchLogs()
      } else {
        toast.error(json.error || t('toast.syncAllFailed'))
      }
    } catch {
      toast.error(t('toast.syncAllFailed'))
    } finally {
      setIsSyncingAll(false)
    }
  }

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
        setApiKey('')
        setApiSecret('')
        setWebhookSecret(detail.webhookSecret || '')
        setIsActive(detail.isActive)
        setRateMultiplierDefault(detail.rateMultiplierDefault || 1.0)
        setMappings(detail.mappings || [])
      } else {
        toast.error(json.error || t('toast.detailLoadFailed'))
      }
    } catch {
      toast.error(t('toast.detailLoadFailed'))
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
    toast.success(t('modal.copied'))
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleTestConnection = async () => {
    if (!selectedChannel) return
    if (!hotelId.trim()) {
      toast.error(t('modal.hotelIdPlaceholder'))
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
        toast.success(t('toast.testSuccess', { channel: OTA_CHANNELS_META[selectedChannel].name }))
      } else {
        toast.error(json.error || json.message || t('toast.testFailed'))
      }
    } catch {
      toast.error(t('toast.testFailed'))
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!selectedChannel) return
    if (!hotelId.trim()) {
      toast.error(t('modal.hotelIdPlaceholder'))
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
        toast.success(t('toast.saveSuccess', { channel: OTA_CHANNELS_META[selectedChannel].name }))
        handleCloseModal()
        fetchChannels()
      } else {
        toast.error(json.error || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save channel configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!selectedChannel) return
    const channelName = OTA_CHANNELS_META[selectedChannel].name
    if (!confirm(t('modal.disconnectConfirm', { channel: channelName }))) {
      return
    }

    try {
      const res = await fetch(`/api/properties/${propertyId}/channels/${selectedChannel}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(t('toast.disconnectSuccess', { channel: channelName }))
        handleCloseModal()
        fetchChannels()
      } else {
        toast.error(json.error || 'Failed to disconnect')
      }
    } catch {
      toast.error('Error disconnecting channel')
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
        title={t('title')}
        description={`${t('description')} (${propertyName || t('propertyLabel')})`}
      />

      {/* Top Architecture Banner */}
      <div className="mb-6 p-4 rounded-box border border-line bg-panel shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-ctl bg-acc/10 flex items-center justify-center text-acc shrink-0 mt-0.5">
            <Share2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-fg flex items-center gap-2">
              <span>{t('card.twoWay')}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Zap className="w-3 h-3" />
                AES-256 Encrypted
              </span>
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              {t('modal.mappingBanner', { channel: 'các sàn OTA' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchChannels()
              fetchLogs()
            }}
            isLoading={isLoading}
            className="text-xs border-line bg-panel hover:bg-fg/5 text-fg"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {t('refreshLogs')}
          </Button>

          {canEdit && (
            <Button
              size="sm"
              onClick={handleSyncAllChannels}
              isLoading={isSyncingAll}
              className="text-xs bg-acc text-acc-fg hover:bg-acc/90 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {t('syncAll')}
            </Button>
          )}
        </div>
      </div>

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-4 bg-panel border-line">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))
          : channels.map((item) => {
              const meta = OTA_CHANNELS_META[item.channel]
              const isChannelActive = item.isActive
              const isChannelConnected = Boolean(item.hotelIdentifier)

              return (
                <Card
                  key={item.channel}
                  className="flex flex-col justify-between border-line hover:border-acc/40 transition-all duration-200 shadow-xs bg-panel group"
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Channel Top Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-10 h-10 rounded-ctl flex items-center justify-center font-bold text-white text-base shadow-xs"
                          style={{ backgroundColor: meta.accentColor }}
                        >
                          {meta.name.slice(0, 1)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-fg text-sm group-hover:text-acc transition-colors">
                            {meta.name}
                          </h3>
                          <span className="text-[11px] text-muted">
                            ~{meta.defaultCommissionRate}% commission
                          </span>
                        </div>
                      </div>

                      {isChannelActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('badge.connected')}
                        </span>
                      ) : isChannelConnected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {t('badge.inactive')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-fg/5 text-muted border border-line">
                          {t('badge.notConnected')}
                        </span>
                      )}
                    </div>

                    {/* Short Description */}
                    <p className="text-xs text-muted line-clamp-2 min-h-[32px]">
                      {meta.shortDescription}
                    </p>

                    {/* Metrics / Info Box */}
                    <div className="p-3 rounded-ctl bg-fg/[0.03] border border-line space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">{t('modal.hotelId')}:</span>
                        <span className="font-mono font-medium text-fg">
                          {item.hotelIdentifier || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">{t('modal.tabMapping')}:</span>
                        <span className="font-medium text-fg">
                          {t('card.mappedCount', { count: item.mappedRoomsCount })} ({item.mappedRoomsCount}/{item.totalPropertyRoomsCount})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">{t('card.lastSync')}</span>
                        <span className="text-muted font-medium">
                          {item.lastSyncedAt
                            ? new Date(item.lastSyncedAt).toLocaleString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })
                            : t('card.never')}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  {/* Actions Footer */}
                  <div className="p-4 border-t border-line bg-fg/[0.02] flex items-center gap-2">
                    <Button
                      variant={isChannelActive ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => handleOpenChannel(item.channel)}
                      className="w-full text-xs"
                      disabled={!canEdit}
                    >
                      <Sliders className="w-3.5 h-3.5 mr-1.5" />
                      {isChannelConnected ? t('card.configure') : t('card.connect')}
                    </Button>
                    <a
                      href={meta.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-ctl border border-line text-muted hover:text-fg hover:bg-fg/5 transition-colors"
                      title={meta.name}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </Card>
              )
            })}
      </div>

      {/* 2-Way Sync Logs Section */}
      <div className="mt-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-acc" />
            <h3 className="font-semibold text-fg text-sm">
              {t('logs.title')}
            </h3>
            <Badge variant="outline" className="text-xs border-line bg-panel text-muted">
              {logs.length}
            </Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            isLoading={isLoadingLogs}
            className="text-xs border-line bg-panel hover:bg-fg/5 text-fg"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {t('refreshLogs')}
          </Button>
        </div>

        <Card className="border-line overflow-hidden shadow-xs bg-panel">
          {isLoadingLogs ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Activity className="w-8 h-8 mx-auto text-muted/40" />
              <p className="text-xs text-muted">{t('logs.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-fg/[0.03] border-b border-line text-muted font-medium">
                  <tr>
                    <th className="py-3 px-4">{t('logs.colTime')}</th>
                    <th className="py-3 px-4">{t('logs.colChannel')}</th>
                    <th className="py-3 px-4">{t('logs.colDirection')}</th>
                    <th className="py-3 px-4">{t('logs.colStatus')}</th>
                    <th className="py-3 px-4">{t('logs.colDetails')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {logs.map((log) => {
                    const isOutbound = String(log.direction).startsWith('OUTBOUND')
                    const isCancel = log.direction === 'INBOUND_CANCELLATION'
                    const isNewBooking = log.direction === 'INBOUND_BOOKING'

                    return (
                      <tr key={log.id} className="hover:bg-fg/[0.02] transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-muted font-mono text-[11px]">
                          {new Date(log.createdAt).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-fg">
                            {OTA_CHANNELS_META[log.channel as OtaChannel]?.name || log.channel}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isOutbound ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <ArrowUpRight className="w-3 h-3" />
                              {t('logs.outbound')}
                            </span>
                          ) : isCancel ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <XCircle className="w-3 h-3" />
                              {t('logs.inbound')} (Cancel)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <ArrowDownLeft className="w-3 h-3" />
                              {t('logs.inbound')} (Booking)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('logs.success')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              {t('logs.failed')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted max-w-xs truncate">
                          {log.errorMessage ? (
                            <span className="text-rose-600 dark:text-rose-400 font-mono text-[11px]">{log.errorMessage}</span>
                          ) : isNewBooking && log.response?.bookingCode ? (
                            <span>
                              Booking: <strong className="text-fg">{log.response.bookingCode}</strong>
                              {log.response.isDuplicate && ' (Duplicate)'}
                            </span>
                          ) : isOutbound && log.payload?.preview ? (
                            <span>Updated {log.payload.itemsCount || 0} dates ({log.payload.rateMultiplier}x)</span>
                          ) : (
                            <span>OK</span>
                          )}
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

      {/* Configuration & Mapping Modal */}
      {selectedChannel && (
        <Modal isOpen={Boolean(selectedChannel)} onClose={handleCloseModal} size="xl">
          <ModalHeader className="border-b border-line pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-ctl flex items-center justify-center font-bold text-white text-base shadow-xs"
                  style={{ backgroundColor: OTA_CHANNELS_META[selectedChannel].accentColor }}
                >
                  {OTA_CHANNELS_META[selectedChannel].name.slice(0, 1)}
                </div>
                <div>
                  <h3 className="font-semibold text-fg flex items-center gap-2">
                    {t('modal.title', { channel: OTA_CHANNELS_META[selectedChannel].name })}
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {t('badge.connected')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-fg/5 text-muted border border-line">
                        {t('badge.inactive')}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted">
                    {t('modal.subtitle')}
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
                  className="text-xs border-line bg-panel hover:bg-fg/5 text-fg"
                >
                  {isTesting ? t('modal.testingBtn') : t('modal.testBtn')}
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
                    className={`flex items-center gap-2 py-1.5 px-3 rounded-ctl font-medium transition-colors ${
                      activeTab === 'credentials'
                        ? 'bg-acc text-acc-fg'
                        : 'text-muted hover:text-fg hover:bg-fg/5'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    {t('modal.tabCredentials')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('mapping')}
                    className={`flex items-center gap-2 py-1.5 px-3 rounded-ctl font-medium transition-colors ${
                      activeTab === 'mapping'
                        ? 'bg-acc text-acc-fg'
                        : 'text-muted hover:text-fg hover:bg-fg/5'
                    }`}
                  >
                    <BedDouble className="w-3.5 h-3.5" />
                    {t('modal.tabMapping')} ({mappings.filter((m) => m.channelRoomId.trim().length > 0).length}/{mappings.length})
                  </button>
                </div>

                {/* TAB 1: CREDENTIALS */}
                {activeTab === 'credentials' && (
                  <div className="space-y-4">
                    {/* Prevent aggressive Chrome / 1Password autofill into API credentials */}
                    <input
                      type="text"
                      name="prevent_autofill_username"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="sr-only opacity-0 w-0 h-0 pointer-events-none absolute"
                    />
                    <input
                      type="password"
                      name="prevent_autofill_password"
                      tabIndex={-1}
                      autoComplete="new-password"
                      aria-hidden="true"
                      className="sr-only opacity-0 w-0 h-0 pointer-events-none absolute"
                    />

                    {/* Hotel Identifier */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-fg">
                        {OTA_CHANNELS_META[selectedChannel].hotelIdLabel}{' '}
                        <span className="text-err">*</span>
                      </label>
                      <Input
                        name={`ota_${selectedChannel}_hotel_id`}
                        id={`ota_${selectedChannel}_hotel_id`}
                        autoComplete="off"
                        value={hotelId}
                        onChange={(e) => setHotelId(e.target.value)}
                        placeholder={OTA_CHANNELS_META[selectedChannel].hotelIdPlaceholder}
                        className="text-xs font-mono bg-panel border-line text-fg"
                      />
                      <p className="text-[11px] text-muted">
                        {t('modal.hotelIdHelp', { channel: OTA_CHANNELS_META[selectedChannel].name })}
                      </p>
                    </div>

                    {/* API Key / Secret */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-fg">
                          {t('modal.apiKey')}
                        </label>
                        <Input
                          name={`ota_${selectedChannel}_api_key`}
                          id={`ota_${selectedChannel}_api_key`}
                          type="password"
                          autoComplete="new-password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={
                            channelDetail?.maskedApiKey
                              ? `Key: ${channelDetail.maskedApiKey}`
                              : t('modal.apiKeyPlaceholder')
                          }
                          className="text-xs font-mono bg-panel border-line text-fg"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-fg">
                          {t('modal.apiSecret')}
                        </label>
                        <Input
                          name={`ota_${selectedChannel}_api_secret`}
                          id={`ota_${selectedChannel}_api_secret`}
                          type="password"
                          autoComplete="new-password"
                          value={apiSecret}
                          onChange={(e) => setApiSecret(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="text-xs font-mono bg-panel border-line text-fg"
                        />
                      </div>
                    </div>

                    {/* Webhook Configuration Box */}
                    <div className="p-4 rounded-box border border-line bg-fg/[0.03] space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-fg flex items-center gap-1.5">
                          <Webhook className="w-3.5 h-3.5 text-acc" />
                          {t('modal.webhookUrl', { channel: OTA_CHANNELS_META[selectedChannel].name })}
                        </span>
                        <a
                          href={OTA_CHANNELS_META[selectedChannel].helpDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-acc hover:underline flex items-center gap-1"
                        >
                          Docs <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <p className="text-[11px] text-muted leading-relaxed">
                        {t('modal.webhookUrlHelp', { channel: OTA_CHANNELS_META[selectedChannel].name })}
                      </p>

                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={channelDetail?.webhookUrl || ''}
                          className="text-xs font-mono bg-panel border-line text-fg select-all"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(channelDetail?.webhookUrl || '', 'Webhook URL')}
                          className="shrink-0 text-xs border-line bg-panel hover:bg-fg/5 text-fg"
                        >
                          {copiedField === 'Webhook URL' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedField === 'Webhook URL' ? t('modal.copied') : 'Copy'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted">
                          {t('modal.webhookSecret')}:{' '}
                          <code className="text-fg font-mono bg-fg/10 px-1.5 py-0.5 rounded">
                            {webhookSecret || '••••••••'}
                          </code>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(webhookSecret, 'Webhook Secret')}
                          className="text-[11px] text-acc hover:underline"
                        >
                          Copy Secret
                        </button>
                      </div>
                    </div>

                    {/* Settings Toggles */}
                    <div className="p-4 rounded-box border border-line bg-panel space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-fg">{t('modal.activeToggle')}</p>
                          <p className="text-[11px] text-muted">
                            {t('modal.activeToggleDesc')}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="w-4 h-4 rounded text-acc accent-acc cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ROOM MAPPING */}
                {activeTab === 'mapping' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-ctl bg-acc/10 border border-acc/20 text-xs text-fg space-y-1">
                      <p className="font-medium flex items-center gap-1.5 text-acc">
                        <HelpCircle className="w-4 h-4" />
                        {t('modal.tabMapping')}
                      </p>
                      <p className="text-[11px] text-muted leading-relaxed">
                        {t('modal.mappingBanner', { channel: OTA_CHANNELS_META[selectedChannel].name })}
                      </p>
                    </div>

                    {/* Mapping Table */}
                    <div className="overflow-x-auto border border-line rounded-box bg-panel">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-fg/[0.03] border-b border-line text-muted font-medium">
                          <tr>
                            <th className="py-2.5 px-3">{t('modal.colRoomType')}</th>
                            <th className="py-2.5 px-3">
                              {t('modal.colOtaId')} <span className="text-err">*</span>
                            </th>
                            <th className="py-2.5 px-3">{t('modal.colOtaName')}</th>
                            <th className="py-2.5 px-3">{t('modal.colMarkup')}</th>
                            <th className="py-2.5 px-3 text-center w-20">{t('modal.colSync')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {mappings.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-muted">
                                {t('modal.noRoomTypes')}
                              </td>
                            </tr>
                          ) : (
                            mappings.map((item) => (
                              <tr key={item.roomTypeId} className="hover:bg-fg/[0.02] transition-colors">
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
                                    placeholder={t('modal.otaIdPlaceholder')}
                                    className="text-xs font-mono h-8 bg-page border-line text-fg"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <Input
                                    value={item.channelRoomName || ''}
                                    onChange={(e) =>
                                      updateMappingRow(item.roomTypeId, 'channelRoomName', e.target.value)
                                    }
                                    placeholder={t('modal.otaNamePlaceholder')}
                                    className="text-xs h-8 bg-page border-line text-fg"
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
                                      className="text-xs font-mono h-8 w-20 bg-page border-line text-fg"
                                    />
                                    <span className="text-[11px] text-muted">
                                      {item.rateMultiplier > 1
                                        ? `+${Math.round((item.rateMultiplier - 1) * 100)}%`
                                        : item.rateMultiplier < 1
                                        ? `-${Math.round((1 - item.rateMultiplier) * 100)}%`
                                        : '1.0x'}
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
                className="text-xs text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              >
                <Unplug className="w-3.5 h-3.5 mr-1" />
                {t('modal.disconnectBtn')}
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCloseModal}
                className="text-xs border-line bg-panel hover:bg-fg/5 text-fg"
              >
                {t('modal.closeBtn')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                isLoading={isSaving}
                className="text-xs bg-acc text-acc-fg hover:bg-acc/90 shadow-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                {isSaving ? t('modal.savingBtn') : t('modal.saveBtn')}
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </PageContainer>
  )
}
