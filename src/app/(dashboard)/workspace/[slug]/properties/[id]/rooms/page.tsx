'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalFooter, Input, Select, Textarea, Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { 
  Plus, Bed, Edit, Trash2, MoreVertical, Image, Users, Maximize2, 
  DollarSign, BedDouble, Wifi, Utensils, 
  Bath, Coffee, Wine, Sparkles, Waves, ChevronRight, Save
} from 'lucide-react'

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

interface Property {
  id: string
  name: string
  subdomain: string
}

const bedTypeLabels: Record<string, string> = {
  SINGLE: 'Giường đơn',
  DOUBLE: 'Giường đôi',
  TWIN: 'Hai giường đơn',
  TRIPLE: 'Ba giường',
  QUADRUPLE: 'Bốn giường',
}

const bedTypeOptions = [
  { value: 'SINGLE', label: 'Giường đơn' },
  { value: 'DOUBLE', label: 'Giường đôi' },
  { value: 'TWIN', label: 'Hai giường đơn' },
  { value: 'TRIPLE', label: 'Ba giường' },
  { value: 'QUADRUPLE', label: 'Bốn giường' },
]

const amenityIcons: Record<string, React.ReactNode> = {
  'pool': <Waves className="w-3 h-3 text-[#2a674c]" />,
  'wifi': <Wifi className="w-3 h-3 text-[#545f73]" />,
  'restaurant': <Utensils className="w-3 h-3 text-[#a93119]" />,
  'breakfast': <Coffee className="w-3 h-3 text-[#a93119]" />,
  'spa': <Sparkles className="w-3 h-3 text-[#2a674c]" />,
  'bathtub': <Bath className="w-3 h-3 text-[#a93119]" />,
  'minibar': <Wine className="w-3 h-3 text-[#a93119]" />,
}

