'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageContainer } from '@/components/layout'
import { NoAccess } from '@/components/layout/no-access'
import { useTheme } from '@/components/layout/theme-root'
import { useCan } from '@/components/layout/workspace-context'
import { toast } from '@/components/ui/toast'
import { EnglishCopy } from '@/components/ui/english-copy'
import { CoverPicker } from './cover-picker'
import { ReviewsEditor, type ReviewEntry } from './reviews-editor'
import { CustomDomainCard, type DomainSettings } from './custom-domain-card'
import { VersionHistory } from './version-history'
import { WebsiteSettingsModal } from './website-settings-modal'
import { ThemeStyleModal } from './theme-style-modal'
import { useProperty } from '@/lib/hooks/use-property'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
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
import { fontStack, normalizeFont } from '@/lib/public-site/font-stack'
import { hotelAccentVariables, hotelButtonVariables, hotelHeadingVariables } from '@/lib/public-site/accent'
import { routes } from '@/lib/utils/routes'
// The hotel site's font faces, for the preview (the same ones its layout loads).
import { siteFontVariables } from '@/app/(public)/[subdomain]/fonts'
import { PreviewBlock, PreviewHeader, type PreviewSite } from './site-preview'
import { InspectableSection } from './inspectable-section'
import { BlockInspectorPanel } from './block-inspector-panel'
import { TemplateCard } from './template-card'
import { THEME_PRESETS } from '@/lib/ai/website-theme-presets'
import { AiRemixDrawer } from './ai-remix-drawer'
import { AiTextCopilot } from './ai-text-copilot'
import { HOTEL_LANDING_TEMPLATES, type HotelLandingTemplate } from '@/lib/public-site/landing-templates'
import {
  Monitor, Smartphone, Eye, Save, Globe, Palette, Type, Image,
  Plus, Trash2, GripVertical, Settings, Layout, Search, ArrowRight,
  Check, X, ChevronRight, Shield, AlertCircle, Loader2, ExternalLink, RefreshCw, Star,
  LayoutGrid, Hotel, ImageIcon, MapPin, Phone, MousePointer2, Zap, Sparkles,
  FileText, Clock, Undo2, Redo2, Copy, Wand2, ChevronDown, ChevronUp, ConciergeBell, UtensilsCrossed, PanelBottom, History as HistoryIcon,
  PanelLeftClose, PanelLeftOpen, Moon, Sun
} from 'lucide-react'
import { apiError } from '@/lib/i18n/api-errors'
import { cn } from '@/lib/utils'

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
  exitIntentEnabled?: boolean
  exitIntentCouponId?: string | null
  facebookPixelId?: string | null
  backgroundColor?: string | null
  themePreset?: string | null
  lastAiPrompt?: string | null
  googleTagId?: string | null
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
  
  // CTA & CRO
  ctaTitle?: string
  ctaSubtitle?: string
  ctaButtonText?: string
  ctaButtonLink?: string
  ctaBackground?: string
  ctaBadge?: string
  ctaPerks?: string[]

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
  layoutVariant?: string
  config: BlockConfig
}

type BlockTypeKey = 'HERO' | 'ROOMS' | 'AMENITIES' | 'ABOUT' | 'GALLERY' | 'REVIEWS' | 'MAP' | 'CONTACT' | 'CTA' | 'SERVICES' | 'RESTAURANT_MENU' | 'FOOTER'

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
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
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
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
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
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
    defaultConfig: {
      amenitiesTitle: 'Tiện ích nổi bật',
      amenitiesColumns: 3
    }
  },
  { 
    type: 'ABOUT', 
    name: 'Giới thiệu', 
    icon: Sparkles, 
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
    defaultConfig: {
      aboutTitle: 'Về chúng tôi',
      aboutContent: 'Nơi mang đến cho bạn trải nghiệm lưu trú tuyệt vời với dịch vụ chuyên nghiệp và không gian thoải mái.'
    }
  },
  { 
    type: 'GALLERY', 
    name: 'Thư viện ảnh', 
    icon: ImageIcon, 
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
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
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
    defaultConfig: {
      reviewsTitle: 'Đánh giá từ khách hàng',
      reviewsLimit: 4
    }
  },
  { 
    type: 'MAP', 
    name: 'Bản đồ', 
    icon: MapPin, 
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
    defaultConfig: {
      // Empty: the site then shows the property's own address (or coordinates).
      mapAddress: '',
      mapZoom: 15
    }
  },
  { 
    type: 'CONTACT', 
    name: 'Liên hệ', 
    icon: Phone, 
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
    defaultConfig: {
      contactTitle: 'Liên hệ với chúng tôi',
      contactFormEnabled: true
    }
  },
  { 
    type: 'CTA', 
    name: 'Call to Action', 
    icon: MousePointer2, 
    color: 'text-primary', 
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
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
    color: 'text-primary',
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
    defaultConfig: {}
  },
  {
    // The dishes from the menu page (MenuItem); shows nothing until there is one.
    type: 'RESTAURANT_MENU',
    name: 'Thực đơn',
    icon: UtensilsCrossed,
    color: 'text-primary',
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
    defaultConfig: {}
  },
  {
    // The hotel's name, address and contacts at the bottom (FooterBlock); the default layout ends with it.
    type: 'FOOTER',
    name: 'Footer',
    icon: PanelBottom,
    color: 'text-primary',
    bgGradient: 'bg-primary/10 text-primary border border-primary/20',
    defaultConfig: {}
  },
]

/** The builder's key for a block's title, where the default layout saved `title`. */
const TITLE_KEYS: Partial<Record<string, keyof BlockConfig>> = {
  ROOMS: 'roomsTitle',
  AMENITIES: 'amenitiesTitle',
  ABOUT: 'aboutTitle',
  GALLERY: 'galleryTitle',
  CONTACT: 'contactTitle',
}

/**
 * The default layout the site shows while no block is saved
 * (src/lib/public-site/site.ts), as builder blocks: the builder starts from
 * what the site shows instead of an empty page. Titles move to the builder's
 * keys (the site reads both, so it shows the same); saving makes the layout
 * the hotel's own.
 */
