'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Textarea, Select } from '@/components/ui'
import { EnglishCopy } from '@/components/ui/english-copy'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { ProvinceWardFields } from '@/components/address/province-ward-fields'
import { propertyProvince } from '@/lib/vn-admin/provinces'
import { PhotoUploadButton } from '@/components/ui/photo-upload'
import { ExternalLink, Star } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { routes } from '@/lib/utils/routes'

export interface EditableProperty {
  id: string
  name: string
  address: string
  city: string
  ward?: string | null
  provinceCode?: string | null
  wardCode?: string | null
  phone: string | null
  hotline?: string | null
  receptionPhone?: string | null
  email: string | null
  logo?: string | null
  coverImage?: string | null
  starRating?: number | null
  zalo?: string | null
  whatsapp?: string | null
  telegram?: string | null
  facebook?: string | null
  wifiName?: string | null
  wifiPassword?: string | null
  taxCode?: string | null
  businessName?: string | null
  description: string | null
  translations?: { en?: { description?: string } } | null
}

/** The property header's "Chỉnh sửa": the hotel's name, address, contacts and description. */
export function EditPropertyModal({
  property,
  isOpen,
  onClose,
  onSaved,
}: {
  property: EditableProperty
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('dash.property')
  const tc = useTranslations('dash.common')
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const slug = params?.slug

  // The saved province, by code or (older rows) by name; a city that is not
  // one of the 34 leaves the picker empty and is kept unless one is chosen.
  const savedProvince = propertyProvince(property)
  const savedWardCode = savedProvince && property.provinceCode === savedProvince.code ? property.wardCode ?? '' : ''
  const legacyCity = savedProvince ? undefined : property.city
  const initial = React.useCallback(
    () => ({
      name: property.name,
      address: property.address,
      provinceCode: savedProvince?.code ?? '',
      wardCode: savedWardCode,
      phone: property.phone ?? '',
      hotline: property.hotline ?? '',
      receptionPhone: property.receptionPhone ?? '',
      email: property.email ?? '',
      zalo: property.zalo ?? '',
      whatsapp: property.whatsapp ?? '',
      telegram: property.telegram ?? '',
      facebook: property.facebook ?? '',
      wifiName: property.wifiName ?? '',
      wifiPassword: property.wifiPassword ?? '',
      description: property.description ?? '',
      enDescription: property.translations?.en?.description ?? '',
    }),
    [property, savedProvince, savedWardCode]
  )
  const [form, setForm] = React.useState(initial)
  const [saving, setSaving] = React.useState(false)

  // Each opening starts from the saved values.
  React.useEffect(() => {
    if (isOpen) setForm(initial())
  }, [isOpen, initial])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { enDescription, provinceCode, wardCode, ...fields } = form
      const place = provinceCode ? { provinceCode, wardCode: wardCode || null } : {}
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, ...place, translations: { en: { description: enDescription } } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        toast.error(apiError(data.error) || t('detail.editModal.failed'))
        return
      }
      toast.success(t('detail.editModal.saved'))
      onSaved()
      onClose()
    } catch {
      toast.error(t('detail.editModal.failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <form onSubmit={save} className="flex flex-col min-h-0">
        <ModalHeader onClose={onClose}>
          <h2 className="text-lg font-semibold text-fg">{t('detail.editModal.title')}</h2>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <Input label={t('form.name')} value={form.name} onChange={set('name')} required minLength={2} maxLength={200} />
          <ProvinceWardFields
            value={{ provinceCode: form.provinceCode, wardCode: form.wardCode }}
            onChange={(place) => setForm({ ...form, ...place })}
            required={!legacyCity}
            // A ward once the province changes or when one was saved; an older
            // row can keep its address as it is.
            wardRequired={form.provinceCode !== (savedProvince?.code ?? '') || Boolean(savedWardCode)}
            legacyCity={legacyCity}
            savedWardName={form.wardCode && form.wardCode === savedWardCode ? property.ward ?? undefined : undefined}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('form.address')} value={form.address} onChange={set('address')} required minLength={5} />
            <Input label={t('form.phone')} type="tel" value={form.phone} onChange={set('phone')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Hotline 24/7" type="tel" placeholder="0901234567" value={form.hotline} onChange={set('hotline')} />
            <Input label={t('form.email')} type="email" value={form.email} onChange={set('email')} />
          </div>

          <div className="p-3 rounded-ctl border border-line bg-raised/30 space-y-3">
            <p className="text-xs font-semibold text-fg uppercase tracking-wider">Kênh Chat & Mạng xã hội</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Số Zalo / Link Zalo" placeholder="0901234567" value={form.zalo} onChange={set('zalo')} />
              <Input label="WhatsApp" placeholder="+84901234567" value={form.whatsapp} onChange={set('whatsapp')} />
              <Input label="Telegram" placeholder="@hotel_support" value={form.telegram} onChange={set('telegram')} />
              <Input label="Facebook Fanpage" placeholder="https://facebook.com/..." value={form.facebook} onChange={set('facebook')} />
            </div>
          </div>

          <div className="p-3 rounded-ctl border border-line bg-raised/30 space-y-3">
            <p className="text-xs font-semibold text-fg uppercase tracking-wider">Wi-Fi cho khách</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Tên Wi-Fi (SSID)" placeholder="Digistay_Guest" value={form.wifiName} onChange={set('wifiName')} />
              <Input label="Mật khẩu Wi-Fi" placeholder="12345678" value={form.wifiPassword} onChange={set('wifiPassword')} />
            </div>
          </div>

          {slug && (
            <div className="flex items-center justify-between p-3 rounded-ctl bg-acc-soft/40 border border-acc/20 text-xs">
              <span className="text-fg">Cần cài đặt logo, giờ check-in/out, GPS, MST hay giấy phép?</span>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  router.push(routes.propertySettings(slug, property.id))
                }}
                className="font-medium text-acc hover:underline flex items-center gap-1 shrink-0 ml-2"
              >
                Mở trang Cài đặt đầy đủ <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <Textarea
            label={t('form.description')}
            value={form.description}
            onChange={set('description')}
            placeholder={t('form.descriptionPlaceholder')}
            rows={4}
            maxLength={2000}
          />
          <EnglishCopy filled={Boolean(form.enDescription)}>
            <Textarea
              label={t('form.description')}
              value={form.enDescription}
              onChange={set('enDescription')}
              placeholder={form.description}
              rows={4}
              maxLength={2000}
            />
          </EnglishCopy>
        </ModalBody>
        <ModalFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" isLoading={saving}>
            {tc('actions.saveChanges')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
