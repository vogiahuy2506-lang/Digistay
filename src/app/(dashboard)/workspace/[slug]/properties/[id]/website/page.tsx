'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Alert, AlertDescription } from '@/components/ui'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { normalizeFont } from '@/lib/public-site/font-stack'
import {
  Monitor, Smartphone, Eye, Save, Globe, Palette, Type, Image,
  Plus, Trash2, GripVertical, Settings, Layout, Search, ArrowRight,
  Check, X, ChevronRight, Shield, AlertCircle, Loader2, ExternalLink, RefreshCw, Star,
  LayoutGrid, Hotel, ImageIcon, MapPin, Phone, MousePointer2, Zap, Sparkles,
  FileText, Clock, Undo2, Redo2, Copy, Wand2, ChevronDown, ChevronUp
} from 'lucide-react'

interface WebsiteSettings {
  id: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  headingFont: string
  layout: string
  metaTitle?: string
  metaDescription?: string
  isPublished: boolean
  customDomain?: string
  sslEnabled: boolean
  sslVerifiedAt?: string
  sslProvider?: string
  domainVerificationStatus?: string
  domainVerifiedAt?: string
  propertyName?: string
  propertyDescription?: string
  propertyImages?: string[]
  rooms?: any[]
}

interface BlockConfig {
  // Hero
  heroTitle?: string
  heroSubtitle?: string
  heroImage?: string
  heroCtaText?: string
  heroCtaLink?: string
  
  // Rooms
  roomsTitle?: string
  roomsDisplay?: 'grid' | 'list'
  roomsLimit?: number
  
  // Amenities
  amenitiesTitle?: string
  amenitiesColumns?: number
  
  // About
  aboutTitle?: string
  aboutContent?: string
  aboutImage?: string
  
  // Gallery
  galleryTitle?: string
  galleryColumns?: number
  galleryImages?: string[]
  
  // Reviews
  reviewsTitle?: string
  reviewsLimit?: number
  
  // Map
  mapAddress?: string
  mapLat?: number
  mapLng?: number
  mapZoom?: number
  
  // Contact
  contactTitle?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
  contactFormEnabled?: boolean
  
  // CTA
  ctaTitle?: string
  ctaSubtitle?: string
  ctaButtonText?: string
  ctaButtonLink?: string
  ctaBackground?: string
}

interface Block {
  id: string
  type: string
  name: string
  isEnabled: boolean
  sortOrder: number
  config: BlockConfig
}

interface BlockType {
  type: string
  name: string
  icon: React.ElementType
  description: string
  color: string
  bgGradient: string
  defaultConfig: BlockConfig
}

const blockTypes: BlockType[] = [
  { 
    type: 'HERO', 
    name: 'Banner Hero', 
    icon: LayoutGrid, 
    description: 'Banner đầu trang với hình ảnh & tìm kiếm', 
    color: 'text-info', 
    bgGradient: 'from-blue-500 to-blue-600',
    defaultConfig: {
      heroTitle: 'Chào mừng đến với',
      heroSubtitle: 'Trải nghiệm lưu trú tuyệt vời',
      heroCtaText: 'Đặt phòng ngay',
      heroCtaLink: '#rooms'
    }
  },
  { 
    type: 'ROOMS', 
    name: 'Danh sách phòng', 
    icon: Hotel, 
    description: 'Hiển thị các hạng phòng', 
    color: 'text-ok', 
    bgGradient: 'from-emerald-500 to-emerald-600',
    defaultConfig: {
      roomsTitle: 'Các hạng phòng',
      roomsDisplay: 'grid',
      roomsLimit: 6
    }
  },
  { 
    type: 'AMENITIES', 
    name: 'Tiện ích', 
    icon: Zap, 
    description: 'Danh sách tiện ích cơ sở', 
    color: 'text-warn', 
    bgGradient: 'from-amber-500 to-amber-600',
    defaultConfig: {
      amenitiesTitle: 'Tiện ích nổi bật',
      amenitiesColumns: 3
    }
  },
  { 
    type: 'ABOUT', 
    name: 'Giới thiệu', 
    icon: Sparkles, 
    description: 'Thông tin giới thiệu', 
    color: 'text-refund', 
    bgGradient: 'from-purple-500 to-purple-600',
    defaultConfig: {
      aboutTitle: 'Về chúng tôi',
      aboutContent: 'Nơi mang đến cho bạn trải nghiệm lưu trú tuyệt vời với dịch vụ chuyên nghiệp và không gian thoải mái.'
    }
  },
  { 
    type: 'GALLERY', 
    name: 'Thư viện ảnh', 
    icon: ImageIcon, 
    description: 'Bộ sưu tập hình ảnh', 
    color: 'text-refund', 
    bgGradient: 'from-pink-500 to-pink-600',
    defaultConfig: {
      galleryTitle: 'Thư viện hình ảnh',
      galleryColumns: 3,
      galleryImages: []
    }
  },
  { 
    type: 'REVIEWS', 
    name: 'Đánh giá', 
    icon: Star, 
    description: 'Hiển thị đánh giá khách', 
    color: 'text-warn', 
    bgGradient: 'from-yellow-500 to-yellow-600',
    defaultConfig: {
      reviewsTitle: 'Đánh giá từ khách hàng',
      reviewsLimit: 4
    }
  },
  { 
    type: 'MAP', 
    name: 'Bản đồ', 
    icon: MapPin, 
    description: 'Vị trí Google Maps', 
    color: 'text-err', 
    bgGradient: 'from-red-500 to-red-600',
    defaultConfig: {
      mapAddress: 'Hà Nội, Việt Nam',
      mapZoom: 15
    }
  },
  { 
    type: 'CONTACT', 
    name: 'Liên hệ', 
    icon: Phone, 
    description: 'Thông tin liên hệ', 
    color: 'text-info', 
    bgGradient: 'from-cyan-500 to-cyan-600',
    defaultConfig: {
      contactTitle: 'Liên hệ với chúng tôi',
      contactFormEnabled: true
    }
  },
  { 
    type: 'CTA', 
    name: 'Call to Action', 
    icon: MousePointer2, 
    description: 'Nút kêu gọi hành động', 
    color: 'text-info', 
    bgGradient: 'from-indigo-500 to-indigo-600',
    defaultConfig: {
      ctaTitle: 'Sẵn sàng trải nghiệm?',
      ctaSubtitle: 'Đặt phòng ngay hôm nay để nhận ưu đãi đặc biệt',
      ctaButtonText: 'Đặt phòng ngay',
      ctaButtonLink: '#contact'
    }
  },
]