function blocksFromDefaults(defaults: PreviewSite['defaultBlocks']): Block[] {
  return defaults.map((block, index) => {
    const { title, ...rest } = block.config ?? {}
    const key = TITLE_KEYS[block.type]
    return {
      id: block.id,
      type: block.type,
      name: blockTypes.find((b) => b.type === block.type)?.name ?? block.name,
      isEnabled: true,
      sortOrder: index,
      config: (key && typeof title === 'string' ? { ...rest, [key]: title } : (block.config ?? {})) as BlockConfig,
    }
  })
}

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
      { type: 'AMENITIES', name: 'Tiện ích', isEnabled: true },
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
        ${isSelected ? 'ring-2 ring-primary ring-offset-1 border-primary bg-primary/5' : ''}
        ${block.isEnabled 
          ? 'bg-panel border-line hover:border-primary/40 hover:shadow-xs' 
          : 'bg-fg/[0.03] border-line opacity-60'
        }
        ${isDragging ? 'shadow-xl border-primary bg-primary/10 z-50 scale-[1.02]' : 'shadow-xs'}
      `}
    >
      <div 
        {...attributes}
        {...listeners}
        className="flex items-center gap-2.5 p-2.5 select-none"
      >
        {/* Drag Indicator */}
        <div title={t('dragHint')} className={`
          flex flex-col gap-0.5 py-1 px-0.5 rounded-lg transition-colors duration-200
          ${isDragging ? 'bg-primary/20 text-primary' : 'text-muted/40 group-hover:text-muted'}
        `}>
          <div className="w-3.5 h-1 rounded-full bg-current"></div>
          <div className="w-3.5 h-1 rounded-full bg-current"></div>
          <div className="w-3.5 h-1 rounded-full bg-current"></div>
        </div>

        {/* Block Icon */}
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
          block.isEnabled
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-fg/5 text-muted border-line'
        )}>
          <BlockIcon className="w-4 h-4" />
        </div>

        {/* Block Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-xs sm:text-sm truncate ${block.isEnabled ? 'text-fg' : 'text-muted'}`}>
            {text.blockName(block)}
          </p>
          <p className="text-[11px] text-muted line-clamp-1">{text.description(block.type)}</p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Edit */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className={`
              p-1.5 rounded-lg transition-colors
              ${isSelected 
                ? 'bg-primary text-on-primary' 
                : 'bg-fg/5 text-muted hover:bg-primary/10 hover:text-primary'
              }
            `}
            title={t('configure')}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`
              p-1.5 rounded-lg transition-colors
              ${block.isEnabled 
                ? 'bg-ok-soft text-ok hover:bg-ok-soft/80' 
                : 'bg-fg/5 text-muted hover:bg-fg/10'
              }
            `}
            title={block.isEnabled ? t('hide') : t('show')}
          >
            {block.isEnabled ? <Eye className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          </button>

          {/* Remove */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg bg-fg/5 text-muted hover:bg-err-soft hover:text-err transition-colors"
            title={t('remove')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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
  activeTemplateId,
  onClose
}: {
  onSelect: (template: HotelLandingTemplate) => void
  activeTemplateId?: string
  onClose: () => void
}) {
  const t = useTranslations('dash.website.templates')
  return (
    <Modal isOpen onClose={onClose} size="2xl">
      <ModalHeader onClose={onClose}>
        <div className="w-10 h-10 shrink-0 rounded-xl bg-ink flex items-center justify-center shadow-lg">
          <Wand2 className="w-5 h-5 text-on-ink" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-fg">Chọn mẫu Landing Page khách sạn</h2>
          <p className="text-xs text-muted">Bộ sưu tập mẫu giao diện tối ưu chuyển đổi (CRO) cho từng phân khúc lưu trú.</p>
        </div>
      </ModalHeader>

      {/* Templates Grid */}
      <ModalBody className="p-4 max-h-[72vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HOTEL_LANDING_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isActive={activeTemplateId === template.id}
              onApply={onSelect}
            />
          ))}
        </div>
      </ModalBody>

      <ModalFooter className="justify-between">
        <p className="text-xs text-muted">
          Áp dụng mẫu sẽ cập nhật phong cách và bố cục chuẩn. Bạn có thể rê chuột chỉnh sửa trực tiếp từng phần.
        </p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Đóng
        </Button>
      </ModalFooter>
    </Modal>
  )
}

// Block Overlay for Drag
function BlockOverlay({ block }: { block: Block }) {
  const t = useTranslations('dash.website.sortable')
  const text = useBlockText()
  const blockTypeInfo = blockTypes.find(b => b.type === block.type)
  const BlockIcon = blockTypeInfo?.icon || Layout

  return (
    <div className="w-full rounded-xl bg-panel border-2 border-primary shadow-2xl p-3 rotate-2 scale-105">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary text-on-primary shadow-md">
          <BlockIcon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-fg">{text.blockName(block)}</p>
          <p className="text-xs text-muted">{text.description(block.type)}</p>
        </div>
        <div className="px-2 py-1 bg-primary/10 rounded-lg">
          <span className="text-xs text-primary font-medium">{t('moving')}</span>
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
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl border p-2.5 transition-all duration-200',
        isAdded ? 'bg-fg/[0.02] border-line opacity-75' : 'bg-panel border-line hover:border-primary/40 hover:shadow-xs'
      )}
    >
      <div
        className={cn(
          'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border transition-colors',
          isAdded
            ? 'bg-fg/5 text-muted border-line'
            : 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-on-primary'
        )}
      >
        <BlockIcon className="w-4 h-4" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium text-xs sm:text-sm truncate', isAdded ? 'text-muted' : 'text-fg')}>{text.typeName(blockType.type)}</p>
        <p className="text-[11px] text-muted line-clamp-1">{text.description(blockType.type)}</p>
      </div>

      {/* Add Button */}
      {!isAdded ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={t('addNamed', { name: text.typeName(blockType.type) })}
          className="shrink-0 h-8 px-2.5 rounded-lg text-xs font-medium bg-ink text-on-ink hover:bg-ink/90 flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          {t('add')}
        </button>
      ) : (
        <span className="shrink-0 h-8 px-2.5 rounded-lg text-xs font-medium bg-ok-soft text-ok flex items-center gap-1 border border-ok/20">
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          {t('added')}
        </span>
      )}
    </div>
  )
}

const PRESET_LABELS: Record<string, { name: string; desc: string }> = {
  luxury_boutique: { name: 'Luxury Boutique Resort', desc: 'Sang trọng, hoàng gia' },
  tropical_eco: { name: 'Tropical Eco Resort', desc: 'Sinh thái nhiệt đới, thư thái' },
  modern_clean: { name: 'Modern Minimalist', desc: 'Hiện đại, tinh tế' },
  vintage_boho: { name: 'Vintage & Boho Homestay', desc: 'Ấm cúng, mộc mạc' },
  coastal_breeze: { name: 'Coastal Breeze Beach Resort', desc: 'Biển xanh ngát, tươi mới' },
}

