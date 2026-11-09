'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Globe, Search, Sparkles, ShieldCheck, ArrowRight, ExternalLink, Activity, Share2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
} from '@/components/ui'
import { EnglishCopy } from '@/components/ui/english-copy'
import { CustomDomainCard, type DomainSettings } from './custom-domain-card'
import { routes } from '@/lib/utils/routes'
import { isValidFacebookPixelId, isValidGoogleTagId } from '@/lib/marketing/tracking'

interface WebsiteSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  slug: string
  subdomain?: string
  propertyName?: string
  coverImage?: string | null
  settings: {
    metaTitle?: string
    metaDescription?: string
    translations?: { en?: { metaTitle?: string; metaDescription?: string } } | null
    customDomain?: string | null
    domainVerificationStatus?: string | null
    sslEnabled?: boolean | null
    sslRequestedAt?: string | null
    sslError?: string | null
    exitIntentEnabled?: boolean
    exitIntentCouponId?: string | null
    facebookPixelId?: string | null
    googleTagId?: string | null
    isPublished: boolean
  }
  onChange: (updated: Record<string, unknown>) => void
  onSaveDomain: (patch: Record<string, unknown>, toastMsg?: string) => void
  onTogglePublish?: (nextPublished: boolean) => Promise<boolean>
  availableCoupons: Array<{
    id: string
    code: string
    name: string
    discountType: string
    discountValue: number
  }>
}

