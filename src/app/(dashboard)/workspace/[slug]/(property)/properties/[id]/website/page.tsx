'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'
import { PageContainer } from '@/components/layout'
import { toast } from '@/components/ui/toast'
import { EnglishCopy } from '@/components/ui/english-copy'
import { CoverPicker } from './cover-picker'
import { ReviewsEditor, type ReviewEntry } from './reviews-editor'
import { CustomDomainCard, type DomainSettings } from './custom-domain-card'
import { useProperty } from '@/lib/hooks/use-property'
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
  FileText, Clock, Undo2, Redo2, Copy, Wand2, ChevronDown, ChevronUp, ConciergeBell, UtensilsCrossed
} from 'lucide-react'
import { apiError } from '@/lib/i18n/api-errors'

interface WebsiteSettings {
  id: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  /** #rrggbb, null: Digistay's ink (src/lib/public-site/accent.ts hotelButtonVariables). */
  buttonColor?: string | null
  /** #rrggbb, null: the text color. */
  headingColor?: string | null
  fontFamily: string
  headingFont: string
  layout: string
  metaTitle?: string
  metaDescription?: string
  translations?: { en?: { metaTitle?: string; metaDescription?: string } } | null
  isPublished: boolean
  customDomain?: string
  sslEnabled: boolean
  sslVerifiedAt?: string
  sslProvider?: string
  domainVerificationStatus?: string
  domainVerifiedAt?: string
  sslRequestedAt?: string | null
  sslError?: string | null
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
  /** The cover photo HeroBlock puts first (CoverPicker); none: the property's own first photo. */
  backgroundImage?: string
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
  /** The hotel's real guest reviews (ReviewsEditor); the block shows nothing without them. */
  reviews?: ReviewEntry[]
  
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

  // Services (the services page's list) and the restaurant menu (the menu page's dishes)
  servicesTitle?: string
  menuTitle?: string
  menuNote?: string

  /** The same texts in English, for the site's /en pages (blockText in src/lib/i18n/content.ts). */
  en?: Partial<Record<BlockTextKey, string>>
}

type BlockTextKey =
  | 'heroTitle' | 'heroSubtitle' | 'heroCtaText' | 'roomsTitle' | 'amenitiesTitle' | 'aboutTitle' | 'aboutContent'
  | 'galleryTitle' | 'reviewsTitle' | 'contactTitle' | 'ctaTitle' | 'ctaSubtitle' | 'ctaButtonText'
  | 'servicesTitle' | 'menuTitle' | 'menuNote'

/** Each block type's texts that have an English version, with their field label (dash.website.config.fields). */
const BLOCK_TEXTS: Record<string, { key: BlockTextKey; label: 'heroTitle' | 'subtitle' | 'ctaButton' | 'title' | 'content' | 'description' | 'buttonText'; long?: boolean }[]> = {
  HERO: [{ key: 'heroTitle', label: 'heroTitle' }, { key: 'heroSubtitle', label: 'subtitle' }, { key: 'heroCtaText', label: 'ctaButton' }],
  ROOMS: [{ key: 'roomsTitle', label: 'title' }],
  AMENITIES: [{ key: 'amenitiesTitle', label: 'title' }],
  ABOUT: [{ key: 'aboutTitle', label: 'title' }, { key: 'aboutContent', label: 'content', long: true }],
  GALLERY: [{ key: 'galleryTitle', label: 'title' }],
  REVIEWS: [{ key: 'reviewsTitle', label: 'title' }],
  CONTACT: [{ key: 'contactTitle', label: 'title' }],
  CTA: [{ key: 'ctaTitle', label: 'title' }, { key: 'ctaSubtitle', label: 'description' }, { key: 'ctaButtonText', label: 'buttonText' }],
  SERVICES: [{ key: 'servicesTitle', label: 'title' }],
  RESTAURANT_MENU: [{ key: 'menuTitle', label: 'title' }, { key: 'menuNote', label: 'description' }],
}

interface Block {
  id: string
  type: string
  name: string
  isEnabled: boolean
  sortOrder: number
  config: BlockConfig
}

type BlockTypeKey = 'HERO' | 'ROOMS' | 'AMENITIES' | 'ABOUT' | 'GALLERY' | 'REVIEWS' | 'MAP' | 'CONTACT' | 'CTA' | 'SERVICES' | 'RESTAURANT_MENU'

interface BlockType {
  type: BlockTypeKey
  // Saved as a new block's name (website content, kept as is); the dashboard
  // shows the type's name and description from messages (dash.website.blockTypes).
  name: string
  icon: React.ElementType
  color: string
  bgGradient: string
  defaultConfig: BlockConfig
}

