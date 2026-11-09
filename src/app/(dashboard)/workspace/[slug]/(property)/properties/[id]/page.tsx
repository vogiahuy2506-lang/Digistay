'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, ModalBody, ModalFooter, ModalHeader, Input, Select } from '@/components/ui'
import {
  ArrowLeft, MapPin, Phone, Mail, Globe, Plus, Pencil, Trash2, ExternalLink, Newspaper,
  Hotel, MessageCircle, Wifi, Clock, FileText, Send, Share2, Star,
} from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { routes } from '@/lib/utils/routes'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'
import { EditPropertyModal } from './edit-property-modal'
import { DeletePropertyZone } from '@/components/deletion/delete-property-zone'
import { TodayOverview } from '@/components/property/today-overview'
import { apiError } from '@/lib/i18n/api-errors'
import { PhotoUploadButton } from '@/components/ui/photo-upload'
import { resizedImage } from '@/lib/media/image-url'
import { formatAddress } from '@/lib/vn-admin/address'

interface Property {
  id: string
  name: string
  type: string
  address: string
  city: string
  district: string | null
  ward: string | null
  provinceCode: string | null
  wardCode: string | null
  phone: string | null
  hotline?: string | null
  receptionPhone?: string | null
  email: string | null
  website: string | null
  logo?: string | null
  coverImage?: string | null
  slogan?: string | null
  starRating?: number | null
  zalo?: string | null
  whatsapp?: string | null
  telegram?: string | null
  facebook?: string | null
  instagram?: string | null
  tiktok?: string | null
  youtube?: string | null
  googleMapsUrl?: string | null
  wifiName?: string | null
  wifiPassword?: string | null
  checkInTime?: string | null
  checkOutTime?: string | null
  businessName?: string | null
  taxCode?: string | null
  subdomain: string
  description: string | null
  translations?: { en?: { description?: string } } | null
  websiteSettings?: { isPublished: boolean } | null
  isActive: boolean
  images: { id: string; url: string; isPrimary: boolean; alt: string | null }[]
  roomTypes: RoomType[]
  amenities: { amenity: Amenity }[]
  pricing: PricingConfig[]
  policy: Policy | null
}

interface RoomType {
  id: string
  name: string
  slug: string
  description: string | null
  area: number | null
  bedType: string
  maxAdults: number
  maxChildren: number
  totalRooms: number
  availableRooms: number
  baseOccupancy: number
  maxOccupancy: number
  isActive: boolean
  /** Locked because the workspace is over its plan's room limit: no new bookings into it. */
  planLockedAt?: string | null
  images: { id: string; url: string; isPrimary: boolean }[]
  amenities: { amenity: Amenity }[]
}

interface Amenity {
  id: string
  name: string
  slug: string
  icon: string | null
  category: string
}

interface PricingConfig {
  id: string
  name: string
  weekdayPrice: number
  weekendPrice: number
  extraAdultPrice: number
  extraChildPrice: number
  isActive: boolean
}

interface Policy {
  id: string
  checkInTime: string
  checkOutTime: string
  cancellationHours: number | null
  cancellationPolicy: string | null
  childrenAllowed: boolean
  minChildAge: number
  petsAllowed: boolean
  smokingAllowed: boolean
  additionalRules: string | null
}

const BED_TYPES = ['SINGLE', 'DOUBLE', 'TWIN', 'TRIPLE', 'QUADRUPLE', 'KING', 'QUEEN', 'SUITE', 'BUNK'] as const
type BedType = (typeof BED_TYPES)[number]

const IMAGE_CATEGORIES = ['lobby', 'room', 'pool', 'restaurant', 'gym', 'exterior', 'other'] as const

