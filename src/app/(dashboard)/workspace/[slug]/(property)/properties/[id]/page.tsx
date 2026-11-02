'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, ModalBody, ModalFooter, ModalHeader, Input, Select } from '@/components/ui'
import {
  ArrowLeft, MapPin, Phone, Mail, Globe, Plus, Pencil, Trash2, ExternalLink, Newspaper,
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
  email: string | null
  website: string | null
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
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-8 font-semibold tracking-tight text-fg">{property.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-muted">
            <span className="break-all">{property.subdomain}</span>
            <Badge variant={property.isActive ? 'success' : 'gray'}>
              {property.isActive ? tp('status.active') : tp('status.inactive')}
            </Badge>
          </p>
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
          <Button variant="outline" onClick={() => router.push(routes.propertyBlog(slug, propertyId))}>
            <Newspaper className="w-4 h-4 mr-2" />
            {tc('nav.blog')}
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
                <CardHeader>
                  <CardTitle>{t('overview.info')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-fg">{t('overview.address')}</p>
                      <p className="text-sm text-muted">{formatAddress(property)}</p>
                    </div>
                  </div>

                  {property.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-muted mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-fg">{t('overview.phone')}</p>
                        <p className="text-sm text-muted">{property.phone}</p>
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