const blockTypes: BlockType[] = [
  { 
    type: 'HERO', 
    name: 'Banner Hero', 
    icon: LayoutGrid, 
    color: 'text-info', 
    bgGradient: 'from-blue-500 to-blue-600',
    defaultConfig: {
      // No title: the site shows the hotel's name (the old default, a bare "Chào mừng đến với", showed nothing after it).
      heroTitle: '',
      heroSubtitle: 'Trải nghiệm lưu trú tuyệt vời',
      heroCtaText: 'Đặt phòng ngay',
      heroCtaLink: '#rooms'
    }
  },
  { 
    type: 'ROOMS', 
    name: 'Danh sách phòng', 
    icon: Hotel, 
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
    color: 'text-info', 
    bgGradient: 'from-indigo-500 to-indigo-600',
    defaultConfig: {
      ctaTitle: 'Sẵn sàng trải nghiệm?',
      ctaSubtitle: 'Đặt phòng ngay hôm nay để nhận ưu đãi đặc biệt',
      ctaButtonText: 'Đặt phòng ngay',
      ctaButtonLink: '#contact'
    }
  },
  {
    // The services from the services page (ExtraService); no title: the site's own, in its language.
    type: 'SERVICES',
    name: 'Dịch vụ',
    icon: ConciergeBell,
    color: 'text-info',
    bgGradient: 'from-teal-500 to-teal-600',
    defaultConfig: {}
  },
  {
    // The dishes from the menu page (MenuItem); shows nothing until there is one.
    type: 'RESTAURANT_MENU',
    name: 'Thực đơn',
    icon: UtensilsCrossed,
    color: 'text-warn',
    bgGradient: 'from-orange-500 to-orange-600',
    defaultConfig: {}
  },
]

// Website Templates
interface WebsiteTemplate {
  id: string
  // Its name and description: dash.website.templates.<key>
  key: 'classicHotel' | 'modernResort' | 'budgetFriendly' | 'premiumBoutique'
  icon: React.ElementType
  // The blocks' names are saved with them (website content, kept as is).
  blocks: Partial<Block>[]
}