export default function PropertyDetailPage() {
  const router = useRouter()
  const t = useTranslations('dash.property.detail')
  const tp = useTranslations('dash.property')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const bedTypes = BED_TYPES.map((value) => ({ value, label: t(`bedTypes.${value}`) }))
  const bedTypeLabel = (type: string) => (BED_TYPES.includes(type as BedType) ? t(`bedTypes.${type as BedType}`) : undefined)
  const params = useParams<{ slug: string; id: string }>()
  const slug = params.slug
  const propertyId = params.id

  const [property, setProperty] = React.useState<Property | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [showEditModal, setShowEditModal] = React.useState(false)

  // Image upload form state
  const [showImageModal, setShowImageModal] = React.useState(false)
  const [imageForm, setImageForm] = React.useState({
    url: '',
    alt: '',
    category: '',
    isPrimary: false,
  })
  const [isUploading, setIsUploading] = React.useState(false)

  const handleUploadImage = async () => {
    if (!imageForm.url) {
      toast.error(t('images.urlRequired'))
      return
    }

    setIsUploading(true)
    try {
      const response = await fetch(`/api/properties/${propertyId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imageForm),
      })

      if (response.ok) {
        setShowImageModal(false)
        setImageForm({ url: '', alt: '', category: '', isPrimary: false })
        fetchProperty()
      } else {
        const data = await response.json().catch(() => ({}))
        toast.error(apiError(data.error) || t('images.saveFailed'))
      }
    } catch (err) {
      console.error('Failed to upload image:', err)
      toast.error(t('images.saveFailed'))
    } finally {
      setIsUploading(false)
    }
  }

  // A photo stored by the upload button becomes one of the property's photos (the first one its main photo).
  const addUploadedImage = async (url: string) => {
    const response = await fetch(`/api/properties/${propertyId}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, isPrimary: !property?.images.length }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      toast.error(apiError(data.error) || t('images.saveFailed'))
    }
    await fetchProperty()
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm(t('images.deleteConfirm'))) return

    try {
      await fetch(`/api/properties/${propertyId}/images?imageId=${imageId}`, {
        method: 'DELETE',
      })
      fetchProperty()
    } catch (err) {
      console.error('Failed to delete image:', err)
    }
  }

  React.useEffect(() => {
    fetchProperty()
  }, [propertyId])

  const fetchProperty = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`)
      const data = await response.json()
      if (data.success) {
        setProperty(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch property:', err)
    } finally {
      setIsLoading(false)
    }
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

  if (!property) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted">{t('notFound')}</p>
            <Button onClick={() => router.push(routes.workspace(slug))} className="mt-4">
              {tc('actions.back')}
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Back button and header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push(routes.workspace(slug))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tc('actions.back')}
        </Button>
      </div>

      {/* The name keeps the full width until there is room for the buttons
          beside it (xl): at tablet width they took it and broke it over two lines.
          The status is a badge after the address, not a fourth button-sized pill. */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          {property.logo && (
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-line bg-page shrink-0 shadow-sm mt-0.5">
              <Image src={property.logo} alt={property.name} fill className="object-contain p-0.5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] leading-8 font-semibold tracking-tight text-fg">{property.name}</h1>
              {Boolean(property.starRating) && property.starRating! > 0 && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  {property.starRating} sao
                </span>
              )}
            </div>
            {property.slogan && <p className="text-xs text-muted italic mt-0.5">{property.slogan}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-muted">
              <span className="break-all">{property.subdomain}</span>
              <Badge variant={property.isActive ? 'success' : 'gray'}>
                {property.isActive ? tp('status.active') : tp('status.inactive')}
              </Badge>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button variant="outline" onClick={() => window.open(`/${property.subdomain}`, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('viewWebsite')}
          </Button>
          <Button variant="outline" onClick={() => router.push(routes.propertyWebsite(slug, propertyId))}>
            <Globe className="w-4 h-4 mr-2" />
            {t('websiteBuilder')}
          </Button>
          <Button variant="outline" onClick={() => router.push(routes.propertySettings(slug, propertyId))}>
            <Hotel className="w-4 h-4 mr-2 text-acc" />
            Thông tin chi tiết
          </Button>
          <Button variant="outline" onClick={() => setShowEditModal(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            {t('edit')}
          </Button>
        </div>
      </div>
      <EditPropertyModal property={property} isOpen={showEditModal} onClose={() => setShowEditModal(false)} onSaved={fetchProperty} />

      {/* Today at the hotel first (the figures the calendar page had), then the property. */}
      <TodayOverview slug={slug} propertyId={propertyId} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Images */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle>{t('overview.images')}</CardTitle>
                  <div className="flex flex-wrap sm:justify-end gap-2">
                    <PhotoUploadButton target={{ propertyId }} multiple onUploaded={addUploadedImage} />
                    <Button variant="ghost" size="sm" onClick={() => setShowImageModal(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('images.addByLink')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {property.images.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      {property.images.map((img) => (
                        <div key={img.id} className="relative aspect-video rounded-lg overflow-hidden group">
                          <Image src={resizedImage(img.url, 480)} alt={img.alt || property.name} fill className="object-cover" />
                          {img.isPrimary && (
                            <div className="absolute top-1.5 left-1.5 px-2 py-1 bg-ink text-on-ink text-xs rounded">
                              {t('overview.primaryImage')}
                            </div>
                          )}
                          {/* Shown on hover where there is one; always on touch screens, where it
                              is small and quiet so it does not cover the "main photo" label. */}
                          <button aria-label={tc('actions.delete')}
                            onClick={() => handleDeleteImage(img.id)}
                            className="absolute top-1.5 right-1.5 p-1.5 rounded-ctl border border-line bg-panel/90 text-err hover:bg-err-soft transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted">
                      <p>{t('overview.noImages')}</p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <PhotoUploadButton target={{ propertyId }} multiple variant="primary" onUploaded={addUploadedImage} />
                        <Button variant="outline" size="sm" onClick={() => setShowImageModal(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          {t('images.addByLink')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info */}
            <div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{t('overview.info')}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(routes.propertySettings(slug, propertyId))}
                    className="text-xs text-acc hover:underline"
                  >
                    Xem tất cả &gt;
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-fg">{t('overview.address')}</p>
                      <p className="text-sm text-muted">{formatAddress(property)}</p>
                      {property.googleMapsUrl && (
                        <a
                          href={property.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-acc hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          Mở bản đồ Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {(property.hotline || property.phone || property.receptionPhone) && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-muted mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-fg">{t('overview.phone')}</p>
                        {property.hotline && (
                          <p className="text-sm text-fg">Hotline: <span className="font-semibold">{property.hotline}</span></p>
                        )}
                        {property.phone && property.phone !== property.hotline && (
                          <p className="text-sm text-muted">ĐT: {property.phone}</p>
                        )}
                        {property.receptionPhone && (
                          <p className="text-xs text-muted">Lễ tân: {property.receptionPhone}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {property.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-muted mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-fg">{t('overview.email')}</p>
                        <p className="text-sm text-muted">{property.email}</p>
                      </div>
                    </div>
                  )}

                  {(property.zalo || property.whatsapp || property.telegram || property.facebook) && (
                    <div className="flex items-start gap-3">
                      <MessageCircle className="w-5 h-5 text-muted mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-fg">Kênh chat & Mạng xã hội</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {property.zalo && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-600 font-medium">
                              Zalo: {property.zalo}
                            </span>
                          )}
                          {property.whatsapp && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-600 font-medium">
                              WhatsApp: {property.whatsapp}
                            </span>
                          )}
                          {property.telegram && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-sky-500/10 text-sky-600 font-medium">
                              Telegram: {property.telegram}
                            </span>
                          )}
                          {property.facebook && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-600 font-medium">
                              Fanpage Facebook
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {(property.wifiName || property.wifiPassword) && (
                    <div className="flex items-start gap-3">
                      <Wifi className="w-5 h-5 text-muted mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-fg">Wi-Fi khách sạn</p>
                        <p className="text-xs text-muted">
                          Tên: <span className="font-semibold text-fg">{property.wifiName || '(Chưa đặt)'}</span>
                          {property.wifiPassword && (
                            <> · Pass: <span className="font-mono font-medium text-fg">{property.wifiPassword}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {(property.checkInTime || property.checkOutTime) && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-muted mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-fg">Giờ nhận / trả phòng</p>
                        <p className="text-xs text-muted">
                          Nhận phòng: <span className="font-semibold text-fg">{property.checkInTime || '14:00'}</span> · Trả phòng: <span className="font-semibold text-fg">{property.checkOutTime || '12:00'}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {property.taxCode && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-muted mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-fg">Mã số thuế</p>
                        <p className="text-xs font-mono text-muted">{property.taxCode}</p>
                      </div>
                    </div>
                  )}

                  {property.website && (
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-muted mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-fg">{t('overview.website')}</p>
                        <p className="text-sm text-muted">{property.website}</p>
                      </div>
                    </div>
                  )}

                  {property.description && (
                    <div>
                      <p className="text-sm font-medium text-fg mb-1">{t('overview.description')}</p>
                      <p className="text-sm text-muted">{property.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

      {/* Deleting the property: its workspace's owner only. */}
      <DeletePropertyZone propertyId={propertyId} slug={slug} />

      {/* Image Upload Modal */}
      <Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)} title={t('images.addTitle')}>
        <ModalHeader onClose={() => setShowImageModal(false)}>
          <h2 className="text-lg font-semibold text-fg">{t('images.addTitle')}</h2>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              {t('images.url')} <span className="text-err">*</span>
            </label>
            <Input
              placeholder="https://example.com/image.jpg"
              value={imageForm.url}
              onChange={(e) => setImageForm({ ...imageForm, url: e.target.value })}
            />
            <p className="text-xs text-muted mt-1">
              {t('images.urlHint')}
            </p>
          </div>

          {imageForm.url && (
            <div>
              <p className="text-sm font-medium text-fg mb-2">{t('images.preview')}</p>
              <div className="relative w-full h-48 rounded-lg overflow-hidden bg-fg/5">
                <Image src={imageForm.url} alt={t('images.previewAlt')} fill className="object-contain" />
              </div>
            </div>
          )}

          <Input
            label={t('images.alt')}
            placeholder={t('images.altPlaceholder')}
            value={imageForm.alt}
            onChange={(e) => setImageForm({ ...imageForm, alt: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              {t('images.category')}
            </label>
            <Select
              options={[
                { value: '', label: t('images.categories.none') },
                ...IMAGE_CATEGORIES.map((value) => ({ value, label: t(`images.categories.${value}`) })),
              ]}
              value={imageForm.category}
              onChange={(e) => setImageForm({ ...imageForm, category: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPrimary"
              checked={imageForm.isPrimary}
              onChange={(e) => setImageForm({ ...imageForm, isPrimary: e.target.checked })}
              className="w-4 h-4 text-acc rounded border-line focus-visible:ring-acc focus-visible:ring-2"
            />
            <label htmlFor="isPrimary" className="text-sm text-fg">
              {t('images.primary')}
            </label>
          </div>
        </ModalBody>
        <ModalFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => setShowImageModal(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleUploadImage} disabled={isUploading}>
            {isUploading ? t('images.uploading') : t('images.add')}
          </Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}
