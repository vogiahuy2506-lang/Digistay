'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CoverPicker } from './cover-picker'
import { ReviewsEditor, type ReviewEntry } from './reviews-editor'
import { Button, Input } from '@/components/ui'
import {
  X, Sparkles, Layout, Eye, EyeOff, Trash2, Wand2,
  ChevronDown, ChevronUp, Check, ExternalLink, HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BlockConfig {
  heroTitle?: string
  heroSubtitle?: string
  heroImage?: string
  backgroundImage?: string
  heroCtaText?: string
  heroCtaLink?: string
  roomsTitle?: string
  roomsDisplay?: 'grid' | 'list'
  roomsLimit?: number
  amenitiesTitle?: string
  amenitiesColumns?: number
  aboutTitle?: string
  aboutContent?: string
  aboutImage?: string
  galleryTitle?: string
  galleryColumns?: number
  galleryImages?: string[]
  reviewsTitle?: string
  reviewsLimit?: number
  reviews?: ReviewEntry[]
  mapAddress?: string
  mapLat?: number
  mapLng?: number
  mapZoom?: number
  contactTitle?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
  contactFormEnabled?: boolean
  ctaTitle?: string
  ctaSubtitle?: string
  ctaButtonText?: string
  ctaButtonLink?: string
  ctaBackground?: string
  ctaBadge?: string
  ctaPerks?: string[]
  servicesTitle?: string
  menuTitle?: string
  menuNote?: string
  en?: Record<string, string>
}

export interface Block {
  id: string
  type: string
  name: string
  isEnabled: boolean
  sortOrder: number
  layoutVariant?: string
  config: BlockConfig
}

export interface BlockInspectorPanelProps {
  block: Block
  onUpdate: (config: BlockConfig) => void
  onClose: () => void
  onToggleEnabled?: () => void
  onRemove?: () => void
  onRemix?: () => void
  propertyData: any
  onPhotoAdded: (photo: { id: string; url: string; alt?: string | null }) => void
  onOpenCopilot?: (fieldKey: string, label: string, currentText: string, onApply: (val: string) => void) => void
}

export function BlockInspectorPanel({
  block,
  onUpdate,
  onClose,
  onToggleEnabled,
  onRemove,
  onRemix,
  propertyData,
  onPhotoAdded,
  onOpenCopilot,
}: BlockInspectorPanelProps) {
  const t = useTranslations('dash.website.config')
  const tc = useTranslations('dash.common')
  const [config, setConfig] = React.useState<BlockConfig>(block.config || {})

  React.useEffect(() => {
    setConfig(block.config || {})
  }, [block])

  const updateConfig = (key: keyof BlockConfig, value: any) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    onUpdate(next)
  }

  return (
    <div className="flex flex-col h-full bg-panel text-fg select-none">
      {/* Inspector Header */}
      <div className="shrink-0 p-3.5 border-b border-line flex items-center justify-between gap-2 bg-raised/50">
        <div className="min-w-0 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-acc-soft text-acc flex items-center justify-center shrink-0 border border-acc/20">
            <Layout className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-fg truncate">
              {block.name || 'Khối giao diện'}
            </h2>
            <span className="text-[10px] text-muted uppercase tracking-wider font-mono">
              {block.type}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onRemix && (
            <button
              type="button"
              onClick={onRemix}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-ink text-on-ink text-[11px] font-medium hover:bg-ink/90 transition-colors shadow-xs"
              title="Dùng AI để thử các biến thể thiết kế mới"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Remix</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-fg hover:bg-fg/5 transition-colors"
            title="Đóng bảng chỉnh sửa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Visibility & Quick Status Bar */}
      <div className="shrink-0 px-3.5 py-2 border-b border-line/60 bg-fg/[0.01] flex items-center justify-between text-xs">
        <span className="text-muted text-[11px]">Hiển thị trên website:</span>
        <button
          type="button"
          onClick={onToggleEnabled}
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
            block.isEnabled
              ? 'bg-ok-soft text-ok border-ok/30'
              : 'bg-warn-soft text-warn border-warn/30'
          )}
        >
          {block.isEnabled ? (
            <>
              <Eye className="w-3 h-3" />
              <span>Đang hiển thị</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3 h-3" />
              <span>Đang ẩn</span>
            </>
          )}
        </button>
      </div>

      {/* Inspector Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {block.type === 'FOOTER' && (
          <p className="rounded-xl bg-fg/5 p-3 text-xs text-muted leading-relaxed">
            Chân trang tự động hiển thị thông tin liên hệ, bản quyền và các liên kết điều hướng của khách sạn.
          </p>
        )}

        {/* HERO CONFIG */}
        {block.type === 'HERO' && (
          <div className="space-y-3.5">
            {/* CRO Hints */}
            <div className="rounded-xl bg-acc-soft/40 border border-acc/20 p-2.5 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-acc">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gợi ý câu từ chuyển đổi cao (CRO):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    updateConfig('heroTitle', propertyData?.name ? `Trải nghiệm nghỉ dưỡng tuyệt vời tại ${propertyData.name}` : 'Trải nghiệm nghỉ dưỡng đẳng cấp')
                    updateConfig('heroSubtitle', 'Không gian thư thái, dịch vụ tận tâm và cam kết giá tốt nhất khi đặt trực tiếp.')
                  }}
                  className="px-2 py-1 rounded-lg bg-panel border border-line hover:border-acc text-fg text-[11px] transition-colors"
                >
                  + Nghỉ dưỡng & Thư giãn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateConfig('heroTitle', propertyData?.name ? `Chào mừng đến với ${propertyData.name}` : 'Điểm dừng chân lý tưởng')
                    updateConfig('heroSubtitle', 'Vị trí đắc địa, tiện nghi hiện đại và dịch vụ tận tâm cho kỳ nghỉ trọn vẹn.')
                  }}
                  className="px-2 py-1 rounded-lg bg-panel border border-line hover:border-acc text-fg text-[11px] transition-colors"
                >
                  + Hiện đại & Tiện nghi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateConfig('heroTitle', 'Ưu đãi đặt phòng trực tiếp hôm nay')
                    updateConfig('heroSubtitle', 'Giảm ngay 10% so với OTA kèm miễn phí bữa sáng hàng ngày khi đặt phòng tại website.')
                  }}
                  className="px-2 py-1 rounded-lg bg-panel border border-line hover:border-acc text-fg text-[11px] transition-colors"
                >
                  + Khuyến mãi trực tiếp
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-fg">Tiêu đề chính (Headline)</label>
                {onOpenCopilot && (
                  <button
                    type="button"
                    onClick={() => onOpenCopilot('heroTitle', 'Tiêu đề chính', config.heroTitle || '', (val) => updateConfig('heroTitle', val))}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-acc hover:underline"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Viết lại</span>
                  </button>
                )}
              </div>
              <Input
                value={config.heroTitle || ''}
                onChange={(e) => updateConfig('heroTitle', e.target.value)}
                placeholder="Nhập tiêu đề hoặc để trống lấy tên khách sạn"
                className="text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-fg">Phụ đề (Subtitle)</label>
                {onOpenCopilot && (
                  <button
                    type="button"
                    onClick={() => onOpenCopilot('heroSubtitle', 'Phụ đề', config.heroSubtitle || '', (val) => updateConfig('heroSubtitle', val))}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-acc hover:underline"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Viết lại</span>
                  </button>
                )}
              </div>
              <textarea
                value={config.heroSubtitle || ''}
                onChange={(e) => updateConfig('heroSubtitle', e.target.value)}
                placeholder="Mô tả ngắn gọn về trải nghiệm lưu trú..."
                rows={2}
                className="w-full px-3 py-2 border border-line rounded-xl bg-fg/[0.02] text-fg text-xs focus:outline-none focus:border-acc"
              />
            </div>

            {/* Background Cover Picker */}
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Ảnh nền Banner</label>
              <CoverPicker
                propertyId={propertyData?.id ?? ''}
                photos={propertyData?.images ?? []}
                value={config.backgroundImage || undefined}
                onChange={(url) => updateConfig('backgroundImage', url)}
                onPhotoAdded={onPhotoAdded}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Chữ nút bấm (CTA)</label>
                <Input
                  value={config.heroCtaText || ''}
                  onChange={(e) => updateConfig('heroCtaText', e.target.value)}
                  placeholder="Đặt phòng ngay"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Đường dẫn nút</label>
                <Input
                  value={config.heroCtaLink || ''}
                  onChange={(e) => updateConfig('heroCtaLink', e.target.value)}
                  placeholder="#rooms"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* ROOMS CONFIG */}
        {block.type === 'ROOMS' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Tiêu đề mục phòng</label>
              <Input
                value={config.roomsTitle || ''}
                onChange={(e) => updateConfig('roomsTitle', e.target.value)}
                placeholder="Các hạng phòng nghỉ"
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Kiểu bố cục hiển thị</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateConfig('roomsDisplay', 'grid')}
                  className={cn(
                    'py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center',
                    config.roomsDisplay === 'grid' || !config.roomsDisplay
                      ? 'border-acc bg-acc-soft text-acc font-semibold'
                      : 'border-line text-muted hover:text-fg'
                  )}
                >
                  Dạng lưới (Grid)
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig('roomsDisplay', 'list')}
                  className={cn(
                    'py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center',
                    config.roomsDisplay === 'list'
                      ? 'border-acc bg-acc-soft text-acc font-semibold'
                      : 'border-line text-muted hover:text-fg'
                  )}
                >
                  Dạng danh sách (List)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Số phòng hiển thị tối đa</label>
              <Input
                type="number"
                value={config.roomsLimit || 6}
                onChange={(e) => updateConfig('roomsLimit', parseInt(e.target.value) || 6)}
                min={1}
                max={20}
                className="text-xs"
              />
            </div>

            <p className="text-[11px] text-muted bg-fg/[0.02] p-2.5 rounded-xl border border-line/60">
              💡 Danh sách phòng và giá bán được lấy tự động trực tiếp từ hệ thống PMS. Bạn chỉ cần bật/tắt hoặc sắp xếp thứ tự ở mục Quản lý phòng.
            </p>
          </div>
        )}

        {/* AMENITIES CONFIG */}
        {block.type === 'AMENITIES' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Tiêu đề tiện ích</label>
              <Input
                value={config.amenitiesTitle || ''}
                onChange={(e) => updateConfig('amenitiesTitle', e.target.value)}
                placeholder="Tiện ích nổi bật"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Số cột hiển thị</label>
              <select
                value={config.amenitiesColumns || 3}
                onChange={(e) => updateConfig('amenitiesColumns', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-line rounded-xl bg-panel text-fg text-xs focus:outline-none focus:border-acc"
              >
                <option value={2}>2 Cột</option>
                <option value={3}>3 Cột (Chuẩn)</option>
                <option value={4}>4 Cột (Rộng)</option>
              </select>
            </div>
          </div>
        )}

        {/* ABOUT CONFIG */}
        {block.type === 'ABOUT' && (
          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-fg">Tiêu đề giới thiệu</label>
                {onOpenCopilot && (
                  <button
                    type="button"
                    onClick={() => onOpenCopilot('aboutTitle', 'Tiêu đề giới thiệu', config.aboutTitle || '', (val) => updateConfig('aboutTitle', val))}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-acc hover:underline"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Viết lại</span>
                  </button>
                )}
              </div>
              <Input
                value={config.aboutTitle || ''}
                onChange={(e) => updateConfig('aboutTitle', e.target.value)}
                placeholder="Về chúng tôi"
                className="text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-fg">Nội dung câu chuyện</label>
                {onOpenCopilot && (
                  <button
                    type="button"
                    onClick={() => onOpenCopilot('aboutContent', 'Nội dung giới thiệu', config.aboutContent || '', (val) => updateConfig('aboutContent', val))}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-acc hover:underline"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Viết lại</span>
                  </button>
                )}
              </div>
              <textarea
                value={config.aboutContent || ''}
                onChange={(e) => updateConfig('aboutContent', e.target.value)}
                rows={5}
                placeholder="Kể câu chuyện về sự ra đời, vị trí đắc địa và sự tận tâm..."
                className="w-full px-3 py-2 border border-line rounded-xl bg-fg/[0.02] text-fg text-xs focus:outline-none focus:border-acc"
              />
            </div>
          </div>
        )}

        {/* GALLERY CONFIG */}
        {block.type === 'GALLERY' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Tiêu đề thư viện ảnh</label>
              <Input
                value={config.galleryTitle || ''}
                onChange={(e) => updateConfig('galleryTitle', e.target.value)}
                placeholder="Hình ảnh không gian"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Số cột hiển thị</label>
              <select
                value={config.galleryColumns || 3}
                onChange={(e) => updateConfig('galleryColumns', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-line rounded-xl bg-panel text-fg text-xs focus:outline-none focus:border-acc"
              >
                <option value={2}>2 Cột</option>
                <option value={3}>3 Cột (Chuẩn)</option>
                <option value={4}>4 Cột (Đẹp)</option>
              </select>
            </div>
          </div>
        )}

        {/* REVIEWS CONFIG */}
        {block.type === 'REVIEWS' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Tiêu đề đánh giá</label>
              <Input
                value={config.reviewsTitle || ''}
                onChange={(e) => updateConfig('reviewsTitle', e.target.value)}
                placeholder="Đánh giá từ khách hàng"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Số lượng hiển thị</label>
              <Input
                type="number"
                value={config.reviewsLimit || 4}
                onChange={(e) => updateConfig('reviewsLimit', parseInt(e.target.value))}
                min={1}
                max={10}
                className="text-xs"
              />
            </div>
            <ReviewsEditor value={config.reviews ?? []} onChange={(reviews) => updateConfig('reviews', reviews)} />
          </div>
        )}

        {/* MAP CONFIG */}
        {block.type === 'MAP' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Địa chỉ hiển thị trên bản đồ</label>
              <Input
                value={config.mapAddress || ''}
                onChange={(e) => updateConfig('mapAddress', e.target.value)}
                placeholder="Để trống để lấy địa chỉ cơ sở lưu trú"
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Vĩ độ (Lat)</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.mapLat || ''}
                  onChange={(e) => updateConfig('mapLat', parseFloat(e.target.value))}
                  placeholder="21.0285"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Kinh độ (Lng)</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={config.mapLng || ''}
                  onChange={(e) => updateConfig('mapLng', parseFloat(e.target.value))}
                  placeholder="105.8542"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* CONTACT CONFIG */}
        {block.type === 'CONTACT' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Tiêu đề liên hệ</label>
              <Input
                value={config.contactTitle || ''}
                onChange={(e) => updateConfig('contactTitle', e.target.value)}
                placeholder="Liên hệ với chúng tôi"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Email liên hệ</label>
              <Input
                type="email"
                value={config.contactEmail || ''}
                onChange={(e) => updateConfig('contactEmail', e.target.value)}
                placeholder="contact@hotel.com"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Số điện thoại</label>
              <Input
                value={config.contactPhone || ''}
                onChange={(e) => updateConfig('contactPhone', e.target.value)}
                placeholder="0905 888 999"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Địa chỉ</label>
              <Input
                value={config.contactAddress || ''}
                onChange={(e) => updateConfig('contactAddress', e.target.value)}
                placeholder="Địa chỉ chi tiết..."
                className="text-xs"
              />
            </div>
            <div className="flex items-center gap-2 p-2.5 bg-fg/5 rounded-xl border border-line">
              <input
                type="checkbox"
                id="contactFormEnabled"
                checked={config.contactFormEnabled ?? true}
                onChange={(e) => updateConfig('contactFormEnabled', e.target.checked)}
                className="w-4 h-4 rounded text-acc focus:ring-acc"
              />
              <label htmlFor="contactFormEnabled" className="text-xs font-medium text-fg cursor-pointer">
                Cho phép khách gửi tin nhắn liên hệ
              </label>
            </div>
          </div>
        )}

        {/* CTA CONFIG */}
        {block.type === 'CTA' && (
          <div className="space-y-3.5">
            <div className="rounded-xl bg-acc-soft/40 border border-acc/20 p-2.5 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-acc">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gợi ý CTA chuyển đổi cao:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    updateConfig('ctaBadge', 'Ưu đãi độc quyền trực tiếp')
                    updateConfig('ctaTitle', 'Đặt phòng ngay hôm nay - Giữ giá ưu đãi')
                    updateConfig('ctaSubtitle', 'Tiết kiệm tới 15% so với đặt qua các trang OTA, hỗ trợ đổi trả linh hoạt.')
                    updateConfig('ctaButtonText', 'Đặt phòng ngay')
                  }}
                  className="px-2 py-1 rounded-lg bg-panel border border-line hover:border-acc text-fg text-[11px] transition-colors"
                >
                  + Ưu đãi giá tốt nhất
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateConfig('ctaBadge', 'Kỳ nghỉ trong mơ')
                    updateConfig('ctaTitle', 'Sẵn sàng cho chuyến du lịch sắp tới?')
                    updateConfig('ctaSubtitle', 'Lựa chọn hạng phòng ưng ý và tận hưởng dịch vụ chu đáo hàng đầu.')
                    updateConfig('ctaButtonText', 'Xem phòng & Giá ưu đãi')
                  }}
                  className="px-2 py-1 rounded-lg bg-panel border border-line hover:border-acc text-fg text-[11px] transition-colors"
                >
                  + Thúc đẩy du lịch
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Huy hiệu (Badge)</label>
              <Input
                value={config.ctaBadge || ''}
                onChange={(e) => updateConfig('ctaBadge', e.target.value)}
                placeholder="Ưu đãi độc quyền"
                className="text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-fg">Tiêu đề CTA</label>
                {onOpenCopilot && (
                  <button
                    type="button"
                    onClick={() => onOpenCopilot('ctaTitle', 'Tiêu đề CTA', config.ctaTitle || '', (val) => updateConfig('ctaTitle', val))}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-acc hover:underline"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Viết lại</span>
                  </button>
                )}
              </div>
              <Input
                value={config.ctaTitle || ''}
                onChange={(e) => updateConfig('ctaTitle', e.target.value)}
                placeholder="Sẵn sàng trải nghiệm?"
                className="text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-fg">Mô tả phụ</label>
                {onOpenCopilot && (
                  <button
                    type="button"
                    onClick={() => onOpenCopilot('ctaSubtitle', 'Mô tả CTA', config.ctaSubtitle || '', (val) => updateConfig('ctaSubtitle', val))}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-acc hover:underline"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Viết lại</span>
                  </button>
                )}
              </div>
              <textarea
                value={config.ctaSubtitle || ''}
                onChange={(e) => updateConfig('ctaSubtitle', e.target.value)}
                rows={2}
                placeholder="Đặt phòng ngay để nhận các quyền lợi tốt nhất..."
                className="w-full px-3 py-2 border border-line rounded-xl bg-fg/[0.02] text-fg text-xs focus:outline-none focus:border-acc"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Chữ nút</label>
                <Input
                  value={config.ctaButtonText || ''}
                  onChange={(e) => updateConfig('ctaButtonText', e.target.value)}
                  placeholder="Đặt phòng ngay"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Link nút</label>
                <Input
                  value={config.ctaButtonLink || ''}
                  onChange={(e) => updateConfig('ctaButtonLink', e.target.value)}
                  placeholder="#contact"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* SERVICES CONFIG */}
        {block.type === 'SERVICES' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Tiêu đề dịch vụ</label>
              <Input
                value={config.servicesTitle || ''}
                onChange={(e) => updateConfig('servicesTitle', e.target.value)}
                placeholder="Dịch vụ & Tiện ích thêm"
                className="text-xs"
              />
            </div>
            <p className="text-[11px] text-muted bg-fg/[0.02] p-2.5 rounded-xl border border-line/60">
              💡 Các dịch vụ cộng thêm (Đưa đón sân bay, Tour tham quan, BBQ...) được lấy tự động từ danh mục Dịch vụ trong hệ thống.
            </p>
          </div>
        )}

        {/* RESTAURANT_MENU CONFIG */}
        {block.type === 'RESTAURANT_MENU' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Tiêu đề thực đơn</label>
              <Input
                value={config.menuTitle || ''}
                onChange={(e) => updateConfig('menuTitle', e.target.value)}
                placeholder="Thực đơn nhà hàng"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Ghi chú thực đơn</label>
              <Input
                value={config.menuNote || ''}
                onChange={(e) => updateConfig('menuNote', e.target.value)}
                placeholder="Phục vụ từ 06:00 đến 22:00 hàng ngày"
                className="text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Inspector Footer Actions */}
      <div className="shrink-0 p-3.5 border-t border-line bg-raised/50 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-err hover:bg-err-soft transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Xóa khối này</span>
        </button>

        <Button
          size="sm"
          onClick={onClose}
          className="px-4 text-xs font-medium"
        >
          Hoàn tất
        </Button>
      </div>
    </div>
  )
}
