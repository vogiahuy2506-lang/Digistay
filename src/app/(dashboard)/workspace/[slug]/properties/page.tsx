'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalFooter, Input, Select, Textarea } from '@/components/ui'
import { Plus, Building2, MapPin, MoreVertical, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import Image from 'next/image'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'

interface Property {
  id: string
  name: string
  type: string
  address: string
  city: string
  subdomain: string
  isActive: boolean
  coverImage: string | null
  images: { url: string; isPrimary: boolean }[]
  _count: {
    roomTypes: number
    images: number
  }
}

const propertyTypes = [
  { value: 'HOTEL', label: 'Khách sạn' },
  { value: 'HOMESTAY', label: 'Homestay' },
  { value: 'RESORT', label: 'Resort' },
  { value: 'RESTAURANT', label: 'Nhà hàng' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'MOTEL', label: 'Motel' },
  { value: 'OTHER', label: 'Khác' },
]

const getPropertyTypeLabel = (type: string) => {
  return propertyTypes.find(t => t.value === type)?.label || type
}

const getPropertyTypeBadge = (type: string) => {
  const variants: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'gray'> = {
    HOTEL: 'primary',
    HOMESTAY: 'secondary',
    RESORT: 'success',
    RESTAURANT: 'warning',
    VILLA: 'primary',
    MOTEL: 'gray',
    OTHER: 'gray',
  }
  return variants[type] || 'gray'
}

export default function PropertiesPage() {
  const router = useRouter()
  const { workspace, loading: wsLoading } = useWorkspace()
  const workspaceId = workspace?.id

  const [properties, setProperties] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [error, setError] = React.useState('')
  const [formData, setFormData] = React.useState({
    name: '',
    type: 'HOTEL',
    address: '',
    city: '',
    district: '',
    phone: '',
    email: '',
    subdomain: '',
    description: '',
  })

  React.useEffect(() => {
    if (workspaceId) {
      fetchProperties()
    }
  }, [workspaceId])

  const fetchProperties = async () => {
    if (!workspaceId) return

    try {
      const response = await fetch(`/api/properties?workspaceId=${workspaceId}`)
      const data = await response.json()
      if (data.success) {
        setProperties(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId) return

    setIsCreating(true)
    setError('')

    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          ...formData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setIsCreateModalOpen(false)
      resetForm()
      fetchProperties()
      router.push(routes.property(workspace!.slug, data.data.id))
    } catch (err) {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsCreating(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'HOTEL',
      address: '',
      city: '',
      district: '',
      phone: '',
      email: '',
      subdomain: '',
      description: '',
    })
  }

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cơ sở này?')) return

    try {
      const response = await fetch(`/api/properties/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchProperties()
      }
    } catch (err) {
      console.error('Failed to delete property:', err)
    }
  }

  const togglePropertyStatus = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/properties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })
      fetchProperties()
    } catch (err) {
      console.error('Failed to toggle property status:', err)
    }
  }

  if (wsLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageContainer>
    )
  }

  if (!workspaceId) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Vui lòng chọn Workspace
            </h3>
            <p className="text-gray-500 mb-6">
              Bạn cần chọn một workspace để xem và quản lý cơ sở kinh doanh.
            </p>
            <Button onClick={() => router.push(routes.workspaces())}>
              Chuyển đến Workspace
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Cơ sở kinh doanh"
        description="Quản lý khách sạn, homestay, resort của bạn"
        actions={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm cơ sở mới
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Chưa có cơ sở nào
            </h3>
            <p className="text-gray-500 mb-6">
              Tạo cơ sở kinh doanh đầu tiên trong workspace này.
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo cơ sở đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => {
            const primaryImage = property.images.find(img => img.isPrimary)
            return (
              <Card key={property.id} className="overflow-hidden hover:shadow-md transition-shadow">
                {/* Image */}
                <div className="relative h-48 bg-gray-100">
                  {primaryImage ? (
                    <Image
                      src={primaryImage.url}
                      alt={property.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge variant={getPropertyTypeBadge(property.type)}>
                      {getPropertyTypeLabel(property.type)}
                    </Badge>
                    <Badge variant={property.isActive ? 'success' : 'gray'}>
                      {property.isActive ? 'Hoạt động' : 'Tắt'}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 truncate">{property.name}</h3>
                    <Dropdown
                      trigger={
                        <button className="p-1 rounded hover:bg-gray-100">
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>
                      }
                    >
                      <DropdownItem 
                        icon={<Pencil className="w-4 h-4" />}
                        onClick={() => router.push(routes.property(workspace!.slug, property.id))}
                      >
                        Chỉnh sửa
                      </DropdownItem>
                      <DropdownItem 
                        icon={property.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        onClick={() => togglePropertyStatus(property.id, property.isActive)}
                      >
                        {property.isActive ? 'Tắt hoạt động' : 'Bật hoạt động'}
                      </DropdownItem>
                      <DropdownDivider />
                      <DropdownItem 
                        icon={<Trash2 className="w-4 h-4" />} 
                        danger
                        onClick={() => handleDeleteProperty(property.id)}
                      >
                        Xóa
                      </DropdownItem>
                    </Dropdown>
                  </div>

                  <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{property.address}, {property.city}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{property._count.roomTypes} hạng phòng</span>
                    <span>{property._count.images} hình ảnh</span>
                  </div>

                  <div className="text-xs text-gray-400 mb-3">
                    Subdomain: <code className="bg-gray-100 px-1 rounded">{property.subdomain}</code>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push(routes.property(workspace!.slug, property.id))}
                  >
                    Quản lý
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Property Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          resetForm()
        }}
        title="Thêm cơ sở mới"
        description="Điền thông tin cơ bản để tạo cơ sở kinh doanh mới"
        size="lg"
      >
        <form onSubmit={handleCreateProperty}>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tên cơ sở"
                placeholder="VD: Khách sạn ABC"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  // Auto-generate subdomain from name
                  if (!formData.subdomain) {
                    const subdomain = e.target.value
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                    setFormData(prev => ({ ...prev, subdomain }))
                  }
                }}
                required
              />

              <Select
                label="Loại hình"
                options={propertyTypes}
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              />
            </div>

            <Input
              label="Subdomain"
              placeholder="ten-khach-san"
              value={formData.subdomain}
              onChange={(e) => setFormData({ 
                ...formData, 
                subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
              })}
              hint="Link: ten-khach-san.digistay.vn"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Địa chỉ"
                placeholder="VD: 123 Đường ABC"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />

              <Input
                label="Thành phố/Tỉnh"
                placeholder="VD: Hà Nội"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Quận/Huyện (tùy chọn)"
                placeholder="VD: Quận Ba Đình"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              />

              <Input
                label="Số điện thoại (tùy chọn)"
                placeholder="VD: 0123456789"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <Input
              label="Email (tùy chọn)"
              type="email"
              placeholder="VD: info@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Textarea
              label="Mô tả (tùy chọn)"
              placeholder="Giới thiệu ngắn về cơ sở của bạn"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false)
                resetForm()
              }}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Tạo cơ sở
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </PageContainer>
  )
}
