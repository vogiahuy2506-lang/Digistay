'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Input, Select, Textarea } from '@/components/ui'
import { 
  ArrowLeft, Building2, MapPin, Phone, Mail, Globe, Bed, Wifi, Car, Utensils, 
  Plus, Pencil, Trash2, Save, Clock, Users, Baby, ExternalLink
} from 'lucide-react'
import Image from 'next/image'

interface Property {
  id: string
  name: string
  type: string
  address: string
  city: string
  district: string | null
  phone: string | null
  email: string | null
  website: string | null
  subdomain: string
  description: string | null
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

const bedTypes = [
  { value: 'SINGLE', label: 'Giường đơn' },
  { value: 'DOUBLE', label: 'Giường đôi' },
  { value: 'TWIN', label: '2 Giường đơn' },
  { value: 'TRIPLE', label: '3 Giường' },
  { value: 'QUADRUPLE', label: '4 Giường' },
  { value: 'KING', label: 'Giường King' },
  { value: 'QUEEN', label: 'Giường Queen' },
  { value: 'SUITE', label: 'Suite' },
  { value: 'BUNK', label: 'Giường tầng' },
]

const defaultAmenities = [
  { id: 'wifi', name: 'Wifi miễn phí', slug: 'wifi', icon: 'wifi', category: 'internet' },
  { id: 'parking', name: 'Bãi đỗ xe', slug: 'parking', icon: 'car', category: 'parking' },
  { id: 'breakfast', name: 'Ăn sáng', slug: 'breakfast', icon: 'utensils', category: 'food' },
  { id: 'ac', name: 'Điều hòa', slug: 'ac', icon: 'snowflake', category: 'comfort' },
  { id: 'pool', name: 'Hồ bơi', slug: 'pool', icon: 'waves', category: 'leisure' },
  { id: 'gym', name: 'Phòng gym', slug: 'gym', icon: 'dumbbell', category: 'leisure' },
  { id: 'spa', name: 'Spa', slug: 'spa', icon: 'sparkles', category: 'leisure' },
  { id: 'restaurant', name: 'Nhà hàng', slug: 'restaurant', icon: 'utensils', category: 'food' },
  { id: 'bar', name: 'Quầy bar', slug: 'bar', icon: 'wine', category: 'food' },
  { id: 'room_service', name: 'Dịch vụ phòng', slug: 'room-service', icon: 'concierge', category: 'service' },
  { id: 'laundry', name: 'Giặt ủi', slug: 'laundry', icon: 'shirt', category: 'service' },
  { id: 'airport', name: 'Đưa đón sân bay', slug: 'airport', icon: 'plane', category: 'transport' },
]

export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const propertyId = params.id as string

