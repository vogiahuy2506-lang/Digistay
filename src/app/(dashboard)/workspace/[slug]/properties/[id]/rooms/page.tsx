'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalFooter, Input, Select, Textarea, Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { 
  Plus, Bed, Edit, Trash2, MoreVertical, Image, Users, Maximize2, 
  DollarSign, BedDouble, Wifi, Utensils, 
  Bath, Coffee, Wine, Sparkles, Waves, ChevronRight, Save, Wrench,
  Calendar, X, AlertCircle
} from 'lucide-react'
import { format, addDays } from 'date-fns'
import { useTranslations } from 'next-intl'
import { useDashLabels } from '@/lib/i18n/dash'

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
  amenities: { amenity: { id: string; name: string; icon: string | null } }[]
  pricing: { weekdayPrice: number; weekendPrice: number }[]
}

interface MaintenanceLock {
  id: string
  propertyId: string
  roomTypeId: string
  lockStart: string
  lockEnd: string
  customerInfo: string | null
  notes: string | null
  roomType: {
    id: string
    name: string
  }
}

interface Property {
  id: string
  name: string
  subdomain: string
}

// Labels: messages dash.rooms.rooms.bedType.*
const BED_TYPES = ['SINGLE', 'DOUBLE', 'TWIN', 'TRIPLE', 'QUADRUPLE'] as const
type BedType = (typeof BED_TYPES)[number]

const amenityIcons: Record<string, React.ReactNode> = {
  'pool': <Waves className="w-3 h-3 text-ok" />,
  'wifi': <Wifi className="w-3 h-3 text-muted" />,
  'restaurant': <Utensils className="w-3 h-3 text-acc" />,
  'breakfast': <Coffee className="w-3 h-3 text-acc" />,
  'spa': <Sparkles className="w-3 h-3 text-ok" />,
  'bathtub': <Bath className="w-3 h-3 text-acc" />,
  'minibar': <Wine className="w-3 h-3 text-acc" />,
}