export default function RoomTypesPage() {
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
    } else {
      setRoomTypes([])
      setIsLoading(false)
    }
  }, [selectedProperty])

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
        alert(data.error || 'Failed to create room type')
      }
    } catch (err) {
      console.error('Failed to create room type:', err)
      alert('Đã xảy ra lỗi')
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
        alert(data.error || 'Failed to update room type')
      }
    } catch (err) {
      console.error('Failed to update room type:', err)
      alert('Đã xảy ra lỗi')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa hạng phòng này?')) return
    try {
      const res = await fetch(`/api/room-types/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchRoomTypes()
      } else {
        alert(data.error || 'Failed to delete room type')
      }
    } catch (err) {
      console.error('Failed to delete room type:', err)
      alert('Đã xảy ra lỗi')
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price)
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
      <Header
        title="Hạng Phòng & Kho Phòng"
        description="Quản lý hạng phòng, sức chứa và hình ảnh"
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
              Thêm Hạng Phòng Mới
            </Button>
          </div>
        }
      />

      <PageContainer>
        {/* Property Info Banner */}
        {selectedPropertyData && (
          <div className="mb-6 p-4 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#a93119]/10 flex items-center justify-center">
                <Bed className="w-6 h-6 text-[#a93119]" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{selectedPropertyData.name}</p>
                <p className="font-semibold text-gray-900">{roomTypes.length} hạng phòng • {roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)} phòng</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-gray-500">Tổng số phòng</p>
                <p className="font-bold text-gray-900">{roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)}</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <p className="text-gray-500">Hạng phòng</p>
                <p className="font-bold text-gray-900">{roomTypes.length}</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <p className="text-gray-500">Đang trống</p>
                <p className="font-bold text-[#2a674c]">{roomTypes.reduce((sum, rt) => sum + rt.availableRooms, 0)}</p>
              </div>
            </div>
          </div>
        )}

        {!selectedProperty ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bed className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Vui lòng chọn cơ sở để xem hạng phòng</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-44 bg-gray-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : roomTypes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bed className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">Chưa có hạng phòng nào</p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Thêm Hạng Phòng Đầu Tiên
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomTypes.map((roomType) => (
              <Card key={roomType.id} className="overflow-hidden rounded-xl hover:shadow-md transition-all">
                {/* Hero Image */}
                <div className="relative h-44 overflow-hidden bg-gradient-to-br from-[#a93119]/5 to-[#a93119]/10">
                  {roomType.images[0] ? (
                    <img
                      src={roomType.images[0].url}
                      alt={roomType.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Bed className="w-16 h-16 text-[#a93119]/30" />
                    </div>
                  )}
                  
                  {/* Photo Count Badge */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 text-white text-xs font-medium backdrop-blur-sm">
                    <Image className="w-3 h-3" />
                    <span>{roomType.images.length} ảnh lưu trữ</span>
                  </div>
                  
                  {/* Room Type ID */}
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/90 text-xs font-mono text-gray-700">
                    ID: {roomType.slug?.toUpperCase().slice(0, 6) || roomType.id.slice(0, 6)}
                  </div>
                  
                  {/* Edit Button */}
                  <div className="absolute top-3 left-3">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="bg-white/90 hover:bg-white shadow-sm"
                      onClick={() => openEditModal(roomType)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Sửa
                    </Button>
                  </div>
                </div>
                
                {/* Content */}
                <CardContent className="p-4 space-y-3">
                  {/* Name & Price */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-base">{roomType.name}</h4>
                      {roomType.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{roomType.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-bold text-[#a93119] text-lg">
                        {formatPrice(roomType.pricing[0]?.weekdayPrice || 0)}
                      </span>
                      <span className="text-xs text-gray-400 block">/đêm</span>
                    </div>
                  </div>
                  
                  {/* Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-gray-50 text-center">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">KHO PHÒNG</p>
                      <p className="font-bold text-gray-900">{roomType.totalRooms} Phòng</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">DIỆN TÍCH</p>
                      <p className="font-bold text-gray-900">{roomType.area || '—'} m²</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">SỨC CHỨA</p>
                      <p className="font-bold text-gray-900">{roomType.baseOccupancy}L • {roomType.maxOccupancy - roomType.baseOccupancy}TE</p>
                    </div>
                  </div>
                  
                  {/* Bed Type */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {roomType.bedType === 'DOUBLE' || roomType.bedType === 'QUADRUPLE' ? (
                      <BedDouble className="w-4 h-4 text-[#a93119]" />
                    ) : (
                      <Bed className="w-4 h-4 text-[#a93119]" />
                    )}
                    <span>{bedTypeLabels[roomType.bedType]}</span>
                  </div>
                  
                  {/* Amenities */}
                  {roomType.amenities.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Tiện ích đặc quyền:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {roomType.amenities.slice(0, 4).map((a) => (
                          <span 
                            key={a.amenity.id} 
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs"
                          >
                            {getAmenityIcon(a.amenity.name)}
                            <span>{a.amenity.name}</span>
                          </span>
                        ))}
                        {roomType.amenities.length > 4 && (
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs">
                            +{roomType.amenities.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Status */}
                  {!roomType.isActive && (
                    <Badge variant="secondary" className="mt-2">Không hoạt động</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Thêm Hạng Phòng Mới">
        <div className="space-y-4">
          <Input
            label="Tên hạng phòng"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="VD: Phòng Deluxe River View"
            required
          />
          <Textarea
            label="Mô tả"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Mô tả về hạng phòng..."
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Loại giường"
              value={formData.bedType}
              onChange={(e) => setFormData({ ...formData, bedType: e.target.value })}
            >
              {bedTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Input
              label="Diện tích (m²)"
              type="number"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              placeholder="25"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số phòng"
              type="number"
              value={formData.totalRooms}
              onChange={(e) => setFormData({ ...formData, totalRooms: e.target.value })}
              min="1"
            />
            <Input
              label="Số khách tối thiểu"
              type="number"
              value={formData.baseOccupancy}
              onChange={(e) => setFormData({ ...formData, baseOccupancy: e.target.value })}
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số khách tối đa"
              type="number"
              value={formData.maxOccupancy}
              onChange={(e) => setFormData({ ...formData, maxOccupancy: e.target.value })}
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Giá ngày thường (VND)"
              type="number"
              value={formData.weekdayPrice}
              onChange={(e) => setFormData({ ...formData, weekdayPrice: e.target.value })}
              placeholder="500000"
            />
            <Input
              label="Giá cuối tuần (VND)"
              type="number"
              value={formData.weekendPrice}
              onChange={(e) => setFormData({ ...formData, weekendPrice: e.target.value })}
              placeholder="650000"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={isSaving || !formData.name}>
            {isSaving ? 'Đang lưu...' : 'Tạo Hạng Phòng'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Chỉnh Sửa Hạng Phòng">
        <div className="space-y-4">
          <Input
            label="Tên hạng phòng"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Textarea
            label="Mô tả"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Loại giường"
              value={formData.bedType}
              onChange={(e) => setFormData({ ...formData, bedType: e.target.value })}
            >
              {bedTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Input
              label="Diện tích (m²)"
              type="number"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số phòng"
              type="number"
              value={formData.totalRooms}
              onChange={(e) => setFormData({ ...formData, totalRooms: e.target.value })}
              min="1"
            />
            <Input
              label="Số khách tối thiểu"
              type="number"
              value={formData.baseOccupancy}
              onChange={(e) => setFormData({ ...formData, baseOccupancy: e.target.value })}
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số khách tối đa"
              type="number"
              value={formData.maxOccupancy}
              onChange={(e) => setFormData({ ...formData, maxOccupancy: e.target.value })}
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Giá ngày thường (VND)"
              type="number"
              value={formData.weekdayPrice}
              onChange={(e) => setFormData({ ...formData, weekdayPrice: e.target.value })}
            />
            <Input
              label="Giá cuối tuần (VND)"
              type="number"
              value={formData.weekendPrice}
              onChange={(e) => setFormData({ ...formData, weekendPrice: e.target.value })}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handleUpdate} disabled={isSaving || !formData.name}>
            {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
