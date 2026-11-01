'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header, PageContainer } from '@/components/layout'
import { NoAccess } from '@/components/layout/no-access'
import { useCan } from '@/components/layout/workspace-context'
import { useProperty } from '@/lib/hooks/use-property'
import { routes } from '@/lib/utils/routes'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import {
  Globe,
  Plus,
  ExternalLink,
  Copy,
  Pencil,
  Trash2,
  Sparkles,
  Eye,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Flame,
  CheckCircle2,
  Clock,
  QrCode,
} from 'lucide-react'

interface LandingPageSummary {
  id: string
  title: string
  slug: string
  type: 'MAIN_SITE' | 'CAMPAIGN_LP'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  metaTitle: string | null
  metaDescription: string | null
  ogImage: string | null
  viewCount: number
  leadCount: number
  bookingCount: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

const TEMPLATE_PRESETS = [
  {
    id: 'blank',
    title: 'Trang trống (Tự do thiết kế)',
    description: 'Bắt đầu với một canvas trắng và tự do thêm các khối nội dung theo ý muốn.',
    icon: Layers,
    badge: 'Tự do',
    badgeColor: 'bg-muted text-muted-fg',
    defaultBlocks: [
      {
        id: 'hero_1',
        type: 'HERO',
        name: 'Hero Banner',
        config: { title: 'Chào mừng quý khách', subtitle: 'Kỳ nghỉ tuyệt vời cùng ưu đãi độc quyền', heroCtaText: 'Đặt phòng ngay' },
      },
      {
        id: 'rooms_1',
        type: 'ROOMS',
        name: 'Hạng phòng',
        config: { roomsTitle: 'Các hạng phòng nổi bật', roomsLimit: 4 },
      },
      {
        id: 'contact_1',
        type: 'CONTACT',
        name: 'Liên hệ',
        config: { contactTitle: 'Liên hệ đặt phòng & Tư vấn', contactFormEnabled: true },
      },
    ],
  },
  {
    id: 'flash_sale',
    title: 'Flash Sale & Đếm ngược',
    description: 'Tối ưu cho các chiến dịch giảm giá giờ vàng, cuối tuần, có đồng hồ đếm ngược kích thích mua ngay.',
    icon: Flame,
    badge: 'Chuyển đổi cao',
    badgeColor: 'bg-amber-500/10 text-amber-600',
    defaultBlocks: [
      {
        id: 'hero_1',
        type: 'HERO',
        name: 'Hero Giảm Giá Giờ Vàng',
        config: { title: 'Flash Sale Cuối Tuần - Giảm Đến 35%', subtitle: 'Chỉ áp dụng cho 20 khách đặt sớm nhất', heroCtaText: 'Nhận ưu đãi ngay' },
      },
      {
        id: 'countdown_1',
        type: 'CTA',
        name: 'Đồng hồ đếm ngược',
        config: { ctaTitle: 'Thời gian ưu đãi còn lại', ctaSubtitle: 'Chương trình kết thúc sau khi hết suất phòng ưu đãi', ctaButtonText: 'Đặt phòng chớp nhoáng' },
      },
      {
        id: 'rooms_1',
        type: 'ROOMS',
        name: 'Phòng áp dụng',
        config: { roomsTitle: 'Hạng phòng ưu đãi', roomsLimit: 3 },
      },
      {
        id: 'reviews_1',
        type: 'REVIEWS',
        name: 'Khách hàng nói gì',
        config: { reviewsTitle: 'Đánh giá từ khách đã lưu trú' },
      },
    ],
  },
  {
    id: 'combo_deal',
    title: 'Gói Combo Trọn Gói 3N2Đ',
    description: 'Dành cho gói nghỉ dưỡng kết hợp ăn uống, tiệc nướng BBQ hoặc đưa đón sân bay.',
    icon: Sparkles,
    badge: 'Phổ biến',
    badgeColor: 'bg-blue-500/10 text-blue-600',
    defaultBlocks: [
      {
        id: 'hero_1',
        type: 'HERO',
        name: 'Hero Combo Trọn Gói',
        config: { title: 'Combo Nghỉ Dưỡng 3N2Đ Siêu Tiết Kiệm', subtitle: 'Bao gồm phòng nghỉ cao cấp + Buffet sáng + Xe đón tiễn', heroCtaText: 'Xem chi tiết combo' },
      },
      {
        id: 'about_1',
        type: 'ABOUT',
        name: 'Lợi ích đặc quyền',
        config: { aboutTitle: 'Tại sao nên chọn gói Combo này?', aboutContent: 'Tiết kiệm lên đến 25% so với đặt riêng lẻ từng dịch vụ.' },
      },
      {
        id: 'services_1',
        type: 'SERVICES',
        name: 'Dịch vụ đi kèm',
        config: { servicesTitle: 'Các dịch vụ bao gồm trong gói' },
      },
      {
        id: 'contact_1',
        type: 'CONTACT',
        name: 'Đăng ký giữ chỗ',
        config: { contactTitle: 'Để lại thông tin nhận tư vấn gói Combo', contactFormEnabled: true },
      },
    ],
  },
]

export default function LandingPagesListPage() {
  const params = useParams<{ slug: string; id: string }>()
  const router = useRouter()
  const { property } = useProperty(params.id)
  const canManage = useCan('website_manage')

  const [pages, setPages] = React.useState<LandingPageSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)