export default function RoomTypesPage() {
  const t = useTranslations('dash.rooms.rooms')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const bedTypeLabel = (bedType: string) =>
    BED_TYPES.includes(bedType as BedType) ? t(`bedType.${bedType as BedType}`) : undefined
  const router = useRouter()
  const params = useParams<{ slug: string; id: string }>()
  const propertyIdFromUrl = params.id
  const [properties, setProperties] = React.useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = React.useState<string>(propertyIdFromUrl || '')
  const [selectedPropertyData, setSelectedPropertyData] = React.useState<any>(null)
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [selectedRoomType, setSelectedRoomType] = React.useState<RoomType | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  // Maintenance state
  const [activeTab, setActiveTab] = React.useState<'rooms' | 'maintenance'>('rooms')
  const [maintenanceLocks, setMaintenanceLocks] = React.useState<MaintenanceLock[]>([])
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = React.useState(false)
  const [maintenanceForm, setMaintenanceForm] = React.useState({
    roomTypeId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    reason: '',
    notes: '',
  })
  const [isDeletingMaintenance, setIsDeletingMaintenance] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    area: '',
    bedType: 'DOUBLE',
    maxAdults: '2',
    maxChildren: '0',
    totalRooms: '1',
    baseOccupancy: '2',
    maxOccupancy: '4',
    weekdayPrice: '',
    weekendPrice: '',
  })

  // Fetch properties
  React.useEffect(() => {
    fetchProperties()
  }, [])

  // Fetch room types when property changes
  React.useEffect(() => {
    if (selectedProperty) {
      fetchRoomTypes()
      if (activeTab === 'maintenance') {
        fetchMaintenanceLocks()
      }
    } else {
      setRoomTypes([])
      setIsLoading(false)
    }
  }, [selectedProperty, activeTab])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setProperties(data.data)
        if (!selectedProperty) {
          setSelectedProperty(data.data[0].id)
          setSelectedPropertyData(data.data[0])
        } else {
          const prop = data.data.find((p: any) => p.id === selectedProperty)
          if (prop) setSelectedPropertyData(prop)
        }
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
    }
  }

  const fetchRoomTypes = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/room-types?propertyId=${selectedProperty}`)
      const data = await res.json()
      if (data.success) {
        setRoomTypes(data.data)
      }
      // Also fetch full property data
      const propRes = await fetch(`/api/properties/${selectedProperty}`)
      const propData = await propRes.json()
      if (propData.success) {
        setSelectedPropertyData(propData.data)
      }
    } catch (err) {
      console.error('Failed to fetch room types:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMaintenanceLocks = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/rooms/maintenance?propertyId=${selectedProperty}`)
      const data = await res.json()
      if (data.success) {
        setMaintenanceLocks(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch maintenance locks:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateMaintenance = async () => {
    if (!maintenanceForm.roomTypeId || !maintenanceForm.startDate || !maintenanceForm.endDate) {
      alert(t('maintenance.fillAll'))
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/rooms/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedProperty,
          ...maintenanceForm,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setIsMaintenanceModalOpen(false)
        setMaintenanceForm({
          roomTypeId: '',
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
          reason: '',
          notes: '',
        })
        fetchMaintenanceLocks()
        alert(t('maintenance.created'))
      } else {
        alert(data.error || t('maintenance.createFailed'))
      }
    } catch (err) {
      console.error('Failed to create maintenance lock:', err)
      alert(t('error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteMaintenance = async (lockId: string) => {
    if (!confirm(t('maintenance.deleteConfirm'))) return
    setIsDeletingMaintenance(lockId)
    try {
      const res = await fetch(`/api/rooms/maintenance?lockId=${lockId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchMaintenanceLocks()
      } else {
        alert(data.error || t('maintenance.deleteFailed'))
      }
    } catch (err) {
      console.error('Failed to delete maintenance lock:', err)
      alert(t('error'))
    } finally {
      setIsDeletingMaintenance(null)
    }
  }

  const handleCreate = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/room-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedProperty,
          ...formData,
          maxAdults: parseInt(formData.maxAdults),
          maxChildren: parseInt(formData.maxChildren),
          totalRooms: parseInt(formData.totalRooms),
          baseOccupancy: parseInt(formData.baseOccupancy),
          maxOccupancy: parseInt(formData.maxOccupancy),
          weekdayPrice: formData.weekdayPrice ? parseFloat(formData.weekdayPrice) : 0,
          weekendPrice: formData.weekendPrice ? parseFloat(formData.weekendPrice) : 0,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setIsCreateModalOpen(false)
        resetForm()
        fetchRoomTypes()
      } else {
        alert(data.error || t('create.failed'))
      }
    } catch (err) {
      console.error('Failed to create room type:', err)
      alert(t('error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedRoomType) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/room-types/${selectedRoomType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        setIsEditModalOpen(false)
        setSelectedRoomType(null)
        resetForm()
        fetchRoomTypes()
      } else {
        alert(data.error || t('edit.failed'))
      }
    } catch (err) {
      console.error('Failed to update room type:', err)
      alert(t('error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('delete.confirm'))) return
    try {
      const res = await fetch(`/api/room-types/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchRoomTypes()
      } else {
        alert(data.error || t('delete.failed'))
      }
    } catch (err) {
      console.error('Failed to delete room type:', err)
      alert(t('error'))
    }
  }

  const openEditModal = (roomType: RoomType) => {
    setSelectedRoomType(roomType)
    setFormData({
      name: roomType.name,
      description: roomType.description || '',
      area: roomType.area?.toString() || '',
      bedType: roomType.bedType,
      maxAdults: roomType.maxAdults.toString(),
      maxChildren: roomType.maxChildren.toString(),
      totalRooms: roomType.totalRooms.toString(),
      baseOccupancy: roomType.baseOccupancy.toString(),
      maxOccupancy: roomType.maxOccupancy.toString(),
      weekdayPrice: roomType.pricing[0]?.weekdayPrice?.toString() || '',
      weekendPrice: roomType.pricing[0]?.weekendPrice?.toString() || '',
    })
    setIsEditModalOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      area: '',
      bedType: 'DOUBLE',
      maxAdults: '2',
      maxChildren: '0',
      totalRooms: '1',
      baseOccupancy: '2',
      maxOccupancy: '4',
      weekdayPrice: '',
      weekendPrice: '',
    })
  }

  const getAmenityIcon = (name: string) => {
    const lowerName = name.toLowerCase()
    for (const [key, icon] of Object.entries(amenityIcons)) {
      if (lowerName.includes(key)) return icon
    }
    return <span className="w-3 h-3" />
  }

  return (
    <div>
      <PageContainer>
        <Header
          title={t('header.title')}
          description={t('header.description')}
          actions={
            <div className="flex items-center gap-3">
              <Select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="w-64"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <Button onClick={() => setIsCreateModalOpen(true)} disabled={!selectedProperty}>
                <Plus className="w-4 h-4 mr-2" />
                {t('header.add')}
              </Button>
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'rooms'
                ? 'bg-ink text-on-ink'
                : 'bg-fg/5 text-muted hover:bg-fg/10'
            }`}
          >
            <Bed className="w-4 h-4 inline mr-2" />
            {t('tabs.rooms')}
          </button>
          <button
            onClick={() => {
              setActiveTab('maintenance')
              if (selectedProperty) fetchMaintenanceLocks()
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'maintenance'
                ? 'bg-ink text-on-ink'
                : 'bg-fg/5 text-muted hover:bg-fg/10'
            }`}
          >
            <Wrench className="w-4 h-4 inline mr-2" />
            {t('tabs.maintenance')}
          </button>
        </div>

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">{t('maintenance.title')}</h3>
                <p className="text-sm text-muted">{t('maintenance.description')}</p>
              </div>
              <Button onClick={() => setIsMaintenanceModalOpen(true)} disabled={!selectedProperty || roomTypes.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                {t('maintenance.add')}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-acc border-t-transparent rounded-full mx-auto" />
              </div>
            ) : maintenanceLocks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Wrench className="w-12 h-12 mx-auto text-muted mb-4" />
                  <p className="text-muted mb-4">{t('maintenance.empty')}</p>
                  <Button onClick={() => setIsMaintenanceModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('maintenance.addFirst')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {maintenanceLocks.map((lock) => (
                  <Card key={lock.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-warn-soft flex items-center justify-center">
                            <Wrench className="w-6 h-6 text-warn" />
                          </div>
                          <div>
                            <p className="font-semibold">{lock.roomType.name}</p>
                            <p className="text-sm text-muted">
                              {format(new Date(lock.lockStart), 'dd/MM/yyyy')} - {format(new Date(lock.lockEnd), 'dd/MM/yyyy')}
                            </p>
                            {lock.customerInfo && (
                              <p className="text-sm text-warn">{lock.customerInfo}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMaintenance(lock.id)}
                          isLoading={isDeletingMaintenance === lock.id}
                          className="text-err border-err/30 hover:bg-err-soft"
                        >
                          <X className="w-4 h-4 mr-2" />
                          {tc('actions.delete')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <>
        {/* Property Info Banner */}
        {selectedPropertyData && (
          <div className="mb-6 p-4 rounded-xl bg-panel border border-line shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-ink/10 flex items-center justify-center">
                <Bed className="w-6 h-6 text-acc" />
              </div>
              <div>
                <p className="text-sm text-muted">{selectedPropertyData.name}</p>
                <p className="font-semibold text-fg">{t('banner.summary', { types: roomTypes.length, rooms: roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0) })}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-muted">{t('banner.totalRooms')}</p>
                <p className="font-bold text-fg">{roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)}</p>
              </div>
              <div className="w-px h-8 bg-fg/10" />
              <div className="text-center">
                <p className="text-muted">{t('banner.roomTypes')}</p>
                <p className="font-bold text-fg">{roomTypes.length}</p>
              </div>
              <div className="w-px h-8 bg-fg/10" />
              <div className="text-center">
                <p className="text-muted">{t('banner.available')}</p>
                <p className="font-bold text-ok">{roomTypes.reduce((sum, rt) => sum + rt.availableRooms, 0)}</p>
              </div>
            </div>
          </div>
        )}

        {!selectedProperty ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bed className="w-12 h-12 mx-auto text-muted mb-4" />
              <p className="text-muted">{t('list.selectProperty')}</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-44 bg-fg/10" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-fg/10 rounded w-3/4" />
                    <div className="h-4 bg-fg/10 rounded w-1/2" />
                    <div className="h-4 bg-fg/10 rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : roomTypes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bed className="w-12 h-12 mx-auto text-muted mb-4" />
              <p className="text-muted mb-4">{t('list.empty')}</p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('list.addFirst')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomTypes.map((roomType) => (
              <Card key={roomType.id} className="overflow-hidden rounded-xl hover:shadow-md transition-all">
                {/* Hero Image */}
                <div className="relative h-44 overflow-hidden bg-acc-soft/60">
                  {roomType.images[0] ? (
                    <img
                      src={roomType.images[0].url}
                      alt={roomType.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Bed className="w-16 h-16 text-acc/30" />
                    </div>
                  )}
                  
                  {/* Photo Count Badge */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 text-white text-xs font-medium backdrop-blur-sm">
                    <Image className="w-3 h-3" />
                    <span>{t('card.photos', { count: roomType.images.length })}</span>
                  </div>
                  
                  {/* Room Type ID */}
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-panel/90 text-xs font-mono text-fg">
                    ID: {roomType.slug?.toUpperCase().slice(0, 6) || roomType.id.slice(0, 6)}
                  </div>
                  
                  {/* Edit Button */}
                  <div className="absolute top-3 left-3">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="bg-panel/90 hover:bg-panel shadow-sm"
                      onClick={() => openEditModal(roomType)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      {tc('actions.edit')}
                    </Button>
                  </div>
                </div>
                
                {/* Content */}
                <CardContent className="p-4 space-y-3">
                  {/* Name & Price */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-fg text-base">{roomType.name}</h4>
                      {roomType.description && (
                        <p className="text-sm text-muted mt-0.5 line-clamp-1">{roomType.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-bold text-acc text-lg">
                        {labels.money(roomType.pricing[0]?.weekdayPrice || 0)}
                      </span>
                      <span className="text-xs text-muted block">{t('card.perNight')}</span>
                    </div>
                  </div>
                  
                  {/* Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-fg/[0.03] text-center">
                    <div>
                      <p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{t('card.inventory')}</p>
                      <p className="font-bold text-fg">{t('card.roomCount', { count: roomType.totalRooms })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{t('card.area')}</p>
                      <p className="font-bold text-fg">{roomType.area || '—'} m²</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{t('card.capacity')}</p>
                      <p className="font-bold text-fg">{t('card.capacityValue', { adults: roomType.baseOccupancy, children: roomType.maxOccupancy - roomType.baseOccupancy })}</p>
                    </div>
                  </div>
                  
                  {/* Bed Type */}
                  <div className="flex items-center gap-2 text-sm text-muted">
                    {roomType.bedType === 'DOUBLE' || roomType.bedType === 'QUADRUPLE' ? (
                      <BedDouble className="w-4 h-4 text-acc" />
                    ) : (
                      <Bed className="w-4 h-4 text-acc" />
                    )}
                    <span>{bedTypeLabel(roomType.bedType)}</span>
                  </div>
                  
                  {/* Amenities */}
                  {roomType.amenities.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{t('card.amenities')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {roomType.amenities.slice(0, 4).map((a) => (
                          <span 
                            key={a.amenity.id} 
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-fg/5 text-fg text-xs"
                          >
                            {getAmenityIcon(a.amenity.name)}
                            <span>{a.amenity.name}</span>
                          </span>
                        ))}
                        {roomType.amenities.length > 4 && (
                          <span className="px-2 py-1 rounded-full bg-fg/5 text-muted text-xs">
                            +{roomType.amenities.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Status */}
                  {!roomType.isActive && (
                    <Badge variant="secondary" className="mt-2">{t('card.inactive')}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </>
        )}
      </PageContainer>

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t('header.add')}>
        <div className="space-y-4">
          <Input
            label={t('form.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t('form.namePlaceholder')}
            required
          />
          <Textarea
            label={t('form.description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t('form.descriptionPlaceholder')}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('form.bedType')}
              value={formData.bedType}
              onChange={(e) => setFormData({ ...formData, bedType: e.target.value })}
            >
              {BED_TYPES.map((value) => (
                <option key={value} value={value}>{t(`bedType.${value}`)}</option>
              ))}
            </Select>
            <Input
              label={t('form.area')}
              type="number"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              placeholder="25"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.totalRooms')}
              type="number"
              value={formData.totalRooms}
              onChange={(e) => setFormData({ ...formData, totalRooms: e.target.value })}
              min="1"
            />
            <Input
              label={t('form.baseOccupancy')}
              type="number"
              value={formData.baseOccupancy}
              onChange={(e) => setFormData({ ...formData, baseOccupancy: e.target.value })}
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.maxOccupancy')}
              type="number"
              value={formData.maxOccupancy}
              onChange={(e) => setFormData({ ...formData, maxOccupancy: e.target.value })}
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.weekdayPrice')}
              type="number"
              value={formData.weekdayPrice}
              onChange={(e) => setFormData({ ...formData, weekdayPrice: e.target.value })}
              placeholder="500000"
            />
            <Input
              label={t('form.weekendPrice')}
              type="number"
              value={formData.weekendPrice}
              onChange={(e) => setFormData({ ...formData, weekendPrice: e.target.value })}
              placeholder="650000"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={isSaving || !formData.name}>
            {isSaving ? tc('actions.saving') : t('create.submit')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={t('edit.title')}>
        <div className="space-y-4">
          <Input
            label={t('form.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Textarea
            label={t('form.description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('form.bedType')}
              value={formData.bedType}
              onChange={(e) => setFormData({ ...formData, bedType: e.target.value })}
            >
              {BED_TYPES.map((value) => (
                <option key={value} value={value}>{t(`bedType.${value}`)}</option>
              ))}
            </Select>
            <Input
              label={t('form.area')}
              type="number"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.totalRooms')}
              type="number"
              value={formData.totalRooms}
              onChange={(e) => setFormData({ ...formData, totalRooms: e.target.value })}
              min="1"
            />
            <Input
              label={t('form.baseOccupancy')}
              type="number"
              value={formData.baseOccupancy}
              onChange={(e) => setFormData({ ...formData, baseOccupancy: e.target.value })}
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.maxOccupancy')}
              type="number"
              value={formData.maxOccupancy}
              onChange={(e) => setFormData({ ...formData, maxOccupancy: e.target.value })}
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.weekdayPrice')}
              type="number"
              value={formData.weekdayPrice}
              onChange={(e) => setFormData({ ...formData, weekdayPrice: e.target.value })}
            />
            <Input
              label={t('form.weekendPrice')}
              type="number"
              value={formData.weekendPrice}
              onChange={(e) => setFormData({ ...formData, weekendPrice: e.target.value })}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleUpdate} disabled={isSaving || !formData.name}>
            {isSaving ? tc('actions.saving') : t('edit.submit')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Maintenance Modal */}
      <Modal isOpen={isMaintenanceModalOpen} onClose={() => setIsMaintenanceModalOpen(false)} title={t('maintenance.add')}>
        <div className="space-y-4">
          <Select
            label={t('maintenance.form.roomType')}
            value={maintenanceForm.roomTypeId}
            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, roomTypeId: e.target.value })}
          >
            <option value="">{t('maintenance.form.chooseRoomType')}</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('maintenance.form.startDate')}
              type="date"
              value={maintenanceForm.startDate}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, startDate: e.target.value })}
            />
            <Input
              label={t('maintenance.form.endDate')}
              type="date"
              value={maintenanceForm.endDate}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, endDate: e.target.value })}
              min={maintenanceForm.startDate}
            />
          </div>
          <Input
            label={t('maintenance.form.reason')}
            value={maintenanceForm.reason}
            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, reason: e.target.value })}
            placeholder={t('maintenance.form.reasonPlaceholder')}
          />
          <Textarea
            label={t('maintenance.form.notes')}
            value={maintenanceForm.notes}
            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
            placeholder={t('maintenance.form.notesPlaceholder')}
            rows={2}
          />
          <div className="bg-warn-soft border border-warn/30 rounded-lg p-3 text-sm text-warn">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {t('maintenance.form.warning')}
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsMaintenanceModalOpen(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleCreateMaintenance} disabled={isSaving || !maintenanceForm.roomTypeId}>
            {isSaving ? tc('actions.saving') : t('maintenance.form.submit')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
