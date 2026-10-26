'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, ModalBody, ModalFooter, ModalHeader, Tabs, TabsList, TabsTrigger, TabsContent, Input, Select, Textarea } from '@/components/ui'
import {
  ArrowLeft, MapPin, Phone, Mail, Globe, Bed, Plus, Pencil, Trash2, Save, Baby, ExternalLink, PawPrint, Cigarette,
} from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { getIcon } from '@/lib/amenity-icons'
import { groupAmenities } from '@/lib/amenity-categories'
import { amenityName } from '@/lib/i18n/amenities'
import { routes } from '@/lib/utils/routes'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'
import { EditPropertyModal } from './edit-property-modal'
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
  const [activeTab, setActiveTab] = React.useState('overview')
  const [showEditModal, setShowEditModal] = React.useState(false)
  /** Every shared amenity, with whether this property has it (GET /api/properties/[id]/amenities). */
  const [amenityOptions, setAmenityOptions] = React.useState<(Amenity & { isSelected: boolean })[]>([])

  // Room type form state
  const [showRoomTypeModal, setShowRoomTypeModal] = React.useState(false)
  const [editingRoomType, setEditingRoomType] = React.useState<RoomType | null>(null)
  const [roomTypeForm, setRoomTypeForm] = React.useState({
    name: '',
    description: '',
    area: '',
    bedType: 'DOUBLE',
    maxAdults: 2,
    maxChildren: 0,
    totalRooms: 1,
    baseOccupancy: 2,
    maxOccupancy: 4,
    amenityIds: [] as string[],
  })

  // Pricing form state
  const [showPricingModal, setShowPricingModal] = React.useState(false)
  const [pricingForm, setPricingForm] = React.useState({
    name: 'Standard',
    weekdayPrice: 0,
    weekendPrice: 0,
    extraAdultPrice: 0,
    extraChildPrice: 0,
  })

  // Policy form state
  const [policyForm, setPolicyForm] = React.useState<Partial<Policy>>({})

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
    fetchAmenities()
  }, [propertyId])

  const fetchAmenities = async () => {
    try {
      const data = await fetch(`/api/properties/${propertyId}/amenities`).then((r) => r.json())
      if (data.success) setAmenityOptions(data.data)
    } catch (err) {
      console.error('Failed to fetch amenities:', err)
    }
  }

  const fetchProperty = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`)
      const data = await response.json()
      if (data.success) {
        setProperty(data.data)
        if (data.data.policy) {
          setPolicyForm(data.data.policy)
        }
      }
    } catch (err) {
      console.error('Failed to fetch property:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveRoomType = async () => {
    try {
      const url = editingRoomType 
        ? `/api/properties/${propertyId}/room-types/${editingRoomType.id}`
        : `/api/properties/${propertyId}/room-types`
      
      const response = await fetch(url, {
        method: editingRoomType ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...roomTypeForm,
          area: roomTypeForm.area ? parseFloat(roomTypeForm.area) : null,
          amenityIds: roomTypeForm.amenityIds,
        }),
      })

      if (response.ok) {
        setShowRoomTypeModal(false)
        setEditingRoomType(null)
        resetRoomTypeForm()
        fetchProperty()
      } else {
        toast.error((await response.json().catch(() => ({}))).error || tc('states.error'))
      }
    } catch (err) {
      console.error('Failed to save room type:', err)
      toast.error(tc('states.error'))
    }
  }

  const handleDeleteRoomType = async (id: string) => {
    if (!confirm(t('rooms.deleteConfirm'))) return

    try {
      await fetch(`/api/properties/${propertyId}/room-types/${id}`, {
        method: 'DELETE',
      })
      fetchProperty()
    } catch (err) {
      console.error('Failed to delete room type:', err)
    }
  }

  const handleEditRoomType = (roomType: RoomType) => {
    setEditingRoomType(roomType)
    setRoomTypeForm({
      name: roomType.name,
      description: roomType.description || '',
      area: roomType.area?.toString() || '',
      bedType: roomType.bedType,
      maxAdults: roomType.maxAdults,
      maxChildren: roomType.maxChildren,
      totalRooms: roomType.totalRooms,
      baseOccupancy: roomType.baseOccupancy,
      maxOccupancy: roomType.maxOccupancy,
      amenityIds: roomType.amenities.map(a => a.amenity.id),
    })
    setShowRoomTypeModal(true)
  }

  const resetRoomTypeForm = () => {
    setRoomTypeForm({
      name: '',
      description: '',
      area: '',
      bedType: 'DOUBLE',
      maxAdults: 2,
      maxChildren: 0,
      totalRooms: 1,
      baseOccupancy: 2,
      maxOccupancy: 4,
      amenityIds: [],
    })
  }

  const handleSavePricing = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingForm),
      })

      if (response.ok) {
        setShowPricingModal(false)
        resetPricingForm()
        fetchProperty()
      } else {
        toast.error((await response.json().catch(() => ({}))).error || tc('states.error'))
      }
    } catch (err) {
      console.error('Failed to save pricing:', err)
      toast.error(tc('states.error'))
    }
  }

  const resetPricingForm = () => {
    setPricingForm({
      name: 'Standard',
      weekdayPrice: 0,
      weekendPrice: 0,
      extraAdultPrice: 0,
      extraChildPrice: 0,
    })
  }

  const handleSavePolicy = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyForm),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        toast.error(apiError(data.error) || tc('states.error'))
        return
      }
      toast.success(tc('states.saved'))
      fetchProperty()
    } catch (err) {
      console.error('Failed to save policy:', err)
      toast.error(tc('states.error'))
    }
  }

  const handleToggleAmenity = async (amenityId: string) => {
    const next = amenityOptions.map((a) => (a.id === amenityId ? { ...a, isSelected: !a.isSelected } : a))
    setAmenityOptions(next)
    try {
      const response = await fetch(`/api/properties/${propertyId}/amenities`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amenityIds: next.filter((a) => a.isSelected).map((a) => a.id) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(apiError(data.error) || tc('states.error'))
      toast.success(t('amenities.saved'))
      fetchProperty()
    } catch (err) {
      // Put the switch back: the change was not saved.
      setAmenityOptions(amenityOptions)
      toast.error(err instanceof Error ? err.message : tc('states.error'))
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
          <Button variant="outline" onClick={() => setShowEditModal(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            {t('edit')}
          </Button>
        </div>
      </div>
      <EditPropertyModal property={property} isOpen={showEditModal} onClose={() => setShowEditModal(false)} onSaved={fetchProperty} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="rooms">{t('tabs.rooms')}</TabsTrigger>
          <TabsTrigger value="pricing">{t('tabs.pricing')}</TabsTrigger>
          <TabsTrigger value="amenities">{t('tabs.amenities')}</TabsTrigger>
          <TabsTrigger value="policy">{t('tabs.policy')}</TabsTrigger>
          <TabsTrigger value="website">{t('tabs.website')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
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

          {/* Room types summary */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('overview.roomsSummary')}</CardTitle>
              <Button size="sm" onClick={() => setActiveTab('rooms')}>
                {t('overview.viewDetails')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {property.roomTypes.length > 0 ? (
                  property.roomTypes.map((room) => (
                    <div key={room.id} className="p-4 bg-fg/[0.03] rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bed className="w-4 h-4 text-muted" />
                        <span className="font-medium text-fg">{room.name}</span>
                      </div>
                      <p className="text-sm text-muted">
                        {t('rooms.capacity', { rooms: room.totalRooms, guests: room.maxOccupancy })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted col-span-full text-center py-4">
                    {t('rooms.empty')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Room Types Tab */}
        <TabsContent value="rooms">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('rooms.title')}</CardTitle>
                <p className="text-sm text-muted mt-1">{t('rooms.subtitle')}</p>
              </div>
              <Button onClick={() => {
                setEditingRoomType(null)
                resetRoomTypeForm()
                setShowRoomTypeModal(true)
              }}>
                <Plus className="w-4 h-4 mr-2" />
                {t('rooms.add')}
              </Button>
            </CardHeader>
            <CardContent>
              {property.roomTypes.length > 0 ? (
                <div className="space-y-4">
                  {property.roomTypes.map((room) => (
                    <div key={room.id} className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-fg/10 rounded-lg flex items-center justify-center">
                          {room.images[0] ? (
                            <Image src={room.images[0].url} alt={room.name} width={64} height={64} className="rounded-lg object-cover" />
                          ) : (
                            <Bed className="w-8 h-8 text-muted" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-fg">{room.name}</h4>
                          <p className="text-sm text-muted">
                            {bedTypeLabel(room.bedType)} • 
                            {room.area && `${room.area}m² • `}
                            {t('rooms.capacity', { rooms: room.totalRooms, guests: room.maxOccupancy })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={room.isActive ? 'success' : 'gray'}>
                          {room.isActive ? tp('status.active') : tp('status.inactive')}
                        </Badge>
                        <Button aria-label={tc('actions.edit')} variant="ghost" size="sm" onClick={() => handleEditRoomType(room)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button aria-label={tc('actions.delete')} variant="ghost" size="sm" onClick={() => handleDeleteRoomType(room.id)}>
                          <Trash2 className="w-4 h-4 text-err" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bed className="w-12 h-12 text-muted mx-auto mb-4" />
                  <p className="text-muted mb-4">{t('rooms.empty')}</p>
                  <Button onClick={() => {
                    setEditingRoomType(null)
                    resetRoomTypeForm()
                    setShowRoomTypeModal(true)
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('rooms.addFirst')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Room Type Modal */}
          <Modal
            isOpen={showRoomTypeModal}
            onClose={() => setShowRoomTypeModal(false)}
            size="lg"
            title={editingRoomType ? t('rooms.modal.editTitle') : t('rooms.modal.addTitle')}
          >
            <ModalHeader onClose={() => setShowRoomTypeModal(false)}>
              <h2 className="text-lg font-semibold text-fg">
                {editingRoomType ? t('rooms.modal.editTitle') : t('rooms.modal.addTitle')}
              </h2>
            </ModalHeader>
            <ModalBody className="space-y-4">
              <Input
                label={t('rooms.modal.name')}
                placeholder={t('rooms.modal.namePlaceholder')}
                value={roomTypeForm.name}
                onChange={(e) => setRoomTypeForm({ ...roomTypeForm, name: e.target.value })}
                required
              />

              <Textarea
                label={t('rooms.modal.description')}
                placeholder={t('rooms.modal.descriptionPlaceholder')}
                value={roomTypeForm.description}
                onChange={(e) => setRoomTypeForm({ ...roomTypeForm, description: e.target.value })}
                rows={3}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('rooms.modal.area')}
                  type="number"
                  placeholder="25"
                  value={roomTypeForm.area}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, area: e.target.value })}
                />

                <Select
                  label={t('rooms.modal.bedType')}
                  options={bedTypes}
                  value={roomTypeForm.bedType}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, bedType: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('rooms.modal.totalRooms')}
                  type="number"
                  min="1"
                  value={roomTypeForm.totalRooms}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, totalRooms: parseInt(e.target.value) || 1 })}
                  required
                />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label={t('rooms.modal.maxAdults')}
                    type="number"
                    min="1"
                    value={roomTypeForm.maxAdults}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxAdults: parseInt(e.target.value) || 1 })}
                  />
                  <Input
                    label={t('rooms.modal.maxChildren')}
                    type="number"
                    min="0"
                    value={roomTypeForm.maxChildren}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxChildren: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('rooms.modal.baseOccupancy')}
                  type="number"
                  min="1"
                  value={roomTypeForm.baseOccupancy}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, baseOccupancy: parseInt(e.target.value) || 1 })}
                  hint={t('rooms.modal.baseOccupancyHint')}
                />

                <Input
                  label={t('rooms.modal.maxOccupancy')}
                  type="number"
                  min="1"
                  value={roomTypeForm.maxOccupancy}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxOccupancy: parseInt(e.target.value) || 4 })}
                />
              </div>
            </ModalBody>
            <ModalFooter className="sm:justify-end">
              <Button variant="outline" onClick={() => setShowRoomTypeModal(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button onClick={handleSaveRoomType}>
                <Save className="w-4 h-4 mr-2" />
                {tc('actions.save')}
              </Button>
            </ModalFooter>
          </Modal>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('pricing.title')}</CardTitle>
                <p className="text-sm text-muted mt-1">{t('pricing.subtitle')}</p>
              </div>
              <Button onClick={() => setShowPricingModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('pricing.add')}
              </Button>
            </CardHeader>
            <CardContent>
              {property.pricing.length > 0 ? (
                <div className="space-y-4">
                  {property.pricing.map((price) => (
                    <div key={price.id} className="p-4 bg-fg/[0.03] rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-fg">{price.name}</h4>
                        <Badge variant={price.isActive ? 'success' : 'gray'}>
                          {price.isActive ? tp('status.active') : tp('status.inactive')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted">{t('pricing.weekday')}</p>
                          <p className="font-semibold text-fg">{labels.money(price.weekdayPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted">{t('pricing.weekend')}</p>
                          <p className="font-semibold text-fg">{labels.money(price.weekendPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted">{t('pricing.extraAdult')}</p>
                          <p className="font-semibold text-fg">{labels.money(price.extraAdultPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted">{t('pricing.extraChild')}</p>
                          <p className="font-semibold text-fg">{labels.money(price.extraChildPrice)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted mb-4">{t('pricing.empty')}</p>
                  <Button onClick={() => setShowPricingModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('pricing.addFirst')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing Modal */}
          <Modal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} size="sm" title={t('pricing.modal.title')}>
            <ModalHeader onClose={() => setShowPricingModal(false)}>
              <h2 className="text-lg font-semibold text-fg">{t('pricing.modal.title')}</h2>
            </ModalHeader>
            <ModalBody className="space-y-4">
              <Input
                label={t('pricing.modal.name')}
                placeholder={t('pricing.modal.namePlaceholder')}
                value={pricingForm.name}
                onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('pricing.modal.weekday')}
                  type="number"
                  min="0"
                  value={pricingForm.weekdayPrice}
                  onChange={(e) => setPricingForm({ ...pricingForm, weekdayPrice: parseInt(e.target.value) || 0 })}
                  required
                />

                <Input
                  label={t('pricing.modal.weekend')}
                  type="number"
                  min="0"
                  value={pricingForm.weekendPrice}
                  onChange={(e) => setPricingForm({ ...pricingForm, weekendPrice: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('pricing.modal.extraAdult')}
                  type="number"
                  min="0"
                  value={pricingForm.extraAdultPrice}
                  onChange={(e) => setPricingForm({ ...pricingForm, extraAdultPrice: parseInt(e.target.value) || 0 })}
                />

                <Input
                  label={t('pricing.modal.extraChild')}
                  type="number"
                  min="0"
                  value={pricingForm.extraChildPrice}
                  onChange={(e) => setPricingForm({ ...pricingForm, extraChildPrice: parseInt(e.target.value) || 0 })}
                />
              </div>
            </ModalBody>
            <ModalFooter className="sm:justify-end">
              <Button variant="outline" onClick={() => setShowPricingModal(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button onClick={handleSavePricing}>
                <Save className="w-4 h-4 mr-2" />
                {tc('actions.save')}
              </Button>
            </ModalFooter>
          </Modal>
        </TabsContent>

        {/* Amenities Tab */}
        <TabsContent value="amenities">
          <Card>
            <CardHeader>
              <CardTitle>{t('amenities.title')}</CardTitle>
              <p className="text-sm text-muted mt-1">{t('amenities.subtitle')}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* By group, with the labels and the selected look of the Services page. */}
              {groupAmenities(amenityOptions).map(({ category, items }) => (
                <section key={category}>
                  <h3 className="text-sm font-medium text-fg mb-3">{t(`amenities.categories.${category}`)}</h3>
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((amenity) => {
                      const isSelected = amenity.isSelected
                      const Icon = getIcon(amenity.icon)
                      return (
                        <button
                          key={amenity.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleToggleAmenity(amenity.id)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc ${
                            isSelected ? 'border-info/30 bg-info-soft' : 'border-line hover:bg-fg/[0.03]'
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-info' : 'text-muted'}`} aria-hidden="true" />
                          <span className={`text-sm font-medium ${isSelected ? 'text-info' : 'text-fg'}`}>
                            {amenityName(amenity.slug, amenity.name, labels.locale)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Tab */}
        <TabsContent value="policy">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('policy.title')}</CardTitle>
                <p className="text-sm text-muted mt-1">{t('policy.subtitle')}</p>
              </div>
              <Button onClick={handleSavePolicy}>
                <Save className="w-4 h-4 mr-2" />
                {tc('actions.saveChanges')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Check-in/out times */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('policy.checkIn')}
                  type="time"
                  value={policyForm.checkInTime || '14:00'}
                  onChange={(e) => setPolicyForm({ ...policyForm, checkInTime: e.target.value })}
                />
                <Input
                  label={t('policy.checkOut')}
                  type="time"
                  value={policyForm.checkOutTime || '12:00'}
                  onChange={(e) => setPolicyForm({ ...policyForm, checkOutTime: e.target.value })}
                />
              </div>

              {/* Policies */}
              <div className="space-y-4">
                <h4 className="font-medium text-fg">{t('policy.rules')}</h4>
                
                <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Baby className="w-5 h-5 text-muted" />
                    <div>
                      <p className="font-medium text-fg">{t('policy.children')}</p>
                      <p className="text-sm text-muted">{t('policy.childrenHint')}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={policyForm.childrenAllowed ?? true}
                      onChange={(e) => setPolicyForm({ ...policyForm, childrenAllowed: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                  <div className="flex items-center gap-3">
                    <PawPrint className="w-5 h-5 text-muted" />
                    <div>
                      <p className="font-medium text-fg">{t('policy.pets')}</p>
                      <p className="text-sm text-muted">{t('policy.petsHint')}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={policyForm.petsAllowed ?? false}
                      onChange={(e) => setPolicyForm({ ...policyForm, petsAllowed: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Cigarette className="w-5 h-5 text-muted" />
                    <div>
                      <p className="font-medium text-fg">{t('policy.smoking')}</p>
                      <p className="text-sm text-muted">{t('policy.smokingHint')}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={policyForm.smokingAllowed ?? false}
                      onChange={(e) => setPolicyForm({ ...policyForm, smokingAllowed: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
                  </label>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div>
                <h4 className="font-medium text-fg mb-2">{t('policy.cancellation')}</h4>
                <Textarea
                  placeholder={t('policy.cancellationPlaceholder')}
                  value={policyForm.cancellationPolicy || ''}
                  onChange={(e) => setPolicyForm({ ...policyForm, cancellationPolicy: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Additional Rules */}
              <div>
                <h4 className="font-medium text-fg mb-2">{t('policy.additionalRules')}</h4>
                <Textarea
                  placeholder={t('policy.additionalRulesPlaceholder')}
                  value={policyForm.additionalRules || ''}
                  onChange={(e) => setPolicyForm({ ...policyForm, additionalRules: e.target.value })}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Website Tab */}
        <TabsContent value="website">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('website.title')}</CardTitle>
                <p className="text-sm text-muted mt-1">{t('website.subtitle')}</p>
              </div>
              <Button onClick={() => router.push(routes.propertyWebsite(slug, propertyId))}>
                <Globe className="w-4 h-4 mr-2" />
                {t('website.open')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-fg/[0.03] rounded-lg text-center">
                  <Globe className="w-8 h-8 text-acc mx-auto mb-2" />
                  <h4 className="font-medium">{t('website.blocks')}</h4>
                  <p className="text-sm text-muted mt-1">{t('website.blocksHint')}</p>
                </div>
                <div className="p-4 bg-fg/[0.03] rounded-lg text-center">
                  <Pencil className="w-8 h-8 text-acc mx-auto mb-2" />
                  <h4 className="font-medium">{t('website.colors')}</h4>
                  <p className="text-sm text-muted mt-1">{t('website.colorsHint')}</p>
                </div>
                <div className="p-4 bg-fg/[0.03] rounded-lg text-center">
                  <ExternalLink className="w-8 h-8 text-acc mx-auto mb-2" />
                  <h4 className="font-medium">{t('website.publish')}</h4>
                  <p className="text-sm text-muted mt-1">{t('website.publishHint')}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between p-4 bg-acc-soft rounded-lg">
                <div>
                  <h4 className="font-medium text-fg">{t('website.public')}</h4>
                  <p className="text-sm text-muted">https://{property.subdomain}.digistay.vn</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`/${property.subdomain}`, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('viewWebsite')}
                  </Button>
                  {property.websiteSettings?.isPublished ? (
                    <Badge variant="success">{t('website.published')}</Badge>
                  ) : (
                    <Badge variant="gray">{t('website.unpublished')}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
