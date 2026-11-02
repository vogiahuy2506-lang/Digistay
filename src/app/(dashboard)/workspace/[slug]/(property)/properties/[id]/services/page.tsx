'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Button, Badge, Input, Modal, ModalBody, ModalFooter, ModalHeader, Textarea, NumberInput } from '@/components/ui'
import { EnglishCopy } from '@/components/ui/english-copy'
import { getIcon } from '@/lib/amenity-icons'
import { amenityName } from '@/lib/i18n/amenities'
import { toast } from '@/components/ui/toast'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'
import {
  Plus, Trash2, Edit, Save, ConciergeBell, Search, X, Star,
} from 'lucide-react'
import { PhotoUploadButton } from '@/components/ui/photo-upload'
import { apiError } from '@/lib/i18n/api-errors'

interface Amenity {
  id: string
  name: string
  slug: string
  icon: string | null
  category: string
  isSelected: boolean
  isFeatured?: boolean
  customName?: string | null
  images?: string[]
  sortOrder?: number
}

interface ExtraService {
  id: string
  propertyId: string
  name: string
  description: string | null
  translations?: { en?: { name?: string; description?: string } } | null
  category: string | null
  priceType: 'FIXED' | 'PER_NIGHT' | 'PER_PERSON'
  price: number
  perPerson: boolean
  isActive: boolean
  coverImage?: string | null
  leadTimeHours?: number
  dailyCapacity?: number | null
  operatingHours?: string | null
  showOnBooking?: boolean
}

// Labels: messages dash.rooms.services.serviceCategory.* and .amenityCategory.*
const SERVICE_CATEGORIES = ['laundry', 'transport', 'food', 'entertainment', 'other'] as const
type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]

const AMENITY_CATEGORIES = ['comfort', 'entertainment', 'facility', 'food', 'internet', 'leisure', 'parking', 'security', 'service', 'transport', 'view'] as const
type AmenityCategory = (typeof AMENITY_CATEGORIES)[number]