// Main Component
export default function WebsiteBuilderPage() {
  const router = useRouter()
  const params = useParams()
  const propertyId = params.id as string
  const slug = params.slug as string
  const { property } = useProperty()
  const t = useTranslations('dash.website')
  const tc = useTranslations('dash.common')
  const tn = useTranslations('dash.common.nav')
  const theme = useTheme()
  const text = useBlockText()
  // Owners, ADMIN and MANAGER (the blocks and settings APIs refuse anyone else; the sidebar hides it).
  const canEdit = useCan('website_manage')

  const [settings, setSettings] = React.useState<WebsiteSettings | null>(null)
  const [blocks, setBlocks] = React.useState<Block[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [previewMode, setPreviewMode] = React.useState<'desktop' | 'mobile'>('desktop')
  const [previewTheme, setPreviewTheme] = React.useState<'auto' | 'light' | 'dark'>('auto')
  // The editor column; hidden, the preview takes the whole width (from lg up).
  const [panelOpen, setPanelOpen] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState('blocks')
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [previewBlocks, setPreviewBlocks] = React.useState<Block[]>([])
  const [showTemplateModal, setShowTemplateModal] = React.useState(false)
  const [showThemeModal, setShowThemeModal] = React.useState(false)
  const [showSettingsModal, setShowSettingsModal] = React.useState(false)
  const [showHistory, setShowHistory] = React.useState(false)
  const [propertyData, setPropertyData] = React.useState<any>(null)
  const [isPublishing, setIsPublishing] = React.useState(false)
  const [isUnpublishModalOpen, setIsUnpublishModalOpen] = React.useState(false)
  const savedSnapshotRef = React.useRef<string | null>(null)
  // What the site shows (real rooms, prices, photos...), for the preview.
  const [site, setSite] = React.useState<PreviewSite | null>(null)
  // No layout saved yet: the blocks are the default layout the site shows.
  const [usingDefaults, setUsingDefaults] = React.useState(false)
  const [availableCoupons, setAvailableCoupons] = React.useState<
    { id: string; code: string; name: string; discountType: string; discountValue: number }[]
  >([])
  
  // Undo/Redo state
  const [history, setHistory] = React.useState<Block[][]>([])
  const [historyIndex, setHistoryIndex] = React.useState(-1)

  const [remixingBlock, setRemixingBlock] = React.useState<Block | null>(null)
  const [aiCopilotField, setAiCopilotField] = React.useState<{
    fieldKey: string
    label: string
    text: string
    onApply: (val: string) => void
  } | null>(null)
  const [isSyncing, setIsSyncing] = React.useState(false)

  const handleSyncPropertyData = async () => {
    if (!propertyId) return
    setIsSyncing(true)
    try {
      const res = await fetch('/api/website/sync-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Không thể đồng bộ dữ liệu lúc này')
        return
      }
      toast.success(json.message || 'Đồng bộ dữ liệu phòng, ảnh và tiện ích thành công!')
      void fetchWebsiteData()
    } catch {
      toast.error('Lỗi kết nối khi đồng bộ dữ liệu')
    } finally {
      setIsSyncing(false)
    }
  }

  // Quick AI Prompt generation (Google Stitch Style)
  const [aiPromptInput, setAiPromptInput] = React.useState('')
  const [isAiGenerating, setIsAiGenerating] = React.useState(false)

  const handleQuickAiGenerate = async (customPrompt?: string, preset?: string) => {
    const promptToUse = customPrompt ?? aiPromptInput
    if (!promptToUse && !preset) {
      return
    }

    setIsAiGenerating(true)
    try {
      const res = await fetch('/api/website/ai/generate-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          prompt: promptToUse || undefined,
          stylePreset: preset || settings?.themePreset || 'luxury_boutique',
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Không thể tạo website bằng AI lúc này')
        return
      }

      setBlocks(json.data.blocks)
      pushHistory(json.data.blocks)
      if (json.data.settings) setSettings(json.data.settings)
      setUsingDefaults(false)
      setAiPromptInput('')
      toast.success('✨ AI đã tái thiết kế website theo yêu cầu của bạn!')
    } catch {
      toast.error('Lỗi kết nối khi gửi yêu cầu tới AI')
    } finally {
      setIsAiGenerating(false)
    }
  }

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
    if (!canEdit) {
      setIsLoading(false)
      return
    }
    fetchWebsiteData()
  }, [propertyId, canEdit])

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
        const saved: Block[] = blocksData.data.blocks || []
        const preview: PreviewSite | null = blocksData.data.site ?? null
        setSite(preview)
        if (saved.length === 0 && preview?.defaultBlocks.length) {
          setBlocks(blocksFromDefaults(preview.defaultBlocks))
          setUsingDefaults(true)
        } else {
          setBlocks(saved)
        }
        if (blocksData.data.settings) {
          setSettings(blocksData.data.settings)
        }
        savedSnapshotRef.current = JSON.stringify({
          blocks: saved.length === 0 && preview?.defaultBlocks.length ? blocksFromDefaults(preview.defaultBlocks) : saved,
          settings: blocksData.data.settings,
        })
      }

      // Fetch active coupons for exit-intent popup (task 43)
      fetch(`/api/properties/${propertyId}/coupons?status=active&limit=100`)
        .then((res) => res.json())
        .then((couponsData) => {
          if (couponsData.success && Array.isArray(couponsData.data)) {
            setAvailableCoupons(couponsData.data)
          }
        })
        .catch(() => {})
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
      savedSnapshotRef.current = JSON.stringify({ blocks, settings: next ?? settings })
      setUsingDefaults(false)
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

  // A version was put back: the builder shows the site as it now is, with a fresh undo history.
  const afterRestore = () => {
    setSelectedBlockId(null)
    setHistory([])
    setHistoryIndex(-1)
    setUsingDefaults(false)
    void fetchWebsiteData()
  }

  const handleTogglePublish = async (nextPublished: boolean): Promise<boolean> => {
    if (!settings) return false
    setIsPublishing(true)
    try {
      const res = await fetch('/api/website/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          settings: {
            ...settings,
            isPublished: nextPublished,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        toast.error(apiError(data?.error) || t('toast.saveFailed'))
        return false
      }
      setSettings((curr) => (curr ? { ...curr, isPublished: nextPublished } : curr))
      if (savedSnapshotRef.current) {
        try {
          const parsed = JSON.parse(savedSnapshotRef.current)
          parsed.settings = { ...(parsed.settings || {}), isPublished: nextPublished }
          savedSnapshotRef.current = JSON.stringify(parsed)
        } catch {}
      }
      toast.success(
        nextPublished
          ? 'Đã xuất bản website thành công! Du khách có thể truy cập ngay.'
          : 'Đã hủy công khai website. Website hiện ở chế độ xem trước riêng tư.'
      )
      return true
    } catch (err) {
      console.error('Failed to toggle publish:', err)
      toast.error(t('toast.offline'))
      return false
    } finally {
      setIsPublishing(false)
    }
  }

  const togglePublish = () => {
    if (!settings) return
    void handleTogglePublish(!settings.isPublished)
  }

  const currentSnapshot = React.useMemo(() => {
    if (!settings) return null
    return JSON.stringify({ blocks, settings })
  }, [blocks, settings])

  const hasUnsavedChanges = Boolean(
    savedSnapshotRef.current && currentSnapshot && savedSnapshotRef.current !== currentSnapshot
  )

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = 'Bạn có thay đổi trên website chưa được lưu. Bạn có chắc muốn rời đi?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

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

  const applyLandingTemplate = (template: HotelLandingTemplate) => {
    const newBlocks: Block[] = template.blocks.map((t, index) => {
      const blockTypeInfo = blockTypes.find((b) => b.type === t.type)
      return {
        id: `block-${Date.now()}-${index}`,
        type: t.type || '',
        name: t.name || '',
        isEnabled: t.isEnabled ?? true,
        sortOrder: index,
        config: {
          ...(blockTypeInfo?.defaultConfig || {}),
          ...(t.config || {}),
        },
      }
    })
    setBlocks(newBlocks)
    pushHistory(newBlocks)
    setUsingDefaults(false)

    setSettings((curr) => {
      if (!curr) return curr
      return {
        ...curr,
        primaryColor: template.style.primaryColor,
        secondaryColor: template.style.secondaryColor,
        accentColor: template.style.accentColor,
        buttonColor: template.style.buttonColor,
        headingColor: template.style.headingColor,
        fontFamily: template.style.fontFamily,
        headingFont: template.style.headingFont,
        layout: template.id,
      }
    })

    setShowTemplateModal(false)
    toast.success(`Đã áp dụng mẫu "${template.name}"`)
  }

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex((b) => b.id === blockId)
    if (index === -1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= blocks.length) return
    const newBlocks = arrayMove(blocks, index, targetIndex)
    setBlocks(newBlocks)
    pushHistory(newBlocks)
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

  // The preview is the hotel's site: its own look (data-surface="site"), its
  // colors and fonts as chosen in the Style tab, light or dark as the site
  // shows it to this viewer (or overridden by the preview theme toggle).
  const defaultSiteTheme = theme?.preference === 'dark' && theme.darkAvailable ? 'dark' : 'light'
  const siteTheme = previewTheme === 'auto' ? defaultSiteTheme : previewTheme
  const siteStyle = React.useMemo(
    () =>
      ({
        ...hotelAccentVariables(settings?.primaryColor),
        ...hotelButtonVariables(settings?.buttonColor),
        ...hotelHeadingVariables(settings?.headingColor),
        '--site-body': fontStack(settings?.fontFamily, 'body'),
        '--site-heading': fontStack(settings?.headingFont, 'heading'),
      }) as React.CSSProperties,
    [settings?.primaryColor, settings?.buttonColor, settings?.headingColor, settings?.fontFamily, settings?.headingFont]
  )
  // Where guests open it: the verified custom domain, else <subdomain>.digistay.vn (the sidebar's address).
  const customDomain = settings?.customDomain && settings.domainVerificationStatus === 'verified' ? settings.customDomain : null
  const siteAddress = customDomain ?? (property ? `${property.subdomain}.digistay.vn` : '')

  if (!canEdit) {
    return (
      <PageContainer>
        <NoAccess hint={t('noAccess')} backHref={routes.property(slug, propertyId)} backLabel={tn('overview')} />
      </PageContainer>
    )
  }

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
    // From lg up the builder fills the window: one row of tools, then the
    // editor and the preview, each scrolling on its own.
    <PageContainer className="max-w-full lg:px-5 lg:py-4 lg:h-dvh lg:flex lg:flex-col">
      {/* Header - Google Stitch Studio Inspired Layout */}
      <header className="flex items-center justify-between gap-3 mb-3 shrink-0 bg-panel rounded-2xl px-3.5 py-2.5 shadow-sm border border-line">
        {/* Left: Back + Property Info + Subdomain Pill */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              if (hasUnsavedChanges && !window.confirm('Bạn có thay đổi trên website chưa được lưu. Bạn có chắc muốn rời đi?')) {
                return
              }
              router.push(routes.property(slug, propertyId))
            }}
            className="h-8 px-2 gap-1 text-xs"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="hidden sm:inline">{tc('actions.back')}</span>
          </Button>

          <div className="h-5 w-px bg-fg/10 hidden sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold text-fg truncate max-w-[180px] sm:max-w-[240px]">
                {property?.name || 'Website Khách sạn'}
              </h1>
              {hasUnsavedChanges ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-warn-soft text-warn border border-warn/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
                  Chưa lưu
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-ok-soft text-ok border border-ok/30">
                  <Check className="w-3 h-3" />
                  Đã lưu
                </span>
              )}
            </div>
            {property?.subdomain && (
              <a
                href={`/${property.subdomain}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-muted hover:text-primary inline-flex items-center gap-1 transition-colors truncate"
                title="Mở website trong tab mới"
              >
                <span>{property.subdomain}.digistay.vn</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            )}
          </div>
        </div>

        {/* Center: Device Switcher + Theme Toggle + Undo/Redo */}
        <div className="hidden md:flex items-center gap-2">
          {/* Viewport switch */}
          <div className="flex items-center gap-0.5 bg-raised rounded-xl p-1 border border-line">
            <button
              type="button"
              onClick={() => setPreviewMode('desktop')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                previewMode === 'desktop' ? 'bg-panel shadow-xs text-primary font-semibold' : 'text-muted hover:text-fg'
              )}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Máy tính</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('mobile')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                previewMode === 'mobile' ? 'bg-panel shadow-xs text-primary font-semibold' : 'text-muted hover:text-fg'
              )}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Điện thoại</span>
            </button>
          </div>

          {/* Light/Dark mode */}
          <button
            type="button"
            onClick={() =>
              setPreviewTheme((curr) => {
                const effective = curr === 'auto' ? defaultSiteTheme : curr
                return effective === 'dark' ? 'light' : 'dark'
              })
            }
            className="p-1.5 rounded-xl bg-raised border border-line text-muted hover:text-fg transition-colors"
            title={siteTheme === 'dark' ? 'Chuyển sang xem trước giao diện sáng' : 'Chuyển sang xem trước giao diện tối'}
          >
            {siteTheme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </button>

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5 bg-raised rounded-xl p-0.5 border border-line">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-panel disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Hoàn tác (Undo)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-panel disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Làm lại (Redo)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: AI Studio + Sync + Publish Switch + Save */}
        <div className="flex items-center gap-2">
          {/* Toggle sidebar button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-label={panelOpen ? 'Ẩn thanh công cụ' : 'Hiện thanh công cụ'}
            title={panelOpen ? 'Ẩn thanh công cụ bên trái' : 'Hiện thanh công cụ bên trái'}
            className="hidden lg:inline-flex px-2 h-8 text-muted hover:text-fg"
          >
            {panelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>

          {/* Sync Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncPropertyData}
            disabled={isSyncing}
            title="Đồng bộ lại phòng, ảnh và tiện ích mới nhất từ cơ sở dữ liệu"
            className="h-8 px-2.5 gap-1.5 text-xs hidden sm:inline-flex"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin text-primary')} />
            <span className="hidden xl:inline">{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
          </Button>

          {/* Quick Publish Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (!settings) return
              if (settings.isPublished) {
                setIsUnpublishModalOpen(true)
              } else {
                void handleTogglePublish(true)
              }
            }}
            disabled={isPublishing || !settings}
            title={settings?.isPublished ? 'Bấm để tắt công khai website' : 'Bấm để xuất bản website cho du khách'}
            className={cn(
              'h-8 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer',
              settings?.isPublished
                ? 'border-ok/30 bg-ok-soft text-ok hover:bg-ok-soft/80'
                : 'border-acc/40 bg-acc text-on-acc hover:bg-acc/90 font-bold'
            )}
          >
            {isPublishing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : settings?.isPublished ? (
              <Check className="w-3.5 h-3.5 text-ok" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-on-acc" />
            )}
            <span>{settings?.isPublished ? 'Đã xuất bản' : 'Xuất bản website'}</span>
          </button>

          {/* Save Button */}
          <Button 
            onClick={() => handleSave()}
            disabled={isSaving}
            size="sm"
            className={cn(
              'h-8 px-3.5 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary-hover text-on-primary shadow-xs transition-all',
              hasUnsavedChanges && 'ring-2 ring-primary/40 ring-offset-1'
            )}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout (3-Panel Studio) */}
      <div
        className={cn(
          'grid grid-cols-1 gap-4 lg:flex-1 lg:min-h-0',
          selectedBlock
            ? panelOpen
              ? 'lg:grid-cols-[300px_minmax(0,1fr)_360px] 2xl:grid-cols-[330px_minmax(0,1fr)_390px]'
              : 'lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]'
            : panelOpen
              ? 'lg:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]'
              : 'lg:grid-cols-1'
        )}
      >
        {/* Left Sidebar - Google Stitch Style 4-Tab Dock */}
        <div id="builder-panel" className={cn('space-y-3.5 lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:pb-3', !panelOpen && 'lg:hidden')}>
          {/* Tab Dock */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-raised rounded-2xl border border-line" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'blocks'}
              onClick={() => setActiveTab('blocks')}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-medium transition-all gap-1',
                activeTab === 'blocks'
                  ? 'bg-panel text-primary shadow-xs border border-line font-semibold'
                  : 'text-muted hover:text-fg'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Khối ({blocks.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'style'}
              onClick={() => setActiveTab('style')}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-medium transition-all gap-1',
                activeTab === 'style'
                  ? 'bg-panel text-primary shadow-xs border border-line font-semibold'
                  : 'text-muted hover:text-fg'
              )}
            >
              <Palette className="w-4 h-4" />
              <span>Giao diện</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'templates'}
              onClick={() => setActiveTab('templates')}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-medium transition-all gap-1',
                activeTab === 'templates'
                  ? 'bg-panel text-primary shadow-xs border border-line font-semibold'
                  : 'text-muted hover:text-fg'
              )}
            >
              <Wand2 className="w-4 h-4" />
              <span>Mẫu sẵn</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-medium transition-all gap-1',
                activeTab === 'settings'
                  ? 'bg-panel text-primary shadow-xs border border-line font-semibold'
                  : 'text-muted hover:text-fg'
              )}
            >
              <Settings className="w-4 h-4" />
              <span>Cài đặt</span>
            </button>
          </div>

          {/* TAB 1: BLOCKS (Sortable & Addable) */}
          {activeTab === 'blocks' && (
            <div className="space-y-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              >
                {/* Active Blocks - Sortable */}
                <div className="bg-panel rounded-2xl border border-line p-3.5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-xs">
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-fg text-sm">{t('blocks.arrange')}</h3>
                        <p className="text-xs text-muted">{t('blocks.arrangeHint')}</p>
                      </div>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      {t('blocks.count', { count: blocks.length })}
                    </Badge>
                  </div>
                  {usingDefaults && (
                    <p className="mb-3 rounded-xl bg-info-soft px-3 py-2 text-xs text-info">{t('blocks.defaultLayout')}</p>
                  )}

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

              {/* Available Blocks Library */}
              <div className="bg-panel rounded-2xl border border-line p-3.5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-ink flex items-center justify-center shadow-lg">
                    <Plus className="w-4 h-4 text-on-ink" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-fg text-sm">{t('blocks.addTitle')}</h3>
                    <p className="text-xs text-muted">{t('blocks.addHint')}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
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
            </div>
          )}

          {/* TAB 2: STYLE & THEME (Live Real-time Editing) */}
          {activeTab === 'style' && (
            <div className="space-y-4">
              {/* AI Theme Presets */}
              <div className="bg-panel rounded-2xl border border-line p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-fg text-sm">Phong cách giao diện AI</h3>
                  </div>
                  <span className="text-[11px] text-muted">1-Click áp dụng</span>
                </div>

                <div className="space-y-2">
                  {Object.entries(THEME_PRESETS).map(([presetKey, p]) => {
                    const presetInfo = PRESET_LABELS[presetKey] || { name: presetKey, desc: '' }
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => {
                          setSettings((curr) => {
                            if (!curr) return curr
                            return {
                              ...curr,
                              primaryColor: p.primaryColor,
                              secondaryColor: p.secondaryColor,
                              accentColor: p.accentColor,
                              buttonColor: p.buttonColor,
                              headingColor: p.headingColor,
                              backgroundColor: p.backgroundColor,
                              fontFamily: p.fontFamily,
                              headingFont: p.headingFont,
                              themePreset: presetKey,
                            }
                          })
                          toast.success(`Đã áp dụng phong cách ${presetInfo.name}`)
                        }}
                        className={cn(
                          'w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group',
                          settings?.themePreset === presetKey
                            ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                            : 'border-line bg-fg/[0.02] hover:border-primary/40 hover:bg-fg/[0.04]'
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-fg truncate">{presetInfo.name}</p>
                          <p className="text-[11px] text-muted truncate">{p.headingFont} + {p.fontFamily}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: p.primaryColor }} />
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: p.secondaryColor }} />
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: p.accentColor }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Color Customizer */}
              <div className="bg-panel rounded-2xl border border-line p-3.5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-fg text-sm">Bảng màu trực tiếp</h3>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="text-muted block mb-1">Màu thương hiệu</label>
                    <div className="flex items-center gap-2 p-1.5 rounded-xl border border-line bg-fg/[0.02]">
                      <input
                        type="color"
                        value={settings?.primaryColor || '#1A2B49'}
                        onChange={(e) => setSettings((c) => (c ? { ...c, primaryColor: e.target.value } : c))}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                      />
                      <span className="font-mono text-fg uppercase text-[11px]">{settings?.primaryColor || '#1A2B49'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-muted block mb-1">Màu nút bấm</label>
                    <div className="flex items-center gap-2 p-1.5 rounded-xl border border-line bg-fg/[0.02]">
                      <input
                        type="color"
                        value={settings?.buttonColor || settings?.primaryColor || '#1A2B49'}
                        onChange={(e) => setSettings((c) => (c ? { ...c, buttonColor: e.target.value } : c))}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                      />
                      <span className="font-mono text-fg uppercase text-[11px]">{settings?.buttonColor || settings?.primaryColor || '#1A2B49'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-muted block mb-1">Màu tiêu đề</label>
                    <div className="flex items-center gap-2 p-1.5 rounded-xl border border-line bg-fg/[0.02]">
                      <input
                        type="color"
                        value={settings?.headingColor || '#1A2B49'}
                        onChange={(e) => setSettings((c) => (c ? { ...c, headingColor: e.target.value } : c))}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                      />
                      <span className="font-mono text-fg uppercase text-[11px]">{settings?.headingColor || '#1A2B49'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-muted block mb-1">Màu nền website</label>
                    <div className="flex items-center gap-2 p-1.5 rounded-xl border border-line bg-fg/[0.02]">
                      <input
                        type="color"
                        value={settings?.backgroundColor || '#FFFFFF'}
                        onChange={(e) => setSettings((c) => (c ? { ...c, backgroundColor: e.target.value } : c))}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                      />
                      <span className="font-mono text-fg uppercase text-[11px]">{settings?.backgroundColor || '#FFFFFF'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography Customizer */}
              <div className="bg-panel rounded-2xl border border-line p-3.5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-fg text-sm">Phông chữ hiển thị</h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-muted block mb-1">Phông tiêu đề</label>
                    <select
                      value={settings?.headingFont || 'Playfair Display'}
                      onChange={(e) => setSettings((c) => (c ? { ...c, headingFont: e.target.value } : c))}
                      className="w-full px-3 py-2 border border-line rounded-xl bg-fg/[0.02] text-fg text-xs focus:outline-none focus:border-primary"
                    >
                      {headingFonts.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.value} ({f.trait})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-muted block mb-1">Phông nội dung</label>
                    <select
                      value={settings?.fontFamily || 'Inter'}
                      onChange={(e) => setSettings((c) => (c ? { ...c, fontFamily: e.target.value } : c))}
                      className="w-full px-3 py-2 border border-line rounded-xl bg-fg/[0.02] text-fg text-xs focus:outline-none focus:border-primary"
                    >
                      {bodyFonts.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.value} ({f.trait})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowThemeModal(true)}
                  className="w-full gap-1.5 text-xs mt-1"
                >
                  <Palette className="w-3.5 h-3.5 text-primary" />
                  <span>Bảng phối màu chi tiết & Đổ màu nâng cao</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-3">
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
                <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Mẫu giao diện thiết kế sẵn</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  Bấm &quot;Áp dụng mẫu này&quot; để tự động cấu hình bố cục, màu sắc và phông chữ chuẩn CRO. Sau đó, bạn có thể chỉnh sửa trực tiếp từng phần.
                </p>
              </div>

              <div className="space-y-3">
                {HOTEL_LANDING_TEMPLATES.map((tmpl) => (
                  <TemplateCard
                    key={tmpl.id}
                    template={tmpl}
                    isActive={settings?.layout === tmpl.id}
                    onApply={applyLandingTemplate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS & SEO */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Domain & SSL Summary Card */}
              <div className="bg-panel rounded-2xl border border-line p-3.5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-fg text-sm">Tên miền & Địa chỉ web</h3>
                </div>

                <div className="p-2.5 rounded-xl bg-fg/[0.03] border border-line/60 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Tên miền mặc định:</span>
                    <a
                      href={`/${property?.subdomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>{property?.subdomain}.digistay.vn</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Tên miền riêng:</span>
                    <span className="font-medium text-fg">
                      {settings?.customDomain ? (
                        <span className="inline-flex items-center gap-1 text-ok">
                          <Shield className="w-3 h-3" />
                          {settings.customDomain}
                        </span>
                      ) : (
                        'Chưa kết nối'
                      )}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettingsModal(true)}
                  className="w-full gap-1.5 text-xs"
                >
                  <Settings className="w-3.5 h-3.5 text-primary" />
                  <span>Cấu hình Tên miền riêng & SSL</span>
                </Button>
              </div>

              {/* SEO Quick Settings */}
              <div className="bg-panel rounded-2xl border border-line p-3.5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-fg text-sm">Tối ưu tìm kiếm (SEO)</h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-muted block mb-1">Tiêu đề SEO (Meta Title)</label>
                    <Input
                      value={settings?.metaTitle || ''}
                      onChange={(e) => setSettings((c) => (c ? { ...c, metaTitle: e.target.value } : c))}
                      placeholder="Ví dụ: Digistay Resort - Nghỉ dưỡng ven sông Hội An"
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-muted block mb-1">Mô tả SEO (Meta Description)</label>
                    <textarea
                      value={settings?.metaDescription || ''}
                      onChange={(e) => setSettings((c) => (c ? { ...c, metaDescription: e.target.value } : c))}
                      placeholder="Mô tả hấp dẫn về điểm đến và ưu đãi đặt phòng trực tiếp..."
                      rows={3}
                      className="w-full px-3 py-2 border border-line rounded-xl bg-fg/[0.02] text-fg text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Version History Quick Access */}
              <div className="bg-panel rounded-2xl border border-line p-3.5 shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-fg text-sm">Lịch sử phiên bản</h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Hệ thống tự động lưu lại các bản chụp website mỗi khi bạn lưu hoặc AI tạo mới. Bạn có thể khôi phục lại bất kỳ lúc nào.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(true)}
                  className="w-full gap-1.5 text-xs mt-1"
                >
                  <HistoryIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Xem và khôi phục các phiên bản cũ</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Canvas & Preview */}
        <div className="rounded-2xl border border-line bg-panel p-2 sm:p-3 lg:min-h-0 lg:flex lg:flex-col relative">
          {/* Orange Warning Banner if Unpublished */}
          {!settings?.isPublished && (
            <div className="mb-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 text-xs font-medium">
                <span className="text-base" aria-hidden="true">⚠️</span>
                <span>
                  <strong>Website chưa xuất bản:</strong> Khách truy cập vào tên miền hiện thấy thông báo chưa công khai hoặc bản xem trước.
                </span>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void handleTogglePublish(true)}
                disabled={isPublishing}
                className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs shrink-0 gap-1.5"
              >
                {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                <span>Xuất bản website ngay</span>
              </Button>
            </div>
          )}

          {/* Browser Frame */}
          <div className={cn('flex flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-xs lg:min-h-0 lg:flex-1 relative', previewMode === 'mobile' && 'mx-auto w-full max-w-[400px]')}>
            {/* Browser Header Bar */}
            <div className="shrink-0 bg-raised px-4 py-2 flex items-center gap-3 border-b border-line">
              <div className="flex gap-1.5" aria-hidden="true">
                <div className="w-2.5 h-2.5 rounded-full bg-fg/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-fg/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-fg/20"></div>
              </div>
              <div className="flex-1 min-w-0 bg-panel rounded-lg px-3 py-1 text-xs text-muted flex items-center justify-between gap-2 border border-line">
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <Globe className="w-3.5 h-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate font-mono">{siteAddress}</span>
                  {customDomain && settings?.sslEnabled && <Shield className="w-3.5 h-3.5 shrink-0 text-ok" aria-hidden="true" />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted uppercase font-medium hidden sm:inline">Xem trước trực quan</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewTheme((curr) => {
                        const effective = curr === 'auto' ? defaultSiteTheme : curr
                        return effective === 'dark' ? 'light' : 'dark'
                      })
                    }
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-panel border border-line text-fg hover:border-primary/40 transition-colors"
                  >
                    {siteTheme === 'dark' ? <Moon className="w-3 h-3 text-primary" /> : <Sun className="w-3 h-3 text-amber-500" />}
                    <span>{siteTheme === 'dark' ? 'Tối' : 'Sáng'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Website Preview Scrollable Canvas */}
            <div
              data-surface="site"
              data-theme={siteTheme}
              data-site-heading={settings?.headingColor ? '' : undefined}
              style={siteStyle}
              className={cn(
                siteFontVariables,
                'min-h-[600px] bg-page text-fg font-site-body lg:min-h-0 lg:flex-1 lg:overflow-y-auto pb-6',
                previewMode === 'mobile' && 'max-h-[700px] overflow-y-auto lg:max-h-none'
              )}
            >
              {/* Dragging indicator */}
              {isDragging && (
                <div className="sticky top-0 z-50 bg-ink text-on-ink px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-lg">
                  <div className="w-2 h-2 rounded-full bg-on-ink animate-pulse"></div>
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
                <div>
                  {site && (
                    <PreviewHeader
                      site={site}
                      types={blocks.filter((b) => b.isEnabled).map((b) => b.type)}
                      compact={previewMode === 'mobile'}
                    />
                  )}
                  {site && (isDragging ? previewBlocks : blocks).filter(b => b.isEnabled).map((block, index, arr) => {
                    const isBeingDragged = isDragging && activeId === block.id

                    return (
                      <InspectableSection
                        key={block.id}
                        id={block.id}
                        type={block.type}
                        name={block.name || text.blockName(block)}
                        isEnabled={block.isEnabled}
                        index={index}
                        total={arr.length}
                        isSelected={selectedBlockId === block.id}
                        isBeingDragged={isBeingDragged}
                        compact={previewMode === 'mobile'}
                        onEdit={() => setSelectedBlockId(block.id)}
                        onRemix={() => setRemixingBlock(block)}
                        onToggle={() => toggleBlock(block.id)}
                        onMoveUp={index > 0 ? () => moveBlock(block.id, 'up') : undefined}
                        onMoveDown={index < arr.length - 1 ? () => moveBlock(block.id, 'down') : undefined}
                        onRemove={() => removeBlock(block.id)}
                      >
                        <PreviewBlock block={block} site={site} compact={previewMode === 'mobile'} />
                      </InspectableSection>
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

          {/* DOCKED AI Command Bar - Dưới browser frame, KHÔNG che phủ viewport của trang web */}
          <div className="shrink-0 mt-3 w-full">
            <div className="rounded-2xl border border-line bg-panel p-2.5 shadow-xs transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (aiPromptInput.trim()) {
                    void handleQuickAiGenerate()
                  }
                }}
                className="flex items-center gap-2"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink text-on-ink shadow-xs border border-line">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
                <input
                  type="text"
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  placeholder="Yêu cầu AI (ví dụ: Biệt thự nghỉ dưỡng ven biển, ưu đãi giảm 10% khi đặt trực tiếp)..."
                  disabled={isAiGenerating}
                  className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-fg placeholder:text-muted focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isAiGenerating || !aiPromptInput.trim()}
                  className="shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold shadow-xs disabled:opacity-40 transition-all cursor-pointer"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tạo bằng AI</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Suggestion Chips (Fixed Dark Mode Contrast) */}
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                <span className="text-muted text-[10px] uppercase font-semibold shrink-0">Gợi ý nhanh:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAiGenerate('Thiết kế website nghỉ dưỡng cao cấp sang trọng chuẩn 5 sao', 'luxury_boutique')}
                  disabled={isAiGenerating}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-raised hover:bg-primary/15 hover:text-primary border border-line hover:border-primary/40 transition-colors text-fg font-medium shadow-2xs"
                >
                  ✨ Luxury 5 Sao
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAiGenerate('Resort sinh thái nhiệt đới gần gũi thiên nhiên và thư giãn', 'tropical_eco')}
                  disabled={isAiGenerating}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-raised hover:bg-primary/15 hover:text-primary border border-line hover:border-primary/40 transition-colors text-fg font-medium shadow-2xs"
                >
                  🌿 Tropical Eco
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAiGenerate('Khách sạn phong cách tối giản hiện đại cho du khách trẻ', 'modern_clean')}
                  disabled={isAiGenerating}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-raised hover:bg-primary/15 hover:text-primary border border-line hover:border-primary/40 transition-colors text-fg font-medium shadow-2xs"
                >
                  🏢 Modern Clean
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAiGenerate('Tối ưu hóa các nút đặt phòng và chương trình khuyến mãi đặt trực tiếp', 'luxury_boutique')}
                  disabled={isAiGenerating}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-raised hover:bg-primary/15 hover:text-primary border border-line hover:border-primary/40 transition-colors text-fg font-medium shadow-2xs"
                >
                  🎯 Ưu đãi trực tiếp (CRO)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Inspector Panel (WYSIWYG Live Editing - No Modal popup) */}
        {selectedBlock && (
          <aside className="lg:min-h-0 lg:overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4 duration-200">
            <BlockInspectorPanel
              block={selectedBlock}
              onUpdate={(config) => updateBlockConfig(selectedBlock.id, config)}
              onClose={() => setSelectedBlockId(null)}
              onToggleEnabled={() => toggleBlock(selectedBlock.id)}
              onRemove={() => removeBlock(selectedBlock.id)}
              onRemix={() => setRemixingBlock(selectedBlock)}
              propertyData={propertyData}
              onPhotoAdded={(photo) => setPropertyData((p: any) => (p ? { ...p, images: [...(p.images ?? []), photo] } : p))}
              onOpenCopilot={(fieldKey, label, currentText, onApply) =>
                setAiCopilotField({ fieldKey, label, text: currentText, onApply })
              }
            />
          </aside>
        )}
      </div>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <TemplateModal
          onSelect={applyLandingTemplate}
          activeTemplateId={settings?.layout}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      <VersionHistory
        propertyId={propertyId}
        subdomain={property?.subdomain}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onRestored={afterRestore}
      />

      {/* Website Settings Modal */}
      {settings && (
        <WebsiteSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          propertyId={propertyId}
          slug={slug}
          subdomain={property?.subdomain}
          propertyName={property?.name}
          coverImage={propertyData?.property?.coverImage || property?.coverImage}
          settings={settings}
          onChange={(patch) => setSettings((curr) => (curr ? { ...curr, ...patch } as any : curr))}
          onSaveDomain={(patch, msg) => handleSave({ ...settings, ...(patch as any) }, msg)}
          onTogglePublish={handleTogglePublish}
          availableCoupons={availableCoupons}
        />
      )}

      {/* Theme & Style Modal */}
      {settings && (
        <ThemeStyleModal
          isOpen={showThemeModal}
          onClose={() => setShowThemeModal(false)}
          settings={settings}
          onChange={(patch) => setSettings((curr) => (curr ? { ...curr, ...patch } as any : curr))}
          bodyFonts={bodyFonts}
          headingFonts={headingFonts}
        />
      )}


      {/* AI Remix Drawer */}
      {remixingBlock && (
        <AiRemixDrawer
          isOpen={Boolean(remixingBlock)}
          onClose={() => setRemixingBlock(null)}
          propertyId={propertyId}
          block={remixingBlock}
          onApplyVariant={(blockId, layoutVariant, newConfig) => {
            setBlocks((prev) =>
              prev.map((b) => (b.id === blockId ? { ...b, layoutVariant, config: { ...b.config, ...newConfig } } : b))
            )
            toast.success(`Đã áp dụng biến thể AI mới cho khối ${remixingBlock.name || remixingBlock.type}`)
          }}
        />
      )}

      {/* AI Text Copilot Modal */}
      {aiCopilotField && (
        <AiTextCopilot
          isOpen={Boolean(aiCopilotField)}
          onClose={() => setAiCopilotField(null)}
          label={aiCopilotField.label}
          initialText={aiCopilotField.text}
          onApplyText={(refined: string) => {
            aiCopilotField.onApply(refined)
            setAiCopilotField(null)
          }}
        />
      )}

      {/* Modal: Xác nhận tắt công khai website */}
      <Modal isOpen={isUnpublishModalOpen} onClose={() => setIsUnpublishModalOpen(false)} size="md">
        <ModalHeader onClose={() => setIsUnpublishModalOpen(false)}>
          <div className="flex items-center gap-2 text-warn">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-bold text-fg">Xác nhận tắt công khai website?</span>
          </div>
        </ModalHeader>
        <ModalBody className="text-sm text-fg/80 space-y-2">
          <p>
            Khi tắt công khai, du khách sẽ không thể truy cập vào website của bạn và không thể đặt phòng trực tuyến được nữa.
          </p>
          <p className="text-xs text-muted">
            Website sẽ chuyển về chế độ <strong>Bản nháp</strong> (chỉ bạn và nhân viên khách sạn đăng nhập mới có thể xem trước).
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsUnpublishModalOpen(false)} disabled={isPublishing}>
            Giữ công khai
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              setIsUnpublishModalOpen(false)
              await handleTogglePublish(false)
            }}
            disabled={isPublishing}
          >
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Xác nhận tắt công khai
          </Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}
