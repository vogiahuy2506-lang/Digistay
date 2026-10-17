'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import {
  Star, Plus, Trash2, Edit, Wifi, Car, Utensils, Waves, Dumbbell,
  Coffee, Sun, Shield, Dog, Save, Check
} from 'lucide-react'

interface Amenity {
  id: string
  name: string
  slug: string
  icon: string | null
  category: string
  isSelected: boolean
}

interface ExtraService {
  id: string
  propertyId: string
  name: string
  description: string | null
  category: string | null
  priceType: 'FIXED' | 'PER_NIGHT' | 'PER_PERSON'
  price: number
  perPerson: boolean
  isActive: boolean
}

const serviceCategories = [
  { value: 'laundry', label: 'Giặt ủi' },
  { value: 'transport', label: 'Vận chuyển' },
  { value: 'food', label: 'Ăn uống' },
  { value: 'entertainment', label: 'Giải trí' },
  { value: 'other', label: 'Khác' },
]

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi, Car, Utensils, Waves, Dumbbell, Coffee, Sun, Shield, Star, Dog,
}

export default function ServicesPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id

  const [amenities, setAmenities] = React.useState<Amenity[]>([])
  const [services, setServices] = React.useState<ExtraService[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showServiceModal, setShowServiceModal] = React.useState(false)
  const [editingService, setEditingService] = React.useState<ExtraService | null>(null)

  const [serviceForm, setServiceForm] = React.useState({
    name: '',
    category: 'other',
    priceType: 'FIXED' as 'FIXED' | 'PER_NIGHT' | 'PER_PERSON',
    price: 0,
    perPerson: false,
  })

  React.useEffect(() => {
    if (propertyId) {
      fetchData()
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } else {
        toast.error(amenitiesData.error || 'Không thể tải tiện ích')
      }
      if (servicesData.success) {
        setServices(servicesData.data)
      } else {
        toast.error(servicesData.error || 'Không thể tải dịch vụ')
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
      toast.error('Đã xảy ra lỗi khi tải dữ liệu')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAmenity = (id: string) => {
    setAmenities(amenities.map(a => (a.id === id ? { ...a, isSelected: !a.isSelected } : a)))
  }

  const handleSaveAmenities = async () => {
    setIsSubmitting(true)
    try {
      const selectedIds = amenities.filter(a => a.isSelected).map(a => a.id)
      const res = await fetch(`/api/properties/${propertyId}/amenities`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amenityIds: selectedIds }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Không thể lưu tiện ích')
        return
      }
      toast.success('Đã lưu tiện ích')
    } catch (err) {
      console.error('Save amenities error:', err)
      toast.error('Đã xảy ra lỗi khi lưu tiện ích')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteService = async (id: string) => {
    if (!confirm('Xóa dịch vụ này?')) return
    try {
      const res = await fetch(`/api/extra-services/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Không thể xóa dịch vụ')
        return
      }
      toast.success('Đã xóa dịch vụ')
      setServices(services.filter(s => s.id !== id))
    } catch (err) {
      console.error('Delete service error:', err)
      toast.error('Đã xảy ra lỗi khi xóa dịch vụ')
    }
  }

  const handleSubmitService = async () => {
    if (!propertyId) {
      toast.error('Không xác định được cơ sở')
      return
    }
    if (!serviceForm.name || serviceForm.price < 0) {
      toast.error('Vui lòng điền tên và giá hợp lệ')
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingService
        ? `/api/extra-services/${editingService.id}`
        : '/api/extra-services'
      const method = editingService ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          ...serviceForm,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Không thể lưu dịch vụ')
        return
      }
      toast.success(editingService ? 'Đã cập nhật dịch vụ' : 'Đã thêm dịch vụ')
      setShowServiceModal(false)
      resetServiceForm()
      await fetchData()
    } catch (err) {
      console.error('Save service error:', err)
      toast.error('Đã xảy ra lỗi khi lưu dịch vụ')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetServiceForm = () => {
    setEditingService(null)
    setServiceForm({
      name: '',
      category: 'other',
      priceType: 'FIXED',
      price: 0,
      perPerson: false,
    })
  }

  const handleEditService = (service: ExtraService) => {
    setEditingService(service)
    setServiceForm({
      name: service.name,
      category: service.category ?? 'other',
      priceType: service.priceType,
      price: service.price,
      perPerson: service.perPerson,
    })
    setShowServiceModal(true)
  }

  const formatPrice = (price: number, priceType: string, perPerson: boolean) => {
    const formatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(price)
    if (priceType === 'FIXED') return formatted
    if (priceType === 'PER_NIGHT') return `${formatted}/đêm`
    if (priceType === 'PER_PERSON') return `${formatted}/${perPerson ? 'người' : 'lần'}`
    return formatted
  }

  if (!propertyId) {
    return (
      <PageContainer>
        <Header title="Tiện ích & Dịch vụ" description="Quản lý tiện ích và dịch vụ của cơ sở" />
        <Card>
          <CardContent className="p-12 text-center">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Không xác định được cơ sở.</p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Tiện ích & Dịch vụ"
        description="Quản lý tiện ích và dịch vụ của cơ sở"
      />

      {/* Amenities Section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tiện ích của cơ sở</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Chọn các tiện ích hiển thị trên website
            </p>
          </div>
          <Button onClick={handleSaveAmenities} isLoading={isSubmitting}>
            <Save className="w-4 h-4 mr-2" />
            Lưu thay đổi
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : amenities.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Chưa có tiện ích nào trong hệ thống. Hãy chạy{' '}
              <code className="bg-gray-100 px-1 rounded">npx tsx prisma/seed-amenities.ts</code>{' '}
              để thêm danh sách tiện ích mặc định.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {amenities.map((amenity) => {
                const IconComponent = iconMap[amenity.icon ?? ''] || Star
                return (
                  <div
                    key={amenity.id}
                    onClick={() => toggleAmenity(amenity.id)}
                    role="checkbox"
                    aria-checked={amenity.isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault()
                        toggleAmenity(amenity.id)
                      }
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      amenity.isSelected
                        ? 'border-primary bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            amenity.isSelected
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-sm">{amenity.name}</span>
                      </div>
                      {amenity.isSelected && <Check className="w-5 h-5 text-primary" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Dịch vụ kèm theo</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Các dịch vụ có thể đặt thêm khi đặt phòng
            </p>
          </div>
          <Button onClick={() => { resetServiceForm(); setShowServiceModal(true) }}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm dịch vụ
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p>Chưa có dịch vụ nào</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { resetServiceForm(); setShowServiceModal(true) }}
              >
                Thêm dịch vụ đầu tiên
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary flex items-center justify-center">
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-gray-500">
                        {serviceCategories.find(c => c.value === service.category)?.label ??
                          'Khác'}{' '}
                        • {formatPrice(service.price, service.priceType, service.perPerson)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={service.isActive ? 'success' : 'gray'}>
                      {service.isActive ? 'Hoạt động' : 'Tắt'}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleEditService(service)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold">
                {editingService ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên dịch vụ <span className="text-red-500">*</span>
                </label>
                <Input
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="VD: Giặt ủi quần áo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                <select
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {serviceCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại giá</label>
                  <select
                    value={serviceForm.priceType}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        priceType: e.target.value as typeof serviceForm.priceType,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="FIXED">Cố định</option>
                    <option value="PER_NIGHT">Theo đêm</option>
                    <option value="PER_PERSON">Theo người</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá (VNĐ)</label>
                  <Input
                    type="number"
                    value={serviceForm.price}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, price: parseInt(e.target.value) || 0 })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowServiceModal(false); resetServiceForm() }}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button onClick={handleSubmitService} isLoading={isSubmitting}>
                {editingService ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
