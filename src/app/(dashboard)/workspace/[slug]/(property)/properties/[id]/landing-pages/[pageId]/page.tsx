'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProperty } from '@/lib/hooks/use-property'
import { useCan } from '@/components/layout/workspace-context'
import { NoAccess } from '@/components/layout/no-access'
import { routes } from '@/lib/utils/routes'
import { Badge, Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  Tablet,
  Save,
  Rocket,
  Globe,
  Settings,
  Palette,
  Layers,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Copy,
  Eye,
  Check,
  Flame,
  Star,
  Hotel,
  Zap,
  Phone,
  Clock,
  ShieldCheck,
  MousePointer2,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Wand2,
} from 'lucide-react'

interface BlockItem {
  id: string
  type: string
  name: string
  isEnabled?: boolean
  config: Record<string, any>
}

interface LandingPageDetail {
  id: string
  title: string
  slug: string
  type: 'MAIN_SITE' | 'CAMPAIGN_LP'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  themeConfig: {
    primaryColor?: string
    accentColor?: string
    fontFamily?: string
  }
  metaTitle: string | null
  metaDescription: string | null
  ogImage: string | null
  trackingPixels: {
    fbPixelId?: string
    ga4Id?: string
    tiktokPixelId?: string
  } | null
  blocks: BlockItem[]
  publishedAt: string | null
}

const AVAILABLE_BLOCKS = [
  {
    type: 'HERO',
    name: 'Hero Banner Chuyển Đổi',
    category: 'Đầu trang',
    icon: Flame,
    color: 'text-amber-500',
    description: 'Tiêu đề lớn giật tít, phụ đề hấp dẫn và nút kêu gọi đặt phòng ngay.',
    defaultConfig: {
      title: 'Kỳ Nghỉ Trong Mơ Với Giá Ưu Đãi',
      subtitle: 'Trải nghiệm không gian nghỉ dưỡng tuyệt đẹp cùng dịch vụ 5 sao.',
      ctaText: 'Nhận ưu đãi ngay',
      ctaLink: '#rooms',
    },
  },
  {
    type: 'ROOMS',
    name: 'Danh Sách Phòng Ưu Đãi',
    category: 'Phòng',
    icon: Hotel,
    color: 'text-emerald-500',
    description: 'Trưng bày các hạng phòng đẹp nhất kèm giá và nút đặt tức thì.',
    defaultConfig: {
      title: 'Các Hạng Phòng Áp Dụng Ưu Đãi',
      subtitle: 'Số lượng phòng ưu đãi có hạn cho đợt này',
      limit: 4,
    },
  },
  {
    type: 'CTA',
    name: 'Đồng Hồ Flash Sale (Countdown)',
    category: 'Thúc đẩy CRO',
    icon: Clock,
    color: 'text-rose-500',
    description: 'Đồng hồ đếm ngược kích thích khách đặt phòng chớp nhoáng trước khi hết hạn.',
    defaultConfig: {
      title: 'Ưu Đãi Flash Sale Sắp Kết Thúc!',
      subtitle: 'Giảm thêm 15% cho khách hàng thanh toán đặt cọc trực tuyến hôm nay.',
      buttonText: 'Giữ chỗ với giá ưu đãi',
      endDate: '2026-12-31',
    },
  },
  {
    type: 'ABOUT',
    name: 'Tại Sao Đặt Trực Tiếp (Perks vs OTA)',
    category: 'Bằng chứng xã hội',
    icon: ShieldCheck,
    color: 'text-blue-500',
    description: 'So sánh lợi ích độc quyền khi đặt qua website so với các kênh trung gian OTA.',
    defaultConfig: {
      title: 'Đặc Quyền Đặt Phòng Trực Tiếp',
      aboutContent: '✔ Cam kết giá tốt nhất thị trường\n✔ Miễn phí nhận phòng sớm (tùy tình trạng phòng)\n✔ Tặng kèm voucher đồ uống chào mừng',
    },
  },
  {
    type: 'AMENITIES',
    name: 'Tiện Ích & Dịch Vụ',
    category: 'Nội dung',
    icon: Zap,
    color: 'text-indigo-500',
    description: 'Hồ bơi vô cực, buffet sáng, wifi tốc độ cao, bãi đỗ xe rộng rãi.',
    defaultConfig: {
      title: 'Tiện Nghi Nghỉ Dưỡng Nổi Bật',
    },
  },
  {
    type: 'REVIEWS',
    name: 'Đánh Giá Khách Hàng (Social Proof)',
    category: 'Bằng chứng xã hội',
    icon: Star,
    color: 'text-yellow-500',
    description: 'Nhận xét tích cực từ du khách đã lưu trú tạo dựng niềm tin vững chắc.',
    defaultConfig: {
      title: 'Du Khách Đã Nói Gì Về Chúng Tôi?',
    },
  },
  {
    type: 'CONTACT',
    name: 'Form Thu Thập Khách Hàng (Lead Gen)',
    category: 'Thúc đẩy CRO',
    icon: Phone,
    color: 'text-teal-500',
    description: 'Form để lại số điện thoại/Zalo để nhận mã giảm giá hoặc tư vấn khách đoàn.',
    defaultConfig: {
      title: 'Đăng Ký Nhận Tư Vấn & Mã Giảm Giá',
      subtitle: 'Chuyên viên tư vấn sẽ liên hệ lại trong vòng 15 phút.',
      formEnabled: true,
    },
  },
]