  const [property, setProperty] = React.useState<Property | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState('overview')

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
      alert('Vui lòng nhập URL hình ảnh')
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
      }
    } catch (err) {
      console.error('Failed to upload image:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hình ảnh này?')) return

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
      }
    } catch (err) {
      console.error('Failed to save room type:', err)
    }
  }

  const handleDeleteRoomType = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hạng phòng này?')) return

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
      }
    } catch (err) {
      console.error('Failed to save pricing:', err)
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
      await fetch(`/api/properties/${propertyId}/policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyForm),
      })
      fetchProperty()
    } catch (err) {
      console.error('Failed to save policy:', err)
    }
  }

  const handleToggleAmenity = (amenityId: string) => {
    if (!property) return
    
    const currentAmenityIds = property.amenities.map(a => a.amenity.id)
    const newAmenityIds = currentAmenityIds.includes(amenityId)
      ? currentAmenityIds.filter(id => id !== amenityId)
      : [...currentAmenityIds, amenityId]

    fetch(`/api/properties/${propertyId}/amenities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amenityIds: newAmenityIds }),
    }).then(() => fetchProperty())
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageContainer>
    )
  }

  if (!property) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Không tìm thấy cơ sở</p>
            <Button onClick={() => router.push('/properties')} className="mt-4">
              Quay lại
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
        <Button variant="ghost" onClick={() => router.push('/properties')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
      </div>

      <Header
        title={property.name}
        description={`${property.subdomain} • ${property.isActive ? 'Hoạt động' : 'Tắt'}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={property.isActive ? 'success' : 'gray'} className="text-sm px-3 py-1">
              {property.isActive ? 'Hoạt động' : 'Tắt'}
            </Badge>
            <Button 
              variant="outline" 
              onClick={() => window.open(`/${property.subdomain}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Xem website
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push(`/properties/${propertyId}/website`)}
            >
              <Globe className="w-4 h-4 mr-2" />
              Website Builder
            </Button>
            <Button variant="outline">
              <Pencil className="w-4 h-4 mr-2" />
              Chỉnh sửa
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="rooms">Hạng phòng</TabsTrigger>
          <TabsTrigger value="pricing">Bảng giá</TabsTrigger>
          <TabsTrigger value="amenities">Tiện ích</TabsTrigger>
          <TabsTrigger value="policy">Chính sách</TabsTrigger>
          <TabsTrigger value="website">Website</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Images */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Hình ảnh</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowImageModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm ảnh
                  </Button>
                </CardHeader>
                <CardContent>
                  {property.images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4">
                      {property.images.map((img) => (
                        <div key={img.id} className="relative aspect-video rounded-lg overflow-hidden group">
                          <Image src={img.url} alt={img.alt || property.name} fill className="object-cover" />
                          {img.isPrimary && (
                            <div className="absolute top-2 left-2 px-2 py-1 bg-primary text-white text-xs rounded">
                              Ảnh chính
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteImage(img.id)}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>Chưa có hình ảnh</p>
                      <Button variant="outline" className="mt-2" onClick={() => setShowImageModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm hình ảnh
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin cơ bản</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Địa chỉ</p>
                      <p className="text-sm text-gray-600">
                        {property.address}, {property.district && `${property.district}, `}{property.city}
                      </p>
                    </div>
                  </div>

                  {property.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Điện thoại</p>
                        <p className="text-sm text-gray-600">{property.phone}</p>
                      </div>
                    </div>
                  )}

                  {property.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <p className="text-sm text-gray-600">{property.email}</p>
                      </div>
                    </div>
                  )}

                  {property.website && (
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Website</p>
                        <p className="text-sm text-gray-600">{property.website}</p>
                      </div>
                    </div>
                  )}

                  {property.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Mô tả</p>
                      <p className="text-sm text-gray-600">{property.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Room types summary */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tóm tắt hạng phòng</CardTitle>
              <Button size="sm" onClick={() => setActiveTab('rooms')}>
                Xem chi tiết
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {property.roomTypes.length > 0 ? (
                  property.roomTypes.map((room) => (
                    <div key={room.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bed className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{room.name}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {room.totalRooms} phòng • Tối đa {room.maxOccupancy} người
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 col-span-4 text-center py-4">
                    Chưa có hạng phòng nào
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
                <CardTitle>Hạng phòng</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Cấu hình các loại phòng và số lượng</p>
              </div>
              <Button onClick={() => {
                setEditingRoomType(null)
                resetRoomTypeForm()
                setShowRoomTypeModal(true)
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Thêm hạng phòng
              </Button>
            </CardHeader>
            <CardContent>
              {property.roomTypes.length > 0 ? (
                <div className="space-y-4">
                  {property.roomTypes.map((room) => (
                    <div key={room.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                          {room.images[0] ? (
                            <Image src={room.images[0].url} alt={room.name} width={64} height={64} className="rounded-lg object-cover" />
                          ) : (
                            <Bed className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{room.name}</h4>
                          <p className="text-sm text-gray-500">
                            {bedTypes.find(b => b.value === room.bedType)?.label} • 
                            {room.area && `${room.area}m² • `}
                            {room.totalRooms} phòng • Tối đa {room.maxOccupancy} người
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={room.isActive ? 'success' : 'gray'}>
                          {room.isActive ? 'Hoạt động' : 'Tắt'}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleEditRoomType(room)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRoomType(room.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bed className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Chưa có hạng phòng nào</p>
                  <Button onClick={() => {
                    setEditingRoomType(null)
                    resetRoomTypeForm()
                    setShowRoomTypeModal(true)
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm hạng phòng đầu tiên
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Room Type Modal */}
          {showRoomTypeModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-semibold">
                    {editingRoomType ? 'Chỉnh sửa hạng phòng' : 'Thêm hạng phòng mới'}
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <Input
                    label="Tên hạng phòng"
                    placeholder="VD: Phòng Deluxe"
                    value={roomTypeForm.name}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, name: e.target.value })}
                    required
                  />

                  <Textarea
                    label="Mô tả (tùy chọn)"
                    placeholder="Mô tả chi tiết về hạng phòng"
                    value={roomTypeForm.description}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, description: e.target.value })}
                    rows={3}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Diện tích (m²)"
                      type="number"
                      placeholder="25"
                      value={roomTypeForm.area}
                      onChange={(e) => setRoomTypeForm({ ...roomTypeForm, area: e.target.value })}
                    />

                    <Select
                      label="Loại giường"
                      options={bedTypes}
                      value={roomTypeForm.bedType}
                      onChange={(e) => setRoomTypeForm({ ...roomTypeForm, bedType: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Số phòng"
                      type="number"
                      min="1"
                      value={roomTypeForm.totalRooms}
                      onChange={(e) => setRoomTypeForm({ ...roomTypeForm, totalRooms: parseInt(e.target.value) || 1 })}
                      required
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="Người lớn tối đa"
                        type="number"
                        min="1"
                        value={roomTypeForm.maxAdults}
                        onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxAdults: parseInt(e.target.value) || 1 })}
                      />
                      <Input
                        label="Trẻ em tối đa"
                        type="number"
                        min="0"
                        value={roomTypeForm.maxChildren}
                        onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxChildren: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Số người cơ bản"
                      type="number"
                      min="1"
                      value={roomTypeForm.baseOccupancy}
                      onChange={(e) => setRoomTypeForm({ ...roomTypeForm, baseOccupancy: parseInt(e.target.value) || 1 })}
                      hint="Số người tính theo giá cơ bản"
                    />

                    <Input
                      label="Số người tối đa"
                      type="number"
                      min="1"
                      value={roomTypeForm.maxOccupancy}
                      onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxOccupancy: parseInt(e.target.value) || 4 })}
                    />
                  </div>
                </div>
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowRoomTypeModal(false)}>
                    Hủy
                  </Button>
                  <Button onClick={handleSaveRoomType}>
                    <Save className="w-4 h-4 mr-2" />
                    Lưu
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bảng giá</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Cấu hình giá phòng ngày thường, cuối tuần và phụ phí</p>
              </div>
              <Button onClick={() => setShowPricingModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Thêm bảng giá
              </Button>
            </CardHeader>
            <CardContent>
              {property.pricing.length > 0 ? (
                <div className="space-y-4">
                  {property.pricing.map((price) => (
                    <div key={price.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900">{price.name}</h4>
                        <Badge variant={price.isActive ? 'success' : 'gray'}>
                          {price.isActive ? 'Hoạt động' : 'Tắt'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Giá ngày thường</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(price.weekdayPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Giá cuối tuần</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(price.weekendPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Phụ thu người lớn</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(price.extraAdultPrice)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Phụ thu trẻ em</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(price.extraChildPrice)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Chưa có bảng giá nào</p>
                  <Button onClick={() => setShowPricingModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tạo bảng giá đầu tiên
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing Modal */}
          {showPricingModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl max-w-md w-full">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-semibold">Thêm bảng giá mới</h2>
                </div>
                <div className="p-6 space-y-4">
                  <Input
                    label="Tên bảng giá"
                    placeholder="VD: Standard"
                    value={pricingForm.name}
                    onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                    required
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Giá ngày thường (VND)"
                      type="number"
                      min="0"
                      value={pricingForm.weekdayPrice}
                      onChange={(e) => setPricingForm({ ...pricingForm, weekdayPrice: parseInt(e.target.value) || 0 })}
                      required
                    />

                    <Input
                      label="Giá cuối tuần (VND)"
                      type="number"
                      min="0"
                      value={pricingForm.weekendPrice}
                      onChange={(e) => setPricingForm({ ...pricingForm, weekendPrice: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Phụ thu người lớn (VND)"
                      type="number"
                      min="0"
                      value={pricingForm.extraAdultPrice}
                      onChange={(e) => setPricingForm({ ...pricingForm, extraAdultPrice: parseInt(e.target.value) || 0 })}
                    />

                    <Input
                      label="Phụ thu trẻ em (VND)"
                      type="number"
                      min="0"
                      value={pricingForm.extraChildPrice}
                      onChange={(e) => setPricingForm({ ...pricingForm, extraChildPrice: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowPricingModal(false)}>
                    Hủy
                  </Button>
                  <Button onClick={handleSavePricing}>
                    <Save className="w-4 h-4 mr-2" />
                    Lưu
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Amenities Tab */}
        <TabsContent value="amenities">
          <Card>
            <CardHeader>
              <CardTitle>Tiện ích</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Chọn các tiện ích có sẵn tại cơ sở của bạn</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {defaultAmenities.map((amenity) => {
                  const isSelected = property.amenities.some(a => a.amenity.id === amenity.id)
                  return (
                    <button
                      key={amenity.id}
                      onClick={() => handleToggleAmenity(amenity.id)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected 
                          ? 'border-primary bg-primary-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-primary-100 text-primary' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Wifi className="w-5 h-5" />
                        </div>
                        <span className={`font-medium ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                          {amenity.name}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Tab */}
        <TabsContent value="policy">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Chính sách</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Cài đặt giờ check-in/out và các quy định khác</p>
              </div>
              <Button onClick={handleSavePolicy}>
                <Save className="w-4 h-4 mr-2" />
                Lưu thay đổi
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Check-in/out times */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Giờ nhận phòng (Check-in)"
                  type="time"
                  value={policyForm.checkInTime || '14:00'}
                  onChange={(e) => setPolicyForm({ ...policyForm, checkInTime: e.target.value })}
                />
                <Input
                  label="Giờ trả phòng (Check-out)"
                  type="time"
                  value={policyForm.checkOutTime || '12:00'}
                  onChange={(e) => setPolicyForm({ ...policyForm, checkOutTime: e.target.value })}
                />
              </div>

              {/* Policies */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Quy định chung</h4>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">Cho phép trẻ em</p>
                      <p className="text-sm text-gray-500">Trẻ em được phép ở tại cơ sở</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={policyForm.childrenAllowed ?? true}
                      onChange={(e) => setPolicyForm({ ...policyForm, childrenAllowed: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Baby className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">Cho phép thú cưng</p>
                      <p className="text-sm text-gray-500">Vật nuôi được phép ở tại cơ sở</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={policyForm.petsAllowed ?? false}
                      onChange={(e) => setPolicyForm({ ...policyForm, petsAllowed: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">Cho phép hút thuốc</p>
                      <p className="text-sm text-gray-500">Hút thuốc được phép trong khuôn viên</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={policyForm.smokingAllowed ?? false}
                      onChange={(e) => setPolicyForm({ ...policyForm, smokingAllowed: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Chính sách hủy phòng</h4>
                <Textarea
                  placeholder="VD: Hủy miễn phí trước 24 giờ check-in..."
                  value={policyForm.cancellationPolicy || ''}
                  onChange={(e) => setPolicyForm({ ...policyForm, cancellationPolicy: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Additional Rules */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Nội quy bổ sung</h4>
                <Textarea
                  placeholder="Các nội quy khác của cơ sở..."
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
                <CardTitle>Website Builder</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Tùy chỉnh giao diện website công khai của bạn</p>
              </div>
              <Button onClick={() => router.push(`/properties/${propertyId}/website`)}>
                <Globe className="w-4 h-4 mr-2" />
                Mở Website Builder
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <Globe className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h4 className="font-medium">Block Builder</h4>
                  <p className="text-sm text-gray-500 mt-1">Kéo thả các khối giao diện</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <Pencil className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h4 className="font-medium">Tùy biến màu sắc</h4>
                  <p className="text-sm text-gray-500 mt-1">Thay đổi màu chủ đạo</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <ExternalLink className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h4 className="font-medium">Xuất bản</h4>
                  <p className="text-sm text-gray-500 mt-1">Đăng tải website của bạn</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between p-4 bg-primary-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Website công khai</h4>
                  <p className="text-sm text-gray-600">https://{property.subdomain}.digistay.vn</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`/${property.subdomain}`, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Xem website
                  </Button>
                  <Badge variant="success">Đã xuất bản</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Upload Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold">Thêm hình ảnh</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL hình ảnh <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageForm.url}
                  onChange={(e) => setImageForm({ ...imageForm, url: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nhập URL hình ảnh từ dịch vụ lưu trữ (Cloudinary, AWS S3, imgbb,...)
                </p>
              </div>

              {imageForm.url && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Xem trước:</p>
                  <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                    <Image src={imageForm.url} alt="Preview" fill className="object-contain" />
                  </div>
                </div>
              )}

              <Input
                label="Mô tả ảnh (alt)"
                placeholder="VD: Phòng Deluxe nhìn ra biển"
                value={imageForm.alt}
                onChange={(e) => setImageForm({ ...imageForm, alt: e.target.value })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Danh mục
                </label>
                <Select
                  options={[
                    { value: '', label: 'Chọn danh mục' },
                    { value: 'lobby', label: 'Sảnh lễ tân' },
                    { value: 'room', label: 'Phòng' },
                    { value: 'pool', label: 'Hồ bơi' },
                    { value: 'restaurant', label: 'Nhà hàng' },
                    { value: 'gym', label: 'Phòng gym' },
                    { value: 'exterior', label: 'Mặt tiền' },
                    { value: 'other', label: 'Khác' },
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
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <label htmlFor="isPrimary" className="text-sm text-gray-700">
                  Đặt làm ảnh chính
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowImageModal(false)}>
                Hủy
              </Button>
              <Button onClick={handleUploadImage} disabled={isUploading}>
                {isUploading ? 'Đang tải lên...' : 'Thêm ảnh'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