export function WebsiteSettingsModal({
  isOpen,
  onClose,
  propertyId,
  slug,
  subdomain,
  propertyName,
  coverImage,
  settings,
  onChange,
  onSaveDomain,
  onTogglePublish,
  availableCoupons,
}: WebsiteSettingsModalProps) {
  const t = useTranslations('dash.website')
  const tc = useTranslations('dash.common')
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState('domain')
  const [isTogglingPublish, setIsTogglingPublish] = React.useState(false)

  const handleTogglePublish = async (nextState: boolean) => {
    if (onTogglePublish) {
      setIsTogglingPublish(true)
      try {
        await onTogglePublish(nextState)
      } finally {
        setIsTogglingPublish(false)
      }
    } else {
      onChange({ isPublished: nextState })
    }
  }

  const publicUrl = subdomain ? `https://${subdomain}.digistay.vn` : ''

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={t('tabs.settings')}>
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-acc-soft text-acc">
            <Globe className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-fg">Cài đặt Website Khách sạn</h2>
            <p className="text-xs text-muted">Cấu hình tên miền, chứng chỉ bảo mật SSL, SEO và popup ưu đãi</p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-1 h-auto p-1 bg-fg/[0.04]">
            <TabsTrigger value="domain" className="gap-1.5 text-xs sm:text-sm py-2">
              <Globe className="h-4 w-4" />
              <span>Tên miền & SSL</span>
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5 text-xs sm:text-sm py-2">
              <Search className="h-4 w-4" />
              <span>SEO & Mạng XH</span>
            </TabsTrigger>
            <TabsTrigger value="marketing" className="gap-1.5 text-xs sm:text-sm py-2">
              <Activity className="h-4 w-4" />
              <span>Đo lường & Pixel</span>
            </TabsTrigger>
            <TabsTrigger value="exitIntent" className="gap-1.5 text-xs sm:text-sm py-2">
              <Sparkles className="h-4 w-4" />
              <span>Popup ưu đãi</span>
            </TabsTrigger>
            <TabsTrigger value="publish" className="gap-1.5 text-xs sm:text-sm py-2">
              <ShieldCheck className="h-4 w-4" />
              <span>{t('publish.title')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Domain & SSL Tab */}
          <TabsContent value="domain" className="mt-4 space-y-4">
            {/* Free Digistay Subdomain */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-fg/[0.02]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Subdomain Digistay (Mặc định)</p>
                <p className="text-sm font-medium text-fg mt-0.5">{publicUrl || 'Chưa thiết lập'}</p>
                <p className="text-xs text-muted mt-1">Được kích hoạt sẵn chứng chỉ bảo mật Wildcard SSL miễn phí.</p>
              </div>
              {subdomain && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-acc hover:underline px-3 py-1.5 rounded-lg bg-acc-soft"
                >
                  <span>Truy cập</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Custom Domain Card */}
            <CustomDomainCard
              propertyId={propertyId}
              settings={settings as DomainSettings}
              onChange={(patch) => onChange(patch as Record<string, unknown>)}
              onRemove={async () => {
                await onSaveDomain({ ...settings, customDomain: '' }, t('domain.removed'))
                return true
              }}
              subdomain={subdomain}
            />
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="mt-4 space-y-4">
            <Input
              label={t('settings.metaTitle')}
              value={settings.metaTitle || ''}
              onChange={(e) => onChange({ metaTitle: e.target.value })}
              placeholder={t('settings.metaTitlePlaceholder')}
            />

            <div>
              <label className="text-sm font-medium text-fg">{t('settings.metaDescription')}</label>
              <textarea
                value={settings.metaDescription || ''}
                onChange={(e) => onChange({ metaDescription: e.target.value })}
                placeholder={t('settings.metaDescriptionPlaceholder')}
                className="w-full mt-1.5 px-3 py-2 border border-line rounded-ctl bg-raised text-fg text-sm focus:outline-none focus:ring-2 focus:ring-acc"
                rows={3}
              />
            </div>

            {/* Google Search Preview */}
            <div className="p-4 rounded-xl border border-line bg-fg/[0.02]">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Xem trước kết quả tìm kiếm Google</p>
              <div className="max-w-xl font-sans">
                <p className="text-xs text-[#202124] dark:text-[#bdc1c6] truncate">{publicUrl || 'https://khachsan.digistay.vn'}</p>
                <h4 className="text-base font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer truncate">
                  {settings.metaTitle || 'Khách sạn nghỉ dưỡng cao cấp - Đặt phòng trực tiếp'}
                </h4>
                <p className="text-xs text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2 mt-0.5">
                  {settings.metaDescription || 'Trải nghiệm kỳ nghỉ tuyệt vời với giá tốt nhất, ưu đãi độc quyền khi đặt phòng trực tiếp tại website khách sạn.'}
                </p>
              </div>
            </div>

            {/* English translation */}
            <EnglishCopy filled={Boolean(settings.translations?.en?.metaTitle || settings.translations?.en?.metaDescription)}>
              <Input
                label={t('settings.metaTitle')}
                value={settings.translations?.en?.metaTitle ?? ''}
                onChange={(e) =>
                  onChange({
                    translations: { en: { ...settings.translations?.en, metaTitle: e.target.value } },
                  })
                }
                placeholder={settings.metaTitle ?? ''}
              />
              <div className="mt-2">
                <label htmlFor="seo-en-desc" className="text-sm font-medium text-fg">
                  {t('settings.metaDescription')}
                </label>
                <textarea
                  id="seo-en-desc"
                  value={settings.translations?.en?.metaDescription ?? ''}
                  onChange={(e) =>
                    onChange({
                      translations: { en: { ...settings.translations?.en, metaDescription: e.target.value } },
                    })
                  }
                  placeholder={settings.metaDescription ?? ''}
                  className="w-full mt-1.5 px-3 py-2 border border-line rounded-ctl bg-raised text-fg text-sm focus:outline-none focus:ring-2 focus:ring-acc"
                  rows={3}
                />
              </div>
            </EnglishCopy>

            {/* Social Share Preview (Task 46) */}
            <div className="p-4 rounded-xl border border-line bg-fg/[0.02] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-acc" />
                  <span>Xem trước hiển thị Mạng xã hội (Zalo, Facebook, Messenger)</span>
                </p>
                {publicUrl && (
                  <a
                    href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(publicUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-acc hover:underline flex items-center gap-1"
                  >
                    <span>Kiểm tra Facebook Debugger</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Social Card Mockup */}
              <div className="max-w-md mx-auto overflow-hidden rounded-xl border border-line bg-panel shadow-sm">
                <div className="relative aspect-[1.91/1] w-full bg-fg/[0.06] overflow-hidden flex items-center justify-center">
                  {coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverImage}
                      alt={settings.metaTitle || propertyName || 'Ảnh chia sẻ'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Globe className="w-8 h-8 mx-auto text-muted/40 mb-1" />
                      <span className="text-xs text-muted">Chưa có ảnh bìa (Hiển thị ảnh mặc định)</span>
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
                    1200 x 630
                  </span>
                </div>
                <div className="p-3 bg-fg/[0.02]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">
                    {(settings.customDomain || publicUrl || 'KHÁCH SẠN.DIGISTAY.VN').replace(/^https?:\/\//, '').split('/')[0]}
                  </p>
                  <h4 className="text-sm font-semibold text-fg line-clamp-1 mt-0.5">
                    {settings.metaTitle || propertyName || 'Tên khách sạn - Đặt phòng trực tiếp'}
                  </h4>
                  <p className="text-xs text-muted line-clamp-2 mt-1">
                    {settings.metaDescription || 'Trải nghiệm kỳ nghỉ tuyệt vời với giá tốt nhất, ưu đãi độc quyền khi đặt phòng trực tiếp tại website khách sạn.'}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                Hệ thống tự động gắn thẻ Open Graph (<code>og:image</code>, <code>og:title</code>, <code>og:description</code>) và Twitter Card theo chuẩn quốc tế để hiển thị đẹp nhất khi copy link gửi qua tin nhắn.
              </p>
            </div>
          </TabsContent>

          {/* Marketing & Tracking Tab (Task 47) */}
          <TabsContent value="marketing" className="mt-4 space-y-4">
            <div className="p-4 rounded-xl border border-line bg-fg/[0.02]">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-acc-soft text-acc">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg">Mã đo lường Tiếp thị (Facebook Pixel & Google Tag)</h3>
                  <p className="text-xs text-muted mt-0.5">
                    Tự động ghi nhận lượt xem phòng, thao tác đặt phòng và doanh thu đơn hàng để tối ưu hoá các chiến dịch quảng cáo Facebook và Google Ads mà không cần can thiệp mã nguồn.
                  </p>
                </div>
              </div>
            </div>

            {/* Meta / Facebook Pixel */}
            <div className="p-4 rounded-xl border border-line bg-panel space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-fg flex items-center gap-2">
                  <span>Facebook Pixel ID (Meta Pixel)</span>
                  {settings.facebookPixelId ? (
                    isValidFacebookPixelId(settings.facebookPixelId) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-acc font-medium bg-acc-soft px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Đang hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-err font-medium bg-err-soft px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" /> ID không hợp lệ
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-muted">Chưa cài đặt</span>
                  )}
                </label>
              </div>

              <Input
                value={settings.facebookPixelId || ''}
                onChange={(e) => onChange({ facebookPixelId: e.target.value.trim() })}
                placeholder="Ví dụ: 123456789012345 (gồm 9 - 20 chữ số)"
              />

              <div className="rounded-lg bg-fg/[0.02] p-2.5 text-xs text-muted space-y-1">
                <p className="font-medium text-fg">📌 Cách lấy Facebook Pixel ID:</p>
                <p>1. Truy cập <b>Meta Events Manager</b> (Trình quản lý sự kiện Facebook).</p>
                <p>2. Chọn nguồn dữ liệu (Pixel / Tập dữ liệu) của bạn → Vào mục <b>Cài đặt</b>.</p>
                <p>3. Sao chép dãy số <b>ID tập dữ liệu</b> (thường gồm 15-16 số) và dán vào ô trên.</p>
              </div>
            </div>

            {/* Google Tag / GA4 / GTM */}
            <div className="p-4 rounded-xl border border-line bg-panel space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-fg flex items-center gap-2">
                  <span>Google Tag ID (Google Analytics 4 / Google Tag Manager)</span>
                  {settings.googleTagId ? (
                    isValidGoogleTagId(settings.googleTagId) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-acc font-medium bg-acc-soft px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Đang hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-err font-medium bg-err-soft px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" /> Sai định dạng (G-..., GT-..., GTM-...)
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-muted">Chưa cài đặt</span>
                  )}
                </label>
              </div>

              <Input
                value={settings.googleTagId || ''}
                onChange={(e) => onChange({ googleTagId: e.target.value.trim().toUpperCase() })}
                placeholder="Ví dụ: G-ABC1234567 hoặc GTM-XXXXXXX"
              />

              <div className="rounded-lg bg-fg/[0.02] p-2.5 text-xs text-muted space-y-1">
                <p className="font-medium text-fg">📌 Hỗ trợ các định dạng Google Tag:</p>
                <p>• <b>Google Analytics 4</b>: Bắt đầu bằng <code>G-</code> (vd: <code>G-ABC1234567</code>).</p>
                <p>• <b>Google Tag Manager</b>: Bắt đầu bằng <code>GTM-</code> (vd: <code>GTM-XXXXXXX</code>).</p>
                <p>• <b>Google Ads Conversion</b>: Bắt đầu bằng <code>AW-</code> (vd: <code>AW-123456789</code>).</p>
              </div>
            </div>

            {/* E-commerce Auto Events breakdown */}
            <div className="p-4 rounded-xl border border-line bg-fg/[0.02] space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                ⚡ Các sự kiện chuẩn được Digistay tự động kích hoạt
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg border border-line/60 bg-panel">
                  <span className="font-semibold text-fg">PageView</span>
                  <p className="text-muted text-[11px] mt-0.5">Tự động gửi khi khách truy cập bất kỳ trang nào.</p>
                </div>
                <div className="p-2 rounded-lg border border-line/60 bg-panel">
                  <span className="font-semibold text-fg">ViewContent</span>
                  <p className="text-muted text-[11px] mt-0.5">Kích hoạt khi khách mở xem chi tiết một hạng phòng.</p>
                </div>
                <div className="p-2 rounded-lg border border-line/60 bg-panel">
                  <span className="font-semibold text-fg">InitiateCheckout</span>
                  <p className="text-muted text-[11px] mt-0.5">Kích hoạt khi khách vào trang điền thông tin đặt phòng.</p>
                </div>
                <div className="p-2 rounded-lg border border-line/60 bg-panel">
                  <span className="font-semibold text-fg">Purchase</span>
                  <p className="text-muted text-[11px] mt-0.5">Kích hoạt khi thanh toán thành công kèm doanh thu & mã đơn.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Exit-Intent Popup Tab */}
          <TabsContent value="exitIntent" className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-fg/[0.02]">
              <div className="pr-4">
                <label htmlFor="exit-intent-modal-toggle" className="text-sm font-semibold text-fg block cursor-pointer">
                  {t('settings.exitIntent.enabledLabel')}
                </label>
                <p className="text-xs text-muted mt-0.5">{t('settings.exitIntent.hint')}</p>
                <p className="text-[11px] text-muted mt-1 italic">{t('settings.exitIntent.previewNote')}</p>
              </div>
              <input
                id="exit-intent-modal-toggle"
                type="checkbox"
                checked={settings.exitIntentEnabled ?? false}
                onChange={(e) => onChange({ exitIntentEnabled: e.target.checked })}
                className="h-5 w-5 rounded border-line text-acc focus:ring-acc cursor-pointer"
              />
            </div>

            {settings.exitIntentEnabled && (
              <div className="space-y-3 pt-2">
                <label className="text-sm font-medium text-fg block">
                  {t('settings.exitIntent.couponLabel')}
                </label>

                {availableCoupons.length > 0 ? (
                  <select
                    value={settings.exitIntentCouponId || ''}
                    onChange={(e) => onChange({ exitIntentCouponId: e.target.value || null })}
                    className="w-full h-11 px-3 border border-line rounded-ctl bg-raised text-fg text-sm focus:outline-none focus:ring-2 focus:ring-acc"
                  >
                    <option value="">{t('settings.exitIntent.selectCouponPlaceholder')}</option>
                    {availableCoupons.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.code}] {c.name} - Giảm {c.discountType === 'PERCENT' ? `${c.discountValue}%` : `${c.discountValue.toLocaleString('vi-VN')}đ`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 rounded-xl bg-warn-soft border border-warn/30 text-xs text-warn">
                    <p className="font-semibold mb-1">{t('settings.exitIntent.noCoupons')}</p>
                    <button
                      type="button"
                      onClick={() => router.push(routes.propertyCoupons(slug, propertyId))}
                      className="text-acc font-semibold hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <span>{t('settings.exitIntent.createCouponLink')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Publish Tab */}
          <TabsContent value="publish" className="mt-4 space-y-4">
            <div className="p-4 rounded-xl border border-line bg-fg/[0.02]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-fg">{t('publish.title')}</h4>
                  <p className="text-xs text-muted mt-0.5">
                    {settings.isPublished ? t('publish.publishedHint') : t('publish.unpublishedHint')}
                  </p>
                </div>
                <Badge variant={settings.isPublished ? 'success' : 'gray'}>
                  {settings.isPublished ? t('publish.published') : t('publish.unpublished')}
                </Badge>
              </div>

              <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                <div>
                  <label htmlFor="publish-toggle-input" className="text-sm font-medium text-fg block cursor-pointer">
                    Công khai website cho du khách
                  </label>
                  <p className="text-xs text-muted">Bật để cho phép mọi người truy cập vào website của bạn ngay lập tức</p>
                </div>
                <div className="flex items-center gap-2">
                  {isTogglingPublish && <Loader2 className="w-4 h-4 animate-spin text-acc" />}
                  <input
                    id="publish-toggle-input"
                    type="checkbox"
                    disabled={isTogglingPublish}
                    checked={settings.isPublished}
                    onChange={(e) => handleTogglePublish(e.target.checked)}
                    className="h-5 w-5 rounded border-line text-acc focus:ring-acc cursor-pointer disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose} className="w-full sm:w-auto">
          {tc('actions.close') || 'Đóng'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