export default function LandingPageBuilderStudio() {
  const params = useParams<{ slug: string; id: string; pageId: string }>()
  const router = useRouter()
  const canManage = useCan('website_manage')
  const { property } = useProperty(params.id)

  const [page, setPage] = React.useState<LandingPageDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [viewport, setViewport] = React.useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [activeTab, setActiveTab] = React.useState<'blocks' | 'layers' | 'theme'>('blocks')
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)

  // Modals
  const [domainModalOpen, setDomainModalOpen] = React.useState(false)
  const [seoModalOpen, setSeoModalOpen] = React.useState(false)

  // Tải chi tiết trang
  const loadPage = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/properties/${params.id}/landing-pages/${params.pageId}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setPage(data.data)
        if (data.data.blocks?.length > 0 && !selectedBlockId) {
          setSelectedBlockId(data.data.blocks[0].id)
        }
      } else {
        toast.error(data.error || 'Không tìm thấy trang')
      }
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }, [params.id, params.pageId, selectedBlockId])

  React.useEffect(() => {
    loadPage()
  }, [loadPage])

  if (!canManage) return <NoAccess />

  // Thao tác Lưu & Xuất bản
  const handleSave = async (publish = false) => {
    if (!page) return
    try {
      setSaving(true)
      const statusToSet = publish ? 'PUBLISHED' : page.status
      const res = await fetch(`/api/properties/${params.id}/landing-pages/${params.pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: page.title,
          slug: page.slug,
          status: statusToSet,
          themeConfig: page.themeConfig,
          metaTitle: page.metaTitle,
          metaDescription: page.metaDescription,
          ogImage: page.ogImage,
          trackingPixels: page.trackingPixels,
          blocks: page.blocks,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPage(data.data)
        toast.success(publish ? 'Đã xuất bản Landing Page thành công!' : 'Đã lưu bản nháp')
      } else {
        toast.error(data.error || 'Không thể lưu trang')
      }
    } catch {
      toast.error('Lỗi khi lưu trang')
    } finally {
      setSaving(false)
    }
  }

  // Thêm khối mới
  const handleAddBlock = (blockDef: typeof AVAILABLE_BLOCKS[number]) => {
    if (!page) return
    const newBlock: BlockItem = {
      id: `${blockDef.type.toLowerCase()}_${Date.now()}`,
      type: blockDef.type,
      name: blockDef.name,
      isEnabled: true,
      config: { ...blockDef.defaultConfig },
    }
    const updatedBlocks = [...(page.blocks || []), newBlock]
    setPage({ ...page, blocks: updatedBlocks })
    setSelectedBlockId(newBlock.id)
    toast.success(`Đã thêm khối "${blockDef.name}"`)
  }

  // Xoá khối
  const handleDeleteBlock = (blockId: string) => {
    if (!page) return
    const updated = page.blocks.filter((b) => b.id !== blockId)
    setPage({ ...page, blocks: updated })
    if (selectedBlockId === blockId) {
      setSelectedBlockId(updated[0]?.id || null)
    }
  }

  // Di chuyển thứ tự khối
  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!page) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= page.blocks.length) return
    const blocksCopy = [...page.blocks]
    const temp = blocksCopy[index]
    blocksCopy[index] = blocksCopy[targetIndex]
    blocksCopy[targetIndex] = temp
    setPage({ ...page, blocks: blocksCopy })
  }

  // Cập nhật cấu hình khối đang chọn
  const handleUpdateActiveBlockConfig = (key: string, value: any) => {
    if (!page || !selectedBlockId) return
    const updated = page.blocks.map((b) => {
      if (b.id === selectedBlockId) {
        return { ...b, config: { ...b.config, [key]: value } }
      }
      return b
    })
    setPage({ ...page, blocks: updated })
  }

  // Trợ lý AI sinh nội dung mẫu
  const handleAiWriter = (type: string) => {
    if (!page || !selectedBlockId) return
    const hotelName = property?.name || 'Khách sạn'
    const city = property?.city || 'Việt Nam'

    let aiTitle = ''
    let aiSubtitle = ''

    if (type === 'HERO') {
      aiTitle = `Nghỉ Dưỡng Tuyệt Vời Tại ${hotelName}`
      aiSubtitle = `Trải nghiệm đẳng cấp giữa lòng ${city} với ưu đãi đặc quyền lên đến 30% khi đặt trực tiếp.`
    } else if (type === 'CTA') {
      aiTitle = `Chỉ Còn 5 Suất Ưu Đãi Cuối Tuần Này!`
      aiSubtitle = `Đặt phòng trước 24:00 hôm nay để nhận trọn gói bữa sáng và xe đưa đón miễn phí.`
    } else {
      aiTitle = `Trải Nghiệm Độc Quyền Tại ${hotelName}`
      aiSubtitle = `Dành riêng cho kỳ nghỉ hoàn hảo của gia đình bạn.`
    }

    handleUpdateActiveBlockConfig('title', aiTitle)
    handleUpdateActiveBlockConfig('subtitle', aiSubtitle)
    toast.success('✨ AI đã gợi ý tiêu đề & thông điệp mới!')
  }

  const selectedBlock = page?.blocks.find((b) => b.id === selectedBlockId)

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-muted">
        <div className="text-center">
          <div className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Đang nạp Studio thiết kế...</p>
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-lg font-bold text-fg">Không tìm thấy landing page</h2>
          <Link href={routes.propertyLandingPages(params.slug, params.id)}>
            <Button className="mt-4">Quay lại danh sách</Button>
          </Link>
        </div>
      </div>
    )
  }

  const publicUrl = `/${property?.subdomain}/lp/${page.slug}`

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Studio Topbar */}
      <header className="h-14 border-b bg-card px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link href={routes.propertyLandingPages(params.slug, params.id)}>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-muted hover:text-fg">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Quay lại
            </Button>
          </Link>
          <div className="h-4 w-[1px] bg-border" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-fg line-clamp-1 max-w-[200px] sm:max-w-xs">{page.title}</span>
              <Badge
                variant="secondary"
                className={
                  page.status === 'PUBLISHED'
                    ? 'bg-emerald-500/10 text-emerald-600 text-[10px] h-5'
                    : 'bg-muted text-muted-fg text-[10px] h-5'
                }
              >
                {page.status === 'PUBLISHED' ? 'Đang xuất bản' : 'Bản nháp'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Viewport Toggles */}
        <div className="hidden sm:flex items-center border rounded-lg p-0.5 bg-muted/40">
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`p-1.5 rounded text-xs flex items-center gap-1 transition-all ${
              viewport === 'desktop' ? 'bg-card text-fg shadow-sm font-medium' : 'text-muted hover:text-fg'
            }`}
            title="Màn hình Máy tính (1280px)"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewport('tablet')}
            className={`p-1.5 rounded text-xs flex items-center gap-1 transition-all ${
              viewport === 'tablet' ? 'bg-card text-fg shadow-sm font-medium' : 'text-muted hover:text-fg'
            }`}
            title="Màn hình Tablet (768px)"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`p-1.5 rounded text-xs flex items-center gap-1 transition-all ${
              viewport === 'mobile' ? 'bg-card text-fg shadow-sm font-medium' : 'text-muted hover:text-fg'
            }`}
            title="Màn hình Điện thoại (390px)"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDomainModalOpen(true)} className="gap-1.5 text-xs h-8">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline">Đường dẫn</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setSeoModalOpen(true)} className="gap-1.5 text-xs h-8">
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">SEO & Ads</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => handleSave(false)} isLoading={saving} className="gap-1.5 text-xs h-8">
            <Save className="w-3.5 h-3.5" />
            Lưu nháp
          </Button>

          <Button size="sm" onClick={() => handleSave(true)} isLoading={saving} className="gap-1.5 text-xs h-8 bg-primary">
            <Rocket className="w-3.5 h-3.5" />
            Xuất bản
          </Button>
        </div>
      </header>

      {/* Main Studio Body (3 Columns) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Sidebar (Blocks / Layers / Theme) */}
        <aside className="w-72 sm:w-80 border-r bg-card flex flex-col shrink-0 z-20">
          <div className="p-2 border-b">
            <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('blocks')}
                className={`py-1.5 rounded transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'blocks' ? 'bg-card text-fg shadow-xs font-semibold' : 'text-muted hover:text-fg'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Khối (+)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('layers')}
                className={`py-1.5 rounded transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'layers' ? 'bg-card text-fg shadow-xs font-semibold' : 'text-muted hover:text-fg'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Cấu trúc
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('theme')}
                className={`py-1.5 rounded transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'theme' ? 'bg-card text-fg shadow-xs font-semibold' : 'text-muted hover:text-fg'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                Giao diện
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'blocks' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider">Thư viện khối nội dung</div>
                <div className="space-y-2">
                  {AVAILABLE_BLOCKS.map((blk) => {
                    const Icon = blk.icon
                    return (
                      <div
                        key={blk.type}
                        onClick={() => handleAddBlock(blk)}
                        className="p-3 rounded-xl border bg-card hover:border-primary/60 hover:bg-primary/5 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg bg-muted group-hover:bg-primary/10 ${blk.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-fg flex items-center justify-between">
                              {blk.name}
                              <Plus className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-[11px] text-muted line-clamp-1 mt-0.5">{blk.description}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === 'layers' && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Thứ tự các khối trên trang</div>
                {page.blocks.length === 0 ? (
                  <p className="text-xs text-muted text-center py-6">Chưa có khối nào. Vui lòng thêm khối từ tab bên cạnh.</p>
                ) : (
                  page.blocks.map((b, idx) => {
                    const isSelected = selectedBlockId === b.id
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBlockId(b.id)}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isSelected ? 'border-primary bg-primary/10 text-primary font-semibold' : 'bg-card hover:border-border/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-muted w-4 font-mono">{idx + 1}</span>
                          <span className="truncate">{b.name}</span>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveBlock(idx, 'up')}
                            className="p-1 text-muted hover:text-fg disabled:opacity-30"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === page.blocks.length - 1}
                            onClick={() => handleMoveBlock(idx, 'down')}
                            className="p-1 text-muted hover:text-fg disabled:opacity-30"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(b.id)}
                            className="p-1 text-muted hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider">Cấu hình màu sắc & Font</div>
                <div>
                  <label className="text-xs font-medium text-fg block mb-1.5">Màu chủ đạo (Primary Color)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={page.themeConfig?.primaryColor || '#3B82F6'}
                      onChange={(e) =>
                        setPage({
                          ...page,
                          themeConfig: { ...page.themeConfig, primaryColor: e.target.value },
                        })
                      }
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={page.themeConfig?.primaryColor || '#3B82F6'}
                      onChange={(e) =>
                        setPage({
                          ...page,
                          themeConfig: { ...page.themeConfig, primaryColor: e.target.value },
                        })
                      }
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-fg block mb-1.5">Màu điểm nhấn (Accent Color)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={page.themeConfig?.accentColor || '#F59E0B'}
                      onChange={(e) =>
                        setPage({
                          ...page,
                          themeConfig: { ...page.themeConfig, accentColor: e.target.value },
                        })
                      }
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={page.themeConfig?.accentColor || '#F59E0B'}
                      onChange={(e) =>
                        setPage({
                          ...page,
                          themeConfig: { ...page.themeConfig, accentColor: e.target.value },
                        })
                      }
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-fg block mb-1.5">Font chữ chính</label>
                  <select
                    value={page.themeConfig?.fontFamily || 'Inter'}
                    onChange={(e) =>
                      setPage({
                        ...page,
                        themeConfig: { ...page.themeConfig, fontFamily: e.target.value },
                      })
                    }
                    className="w-full h-8 rounded-lg border bg-card px-2 text-xs"
                  >
                    <option value="Inter">Inter (Hiện đại, đa dụng)</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans (Thân thiện, Homestay)</option>
                    <option value="Playfair Display">Playfair Display (Sang trọng, Resort & Boutique)</option>
                    <option value="Roboto">Roboto (Cổ điển)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER COLUMN: Live Interactive Canvas */}
        <main className="flex-1 bg-muted/30 p-4 sm:p-6 overflow-y-auto flex flex-col items-center">
          <div
            className={`transition-all duration-300 bg-card border rounded-2xl shadow-md min-h-[600px] flex flex-col overflow-hidden ${
              viewport === 'desktop'
                ? 'w-full max-w-4xl'
                : viewport === 'tablet'
                  ? 'w-[768px]'
                  : 'w-[390px]'
            }`}
          >
            {/* Fake Browser/Phone Top Bar */}
            <div className="h-9 bg-muted/60 border-b px-4 flex items-center justify-between text-xs text-muted select-none">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="font-mono text-[11px] truncate max-w-xs text-muted">
                {property?.subdomain}.digistay.vn/lp/{page.slug}
              </div>
              <div className="w-8" />
            </div>

            {/* Canvas Blocks Rendering */}
            <div className="flex-1 flex flex-col divide-y divide-border/60">
              {page.blocks.length === 0 ? (
                <div className="py-24 text-center text-muted">
                  <p className="text-sm">Trang chưa có khối nội dung nào.</p>
                  <p className="text-xs mt-1">Chọn một khối từ cột bên trái để bắt đầu thiết kế.</p>
                </div>
              ) : (
                page.blocks.map((block) => {
                  const isSelected = selectedBlockId === block.id
                  const cfg = block.config || {}
                  return (
                    <div
                      key={block.id}
                      onClick={() => setSelectedBlockId(block.id)}
                      className={`relative p-6 sm:p-8 cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-2 ring-primary ring-inset bg-primary/[0.02]'
                          : 'hover:bg-muted/10'
                      }`}
                    >
                      {/* Active Indicator Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow z-10 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Đang chọn ({block.name})
                        </div>
                      )}

                      {/* Block Preview Representation */}
                      {block.type === 'HERO' && (
                        <div className="text-center py-6 space-y-3">
                          <Badge variant="outline" className="text-xs uppercase tracking-widest text-primary border-primary/30">
                            {property?.type || 'HOTEL'} · {property?.city || 'VIỆT NAM'}
                          </Badge>
                          <h1 className="text-2xl sm:text-4xl font-bold text-fg leading-tight font-site">
                            {cfg.title || 'Tiêu đề Hero Banner'}
                          </h1>
                          <p className="text-sm text-muted max-w-lg mx-auto">{cfg.subtitle || 'Mô tả ngắn gọn về ưu đãi'}</p>
                          <div className="pt-2">
                            <Button className="rounded-full px-6 shadow-md" style={{ backgroundColor: page.themeConfig?.primaryColor || '#3B82F6' }}>
                              {cfg.ctaText || 'Đặt phòng ngay'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {block.type === 'CTA' && (
                        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase">
                            <Clock className="w-4 h-4" />
                            Flash Sale Đếm Ngược
                          </div>
                          <h2 className="text-xl sm:text-2xl font-bold text-fg">{cfg.title || 'Ưu Đãi Có Hạn!'}</h2>
                          <div className="flex justify-center gap-3 py-2 font-mono text-center">
                            <div className="bg-card p-2 rounded-lg border shadow-xs min-w-[50px]">
                              <div className="text-lg font-bold text-fg">03</div>
                              <div className="text-[10px] text-muted">Ngày</div>
                            </div>
                            <div className="bg-card p-2 rounded-lg border shadow-xs min-w-[50px]">
                              <div className="text-lg font-bold text-fg">14</div>
                              <div className="text-[10px] text-muted">Giờ</div>
                            </div>
                            <div className="bg-card p-2 rounded-lg border shadow-xs min-w-[50px]">
                              <div className="text-lg font-bold text-fg">35</div>
                              <div className="text-[10px] text-muted">Phút</div>
                            </div>
                          </div>
                          <p className="text-xs text-muted">{cfg.subtitle || 'Đừng bỏ lỡ giá tốt nhất'}</p>
                        </div>
                      )}

                      {block.type === 'ROOMS' && (
                        <div className="space-y-4 py-2">
                          <div className="text-center">
                            <h2 className="text-xl font-bold text-fg">{cfg.title || 'Danh sách phòng'}</h2>
                            <p className="text-xs text-muted mt-1">{cfg.subtitle || 'Chọn phòng phù hợp'}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 rounded-xl border bg-card/60 space-y-1.5">
                              <div className="h-24 bg-muted rounded-lg flex items-center justify-center text-xs text-muted">
                                Ảnh phòng Deluxe
                              </div>
                              <div className="font-semibold text-xs text-fg">Phòng Deluxe Ban Công</div>
                              <div className="text-xs text-emerald-600 font-bold">Từ 850.000₫ / đêm</div>
                            </div>
                            <div className="p-3 rounded-xl border bg-card/60 space-y-1.5">
                              <div className="h-24 bg-muted rounded-lg flex items-center justify-center text-xs text-muted">
                                Ảnh phòng Suite
                              </div>
                              <div className="font-semibold text-xs text-fg">Phòng Suite Hướng Biển</div>
                              <div className="text-xs text-emerald-600 font-bold">Từ 1.450.000₫ / đêm</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {block.type === 'ABOUT' && (
                        <div className="py-2 space-y-3">
                          <h2 className="text-lg font-bold text-fg">{cfg.title || 'Giới thiệu & Đặc quyền'}</h2>
                          <div className="text-xs text-muted whitespace-pre-line leading-relaxed">
                            {cfg.aboutContent || 'Thông tin đặc quyền khi đặt trực tiếp tại website...'}
                          </div>
                        </div>
                      )}

                      {block.type === 'CONTACT' && (
                        <div className="py-4 text-center space-y-3 bg-muted/20 rounded-xl p-4">
                          <h2 className="text-base font-bold text-fg">{cfg.title || 'Liên hệ nhận tư vấn'}</h2>
                          <p className="text-xs text-muted">{cfg.subtitle || 'Để lại số điện thoại'}</p>
                          <div className="flex gap-2 max-w-sm mx-auto">
                            <Input placeholder="Số điện thoại hoặc Zalo của bạn" className="h-8 text-xs" readOnly />
                            <Button size="sm" className="h-8 text-xs shrink-0">
                              Gửi ngay
                            </Button>
                          </div>
                        </div>
                      )}

                      {!['HERO', 'CTA', 'ROOMS', 'ABOUT', 'CONTACT'].includes(block.type) && (
                        <div className="py-4 text-center">
                          <h2 className="text-sm font-semibold text-fg">{block.name}</h2>
                          <p className="text-xs text-muted mt-1">{cfg.title || 'Nội dung khối'}</p>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: Inspector (Properties & AI Copilot) */}
        <aside className="w-72 sm:w-80 border-l bg-card flex flex-col shrink-0 z-20">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-xs font-semibold text-fg">Thuộc tính phần tử</span>
            {selectedBlock && (
              <Badge variant="outline" className="text-[10px]">
                {selectedBlock.name}
              </Badge>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedBlock ? (
              <div className="space-y-4">
                {/* AI Writer Assistant */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-transparent border border-primary/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="w-4 h-4" />
                    Digistay AI Writer
                  </div>
                  <p className="text-[11px] text-muted leading-tight">
                    Tự động tạo câu từ hấp dẫn, giật tít cho khối {selectedBlock.name}.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAiWriter(selectedBlock.type)}
                    className="w-full text-xs h-7 gap-1.5 bg-card/80"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-primary" />
                    Sinh nội dung bằng AI
                  </Button>
                </div>

                {/* Common Inputs */}
                <div>
                  <label className="text-xs font-medium text-fg block mb-1">Tiêu đề khối (Title)</label>
                  <Input
                    value={selectedBlock.config.title || ''}
                    onChange={(e) => handleUpdateActiveBlockConfig('title', e.target.value)}
                    placeholder="Nhập tiêu đề hiển thị"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-fg block mb-1">Mô tả phụ (Subtitle / Copy)</label>
                  <textarea
                    value={selectedBlock.config.subtitle || selectedBlock.config.aboutContent || ''}
                    onChange={(e) => {
                      if (selectedBlock.type === 'ABOUT') {
                        handleUpdateActiveBlockConfig('aboutContent', e.target.value)
                      } else {
                        handleUpdateActiveBlockConfig('subtitle', e.target.value)
                      }
                    }}
                    rows={3}
                    placeholder="Nội dung chi tiết..."
                    className="w-full rounded-lg border bg-background p-2 text-xs text-fg"
                  />
                </div>

                {selectedBlock.type === 'HERO' && (
                  <div>
                    <label className="text-xs font-medium text-fg block mb-1">Chữ trên nút kêu gọi (CTA)</label>
                    <Input
                      value={selectedBlock.config.ctaText || ''}
                      onChange={(e) => handleUpdateActiveBlockConfig('ctaText', e.target.value)}
                      placeholder="VD: Đặt phòng ngay"
                      className="text-xs"
                    />
                  </div>
                )}

                {selectedBlock.type === 'ROOMS' && (
                  <div>
                    <label className="text-xs font-medium text-fg block mb-1">Số lượng phòng hiển thị</label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={selectedBlock.config.limit || 4}
                      onChange={(e) => handleUpdateActiveBlockConfig('limit', parseInt(e.target.value) || 4)}
                      className="text-xs"
                    />
                  </div>
                )}

                {selectedBlock.type === 'CTA' && (
                  <div>
                    <label className="text-xs font-medium text-fg block mb-1">Chữ trên nút bấm Flash Sale</label>
                    <Input
                      value={selectedBlock.config.buttonText || ''}
                      onChange={(e) => handleUpdateActiveBlockConfig('buttonText', e.target.value)}
                      placeholder="VD: Nhận ưu đãi chớp nhoáng"
                      className="text-xs"
                    />
                  </div>
                )}

                <div className="pt-2 border-t flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBlock(selectedBlock.id)}
                    className="text-destructive hover:bg-destructive/10 text-xs gap-1.5 h-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xoá khối này
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-muted">
                <p className="text-xs">Bấm chọn một khối trên Canvas để chỉnh sửa thuộc tính.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal: Cấu hình Đường dẫn & Tên miền */}
      <Modal isOpen={domainModalOpen} onClose={() => setDomainModalOpen(false)}>
        <ModalHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Cấu hình Tên miền & Đường dẫn Landing Page
          </div>
        </ModalHeader>
        <ModalBody className="space-y-5">
          <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
            <div className="text-xs font-semibold text-fg">1. Đường dẫn Subdomain Digistay (Mặc định)</div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-card px-2.5 py-1.5 rounded border font-mono flex-1 text-fg truncate">
                {property?.subdomain}.digistay.vn/lp/{page.slug}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : ''
                  navigator.clipboard.writeText(`${origin}/${property?.subdomain}/lp/${page.slug}`)
                  toast.success('Đã sao chép liên kết')
                }}
                className="h-8 gap-1 text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </Button>
            </div>
            <p className="text-[11px] text-muted">Chứng chỉ bảo mật HTTPS (SSL) đã được kích hoạt sẵn tự động.</p>
          </div>

          <div className="p-4 rounded-xl border space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-fg">2. Tên miền riêng (Custom Domain)</div>
              <Badge variant="outline" className="text-[10px]">
                cname.digistay.vn
              </Badge>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Nếu cơ sở của bạn đã kết nối tên miền riêng (ví dụ: <span className="font-mono text-fg">booking.khachsan.vn</span>), trang này sẽ hoạt động đồng thời tại:{' '}
              <span className="font-mono text-primary font-semibold">https://[ten-mien-rieng]/lp/{page.slug}</span>
            </p>
            <div className="pt-2 border-t">
              <Link href={routes.propertyWebsite(params.slug, params.id)}>
                <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                  Đi đến trang Quản lý & Cấu hình DNS Tên miền riêng
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setDomainModalOpen(false)}>Đóng</Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Cài đặt SEO & Mã tiếp thị (Tracking Pixels) */}
      <Modal isOpen={seoModalOpen} onClose={() => setSeoModalOpen(false)}>
        <ModalHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Cài đặt SEO & Mã đo lường Quảng cáo
          </div>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div>
            <label className="text-xs font-medium text-fg block mb-1">Tiêu đề SEO (Meta Title)</label>
            <Input
              value={page.metaTitle || ''}
              onChange={(e) => setPage({ ...page, metaTitle: e.target.value })}
              placeholder="VD: Combo Nghỉ Dưỡng Mùa Hè 3N2Đ - Khách Sạn Biển Xanh"
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-fg block mb-1">Mô tả SEO (Meta Description)</label>
            <textarea
              value={page.metaDescription || ''}
              onChange={(e) => setPage({ ...page, metaDescription: e.target.value })}
              rows={3}
              placeholder="Mô tả hấp dẫn khi hiển thị trên Google Search hoặc chia sẻ link qua Zalo/Facebook..."
              className="w-full rounded-lg border bg-background p-2 text-xs text-fg"
            />
          </div>

          <div className="pt-3 border-t space-y-3">
            <div className="text-xs font-semibold text-fg">Mã đo lường Tiếp thị (Tracking Pixels)</div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Facebook Pixel ID</label>
              <Input
                value={page.trackingPixels?.fbPixelId || ''}
                onChange={(e) =>
                  setPage({
                    ...page,
                    trackingPixels: { ...page.trackingPixels, fbPixelId: e.target.value },
                  })
                }
                placeholder="VD: 123456789012345"
                className="text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Google Analytics 4 / Google Tag ID</label>
              <Input
                value={page.trackingPixels?.ga4Id || ''}
                onChange={(e) =>
                  setPage({
                    ...page,
                    trackingPixels: { ...page.trackingPixels, ga4Id: e.target.value },
                  })
                }
                placeholder="VD: G-XXXXXXXXXX"
                className="text-xs font-mono"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={() => {
              setSeoModalOpen(false)
              toast.success('Đã lưu cấu hình SEO & Pixels vào bộ nhớ tạm')
            }}
          >
            Lưu thay đổi
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

