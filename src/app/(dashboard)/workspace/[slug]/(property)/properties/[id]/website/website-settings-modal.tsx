'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Globe, Search, Sparkles, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react'
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

interface WebsiteSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  slug: string
  subdomain?: string
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
    isPublished: boolean
  }
  onChange: (updated: Record<string, unknown>) => void
  onSaveDomain: (patch: Record<string, unknown>, toastMsg?: string) => void
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
  settings,
  onChange,
  onSaveDomain,
  availableCoupons,
}: WebsiteSettingsModalProps) {
  const t = useTranslations('dash.website')
  const tc = useTranslations('dash.common')
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState('domain')

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="domain" className="gap-1.5 text-xs sm:text-sm">
              <Globe className="h-4 w-4" />
              <span>Tên miền & SSL</span>
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5 text-xs sm:text-sm">
              <Search className="h-4 w-4" />
              <span>{t('settings.seo')}</span>
            </TabsTrigger>
            <TabsTrigger value="exitIntent" className="gap-1.5 text-xs sm:text-sm">
              <Sparkles className="h-4 w-4" />
              <span>Popup ưu đãi</span>
            </TabsTrigger>
            <TabsTrigger value="publish" className="gap-1.5 text-xs sm:text-sm">
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
                  <p className="text-xs text-muted">Bật để cho phép mọi người truy cập vào website của bạn</p>
                </div>
                <input
                  id="publish-toggle-input"
                  type="checkbox"
                  checked={settings.isPublished}
                  onChange={(e) => onChange({ isPublished: e.target.checked })}
                  className="h-5 w-5 rounded border-line text-acc focus:ring-acc cursor-pointer"
                />
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