// Website Templates
interface WebsiteTemplate {
  id: string
  name: string
  description: string
  icon: React.ElementType
  blocks: Partial<Block>[]
}

const websiteTemplates: WebsiteTemplate[] = [
  {
    id: 'classic-hotel',
    name: 'Khách sạn Cổ điển',
    description: 'Phong cách thanh lịch, chuyên nghiệp',
    icon: Hotel,
    blocks: [
      { type: 'HERO', name: 'Banner Hero', isEnabled: true },
      { type: 'ROOMS', name: 'Danh sách phòng', isEnabled: true },
      { type: 'AMENITIES', name: 'Tiện ích', isEnabled: true },
      { type: 'ABOUT', name: 'Giới thiệu', isEnabled: true },
      { type: 'REVIEWS', name: 'Đánh giá', isEnabled: true },
      { type: 'CONTACT', name: 'Liên hệ', isEnabled: true },
    ]
  },
  {
    id: 'modern-resort',
    name: 'Resort Hiện đại',
    description: 'Tối giản, sang trọng, nghỉ dưỡng',
    icon: Sparkles,
    blocks: [
      { type: 'HERO', name: 'Banner Hero', isEnabled: true },
      { type: 'ABOUT', name: 'Giới thiệu', isEnabled: true },
      { type: 'ROOMS', name: 'Danh sách phòng', isEnabled: true },
      { type: 'GALLERY', name: 'Thư viện ảnh', isEnabled: true },
      { type: 'AMENITIES', name: 'Tiện ích', isEnabled: true },
      { type: 'CTA', name: 'Call to Action', isEnabled: true },
      { type: 'CONTACT', name: 'Liên hệ', isEnabled: true },
    ]
  },
  {
    id: 'budget-friendly',
    name: 'Tiết kiệm',
    description: 'Đơn giản, dễ dùng, giá tốt',
    icon: LayoutGrid,
    blocks: [
      { type: 'HERO', name: 'Banner Hero', isEnabled: true },
      { type: 'ROOMS', name: 'Danh sách phòng', isEnabled: true },
      { type: 'MAP', name: 'Bản đồ', isEnabled: true },
      { type: 'CONTACT', name: 'Liên hệ', isEnabled: true },
    ]
  },
  {
    id: 'premium-boutique',
    name: 'Boutique Cao cấp',
    description: 'Độc đáo, riêng tư, cao cấp',
    icon: Star,
    blocks: [
      { type: 'HERO', name: 'Banner Hero', isEnabled: true },
      { type: 'ABOUT', name: 'Giới thiệu', isEnabled: true },
      { type: 'ROOMS', name: 'Danh sách phòng', isEnabled: true },
      { type: 'GALLERY', name: 'Thư viện ảnh', isEnabled: true },
      { type: 'REVIEWS', name: 'Đánh giá', isEnabled: true },
      { type: 'AMENITIES', name: 'Tiện ích', isEnabled: true },
      { type: 'CTA', name: 'Call to Action', isEnabled: true },
      { type: 'MAP', name: 'Bản đồ', isEnabled: true },
      { type: 'CONTACT', name: 'Liên hệ', isEnabled: true },
    ]
  }
]

// Sortable Block Item Component
function SortableBlockItem({
  block,
  onRemove,
  onToggle,
  onEdit,
  isSelected,
}: {
  block: Block
  onRemove: () => void
  onToggle: () => void
  onEdit: () => void
  isSelected: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const blockTypeInfo = blockTypes.find(b => b.type === block.type)
  const BlockIcon = blockTypeInfo?.icon || Layout
  const bgGradient = blockTypeInfo?.bgGradient || 'from-gray-500 to-gray-600'

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isSelected ? 'ring-2 ring-acc ring-offset-2 border-acc bg-acc-soft' : ''}
        ${block.isEnabled 
          ? 'bg-panel border-line hover:shadow-md hover:border-acc hover:bg-acc-soft/30' 
          : 'bg-fg/[0.03] border-line opacity-60'
        }
        ${isDragging ? 'shadow-xl border-acc bg-acc-soft z-50 scale-[1.02]' : 'shadow-sm'}
      `}
    >
      <div 
        {...attributes}
        {...listeners}
        className="flex items-center gap-3 p-3 select-none"
      >
        {/* Drag Indicator */}
        <div className={`
          flex flex-col gap-0.5 py-1 px-1 rounded-lg transition-colors duration-200
          ${isDragging ? 'bg-acc-soft' : 'group-hover:bg-fg/5'}
        `}>
          <div className="w-4 h-1 rounded-full bg-current opacity-40"></div>
          <div className="w-4 h-1 rounded-full bg-current opacity-40"></div>
          <div className="w-4 h-1 rounded-full bg-current opacity-40"></div>
        </div>

        {/* Block Icon */}
        <div className={`
          w-10 h-10 rounded-xl flex items-center justify-center shrink-0
          bg-gradient-to-br ${bgGradient} text-white shadow-sm
        `}>
          <BlockIcon className="w-5 h-5" />
        </div>

        {/* Block Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${block.isEnabled ? 'text-fg' : 'text-muted'}`}>
            {block.name}
          </p>
          <p className="text-xs text-muted">{blockTypeInfo?.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Edit */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className={`
              p-1.5 rounded-lg transition-all duration-200
              ${isSelected 
                ? 'bg-acc-soft text-acc hover:bg-acc-soft' 
                : 'bg-fg/5 text-muted hover:bg-acc-soft hover:text-acc'
              }
            `}
            title="Cấu hình khối"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`
              p-1.5 rounded-lg transition-all duration-200
              ${block.isEnabled 
                ? 'bg-ok-soft text-ok hover:bg-ok-soft' 
                : 'bg-fg/5 text-muted hover:bg-fg/10'
              }
            `}
            title={block.isEnabled ? 'Ẩn khối' : 'Hiện khối'}
          >
            {block.isEnabled ? <Eye className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>

          {/* Remove */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg bg-fg/5 text-muted hover:bg-err-soft hover:text-err transition-all duration-200"
            title="Xóa khối"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drag hint */}
      <div className={`
        absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-acc font-medium
        bg-acc-soft px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
        ${isDragging ? 'opacity-100' : ''}
      `}>
        Kéo để sắp xếp
      </div>
    </div>
  )
}