const websiteTemplates: WebsiteTemplate[] = [
  {
    id: 'classic-hotel',
    key: 'classicHotel',
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
    key: 'modernResort',
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
    key: 'budgetFriendly',
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
    key: 'premiumBoutique',
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

// The fonts on offer, each with a word on its character (dash.website.style.fontTraits).
const bodyFonts = [
  { value: 'Inter', trait: 'modern' },
  { value: 'Roboto', trait: 'popular' },
  { value: 'Open Sans', trait: 'readable' },
  { value: 'Nunito Sans', trait: 'elegant' },
] as const
const headingFonts = [
  { value: 'Playfair Display', trait: 'luxurious' },
  { value: 'Merriweather', trait: 'traditional' },
  { value: 'Be Vietnam Pro', trait: 'youthful' },
  { value: 'Montserrat', trait: 'dynamic' },
] as const

/** A block type's name and description in the dashboard's language. */
function useBlockText() {
  const t = useTranslations('dash.website.blockTypes')
  return React.useMemo(() => {
    const info = (type?: string) => blockTypes.find((b) => b.type === type)
    return {
      typeName: (type: BlockTypeKey) => t(`${type}.name`),
      description: (type?: string) => {
        const found = info(type)
        return found ? t(`${found.type}.description`) : undefined
      },
      // A block keeps the name it was saved with; the default one (its type's
      // name) is shown in the dashboard's language, any other as it is.
      blockName: (block: { type?: string; name?: string }) => {
        const found = info(block.type)
        return found && block.name === found.name ? t(`${found.type}.name`) : (block.name ?? '')
      },
    }
  }, [t])
}

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
  const t = useTranslations('dash.website.sortable')
  const text = useBlockText()

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
            {text.blockName(block)}
          </p>
          <p className="text-xs text-muted">{text.description(block.type)}</p>
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
            title={t('configure')}
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
            title={block.isEnabled ? t('hide') : t('show')}
          >
            {block.isEnabled ? <Eye className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>

          {/* Remove */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg bg-fg/5 text-muted hover:bg-err-soft hover:text-err transition-all duration-200"
            title={t('remove')}
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
        {t('dragHint')}
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
  const t = useTranslations('dash.website.config')
  const tc = useTranslations('dash.common')
  const text = useBlockText()
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
  const englishTexts = BLOCK_TEXTS[block.type] ?? []
  const updateEnglish = (key: BlockTextKey, value: string) => updateConfig('en', { ...config.en, [key]: value })

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
              <h3 className="font-semibold text-fg">{t('heading', { name: text.blockName(block) })}</h3>
              <p className="text-xs text-muted">{text.description(block.type)}</p>
            </div>
          </div>
          <button aria-label={tc('actions.close')} 
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
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.heroTitle')}</label>
                <Input 
                  value={config.heroTitle || ''} 
                  onChange={(e) => updateConfig('heroTitle', e.target.value)}
                  placeholder={t('placeholders.heroTitle')}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.subtitle')}</label>
                <Input 
                  value={config.heroSubtitle || ''} 
                  onChange={(e) => updateConfig('heroSubtitle', e.target.value)}
                  placeholder={t('placeholders.heroSubtitle')}
                />
              </div>
              <CoverPicker
                photos={propertyData?.images ?? []}
                value={config.backgroundImage || undefined}
                onChange={(url) => updateConfig('backgroundImage', url)}
              />
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.ctaButton')}</label>
                <Input 
                  value={config.heroCtaText || ''} 
                  onChange={(e) => updateConfig('heroCtaText', e.target.value)}
                  placeholder={t('placeholders.ctaButton')}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.ctaLink')}</label>
                <Input 
                  value={config.heroCtaLink || ''} 
                  onChange={(e) => updateConfig('heroCtaLink', e.target.value)}
                  placeholder={t('placeholders.ctaLink')}
                />
              </div>
            </>
          )}

          {/* Rooms Config */}
          {block.type === 'ROOMS' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input 
                  value={config.roomsTitle || ''} 
                  onChange={(e) => updateConfig('roomsTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.displayStyle')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig('roomsDisplay', 'grid')}
                    className={`flex-1 py-2 rounded-lg border transition-all ${config.roomsDisplay === 'grid' ? 'border-acc bg-acc-soft text-acc' : 'border-line text-muted'}`}
                  >
                    {t('display.grid')}
                  </button>
                  <button
                    onClick={() => updateConfig('roomsDisplay', 'list')}
                    className={`flex-1 py-2 rounded-lg border transition-all ${config.roomsDisplay === 'list' ? 'border-acc bg-acc-soft text-acc' : 'border-line text-muted'}`}
                  >
                    {t('display.list')}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.roomsLimit')}</label>
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
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input 
                  value={config.amenitiesTitle || ''} 
                  onChange={(e) => updateConfig('amenitiesTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.columnsShown')}</label>
                <select
                  value={config.amenitiesColumns || 3}
                  onChange={(e) => updateConfig('amenitiesColumns', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={2}>{t('columnCount', { count: 2 })}</option>
                  <option value={3}>{t('columnCount', { count: 3 })}</option>
                  <option value={4}>{t('columnCount', { count: 4 })}</option>
                </select>
              </div>
            </>
          )}

          {/* About Config */}
          {block.type === 'ABOUT' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input 
                  value={config.aboutTitle || ''} 
                  onChange={(e) => updateConfig('aboutTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.content')}</label>
                <textarea
                  value={config.aboutContent || ''}
                  onChange={(e) => updateConfig('aboutContent', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  placeholder={t('placeholders.about')}
                />
              </div>
            </>
          )}

          {/* Gallery Config */}
          {block.type === 'GALLERY' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input 
                  value={config.galleryTitle || ''} 
                  onChange={(e) => updateConfig('galleryTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.columns')}</label>
                <select
                  value={config.galleryColumns || 3}
                  onChange={(e) => updateConfig('galleryColumns', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={2}>{t('columnCount', { count: 2 })}</option>
                  <option value={3}>{t('columnCount', { count: 3 })}</option>
                  <option value={4}>{t('columnCount', { count: 4 })}</option>
                </select>
              </div>
            </>
          )}

          {/* Reviews Config */}
          {block.type === 'REVIEWS' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input 
                  value={config.reviewsTitle || ''} 
                  onChange={(e) => updateConfig('reviewsTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.reviewsLimit')}</label>
                <Input 
                  type="number"
                  value={config.reviewsLimit || 4} 
                  onChange={(e) => updateConfig('reviewsLimit', parseInt(e.target.value))}
                  min={1}
                  max={10}
                />
              </div>
              <ReviewsEditor value={config.reviews ?? []} onChange={(reviews) => updateConfig('reviews', reviews)} />
            </>
          )}

          {/* Map Config */}
          {block.type === 'MAP' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.mapAddress')}</label>
                <Input 
                  value={config.mapAddress || ''} 
                  onChange={(e) => updateConfig('mapAddress', e.target.value)}
                  placeholder={t('placeholders.mapAddress')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-fg block mb-1">{t('fields.latitude')}</label>
                  <Input 
                    type="number"
                    step="0.0001"
                    value={config.mapLat || ''} 
                    onChange={(e) => updateConfig('mapLat', parseFloat(e.target.value))}
                    placeholder="21.0285"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-fg block mb-1">{t('fields.longitude')}</label>
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
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.zoom')}</label>
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
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input 
                  value={config.contactTitle || ''} 
                  onChange={(e) => updateConfig('contactTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.email')}</label>
                <Input 
                  type="email"
                  value={config.contactEmail || ''} 
                  onChange={(e) => updateConfig('contactEmail', e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.phone')}</label>
                <Input 
                  value={config.contactPhone || ''} 
                  onChange={(e) => updateConfig('contactPhone', e.target.value)}
                  placeholder="0901 234 567"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.address')}</label>
                <Input 
                  value={config.contactAddress || ''} 
                  onChange={(e) => updateConfig('contactAddress', e.target.value)}
                  placeholder={t('placeholders.address')}
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
                  {t('contactForm')}
                </label>
              </div>
            </>
          )}

          {/* Services Config */}
          {block.type === 'SERVICES' && (
            <>
              <p className="rounded-box bg-fg/[0.03] p-3 text-sm text-muted">{t('servicesHint')}</p>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input
                  value={config.servicesTitle || ''}
                  onChange={(e) => updateConfig('servicesTitle', e.target.value)}
                  placeholder={t('placeholders.servicesTitle')}
                />
              </div>
            </>
          )}

          {/* Restaurant Menu Config */}
          {block.type === 'RESTAURANT_MENU' && (
            <>
              <p className="rounded-box bg-fg/[0.03] p-3 text-sm text-muted">{t('menuHint')}</p>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input
                  value={config.menuTitle || ''}
                  onChange={(e) => updateConfig('menuTitle', e.target.value)}
                  placeholder={t('placeholders.menuTitle')}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.description')}</label>
                <Input
                  value={config.menuNote || ''}
                  onChange={(e) => updateConfig('menuNote', e.target.value)}
                  placeholder={t('placeholders.menuNote')}
                />
              </div>
            </>
          )}

          {/* CTA Config */}
          {block.type === 'CTA' && (
            <>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.title')}</label>
                <Input 
                  value={config.ctaTitle || ''} 
                  onChange={(e) => updateConfig('ctaTitle', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-fg block mb-1">{t('fields.description')}</label>
                <Input 
                  value={config.ctaSubtitle || ''} 
                  onChange={(e) => updateConfig('ctaSubtitle', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-fg block mb-1">{t('fields.buttonText')}</label>
                  <Input 
                    value={config.ctaButtonText || ''} 
                    onChange={(e) => updateConfig('ctaButtonText', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-fg block mb-1">{t('fields.buttonLink')}</label>
                  <Input 
                    value={config.ctaButtonLink || ''} 
                    onChange={(e) => updateConfig('ctaButtonLink', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {englishTexts.length > 0 && (
            <EnglishCopy filled={englishTexts.some(({ key }) => config.en?.[key])}>
              {englishTexts.map(({ key, label, long }) => (
                <div key={key}>
                  <label htmlFor={`en-${key}`} className="text-sm font-medium text-fg block mb-1">{t(`fields.${label}`)}</label>
                  {long ? (
                    <textarea
                      id={`en-${key}`}
                      value={config.en?.[key] ?? ''}
                      onChange={(e) => updateEnglish(key, e.target.value)}
                      placeholder={config[key] ?? ''}
                      rows={4}
                      className="w-full px-3 py-2 border border-line rounded-ctl bg-raised text-fg text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                    />
                  ) : (
                    <Input
                      id={`en-${key}`}
                      value={config.en?.[key] ?? ''}
                      onChange={(e) => updateEnglish(key, e.target.value)}
                      placeholder={config[key] ?? ''}
                    />
                  )}
                </div>
              ))}
            </EnglishCopy>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-fg/[0.03]">
          <Button onClick={onClose} className="w-full">{tc('actions.close')}</Button>
        </div>
      </div>
    </div>
  )
}

/** A color the hotel may leave to the default (null): a swatch, the hex, and "Mặc định". */
function OptionalColor({
  label,
  hint,
  value,
  fallback,
  onChange,
  defaultLabel,
}: {
  label: string
  hint: string
  value: string | null
  fallback: string
  onChange: (value: string | null) => void
  defaultLabel: string
}) {
  const [text, setText] = React.useState(value ?? '')
  React.useEffect(() => setText(value ?? ''), [value])
  return (
    <div>
      <label className="text-sm font-medium text-fg">{label}</label>
      <p className="text-xs text-muted">{hint}</p>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          aria-label={label}
          value={value ?? fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-10 h-10 rounded border cursor-pointer"
        />
        <Input
          value={text}
          placeholder={defaultLabel}
          onChange={(e) => {
            setText(e.target.value)
            const v = e.target.value.trim()
            if (v === '') onChange(null)
            else if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toUpperCase())
          }}
          className="flex-1"
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={value === null}>
          {defaultLabel}
        </Button>
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
  const t = useTranslations('dash.website.templates')
  const tc = useTranslations('dash.common')
  const text = useBlockText()
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
              <h3 className="font-semibold text-fg">{t('choose')}</h3>
              <p className="text-xs text-muted">{t('subtitle')}</p>
            </div>
          </div>
          <button aria-label={tc('actions.close')} 
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
                        {t(`${template.key}.name`)}
                      </h4>
                      <p className="text-sm text-muted mt-1">{t(`${template.key}.description`)}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.blocks.slice(0, 4).map((b, i) => (
                          <Badge key={i} className="text-xs bg-fg/5 text-muted border-0">
                            {text.blockName(b)}
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
            {t('startBlank')}
          </p>
        </div>
      </div>
    </div>
  )
}

// Block Overlay for Drag
function BlockOverlay({ block }: { block: Block }) {
  const t = useTranslations('dash.website.sortable')
  const text = useBlockText()
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
          <p className="font-medium text-sm text-fg">{text.blockName(block)}</p>
          <p className="text-xs text-muted">{text.description(block.type)}</p>
        </div>
        <div className="px-2 py-1 bg-acc-soft rounded-lg">
          <span className="text-xs text-acc font-medium">{t('moving')}</span>
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
  const t = useTranslations('dash.website.available')
  const text = useBlockText()
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
            {text.typeName(blockType.type)}
          </p>
          <p className="text-xs text-muted mt-0.5 line-clamp-2">
            {text.description(blockType.type)}
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
          {t('addToPage')}
        </button>
      ) : (
        <div className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-ok-soft text-ok flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />
          {t('added')}
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
  const t = useTranslations('dash.website.preview')
  const labels = useDashLabels()
  const text = useBlockText()
  const blockTypeInfo = blockTypes.find(b => b.type === block.type)
  const BlockIcon = blockTypeInfo?.icon || Layout
  const bgGradient = blockTypeInfo?.bgGradient || 'from-slate-400 to-slate-500'
  const config = block.config || {}

  // Default property data if not provided
  const propertyName = propertyData?.name || t('propertyName')
  const propertyDescription = propertyData?.description || t('propertyDescription')

  const renderBlockContent = () => {
    switch (block.type) {
      case 'HERO':
        return (
          <div className="relative h-64 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden">
            {(config.backgroundImage || propertyData?.images?.[0]?.url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.backgroundImage || propertyData.images[0].url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">{config.heroTitle || propertyName}</h2>
              <p className="text-muted mb-4">{config.heroSubtitle || propertyDescription}</p>
              <button className="px-6 py-2 bg-panel text-fg rounded-lg font-medium">
                {config.heroCtaText || t('bookNow')}
              </button>
            </div>
          </div>
        )
      
      case 'ROOMS':
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Hotel className="w-5 h-5 text-ok" />
              {config.roomsTitle || t('roomsTitle')}
            </h3>
            <div className={`grid gap-3 ${config.roomsDisplay === 'list' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-fg/5 rounded-lg p-3 flex gap-3">
                  <div className="w-16 h-16 bg-fg/10 rounded-lg flex items-center justify-center">
                    <Hotel className="w-6 h-6 text-muted" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-fg">{t('roomName', { name: ['Deluxe', 'Suite', 'Standard'][i-1] })}</p>
                    <p className="text-sm text-muted">{t('roomMeta')}</p>
                    <p className="text-sm font-medium text-ok">{t('roomPrice', { price: labels.money(500000) })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      
      case 'AMENITIES':
        const amenities = [
          { icon: '📶', name: t('amenities.wifi') },
          { icon: '🅿️', name: t('amenities.parking') },
          { icon: '🏊', name: t('amenities.pool') },
          { icon: '🍽️', name: t('amenities.restaurant') },
          { icon: '💆', name: t('amenities.spa') },
          { icon: '🎤', name: t('amenities.karaoke') },
        ]
        const cols = config.amenitiesColumns || 3
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-warn" />
              {config.amenitiesTitle || t('amenitiesTitle')}
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
              {config.aboutTitle || t('aboutTitle')}
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
              {config.galleryTitle || t('galleryTitle')}
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
        // The hotel's own reviews, as the site shows them; none: the site hides the block.
        const reviews = (config.reviews ?? [])
          .filter((r) => r.name?.trim() && r.text?.trim())
          .map((r) => ({ name: r.source ? `${r.name} · ${r.source}` : r.name, rating: r.rating, comment: r.text }))
        if (reviews.length === 0) {
          return (
            <div className="p-4 bg-panel rounded-xl border border-dashed border-line text-center">
              <Star className="w-5 h-5 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">{t('reviews.none')}</p>
            </div>
          )
        }
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-warn" />
              {config.reviewsTitle || t('reviewsTitle')}
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
              {t('mapTitle')}
            </h3>
            <div className="h-40 bg-fg/5 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-err mx-auto mb-2" />
                <p className="text-sm text-muted">{config.mapAddress || t('mapNoLocation')}</p>
                <p className="text-xs text-muted mt-1">{t('mapPreview')}</p>
              </div>
            </div>
          </div>
        )
      
      case 'CONTACT':
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-info" />
              {config.contactTitle || t('contactTitle')}
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
                <input type="text" placeholder={t('form.name')} className="w-full px-3 py-2 border rounded-lg text-sm" disabled />
                <input type="email" placeholder={t('form.email')} className="w-full px-3 py-2 border rounded-lg text-sm" disabled />
                <textarea placeholder={t('form.message')} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} disabled />
                <button className="w-full py-2 bg-ink text-on-ink rounded-lg text-sm font-medium" disabled>
                  {t('form.send')}
                </button>
              </div>
            )}
          </div>
        )
      
      case 'SERVICES':
      case 'RESTAURANT_MENU': {
        const menu = block.type === 'RESTAURANT_MENU'
        const Icon = menu ? UtensilsCrossed : ConciergeBell
        return (
          <div className="p-4 bg-panel rounded-xl border border-line">
            <h3 className="text-lg font-semibold text-fg mb-2 flex items-center gap-2">
              <Icon className="w-5 h-5 text-acc" />
              {(menu ? config.menuTitle : config.servicesTitle) || t(menu ? 'menuTitle' : 'servicesTitle')}
            </h3>
            <p className="text-sm text-muted">{t(menu ? 'menuFrom' : 'servicesFrom')}</p>
          </div>
        )
      }

      case 'CTA':
        return (
          <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white text-center">
            <h3 className="text-xl font-bold mb-2">{config.ctaTitle || t('ctaTitle')}</h3>
            <p className="text-indigo-100 mb-4">{config.ctaSubtitle || t('ctaSubtitle')}</p>
            <button className="px-6 py-2 bg-panel text-info rounded-lg font-medium">
              {config.ctaButtonText || t('bookNow')}
            </button>
          </div>
        )
      
      default:
        return (
          <div className="p-6 bg-fg/5 rounded-xl text-center">
            <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
              <BlockIcon className="w-7 h-7 text-white" />
            </div>
            <p className="font-semibold text-fg">{text.blockName(block)}</p>
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
  const { property } = useProperty()
  const t = useTranslations('dash.website')
  const tc = useTranslations('dash.common')

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

  /**
   * Saves the blocks and the settings. Failures used to be silent; and
   * publishing only flipped a local switch until "Lưu thay đổi" was
   * pressed, which matters now that an unpublished site is hidden from
   * guests (src/lib/public-site/visibility.ts).
   */
  // The custom domain card's news (verified, certificate issued) into the settings a later save sends back.
  const mergeDomain = React.useCallback(
    (patch: DomainSettings) => setSettings((s) => (s ? ({ ...s, ...patch } as WebsiteSettings) : s)),
    []
  )

  const handleSave = async (next: WebsiteSettings | null = settings, successMessage: string = t('toast.saved')) => {
    setIsSaving(true)
    try {
      const blocksRes = await fetch('/api/website/blocks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, blocks }),
      })
      const settingsRes = next
        ? await fetch('/api/website/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyId, settings: next }),
          })
        : null
      const failed = [blocksRes, settingsRes].find((r) => r && !r.ok)
      if (failed) {
        const body = await failed.json().catch(() => null)
        toast.error(apiError(body?.error) || t('toast.saveFailed'))
        return false
      }
      if (next) setSettings(next)
      toast.success(successMessage)
      return true
    } catch (err) {
      console.error('Save failed:', err)
      toast.error(t('toast.offline'))
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const togglePublish = () => {
    if (!settings) return
    const publish = !settings.isPublished
    void handleSave({ ...settings, isPublished: publish }, publish ? t('toast.published') : t('toast.unpublished'))
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-panel rounded-2xl p-4 shadow-sm border border-line">
        <div className="flex min-w-0 items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="gap-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            {tc('actions.back')}
          </Button>
          <div className="h-8 w-px bg-fg/10" />
          <div>
            <h1 className="text-xl font-bold text-fg flex items-center gap-2">
              <Layout className="w-5 h-5 text-acc" />
              {t('header.title')}
            </h1>
            <p className="text-sm text-muted">{t('header.subtitle')}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 bg-fg/5 rounded-lg p-1">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-2 rounded-md hover:bg-panel hover:shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-transparent"
              title={t('header.undo')}
            >
              <Undo2 className="w-4 h-4 text-muted" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 rounded-md hover:bg-panel hover:shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-transparent"
              title={t('header.redo')}
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
            {t('header.template')}
          </Button>

          {/* Preview Mode Toggle */}
          <div className="flex items-center gap-1 bg-fg/5 rounded-xl p-1">
            <button aria-label={t('header.desktop')}
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
            <button aria-label={t('header.mobile')}
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
            // The site lives at /<subdomain> (it opened /<property id>, a 404).
            // Before publishing, only signed-in members see it, as a preview.
            onClick={() => property && window.open(`/${property.subdomain}`, '_blank')}
            disabled={!property}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {t('header.preview')}
          </Button>
          
          <Button 
            onClick={() => handleSave()}
            disabled={isSaving}
            size="sm"
            className="gap-2 shadow-lg"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? tc('actions.saving') : tc('actions.saveChanges')}
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
                {t('tabs.blocks')}
              </TabsTrigger>
              <TabsTrigger 
                value="style"
                className="rounded-lg data-[state=active]:bg-panel data-[state=active]:shadow-sm"
              >
                <Palette className="w-4 h-4 mr-1.5" />
                {t('tabs.style')}
              </TabsTrigger>
              <TabsTrigger 
                value="settings"
                className="rounded-lg data-[state=active]:bg-panel data-[state=active]:shadow-sm"
              >
                <Settings className="w-4 h-4 mr-1.5" />
                {t('tabs.settings')}
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
                        <h3 className="font-semibold text-fg">{t('blocks.arrange')}</h3>
                        <p className="text-xs text-muted">{t('blocks.arrangeHint')}</p>
                      </div>
                    </div>
                    <Badge className="bg-acc-soft text-acc border-acc/30">
                      {t('blocks.count', { count: blocks.length })}
                    </Badge>
                  </div>

                  {blocks.length === 0 ? (
                    <div className="text-center py-10 bg-info-soft/40 rounded-xl border-2 border-dashed border-info/30">
                      <div className="w-16 h-16 rounded-2xl bg-info-soft flex items-center justify-center mx-auto mb-3">
                        <GripVertical className="w-8 h-8 text-info" />
                      </div>
                      <p className="text-sm font-semibold text-muted mb-1">{t('blocks.empty')}</p>
                      <p className="text-xs text-muted max-w-[200px] mx-auto mb-3">
                        {t('blocks.emptyHint')}
                      </p>
                      <Button 
                        size="sm" 
                        onClick={() => setShowTemplateModal(true)}
                        className="gap-2"
                      >
                        <Wand2 className="w-4 h-4" />
                        {t('templates.choose')}
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
                    <h3 className="font-semibold text-fg">{t('blocks.addTitle')}</h3>
                    <p className="text-xs text-muted">{t('blocks.addHint')}</p>
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
                    {t('style.colors')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-fg">{t('style.primary')}</label>
                    <p className="text-xs text-muted">{t('style.primaryHint')}</p>
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
                  <OptionalColor
                    label={t('style.button')}
                    hint={t('style.buttonHint')}
                    value={settings?.buttonColor ?? null}
                    fallback="#1C1B19"
                    onChange={(buttonColor) => setSettings({ ...settings!, buttonColor })}
                    defaultLabel={t('style.useDefault')}
                  />
                  <OptionalColor
                    label={t('style.heading')}
                    hint={t('style.headingHint')}
                    value={settings?.headingColor ?? null}
                    fallback="#1B1C1A"
                    onChange={(headingColor) => setSettings({ ...settings!, headingColor })}
                    defaultLabel={t('style.useDefault')}
                  />
                  <p className="text-xs text-muted">{t('style.contrastNote')}</p>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    {t('style.fonts')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-fg">{t('style.bodyFont')}</label>
                    <select
                      value={normalizeFont(settings?.fontFamily, 'body')}
                      onChange={(e) => setSettings({ ...settings!, fontFamily: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    >
                      {bodyFonts.map((font) => (
                        <option key={font.value} value={font.value}>{`${font.value} - ${t(`style.fontTraits.${font.trait}`)}`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-fg">{t('style.headingFont')}</label>
                    <select
                      value={normalizeFont(settings?.headingFont, 'heading')}
                      onChange={(e) => setSettings({ ...settings!, headingFont: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    >
                      {headingFonts.map((font) => (
                        <option key={font.value} value={font.value}>{`${font.value} - ${t(`style.fontTraits.${font.trait}`)}`}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('settings.seo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label={t('settings.metaTitle')}
                    value={settings?.metaTitle || ''}
                    onChange={(e) => setSettings({ ...settings!, metaTitle: e.target.value })}
                    placeholder={t('settings.metaTitlePlaceholder')}
                  />
                  <div>
                    <label className="text-sm font-medium text-fg">{t('settings.metaDescription')}</label>
                    <textarea
                      value={settings?.metaDescription || ''}
                      onChange={(e) => setSettings({ ...settings!, metaDescription: e.target.value })}
                      placeholder={t('settings.metaDescriptionPlaceholder')}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                  </div>
                  {settings && (
                    <EnglishCopy filled={Boolean(settings.translations?.en?.metaTitle || settings.translations?.en?.metaDescription)}>
                      <Input
                        label={t('settings.metaTitle')}
                        value={settings.translations?.en?.metaTitle ?? ''}
                        onChange={(e) => setSettings({ ...settings, translations: { en: { ...settings.translations?.en, metaTitle: e.target.value } } })}
                        placeholder={settings.metaTitle ?? ''}
                      />
                      <div>
                        <label htmlFor="seo-en-description" className="text-sm font-medium text-fg">{t('settings.metaDescription')}</label>
                        <textarea
                          id="seo-en-description"
                          value={settings.translations?.en?.metaDescription ?? ''}
                          onChange={(e) => setSettings({ ...settings, translations: { en: { ...settings.translations?.en, metaDescription: e.target.value } } })}
                          placeholder={settings.metaDescription ?? ''}
                          className="w-full mt-1 px-3 py-2 border border-line rounded-ctl bg-raised text-fg text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                          rows={3}
                        />
                      </div>
                    </EnglishCopy>
                  )}
                </CardContent>
              </Card>

              {settings && (
                <CustomDomainCard
                  propertyId={propertyId}
                  settings={settings as DomainSettings}
                  onChange={mergeDomain}
                  onRemove={() => handleSave({ ...settings, customDomain: '' }, t('domain.removed'))}
                />
              )}

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>{t('publish.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {settings?.isPublished ? t('publish.published') : t('publish.unpublished')}
                      </p>
                      <p className="text-sm text-muted">
                        {settings?.isPublished ? t('publish.publishedHint') : t('publish.unpublishedHint')}
                      </p>
                    </div>
                    <Button
                      onClick={togglePublish}
                      disabled={isSaving || !settings}
                      variant={settings?.isPublished ? 'danger' : 'primary'}
                    >
                      {settings?.isPublished ? t('publish.unpublish') : t('publish.publishNow')}
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
                      {t('canvas.dragging')}
                    </div>
                  )}
                  
                  {previewBlocks.length === 0 && !isDragging ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                      <div className="w-20 h-20 rounded-2xl bg-fg/5 flex items-center justify-center mb-4">
                        <LayoutGrid className="w-10 h-10 text-muted" />
                      </div>
                      <h3 className="text-lg font-semibold text-muted mb-2">{t('blocks.empty')}</h3>
                      <p className="text-sm text-muted max-w-xs mb-4">
                        {t('canvas.emptyHint')}
                      </p>
                      <Button onClick={() => setShowTemplateModal(true)} className="gap-2">
                        <Wand2 className="w-4 h-4" />
                        {t('templates.choose')}
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
                          <p className="text-muted">{t('canvas.allHidden')}</p>
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