  // Form state
  const [title, setTitle] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [selectedTemplate, setSelectedTemplate] = React.useState('blank')

  const loadPages = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/properties/${params.id}/landing-pages`)
      const data = await res.json()
      if (res.ok && data.success) {
        setPages(data.data)
      } else {
        toast.error(data.error || 'Không thể tải danh sách landing page')
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    loadPages()
  }, [loadPages])

  if (!canManage) {
    return <NoAccess />
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề landing page')
      return
    }

    try {
      setCreating(true)
      const tmpl = TEMPLATE_PRESETS.find((t) => t.id === selectedTemplate)
      const res = await fetch(`/api/properties/${params.id}/landing-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim() || undefined,
          type: 'CAMPAIGN_LP',
          status: 'DRAFT',
          blocks: tmpl?.defaultBlocks ?? [],
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Đã tạo landing page thành công!')
        setModalOpen(false)
        setTitle('')
        setSlug('')
        router.push(routes.propertyLandingPageBuilder(params.slug, params.id, data.data.id))
      } else {
        toast.error(data.error || 'Không thể tạo landing page')
      }
    } catch {
      toast.error('Lỗi khi gửi yêu cầu')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (pageId: string, pageTitle: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xoá trang "${pageTitle}"?`)) return
    try {
      const res = await fetch(`/api/properties/${params.id}/landing-pages/${pageId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Đã xoá landing page')
        setPages((prev) => prev.filter((p) => p.id !== pageId))
      } else {
        toast.error(data.error || 'Không thể xoá trang')
      }
    } catch {
      toast.error('Lỗi kết nối')
    }
  }

  const copyUrl = (pageSlug: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/${property?.subdomain}/lp/${pageSlug}`
    navigator.clipboard.writeText(url)
    toast.success('Đã sao chép liên kết vào bộ nhớ tạm')
  }

  // Summary counts
  const publishedCount = pages.filter((p) => p.status === 'PUBLISHED').length
  const totalViews = pages.reduce((sum, p) => sum + p.viewCount, 0)
  const totalLeads = pages.reduce((sum, p) => sum + p.leadCount, 0)

  return (
    <PageContainer>
      <Header
        title="Landing Pages & Chiến dịch"
        description="Tạo các trang đích chuyên biệt cho từng chiến dịch quảng cáo, ưu đãi phòng và sự kiện nhằm tối đa hóa tỷ lệ đặt phòng trực tiếp."
        actions={
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Tạo Landing Page mới
          </Button>
        }
      />

      {/* Domain Quick Overview Banner */}
      <div className="mt-6 p-4 rounded-xl border bg-card/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Đường dẫn cơ sở:</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-fg">
                {property?.subdomain}.digistay.vn
              </code>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Các Landing Page chiến dịch sẽ hoạt động tại{' '}
              <span className="font-mono">{property?.subdomain}.digistay.vn/lp/[duong-dan]</span> hoặc trên tên miền riêng của bạn.
            </p>
          </div>
        </div>
        <Link href={routes.propertyWebsite(params.slug, params.id)}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            Cấu hình Tên miền riêng
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted font-semibold flex items-center justify-between">
              Tổng số trang
              <Layers className="w-4 h-4 text-muted" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-fg">{pages.length}</div>
            <p className="text-xs text-muted mt-1">{publishedCount} trang đang xuất bản</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted font-semibold flex items-center justify-between">
              Đang xuất bản
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{publishedCount}</div>
            <p className="text-xs text-muted mt-1">Sẵn sàng nhận khách truy cập</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted font-semibold flex items-center justify-between">
              Lượt xem toàn bộ
              <Eye className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-fg">{totalViews.toLocaleString('vi-VN')}</div>
            <p className="text-xs text-muted mt-1">Lượt truy cập từ các chiến dịch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted font-semibold flex items-center justify-between">
              Khách tiềm năng (Leads)
              <Users className="w-4 h-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalLeads.toLocaleString('vi-VN')}</div>
            <p className="text-xs text-muted mt-1">Khách để lại thông tin tư vấn</p>
          </CardContent>
        </Card>
      </div>

      {/* Pages List */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-fg">Danh sách Landing Pages</h2>
          <span className="text-xs text-muted">{pages.length} trang</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Đang tải danh sách trang...
          </div>
        ) : pages.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed rounded-xl bg-card/40">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-fg">Chưa có Landing Page chiến dịch nào</h3>
            <p className="text-sm text-muted max-w-md mx-auto mt-1 mb-5">
              Tạo trang đích đầu tiên để chạy quảng cáo Facebook, Google hoặc gửi cho khách đoàn để tăng tỷ lệ đặt phòng trực tiếp.
            </p>
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Tạo Landing Page đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pages.map((page) => {
              const liveUrl = `/${property?.subdomain}/lp/${page.slug}`
              return (
                <div
                  key={page.id}
                  className="rounded-xl border bg-card hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden shadow-sm hover:shadow"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <Badge
                        variant="secondary"
                        className={
                          page.status === 'PUBLISHED'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-muted text-muted-fg'
                        }
                      >
                        {page.status === 'PUBLISHED' ? 'Đang xuất bản' : page.status === 'DRAFT' ? 'Bản nháp' : 'Đã lưu trữ'}
                      </Badge>
                      <span className="text-xs text-muted font-mono">/lp/{page.slug}</span>
                    </div>

                    <h3 className="font-semibold text-base text-fg line-clamp-1">{page.title}</h3>
                    <p className="text-xs text-muted line-clamp-2 mt-1">
                      {page.metaDescription || 'Chưa thiết lập mô tả SEO cho trang này.'}
                    </p>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t text-center">
                      <div className="bg-muted/40 p-2 rounded-lg">
                        <div className="text-xs text-muted">Lượt xem</div>
                        <div className="font-semibold text-sm text-fg mt-0.5">{page.viewCount}</div>
                      </div>
                      <div className="bg-muted/40 p-2 rounded-lg">
                        <div className="text-xs text-muted">Leads</div>
                        <div className="font-semibold text-sm text-purple-600 mt-0.5">{page.leadCount}</div>
                      </div>
                      <div className="bg-muted/40 p-2 rounded-lg">
                        <div className="text-xs text-muted">Đơn phòng</div>
                        <div className="font-semibold text-sm text-emerald-600 mt-0.5">{page.bookingCount}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/20 border-t flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyUrl(page.slug)}
                        title="Sao chép liên kết"
                        className="h-8 px-2 text-xs"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy Link
                      </Button>
                      {page.status === 'PUBLISHED' && (
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-8 px-2 text-xs text-muted hover:text-fg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Xem
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Link href={routes.propertyLandingPageBuilder(params.slug, params.id, page.id)}>
                        <Button size="sm" variant="primary" className="h-8 px-3 text-xs gap-1.5">
                          <Pencil className="w-3.5 h-3.5" />
                          Thiết kế Studio
                        </Button>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(page.id, page.title)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        title="Xoá trang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Tạo Landing Page mới */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreate}>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Tạo Landing Page Chiến dịch Mới
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <label className="text-sm font-medium text-fg block mb-1.5">
                Tiêu đề chiến dịch <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="VD: Combo Mùa Hè 3N2Đ Siêu Tiết Kiệm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted mt-1">Tên gọi để bạn và khách hàng nhận diện chiến dịch này.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-fg block mb-1.5">Đường dẫn URL (slug - Không bắt buộc)</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted font-mono">/lp/</span>
                <Input
                  placeholder="combo-mua-he-2026 (tự động tạo từ tiêu đề)"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-fg block mb-2">Chọn mẫu bắt đầu (Template Preset)</label>
              <div className="space-y-2.5">
                {TEMPLATE_PRESETS.map((tmpl) => {
                  const Icon = tmpl.icon
                  const isSelected = selectedTemplate === tmpl.id
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:border-primary/40 bg-card'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-card border mt-0.5 text-primary shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-fg">{tmpl.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tmpl.badgeColor}`}>
                            {tmpl.badge}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">{tmpl.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={creating}>
              Huỷ
            </Button>
            <Button type="submit" isLoading={creating} className="gap-2">
              Tạo và mở Studio
              <ArrowRight className="w-4 h-4" />
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </PageContainer>
  )
}