// Block Configuration Panel Component
function BlockConfigPanel({
  block,
  onUpdate,
  onClose,
  propertyData
}: {
  block: Block
  onUpdate: (config: BlockConfig) => void
  onClose: () => void
  propertyData: any
}) {
  const blockTypeInfo = blockTypes.find(b => b.type === block.type)
  const BlockIcon = blockTypeInfo?.icon || Layout
  const bgGradient = blockTypeInfo?.bgGradient || 'from-gray-500 to-gray-600'
  const [config, setConfig] = React.useState<BlockConfig>(block.config || {})

  React.useEffect(() => {
    setConfig(block.config || {})
  }, [block])

  const updateConfig = (key: keyof BlockConfig, value: any) => {
    const newConfig = { ...config, [key]: value }
    setConfig(newConfig)
    onUpdate(newConfig)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-panel rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-fg/[0.03]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bgGradient} flex items-center justify-center shadow-lg`}>
              <BlockIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-fg">Cấu hình: {block.name}</h3>
              <p className="text-xs text-muted">{blockTypeInfo?.description}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-fg/5 transition-colors"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Hero Config */}
          {block.type === 'HERO' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Tiêu đề chính</label>
                <Input 
                  value={config.heroTitle || ''} 
                  onChange={(e) => updateConfig('heroTitle', e.target.value)}
                  placeholder="VD: Chào mừng đến với..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Phụ đề</label>
                <Input 
                  value={config.heroSubtitle || ''} 
                  onChange={(e) => updateConfig('heroSubtitle', e.target.value)}
                  placeholder="VD: Trải nghiệm lưu trú tuyệt vời"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Nút CTA</label>
                <Input 
                  value={config.heroCtaText || ''} 
                  onChange={(e) => updateConfig('heroCtaText', e.target.value)}
                  placeholder="VD: Đặt phòng ngay"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Link CTA</label>
                <Input 
                  value={config.heroCtaLink || ''} 
                  onChange={(e) => updateConfig('heroCtaLink', e.target.value)}
                  placeholder="VD: #rooms"
                />
              </div>
            </>
          )}

          {/* Rooms Config */}
          {block.type === 'ROOMS' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Tiêu đề</label>
                <Input 
                  value={config.roomsTitle || ''} 
                  onChange={(e) => updateConfig('roomsTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Kiểu hiển thị</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig('roomsDisplay', 'grid')}
                    className={`flex-1 py-2 rounded-lg border transition-all ${config.roomsDisplay === 'grid' ? 'border-acc bg-acc-soft text-acc' : 'border-line text-muted'}`}
                  >
                    Grid (Lưới)
                  </button>
                  <button
                    onClick={() => updateConfig('roomsDisplay', 'list')}
                    className={`flex-1 py-2 rounded-lg border transition-all ${config.roomsDisplay === 'list' ? 'border-acc bg-acc-soft text-acc' : 'border-line text-muted'}`}
                  >
                    List (Danh sách)
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Số phòng hiển thị</label>
                <Input 
                  type="number"
                  value={config.roomsLimit || 6} 
                  onChange={(e) => updateConfig('roomsLimit', parseInt(e.target.value))}
                  min={1}
                  max={20}
                />
              </div>
            </>
          )}

          {/* Amenities Config */}
          {block.type === 'AMENITIES' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Tiêu đề</label>
                <Input 
                  value={config.amenitiesTitle || ''} 
                  onChange={(e) => updateConfig('amenitiesTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Số cột hiển thị</label>
                <select
                  value={config.amenitiesColumns || 3}
                  onChange={(e) => updateConfig('amenitiesColumns', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={2}>2 cột</option>
                  <option value={3}>3 cột</option>
                  <option value={4}>4 cột</option>
                </select>
              </div>
            </>
          )}

          {/* About Config */}
          {block.type === 'ABOUT' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Tiêu đề</label>
                <Input 
                  value={config.aboutTitle || ''} 
                  onChange={(e) => updateConfig('aboutTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Nội dung</label>
                <textarea
                  value={config.aboutContent || ''}
                  onChange={(e) => updateConfig('aboutContent', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  placeholder="Giới thiệu về cơ sở của bạn..."
                />
              </div>
            </>
          )}

          {/* Gallery Config */}
          {block.type === 'GALLERY' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Tiêu đề</label>
                <Input 
                  value={config.galleryTitle || ''} 
                  onChange={(e) => updateConfig('galleryTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Số cột</label>
                <select
                  value={config.galleryColumns || 3}
                  onChange={(e) => updateConfig('galleryColumns', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={2}>2 cột</option>
                  <option value={3}>3 cột</option>
                  <option value={4}>4 cột</option>
                </select>
              </div>
            </>
          )}

          {/* Reviews Config */}
          {block.type === 'REVIEWS' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Tiêu đề</label>
                <Input 
                  value={config.reviewsTitle || ''} 
                  onChange={(e) => updateConfig('reviewsTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Số đánh giá hiển thị</label>
                <Input 
                  type="number"
                  value={config.reviewsLimit || 4} 
                  onChange={(e) => updateConfig('reviewsLimit', parseInt(e.target.value))}
                  min={1}
                  max={10}
                />
              </div>
            </>
          )}

          {/* Map Config */}
          {block.type === 'MAP' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Địa chỉ hiển thị</label>
                <Input 
                  value={config.mapAddress || ''} 
                  onChange={(e) => updateConfig('mapAddress', e.target.value)}
                  placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-fg block mb-1">Vĩ độ (Latitude)</label>
                  <Input 
                    type="number"
                    step="0.0001"
                    value={config.mapLat || ''} 
                    onChange={(e) => updateConfig('mapLat', parseFloat(e.target.value))}
                    placeholder="21.0285"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-fg block mb-1">Kinh độ (Longitude)</label>
                  <Input 
                    type="number"
                    step="0.0001"
                    value={config.mapLng || ''} 
                    onChange={(e) => updateConfig('mapLng', parseFloat(e.target.value))}
                    placeholder="105.8542"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Zoom level</label>
                <Input 
                  type="number"
                  value={config.mapZoom || 15} 
                  onChange={(e) => updateConfig('mapZoom', parseInt(e.target.value))}
                  min={1}
                  max={20}
                />
              </div>
            </>
          )}

          {/* Contact Config */}
          {block.type === 'CONTACT' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Tiêu đề</label>
                <Input 
                  value={config.contactTitle || ''} 
                  onChange={(e) => updateConfig('contactTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Email</label>
                <Input 
                  type="email"
                  value={config.contactEmail || ''} 
                  onChange={(e) => updateConfig('contactEmail', e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Số điện thoại</label>
                <Input 
                  value={config.contactPhone || ''} 
                  onChange={(e) => updateConfig('contactPhone', e.target.value)}
                  placeholder="0901 234 567"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Địa chỉ</label>
                <Input 
                  value={config.contactAddress || ''} 
                  onChange={(e) => updateConfig('contactAddress', e.target.value)}
                  placeholder="123 Đường ABC..."
                />
              </div>
              <div className="flex items-center gap-3 p-3 bg-fg/[0.03] rounded-lg">
                <input
                  type="checkbox"
                  id="contactForm"
                  checked={config.contactFormEnabled ?? true}
                  onChange={(e) => updateConfig('contactFormEnabled', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="contactForm" className="text-sm font-medium text-fg">
                  Hiển thị form liên hệ
                </label>
              </div>
            </>
          )}

          {/* CTA Config */}
          {block.type === 'CTA' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Tiêu đề</label>
                <Input 
                  value={config.ctaTitle || ''} 
                  onChange={(e) => updateConfig('ctaTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">Mô tả</label>
                <Input 
                  value={config.ctaSubtitle || ''} 
                  onChange={(e) => updateConfig('ctaSubtitle', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-fg block mb-1">Text nút</label>
                  <Input 
                    value={config.ctaButtonText || ''} 
                    onChange={(e) => updateConfig('ctaButtonText', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-fg block mb-1">Link nút</label>
                  <Input 
                    value={config.ctaButtonLink || ''} 
                    onChange={(e) => updateConfig('ctaButtonLink', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-fg/[0.03]">
          <Button onClick={onClose} className="w-full">Đóng</Button>
        </div>
      </div>
    </div>
  )
}

// Template Selection Modal
function TemplateModal({
  onSelect,
  onClose
}: {
  onSelect: (template: WebsiteTemplate) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-panel rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-fg/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-fg">Chọn Template</h3>
              <p className="text-xs text-muted">Bắt đầu nhanh với template có sẵn</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-fg/5 transition-colors"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {websiteTemplates.map((template) => {
              const TemplateIcon = template.icon
              return (
                <button
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className="p-4 rounded-xl border-2 border-line hover:border-acc hover:bg-acc-soft/30 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-fg/5 flex items-center justify-center group-hover:bg-info-soft transition-all">
                      <TemplateIcon className="w-7 h-7 text-muted group-hover:text-acc transition-colors" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-fg group-hover:text-acc transition-colors">
                        {template.name}
                      </h4>
                      <p className="text-sm text-muted mt-1">{template.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.blocks.slice(0, 4).map((b, i) => (
                          <Badge key={i} className="text-xs bg-fg/5 text-muted border-0">
                            {b.name}
                          </Badge>
                        ))}
                        {template.blocks.length > 4 && (
                          <Badge className="text-xs bg-fg/5 text-muted border-0">
                            +{template.blocks.length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-fg/[0.03]">
          <p className="text-sm text-muted text-center">
            Hoặc bắt đầu trống và tự thiết kế theo ý bạn
          </p>
        </div>
      </div>
    </div>
  )
}

// Block Overlay for Drag
function BlockOverlay({ block }: { block: Block }) {
  const blockTypeInfo = blockTypes.find(b => b.type === block.type)
  const BlockIcon = blockTypeInfo?.icon || Layout
  const bgGradient = blockTypeInfo?.bgGradient || 'from-gray-500 to-gray-600'

  return (
    <div className="w-full rounded-xl bg-panel border-2 border-acc shadow-2xl p-3 rotate-2 scale-105">
      <div className="flex items-center gap-3">
        <div className={`
          w-10 h-10 rounded-xl flex items-center justify-center
          bg-gradient-to-br ${bgGradient} text-white shadow-lg
        `}>
          <BlockIcon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm text-fg">{block.name}</p>
          <p className="text-xs text-muted">{blockTypeInfo?.description}</p>
        </div>
        <div className="px-2 py-1 bg-acc-soft rounded-lg">
          <span className="text-xs text-acc font-medium">Di chuyển...</span>
        </div>
      </div>
    </div>
  )
}

// Available Block Card
function AvailableBlockCard({
  blockType,
  isAdded,
  onAdd,
}: {
  blockType: BlockType
  isAdded: boolean
  onAdd: () => void
}) {
  const BlockIcon = blockType.icon

  return (
    <div className={`
      relative group rounded-xl border p-4 transition-all duration-300
      ${isAdded 
        ? 'bg-fg/[0.03] border-line opacity-70' 
        : 'bg-panel border-line hover:border-acc hover:shadow-lg'
      }
    `}>
      <div className="flex items-start gap-3">
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center
          bg-gradient-to-br ${blockType.bgGradient} text-white shadow-md
          group-hover:shadow-lg transition-shadow duration-300
        `}>
          <BlockIcon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${isAdded ? 'text-muted' : 'text-fg'}`}>
            {blockType.name}
          </p>
          <p className="text-xs text-muted mt-0.5 line-clamp-2">
            {blockType.description}
          </p>
        </div>
      </div>

      {/* Add Button */}
      {!isAdded ? (
        <button
          onClick={onAdd}
          className="
            mt-3 w-full py-2 rounded-lg text-sm font-medium
            bg-ink text-on-ink hover:bg-ink/90
            shadow-sm hover:shadow transition-all duration-200
            flex items-center justify-center gap-2
          "
        >
          <Plus className="w-4 h-4" />
          Thêm vào trang
        </button>
      ) : (
        <div className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-ok-soft text-ok flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />
          Đã thêm
        </div>
      )}
    </div>
  )
}

// Preview Block Component
function PreviewBlock({ 
  block, 
  propertyData,
  index 
}: { 
  block: Block
  propertyData: any
  index: number
}) {
  const blockTypeInfo = blockTypes.find(b => b.type === block.type)
  const BlockIcon = blockTypeInfo?.icon || Layout
  const bgGradient = blockTypeInfo?.bgGradient || 'from-slate-400 to-slate-500'
  const config = block.config || {}

  // Default property data if not provided
  const propertyName = propertyData?.name || 'Khách sạn của bạn'
  const propertyDescription = propertyData?.description || 'Mô tả ngắn về cơ sở của bạn'

  const renderBlockContent = () => {
    switch (block.type) {
      case 'HERO':
        return (
          <div className="relative h-64 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">{config.heroTitle || propertyName}</h2>
              <p className="text-muted mb-4">{config.heroSubtitle || propertyDescription}</p>
              <button className="px-6 py-2 bg-panel text-fg rounded-lg font-medium">
                {config.heroCtaText || 'Đặt phòng ngay'}
              </button>
            </div>
          </div>
        )
      
      case 'ROOMS':
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Hotel className="w-5 h-5 text-ok" />
              {config.roomsTitle || 'Các hạng phòng'}
            </h3>
            <div className={`grid gap-3 ${config.roomsDisplay === 'list' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-fg/5 rounded-lg p-3 flex gap-3">
                  <div className="w-16 h-16 bg-fg/10 rounded-lg flex items-center justify-center">
                    <Hotel className="w-6 h-6 text-muted" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-fg">Phòng {['Deluxe', 'Suite', 'Standard'][i-1]}</p>
                    <p className="text-sm text-muted">2 người • 25m²</p>
                    <p className="text-sm font-medium text-ok">500.000đ/đêm</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      
      case 'AMENITIES':
        const amenities = [
          { icon: '📶', name: 'Wifi miễn phí' },
          { icon: '🅿️', name: 'Bãi đỗ xe' },
          { icon: '🏊', name: 'Hồ bơi' },
          { icon: '🍽️', name: 'Nhà hàng' },
          { icon: '💆', name: 'Spa' },
          { icon: '🎤', name: 'Karaoke' },
        ]
        const cols = config.amenitiesColumns || 3
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-warn" />
              {config.amenitiesTitle || 'Tiện ích nổi bật'}
            </h3>
            <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {amenities.slice(0, cols * 2).map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-fg/[0.03] rounded-lg">
                  <span>{item.icon}</span>
                  <span className="text-sm text-fg">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )
      
      case 'ABOUT':
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-refund" />
              {config.aboutTitle || 'Về chúng tôi'}
            </h3>
            <p className="text-muted leading-relaxed">
              {config.aboutContent || propertyDescription}
            </p>
          </div>
        )
      
      case 'GALLERY':
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-refund" />
              {config.galleryTitle || 'Thư viện hình ảnh'}
            </h3>
            <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${config.galleryColumns || 3}, 1fr)` }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square bg-fg/5 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted" />
                </div>
              ))}
            </div>
          </div>
        )
      
      case 'REVIEWS':
        const reviews = [
          { name: 'Nguyễn Văn A', rating: 5, comment: 'Dịch vụ tuyệt vời, phòng sạch sẽ!' },
          { name: 'Trần Thị B', rating: 4, comment: 'Vị trí thuận tiện, nhân viên friendly.' },
          { name: 'Lê Văn C', rating: 5, comment: 'Sẽ quay lại lần sau!' },
        ]
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-warn" />
              {config.reviewsTitle || 'Đánh giá từ khách hàng'}
            </h3>
            <div className="space-y-3">
              {reviews.slice(0, config.reviewsLimit || 3).map((r, i) => (
                <div key={i} className="p-3 bg-fg/[0.03] rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-fg">{r.name}</span>
                    <div className="flex">
                      {[...Array(r.rating)].map((_, j) => (
                        <Star key={j} className="w-3 h-3 text-warn fill-warn" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted">{r.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )
      
      case 'MAP':
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-err" />
              Vị trí của chúng tôi
            </h3>
            <div className="h-40 bg-fg/5 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-err mx-auto mb-2" />
                <p className="text-sm text-muted">{config.mapAddress || 'Chưa cài đặt vị trí'}</p>
                <p className="text-xs text-muted mt-1">Google Maps Preview</p>
              </div>
            </div>
          </div>
        )
      
      case 'CONTACT':
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-info" />
              {config.contactTitle || 'Liên hệ với chúng tôi'}
            </h3>
            <div className="space-y-2 mb-4">
              {config.contactPhone && (
                <p className="text-sm text-muted flex items-center gap-2">
                  <Phone className="w-4 h-4" /> {config.contactPhone}
                </p>
              )}
              {config.contactEmail && (
                <p className="text-sm text-muted flex items-center gap-2">
                  <span>✉️</span> {config.contactEmail}
                </p>
              )}
              {config.contactAddress && (
                <p className="text-sm text-muted flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {config.contactAddress}
                </p>
              )}
            </div>
            {config.contactFormEnabled !== false && (
              <div className="space-y-2">
                <input type="text" placeholder="Họ tên" className="w-full px-3 py-2 border rounded-lg text-sm" disabled />
                <input type="email" placeholder="Email" className="w-full px-3 py-2 border rounded-lg text-sm" disabled />
                <textarea placeholder="Nội dung" className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} disabled />
                <button className="w-full py-2 bg-ink text-on-ink rounded-lg text-sm font-medium" disabled>
                  Gửi liên hệ
                </button>
              </div>
            )}
          </div>
        )
      
      case 'CTA':
        return (
          <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white text-center">
            <h3 className="text-xl font-bold mb-2">{config.ctaTitle || 'Sẵn sàng trải nghiệm?'}</h3>
            <p className="text-indigo-100 mb-4">{config.ctaSubtitle || 'Đặt phòng ngay hôm nay!'}</p>
            <button className="px-6 py-2 bg-panel text-info rounded-lg font-medium">
              {config.ctaButtonText || 'Đặt phòng ngay'}
            </button>
          </div>
        )
      
      default:
        return (
          <div className="p-6 bg-fg/5 rounded-xl text-center">
            <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
              <BlockIcon className="w-7 h-7 text-white" />
            </div>
            <p className="font-semibold text-fg">{block.name}</p>
          </div>
        )
    }
  }

  return (
    <div className="relative group">
      {renderBlockContent()}
      <div className="absolute -top-2 -right-2">
        <Badge className="bg-ink text-on-ink text-xs shadow-lg">
          #{index + 1}
        </Badge>
      </div>
    </div>
  )
}

// Main Component
export default function WebsiteBuilderPage() {
  const router = useRouter()
  const params = useParams()
  const propertyId = params.id as string

  const [settings, setSettings] = React.useState<WebsiteSettings | null>(null)
  const [blocks, setBlocks] = React.useState<Block[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [previewMode, setPreviewMode] = React.useState<'desktop' | 'mobile'>('desktop')
  const [activeTab, setActiveTab] = React.useState('blocks')
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [previewBlocks, setPreviewBlocks] = React.useState<Block[]>([])
  const [showTemplateModal, setShowTemplateModal] = React.useState(false)
  const [propertyData, setPropertyData] = React.useState<any>(null)
  
  // Undo/Redo state
  const [history, setHistory] = React.useState<Block[][]>([])
  const [historyIndex, setHistoryIndex] = React.useState(-1)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Update preview blocks
  React.useEffect(() => {
    setPreviewBlocks(blocks)
  }, [blocks])

  // Load data
  React.useEffect(() => {
    fetchWebsiteData()
  }, [propertyId])

  const fetchWebsiteData = async () => {
    try {
      // Fetch property data
      const propResponse = await fetch(`/api/properties/${propertyId}`)
      const propData = await propResponse.json()
      if (propData.success) {
        setPropertyData(propData.data)
      }

      // Fetch blocks
      const blocksResponse = await fetch(`/api/website/blocks?propertyId=${propertyId}`)
      const blocksData = await blocksResponse.json()
      
      if (blocksData.success) {
        setBlocks(blocksData.data.blocks || [])
        if (blocksData.data.settings) {
          setSettings(blocksData.data.settings)
        }
      }
    } catch (err) {
      console.error('Failed to fetch website data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // History management
  const pushHistory = (newBlocks: Block[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(JSON.parse(JSON.stringify(newBlocks)))
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setBlocks(history[historyIndex - 1])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setBlocks(history[historyIndex + 1])
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/website/blocks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, blocks }),
      })

      if (settings) {
        await fetch('/api/website/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, settings }),
        })
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const addBlock = (type: string, name: string) => {
    const blockTypeInfo = blockTypes.find(b => b.type === type)
    const newBlock: Block = {
      id: `block-${Date.now()}`,
      type,
      name,
      isEnabled: true,
      sortOrder: blocks.length,
      config: blockTypeInfo?.defaultConfig || {},
    }
    const newBlocks = [...blocks, newBlock]
    setBlocks(newBlocks)
    pushHistory(newBlocks)
  }

  const removeBlock = (blockId: string) => {
    const newBlocks = blocks.filter(b => b.id !== blockId)
    setBlocks(newBlocks)
    pushHistory(newBlocks)
  }

  const toggleBlock = (blockId: string) => {
    const newBlocks = blocks.map(b => 
      b.id === blockId ? { ...b, isEnabled: !b.isEnabled } : b
    )
    setBlocks(newBlocks)
    pushHistory(newBlocks)
  }

  const updateBlockConfig = (blockId: string, config: BlockConfig) => {
    const newBlocks = blocks.map(b => 
      b.id === blockId ? { ...b, config } : b
    )
    setBlocks(newBlocks)
  }

  const applyTemplate = (template: WebsiteTemplate) => {
    const newBlocks: Block[] = template.blocks.map((t, index) => {
      const blockTypeInfo = blockTypes.find(b => b.type === t.type)
      return {
        id: `block-${Date.now()}-${index}`,
        type: t.type || '',
        name: t.name || '',
        isEnabled: t.isEnabled ?? true,
        sortOrder: index,
        config: blockTypeInfo?.defaultConfig || {},
      }
    })
    setBlocks(newBlocks)
    pushHistory(newBlocks)
    setShowTemplateModal(false)
  }

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
    setIsDragging(true)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const newBlocks = arrayMove(blocks, 
        blocks.findIndex(item => item.id === active.id),
        blocks.findIndex(item => item.id === over.id)
      )
      setBlocks(newBlocks)
      pushHistory(newBlocks)
    }

    setActiveId(null)
    setIsDragging(false)
  }

  function handleDragMove(event: any) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const activeIndex = previewBlocks.findIndex(b => b.id === active.id)
      const overIndex = previewBlocks.findIndex(b => b.id === over.id)
      if (activeIndex !== overIndex) {
        setPreviewBlocks(arrayMove(previewBlocks, activeIndex, overIndex))
      }
    }
  }

  const activeBlock = activeId ? (previewBlocks.length > 0 ? previewBlocks.find(b => b.id === activeId) : blocks.find(b => b.id === activeId)) : null
  const selectedBlock = selectedBlockId ? blocks.find(b => b.id === selectedBlockId) : null

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc"></div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-panel rounded-2xl p-4 shadow-sm border border-line">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="gap-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Quay lại
          </Button>
          <div className="h-8 w-px bg-fg/10" />
          <div>
            <h1 className="text-xl font-bold text-fg flex items-center gap-2">
              <Layout className="w-5 h-5 text-acc" />
              Website Builder
            </h1>
            <p className="text-sm text-muted">Kéo thả để sắp xếp giao diện website</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 bg-fg/5 rounded-lg p-1">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-2 rounded-md hover:bg-panel hover:shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-transparent"
              title="Hoàn tác (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4 text-muted" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 rounded-md hover:bg-panel hover:shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-transparent"
              title="Làm lại (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4 text-muted" />
            </button>
          </div>

          {/* Template Button */}
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateModal(true)}
            className="gap-2"
          >
            <Wand2 className="w-4 h-4" />
            Template
          </Button>

          {/* Preview Mode Toggle */}
          <div className="flex items-center gap-1 bg-fg/5 rounded-xl p-1">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={`
                p-2 rounded-lg transition-all duration-200
                ${previewMode === 'desktop' 
                  ? 'bg-panel shadow-sm text-acc' 
                  : 'text-muted hover:text-fg'
                }
              `}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={`
                p-2 rounded-lg transition-all duration-200
                ${previewMode === 'mobile' 
                  ? 'bg-panel shadow-sm text-acc' 
                  : 'text-muted hover:text-fg'
                }
              `}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={() => window.open(`/${settings?.customDomain || propertyId}`, '_blank')}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            Xem trước
          </Button>
          
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            size="sm"
            className="gap-2 shadow-lg"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Sidebar - Block Editor */}
        <div className="xl:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 bg-fg/5 p-1 rounded-xl">
              <TabsTrigger 
                value="blocks"
                className="rounded-lg data-[state=active]:bg-panel data-[state=active]:shadow-sm"
              >
                <Layout className="w-4 h-4 mr-1.5" />
                Blocks
              </TabsTrigger>
              <TabsTrigger 
                value="style"
                className="rounded-lg data-[state=active]:bg-panel data-[state=active]:shadow-sm"
              >
                <Palette className="w-4 h-4 mr-1.5" />
                Style
              </TabsTrigger>
              <TabsTrigger 
                value="settings"
                className="rounded-lg data-[state=active]:bg-panel data-[state=active]:shadow-sm"
              >
                <Settings className="w-4 h-4 mr-1.5" />
                Cài đặt
              </TabsTrigger>
            </TabsList>

            {/* Blocks Tab */}
            <TabsContent value="blocks" className="mt-4 space-y-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              >
                {/* Active Blocks - Sortable */}
                <div className="bg-panel rounded-2xl border border-line p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <LayoutGrid className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-fg">Sắp xếp khối</h3>
                        <p className="text-xs text-muted">Kéo thả để sắp xếp thứ tự</p>
                      </div>
                    </div>
                    <Badge className="bg-acc-soft text-acc border-acc/30">
                      {blocks.length} khối
                    </Badge>
                  </div>

                  {blocks.length === 0 ? (
                    <div className="text-center py-10 bg-info-soft/40 rounded-xl border-2 border-dashed border-info/30">
                      <div className="w-16 h-16 rounded-2xl bg-info-soft flex items-center justify-center mx-auto mb-3">
                        <GripVertical className="w-8 h-8 text-info" />
                      </div>
                      <p className="text-sm font-semibold text-muted mb-1">Chưa có khối nào</p>
                      <p className="text-xs text-muted max-w-[200px] mx-auto mb-3">
                        Chọn template hoặc thêm khối thủ công
                      </p>
                      <Button 
                        size="sm" 
                        onClick={() => setShowTemplateModal(true)}
                        className="gap-2"
                      >
                        <Wand2 className="w-4 h-4" />
                        Chọn Template
                      </Button>
                    </div>
                  ) : (
                    <SortableContext
                      items={blocks.map(b => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {blocks.map((block) => (
                          <SortableBlockItem
                            key={block.id}
                            block={block}
                            onRemove={() => removeBlock(block.id)}
                            onToggle={() => toggleBlock(block.id)}
                            onEdit={() => setSelectedBlockId(block.id)}
                            isSelected={selectedBlockId === block.id}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </div>

                <DragOverlay>
                  {activeBlock ? <BlockOverlay block={activeBlock} /> : null}
                </DragOverlay>
              </DndContext>

              {/* Available Blocks */}
              <div className="bg-panel rounded-2xl border border-line p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-ink flex items-center justify-center shadow-lg">
                    <Plus className="w-4 h-4 text-on-ink" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-fg">Thêm khối mới</h3>
                    <p className="text-xs text-muted">Chọn khối để thêm vào website</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {blockTypes.map((blockType) => {
                    const isAdded = blocks.some(b => b.type === blockType.type)
                    return (
                      <AvailableBlockCard
                        key={blockType.type}
                        blockType={blockType}
                        isAdded={isAdded}
                        onAdd={() => addBlock(blockType.type, blockType.name)}
                      />
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Màu sắc
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-fg">Màu chính</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={settings?.primaryColor || '#3B82F6'}
                        onChange={(e) => setSettings({ ...settings!, primaryColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={settings?.primaryColor || '#3B82F6'}
                        onChange={(e) => setSettings({ ...settings!, primaryColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-fg">Màu phụ</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={settings?.secondaryColor || '#10B981'}
                        onChange={(e) => setSettings({ ...settings!, secondaryColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={settings?.secondaryColor || '#10B981'}
                        onChange={(e) => setSettings({ ...settings!, secondaryColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-fg">Màu nhấn</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={settings?.accentColor || '#F59E0B'}
                        onChange={(e) => setSettings({ ...settings!, accentColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={settings?.accentColor || '#F59E0B'}
                        onChange={(e) => setSettings({ ...settings!, accentColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Phông chữ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-fg">Phông chữ chính</label>
                    <select
                      value={normalizeFont(settings?.fontFamily, 'body')}
                      onChange={(e) => setSettings({ ...settings!, fontFamily: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    >
                      <option value="Inter">Inter - Hiện đại</option>
                      <option value="Roboto">Roboto - Phổ biến</option>
                      <option value="Open Sans">Open Sans - Dễ đọc</option>
                      <option value="Nunito Sans">Nunito Sans - Thanh lịch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-fg">Phông chữ tiêu đề</label>
                    <select
                      value={normalizeFont(settings?.headingFont, 'heading')}
                      onChange={(e) => setSettings({ ...settings!, headingFont: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    >
                      <option value="Playfair Display">Playfair Display - Sang trọng</option>
                      <option value="Merriweather">Merriweather - Truyền thống</option>
                      <option value="Be Vietnam Pro">Be Vietnam Pro - Trẻ trung</option>
                      <option value="Montserrat">Montserrat - Năng động</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">SEO & Meta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Tiêu đề trang (Meta Title)"
                    value={settings?.metaTitle || ''}
                    onChange={(e) => setSettings({ ...settings!, metaTitle: e.target.value })}
                    placeholder="VD: Khách sạn ABC - Đặt phòng online"
                  />
                  <div>
                    <label className="text-sm font-medium text-fg">Mô tả trang</label>
                    <textarea
                      value={settings?.metaDescription || ''}
                      onChange={(e) => setSettings({ ...settings!, metaDescription: e.target.value })}
                      placeholder="Mô tả ngắn về cơ sở của bạn..."
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Xuất bản</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {settings?.isPublished ? 'Đã xuất bản' : 'Chưa xuất bản'}
                      </p>
                      <p className="text-sm text-muted">
                        {settings?.isPublished 
                          ? 'Website đang hoạt động công khai' 
                          : 'Website chỉ hiển thị khi bạn xuất bản'}
                      </p>
                    </div>
                    <Button 
                      onClick={() => setSettings({ ...settings!, isPublished: !settings?.isPublished })}
                      variant={settings?.isPublished ? 'danger' : 'primary'}
                    >
                      {settings?.isPublished ? 'Gỡ xuất bản' : 'Xuất bản ngay'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Area */}
        <div className="xl:col-span-3">
          <Card className="overflow-hidden shadow-lg border-line">
            {/* The hotel website is light-only, so its preview stays light in the dark dashboard. */}
            <div data-theme="light" className={`bg-fg/5 border-b border-line p-4 ${previewMode === 'mobile' ? 'max-w-[420px] mx-auto' : ''}`}>
              {/* Browser Chrome */}
              <div className="bg-panel rounded-t-xl shadow-sm border border-line overflow-hidden">
                {/* Traffic Lights */}
                <div className="bg-fg/5 px-4 py-2.5 flex items-center gap-3 border-b border-line">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-err"></div>
                    <div className="w-3 h-3 rounded-full bg-warn"></div>
                    <div className="w-3 h-3 rounded-full bg-ok"></div>
                  </div>
                  <div className="flex-1 bg-fg/[0.03] rounded-lg px-4 py-1.5 text-sm text-muted flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" />
                    {settings?.customDomain || `${propertyId.slice(0, 8)}...digistay.vn`}
                    {settings?.sslEnabled && <Shield className="w-3.5 h-3.5 text-ok" />}
                  </div>
                </div>
                
                {/* Website Preview Content */}
                <div className={`min-h-[600px] bg-panel ${previewMode === 'mobile' ? 'max-h-[700px] overflow-y-auto' : ''}`}>
                  {/* Dragging indicator */}
                  {isDragging && (
                    <div className="sticky top-0 z-50 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-lg">
                      <div className="w-2 h-2 rounded-full bg-panel animate-pulse"></div>
                      Đang kéo thả... Di chuyển khối đến vị trí mong muốn
                    </div>
                  )}
                  
                  {previewBlocks.length === 0 && !isDragging ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                      <div className="w-20 h-20 rounded-2xl bg-fg/5 flex items-center justify-center mb-4">
                        <LayoutGrid className="w-10 h-10 text-muted" />
                      </div>
                      <h3 className="text-lg font-semibold text-muted mb-2">Chưa có khối nào</h3>
                      <p className="text-sm text-muted max-w-xs mb-4">
                        Thêm các khối từ panel bên trái hoặc chọn template để bắt đầu
                      </p>
                      <Button onClick={() => setShowTemplateModal(true)} className="gap-2">
                        <Wand2 className="w-4 h-4" />
                        Chọn Template
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4">
                      {(isDragging ? previewBlocks : blocks).filter(b => b.isEnabled).map((block, index) => {
                        const isBeingDragged = isDragging && activeId === block.id
                        
                        return (
                          <div 
                            key={block.id} 
                            className={`
                              rounded-xl border-2 transition-all duration-300
                              ${isBeingDragged 
                                ? 'border-info/30 bg-info-soft scale-95 opacity-50' 
                                : 'border-transparent hover:border-line hover:bg-fg/[0.03]'
                              }
                            `}
                          >
                            <PreviewBlock 
                              block={block} 
                              propertyData={propertyData}
                              index={index}
                            />
                          </div>
                        )
                      })}
                      
                      {(isDragging ? previewBlocks : blocks).filter(b => b.isEnabled).length === 0 && (
                        <div className="text-center py-12">
                          <p className="text-muted">Tất cả các khối đang bị ẩn</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Block Configuration Modal */}
      {selectedBlock && (
        <BlockConfigPanel
          block={selectedBlock}
          onUpdate={(config) => updateBlockConfig(selectedBlock.id, config)}
          onClose={() => setSelectedBlockId(null)}
          propertyData={propertyData}
        />
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <TemplateModal
          onSelect={applyTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </PageContainer>
  )
}