export default function ServicesPage() {
  const t = useTranslations('dash.rooms.services')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id

  const [amenities, setAmenities] = React.useState<Amenity[]>([])
  const [services, setServices] = React.useState<ExtraService[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showServiceModal, setShowServiceModal] = React.useState(false)
  const [editingService, setEditingService] = React.useState<ExtraService | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')

  const [serviceForm, setServiceForm] = React.useState({
    name: '',
    description: '',
    en: { name: '', description: '' },
    category: 'other',
    priceType: 'FIXED' as 'FIXED' | 'PER_NIGHT' | 'PER_PERSON',
    price: 0,
    perPerson: false,
    coverImage: '',
    leadTimeHours: 0,
    dailyCapacity: '' as string | number,
    operatingHours: '',
    showOnBooking: true,
  })

  // State for Custom Amenity Modal
  const [showCustomModal, setShowCustomModal] = React.useState(false)
  const [customForm, setCustomForm] = React.useState({
    name: '',
    category: 'facility',
    icon: 'sparkles',
    isFeatured: false,
  })

  // State for Custom Name Editing Modal
  const [editingAmenity, setEditingAmenity] = React.useState<Amenity | null>(null)
  const [customNameInput, setCustomNameInput] = React.useState('')

  React.useEffect(() => {
    if (propertyId) {
      fetchData()
    } else {
      setIsLoading(false)
    }
  }, [propertyId])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [amenitiesRes, servicesRes] = await Promise.all([
        fetch(`/api/properties/${propertyId}/amenities`),
        fetch(`/api/extra-services?propertyId=${propertyId}`),
      ])

      const [amenitiesData, servicesData] = await Promise.all([
        amenitiesRes.json(),
        servicesRes.json(),
      ])

      if (amenitiesData.success) {
        setAmenities(amenitiesData.data)
      }
      if (servicesData.success) {
        setServices(servicesData.data)
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
      toast.error(t('loadError'))
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAmenity = (id: string) => {
    setAmenities(amenities.map(a => {
      if (a.id !== id) return a
      const nextSelected = !a.isSelected
      return {
        ...a,
        isSelected: nextSelected,
        isFeatured: nextSelected ? a.isFeatured : false,
      }
    }))
  }

  const toggleFeatured = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const target = amenities.find(a => a.id === id)
    if (!target) return
    const currentFeaturedCount = amenities.filter(a => a.isSelected && a.isFeatured).length
    if (!target.isFeatured && currentFeaturedCount >= 6) {
      toast.warning(t('amenities.maxFeaturedWarning'))
    }
    setAmenities(amenities.map(a => (a.id === id ? { ...a, isFeatured: !a.isFeatured } : a)))
  }

  const handleOpenEditCustomName = (e: React.MouseEvent, amenity: Amenity) => {
    e.stopPropagation()
    setEditingAmenity(amenity)
    setCustomNameInput(amenity.customName ?? '')
  }

  const handleSaveCustomName = () => {
    if (!editingAmenity) return
    const trimmed = customNameInput.trim()
    setAmenities(amenities.map(a => (a.id === editingAmenity.id ? { ...a, customName: trimmed || null } : a)))
    setEditingAmenity(null)
  }

  const handleCreateCustomAmenity = async () => {
    if (!propertyId || !customForm.name.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/amenities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customForm),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(apiError(data.error) || t('amenities.saveFailed'))
        return
      }
      toast.success(t('amenities.createSuccess'))
      setAmenities(prev => [...prev, data.data])
      setShowCustomModal(false)
      setCustomForm({ name: '', category: 'facility', icon: 'sparkles', isFeatured: false })
    } catch {
      toast.error(t('amenities.saveError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveAmenities = async () => {
    setIsSubmitting(true)
    try {
      const selectedAmenities = amenities.filter(a => a.isSelected)
      const res = await fetch(`/api/properties/${propertyId}/amenities`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amenities: selectedAmenities.map((a, idx) => ({
            amenityId: a.id,
            isFeatured: Boolean(a.isFeatured),
            customName: a.customName || null,
            images: a.images || [],
            sortOrder: typeof a.sortOrder === 'number' ? a.sortOrder : idx,
          })),
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(apiError(data.error) || t('amenities.saveFailed'))
        return
      }
      toast.success(t('amenities.saved'))
    } catch (err) {
      console.error('Save amenities error:', err)
      toast.error(t('amenities.saveError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteService = async (id: string) => {
    if (!confirm(t('list.deleteConfirm'))) return
    try {
      const res = await fetch(`/api/extra-services/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) {
        toast.error(apiError(data.error) || t('list.deleteFailed'))
        return
      }
      toast.success(t('list.deleted'))
      setServices(services.filter(s => s.id !== id))
    } catch (err) {
      console.error('Delete service error:', err)
      toast.error(t('list.deleteError'))
    }
  }

  const handleSubmitService = async () => {
    if (!propertyId) {
      toast.error(t('noPropertyToast'))
      return
    }
    if (!serviceForm.name || serviceForm.price < 0) {
      toast.error(t('modal.invalid'))
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingService
        ? `/api/extra-services/${editingService.id}`
        : '/api/extra-services'
      const method = editingService ? 'PATCH' : 'POST'

      const capacityNum = typeof serviceForm.dailyCapacity === 'number'
        ? serviceForm.dailyCapacity
        : parseInt(serviceForm.dailyCapacity, 10)

      const payload = {
        propertyId,
        name: serviceForm.name,
        description: serviceForm.description || null,
        category: serviceForm.category,
        priceType: serviceForm.priceType,
        price: serviceForm.price,
        perPerson: serviceForm.perPerson,
        coverImage: serviceForm.coverImage ? serviceForm.coverImage.trim() : null,
        leadTimeHours: Number(serviceForm.leadTimeHours) || 0,
        dailyCapacity: capacityNum && capacityNum > 0 ? capacityNum : null,
        operatingHours: serviceForm.operatingHours ? serviceForm.operatingHours.trim() : null,
        showOnBooking: serviceForm.showOnBooking,
        translations: { en: serviceForm.en },
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(apiError(data.error) || t('modal.saveFailed'))
        return
      }
      toast.success(editingService ? t('modal.updated') : t('modal.added'))
      setShowServiceModal(false)
      resetServiceForm()
      await fetchData()
    } catch (err) {
      console.error('Save service error:', err)
      toast.error(t('modal.saveError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetServiceForm = () => {
    setEditingService(null)
    setServiceForm({
      name: '',
      description: '',
      en: { name: '', description: '' },
      category: 'other',
      priceType: 'FIXED',
      price: 0,
      perPerson: false,
      coverImage: '',
      leadTimeHours: 0,
      dailyCapacity: '',
      operatingHours: '',
      showOnBooking: true,
    })
  }

  const handleEditService = (service: ExtraService) => {
    setEditingService(service)
    setServiceForm({
      name: service.name,
      description: service.description ?? '',
      en: { name: service.translations?.en?.name ?? '', description: service.translations?.en?.description ?? '' },
      category: service.category ?? 'other',
      priceType: service.priceType,
      price: service.price,
      perPerson: service.perPerson,
      coverImage: service.coverImage ?? '',
      leadTimeHours: service.leadTimeHours ?? 0,
      dailyCapacity: service.dailyCapacity ?? '',
      operatingHours: service.operatingHours ?? '',
      showOnBooking: service.showOnBooking ?? true,
    })
    setShowServiceModal(true)
  }

  const formatPrice = (price: number, priceType: string, perPerson: boolean) => {
    const formatted = labels.money(price)
    if (priceType === 'PER_NIGHT') return t('price.perNight', { price: formatted })
    if (priceType === 'PER_PERSON') return perPerson ? t('price.perPerson', { price: formatted }) : t('price.perUse', { price: formatted })
    return formatted
  }

  const serviceCategoryLabel = (category: string | null) =>
    t(`serviceCategory.${SERVICE_CATEGORIES.includes(category as ServiceCategory) ? (category as ServiceCategory) : 'other'}`)
  const amenityCategoryLabel = (category: string) =>
    AMENITY_CATEGORIES.includes(category as AmenityCategory) ? t(`amenityCategory.${category as AmenityCategory}`) : category

  const groupedAmenities = React.useMemo(() => {
    const filtered = amenities.filter(a =>
      searchQuery
        ? (a.customName || amenityName(a.slug, a.name, labels.locale)).toLowerCase().includes(searchQuery.toLowerCase())
        : true
    )
    const groups: Record<string, Amenity[]> = {}
    filtered.forEach(a => {
      if (!groups[a.category]) groups[a.category] = []
      groups[a.category].push(a)
    })
    return groups
  }, [amenities, searchQuery, labels.locale])

  const selectedCount = amenities.filter(a => a.isSelected).length
  const featuredCount = amenities.filter(a => a.isSelected && a.isFeatured).length

  if (!propertyId) {
    return (
      <PageContainer>
        <div className="py-16 text-center">
          <p className="text-muted">{t('noProperty')}</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-8">
        <Header title={t('title')} description={t('description')} />

        {/* Amenities Section */}
        <section className="bg-panel rounded-xl border border-line p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-fg">{t('amenities.title')}</h2>
              <p className="text-sm text-muted mt-0.5">
                {selectedCount > 0 ? t('amenities.selected', { count: selectedCount }) : t('amenities.choose')}
                {featuredCount > 0 && (
                  <span className="text-amber-500 font-medium"> · ⭐ {t('amenities.featuredCount', { count: featuredCount })}</span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  aria-label={t('amenities.search')}
                  placeholder={t('amenities.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-base sm:text-sm bg-panel text-fg border border-line rounded-lg focus:outline-none focus:border-muted w-full sm:w-48"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomModal(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {t('amenities.addCustom')}
              </Button>
              <Button
                onClick={handleSaveAmenities}
                isLoading={isSubmitting}
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {tc('actions.save')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-14 bg-fg/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : amenities.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-line rounded-lg">
              <p className="text-sm text-muted">
                {t.rich('amenities.empty', {
                  code: (chunks) => <code className="bg-fg/5 px-2 py-0.5 rounded text-xs">{chunks}</code>,
                })}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAmenities).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-fg mb-3">
                    {amenityCategoryLabel(category)}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((amenity) => {
                      const IconComponent = getIcon(amenity.icon)
                      return (
                        <div
                          key={amenity.id}
                          onClick={() => toggleAmenity(amenity.id)}
                          className={`
                            group relative flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-left cursor-pointer
                            transition-all select-none
                            ${amenity.isSelected
                              ? amenity.isFeatured
                                ? 'border-amber-500/50 bg-amber-500/[0.08] shadow-sm ring-1 ring-amber-500/30'
                                : 'border-info/30 bg-info-soft'
                              : 'border-line hover:border-line hover:bg-fg/[0.03]'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <IconComponent className={`w-4 h-4 shrink-0 ${amenity.isFeatured ? 'text-amber-500' : amenity.isSelected ? 'text-info' : 'text-muted'}`} />
                            <div className="min-w-0">
                              <span className={`text-sm font-medium block truncate ${amenity.isFeatured ? 'text-amber-600 dark:text-amber-400 font-semibold' : amenity.isSelected ? 'text-info' : 'text-fg'}`}>
                                {amenity.customName || amenityName(amenity.slug, amenity.name, labels.locale)}
                              </span>
                              {amenity.customName && (
                                <span className="text-[10px] text-muted block truncate">
                                  ({amenityName(amenity.slug, amenity.name, labels.locale)})
                                </span>
                              )}
                            </div>
                          </div>

                          {amenity.isSelected && (
                            <div className="flex items-center gap-0.5 shrink-0 ml-1">
                              <button
                                type="button"
                                onClick={(e) => toggleFeatured(e, amenity.id)}
                                title={amenity.isFeatured ? t('amenities.unpinFeatured') : t('amenities.pinFeatured')}
                                className={`p-1 rounded hover:bg-fg/10 transition-colors ${amenity.isFeatured ? 'text-amber-500' : 'text-muted/60 hover:text-amber-500'}`}
                              >
                                <Star className={`w-3.5 h-3.5 ${amenity.isFeatured ? 'fill-amber-500' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditCustomName(e, amenity)}
                                title={t('amenities.editCustomName')}
                                className="p-1 rounded text-muted/60 hover:text-fg hover:bg-fg/10 transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Services Section */}
        <section className="bg-panel rounded-xl border border-line p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-fg">{t('list.title')}</h2>
              <p className="text-sm text-muted mt-0.5">
                {services.length > 0 ? t('list.count', { count: services.length }) : t('list.empty')}
              </p>
            </div>
            <Button
              onClick={() => { resetServiceForm(); setShowServiceModal(true) }}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('list.add')}
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 bg-fg/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-line rounded-lg">
              <ConciergeBell className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-sm text-muted font-medium">{t('list.empty')}</p>
              <p className="text-xs text-muted mt-1 mb-4">{t('list.emptyHint')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { resetServiceForm(); setShowServiceModal(true) }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('list.addFirst')}
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {services.map((service) => {
                return (
                  <div
                    key={service.id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="w-12 h-12 rounded-lg shrink-0 overflow-hidden bg-fg/5 border border-line/60 flex items-center justify-center">
                      {service.coverImage ? (
                        <img
                          src={service.coverImage}
                          alt={service.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ConciergeBell className="w-5 h-5 text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-medium break-words ${service.isActive ? 'text-fg' : 'text-muted'}`}>
                          {service.name}
                        </span>
                        {!service.isActive && (
                          <Badge variant="secondary" className="text-xs">{t('list.off')}</Badge>
                        )}
                        {service.showOnBooking && (
                          <Badge variant="outline" className="text-[11px] text-ok border-ok/30 bg-ok/5">
                            🌐 {t('list.showOnBooking')}
                          </Badge>
                        )}
                        {Boolean(service.leadTimeHours && service.leadTimeHours > 0) && (
                          <Badge variant="outline" className="text-[11px] text-warn border-warn/30 bg-warn/5">
                            ⏰ {t('list.leadTime', { hours: service.leadTimeHours! })}
                          </Badge>
                        )}
                        {Boolean(service.dailyCapacity && service.dailyCapacity > 0) && (
                          <Badge variant="outline" className="text-[11px] text-info border-info/30 bg-info/5">
                            📊 {t('list.capacity', { count: service.dailyCapacity! })}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted mt-0.5">
                        <span>{serviceCategoryLabel(service.category)}</span>
                        {service.priceType === 'PER_NIGHT' && <span>· {t('priceType.PER_NIGHT')}</span>}
                        {service.priceType === 'PER_PERSON' && (
                          <span>· {service.perPerson ? t('priceType.PER_PERSON') : t('list.perUse')}</span>
                        )}
                        {service.operatingHours && (
                          <span>· 🕒 {service.operatingHours}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-base font-semibold text-fg tabular-nums whitespace-nowrap mr-auto sm:mr-0">
                      {formatPrice(service.price, service.priceType, service.perPerson)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button aria-label={tc('actions.edit')}
                        onClick={() => handleEditService(service)}
                        className="p-2 text-muted hover:text-muted hover:bg-fg/5 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button aria-label={tc('actions.delete')}
                        onClick={() => handleDeleteService(service.id)}
                        className="p-2 text-muted hover:text-err hover:bg-err-soft rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Service dialog: the shared Modal (role="dialog", Esc and focus handling); it was a hand-made overlay. */}
      <Modal
        isOpen={showServiceModal}
        onClose={() => { setShowServiceModal(false); resetServiceForm() }}
        size="sm"
      >
        <ModalHeader onClose={() => { setShowServiceModal(false); resetServiceForm() }}>
          <span className="block min-w-0">
            <span className="block font-semibold">{editingService ? t('modal.editTitle') : t('modal.newTitle')}</span>
            <span className="block text-sm font-normal text-muted mt-0.5">
              {editingService ? t('modal.editSubtitle') : t('modal.newSubtitle')}
            </span>
          </span>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <Input
            label={t('modal.name')}
            value={serviceForm.name}
            onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
            placeholder={t('modal.namePlaceholder')}
          />

          <Textarea
            label={t('modal.description')}
            value={serviceForm.description}
            onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
            placeholder={t('modal.descriptionPlaceholder')}
            rows={2}
          />

          <EnglishCopy filled={Boolean(serviceForm.en.name || serviceForm.en.description)}>
            <Input
              label={t('modal.name')}
              value={serviceForm.en.name}
              onChange={(e) => setServiceForm({ ...serviceForm, en: { ...serviceForm.en, name: e.target.value } })}
              placeholder={serviceForm.name}
            />
            <Textarea
              label={t('modal.description')}
              value={serviceForm.en.description}
              onChange={(e) => setServiceForm({ ...serviceForm, en: { ...serviceForm.en, description: e.target.value } })}
              placeholder={serviceForm.description}
              rows={2}
            />
          </EnglishCopy>

          <div role="group" aria-label={t('modal.category')}>
            <p className="block text-sm font-medium text-fg mb-1.5">{t('modal.category')}</p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={serviceForm.category === cat}
                  onClick={() => setServiceForm({ ...serviceForm, category: cat })}
                  className={`
                    px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${serviceForm.category === cat
                      ? 'bg-info text-on-ink'
                      : 'bg-fg/5 text-muted hover:bg-fg/10'
                    }
                  `}
                >
                  {t(`serviceCategory.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="service-price-type" className="block text-sm font-medium text-fg mb-1.5">{t('modal.priceType')}</label>
              <select
                id="service-price-type"
                value={serviceForm.priceType}
                onChange={(e) =>
                  setServiceForm({
                    ...serviceForm,
                    priceType: e.target.value as typeof serviceForm.priceType,
                  })
                }
                className="w-full h-10 px-3 text-base sm:text-sm text-fg border border-line rounded-lg focus:outline-none focus:border-muted bg-panel"
              >
                <option value="FIXED">{t('priceType.FIXED')}</option>
                <option value="PER_NIGHT">{t('priceType.PER_NIGHT')}</option>
                <option value="PER_PERSON">{t('priceType.PER_PERSON')}</option>
              </select>
            </div>
            <div>
              <NumberInput
                label={t('modal.price')}
                value={serviceForm.price}
                onValueChange={(v) =>
                  setServiceForm({ ...serviceForm, price: parseInt(v) || 0 })
                }
                placeholder="0"
              />
            </div>
          </div>

          {serviceForm.priceType === 'PER_PERSON' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={serviceForm.perPerson}
                onChange={(e) => setServiceForm({ ...serviceForm, perPerson: e.target.checked })}
                className="w-4 h-4 rounded border-line text-info"
              />
              <span className="text-sm text-fg">{t('modal.perPerson')}</span>
            </label>
          )}

          {/* Operations & Booking Settings */}
          <div className="pt-3 border-t border-line space-y-4">
            <h4 className="text-sm font-semibold text-fg">
              {t('modal.operationsSection')}
            </h4>

            {/* Cover Image */}
            <div>
              <label className="block text-sm font-medium text-fg mb-1">
                {t('modal.coverImage')}
              </label>
              <p className="text-xs text-muted mb-2">
                {t('modal.coverImageHint')}
              </p>
              {serviceForm.coverImage ? (
                <div className="relative inline-block rounded-lg overflow-hidden border border-line bg-fg/5">
                  <img
                    src={serviceForm.coverImage}
                    alt={serviceForm.name || 'Service cover'}
                    className="w-40 h-24 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setServiceForm({ ...serviceForm, coverImage: '' })}
                    className="absolute top-1 right-1 p-1 bg-panel/80 hover:bg-panel text-fg rounded-full border border-line shadow-sm"
                    title={t('modal.removePhoto')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <PhotoUploadButton
                    target={{ propertyId }}
                    onUploaded={(url) => setServiceForm({ ...serviceForm, coverImage: url })}
                    label={t('modal.uploadPhoto')}
                  />
                  <span className="text-xs text-muted">hoặc</span>
                  <Input
                    placeholder="https://..."
                    value={serviceForm.coverImage}
                    onChange={(e) => setServiceForm({ ...serviceForm, coverImage: e.target.value })}
                    className="text-xs h-9 flex-1"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  label={t('modal.leadTimeHours')}
                  value={serviceForm.leadTimeHours}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      leadTimeHours: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  placeholder={t('modal.leadTimeHoursPlaceholder')}
                  hint={t('modal.leadTimeHoursHint')}
                />
              </div>

              <div>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  label={t('modal.dailyCapacity')}
                  value={serviceForm.dailyCapacity}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      dailyCapacity: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  placeholder={t('modal.dailyCapacityPlaceholder')}
                  hint={t('modal.dailyCapacityHint')}
                />
              </div>
            </div>

            <div>
              <Input
                label={t('modal.operatingHours')}
                value={serviceForm.operatingHours}
                onChange={(e) => setServiceForm({ ...serviceForm, operatingHours: e.target.value })}
                placeholder={t('modal.operatingHoursPlaceholder')}
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={serviceForm.showOnBooking}
                onChange={(e) => setServiceForm({ ...serviceForm, showOnBooking: e.target.checked })}
                className="w-4 h-4 rounded border-line text-info mt-0.5"
              />
              <div className="text-sm">
                <span className="font-medium text-fg block">{t('modal.showOnBooking')}</span>
                <span className="text-xs text-muted block mt-0.5">{t('modal.showOnBookingHint')}</span>
              </div>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => { setShowServiceModal(false); resetServiceForm() }}
            disabled={isSubmitting}
          >
            {tc('actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmitService}
            isLoading={isSubmitting}
          >
            {editingService ? tc('actions.saveChanges') : t('modal.create')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Custom Amenity Modal */}
      <Modal
        isOpen={showCustomModal}
        onClose={() => !isSubmitting && setShowCustomModal(false)}
        size="sm"
      >
        <ModalHeader onClose={() => !isSubmitting && setShowCustomModal(false)}>
          <span className="font-semibold">{t('amenities.addCustomTitle')}</span>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <Input
            label={t('amenities.customName')}
            placeholder={t('amenities.customNamePlaceholder')}
            value={customForm.name}
            onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
            required
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-fg mb-1.5">{t('amenities.category')}</label>
            <select
              value={customForm.category}
              onChange={(e) => setCustomForm({ ...customForm, category: e.target.value })}
              className="w-full h-10 px-3 text-base sm:text-sm text-fg border border-line rounded-lg focus:outline-none focus:border-muted bg-panel"
            >
              {AMENITY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {amenityCategoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={customForm.isFeatured}
              onChange={(e) => setCustomForm({ ...customForm, isFeatured: e.target.checked })}
              className="w-4 h-4 rounded border-line text-info"
            />
            <span className="text-sm font-medium text-fg">⭐ {t('amenities.makeFeatured')}</span>
          </label>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setShowCustomModal(false)}
            disabled={isSubmitting}
          >
            {tc('actions.cancel')}
          </Button>
          <Button
            onClick={handleCreateCustomAmenity}
            isLoading={isSubmitting}
            disabled={!customForm.name.trim()}
          >
            {tc('actions.create')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Custom Name Modal */}
      <Modal
        isOpen={Boolean(editingAmenity)}
        onClose={() => setEditingAmenity(null)}
        size="sm"
      >
        <ModalHeader onClose={() => setEditingAmenity(null)}>
          <span className="font-semibold">{t('amenities.editCustomNameTitle')}</span>
        </ModalHeader>
        <ModalBody className="space-y-3">
          <p className="text-xs text-muted">
            Tên gốc: <span className="font-medium text-fg">{editingAmenity ? amenityName(editingAmenity.slug, editingAmenity.name, labels.locale) : ''}</span>
          </p>
          <Input
            label={t('amenities.editCustomName')}
            placeholder={t('amenities.editCustomNamePlaceholder')}
            value={customNameInput}
            onChange={(e) => setCustomNameInput(e.target.value)}
            autoFocus
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setEditingAmenity(null)}
          >
            {tc('actions.cancel')}
          </Button>
          <Button
            onClick={handleSaveCustomName}
          >
            {tc('actions.save')}
          </Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}
