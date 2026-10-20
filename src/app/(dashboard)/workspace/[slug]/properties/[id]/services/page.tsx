'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import { Button, Badge, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import {
  Star, Plus, Trash2, Edit, Wifi, Car, Utensils, Waves, Dumbbell,
  Coffee, Sun, Shield, Dog, Save, Check, ConciergeBell,
  Shirt, Bike, Music, X, Search
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

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi, Car, Utensils, Waves, Dumbbell, Coffee, Sun, Shield, Star, Dog,
  Shirt, Bike, Music, ConciergeBell
}

const serviceCategories = [
  { value: 'laundry', label: 'Giặt ủi' },
  { value: 'transport', label: 'Vận chuyển' },
  { value: 'food', label: 'Ăn uống' },
  { value: 'entertainment', label: 'Giải trí' },
  { value: 'other', label: 'Khác' },
]

const categoryLabels: Record<string, string> = {
  comfort: 'Tiện nghi',
  entertainment: 'Giải trí',
  facility: 'Cơ sở',
  food: 'Ăn uống',
  internet: 'Internet',
  leisure: 'Giải trí',
  parking: 'Đỗ xe',
  security: 'An ninh',
  service: 'Dịch vụ',
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
  const [searchQuery, setSearchQuery] = React.useState('')

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
      toast.success('Đã lưu tiện ích thành công!')
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
      toast.success(editingService ? 'Đã cập nhật dịch vụ' : 'Đã thêm dịch vụ mới')
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
    const formatted = new Intl.NumberFormat('vi-VN').format(price)
    if (priceType === 'FIXED') return `${formatted} ₫`
    if (priceType === 'PER_NIGHT') return `${formatted} ₫/đêm`
    if (priceType === 'PER_PERSON') return `${formatted} ₫/${perPerson ? 'người' : 'lần'}`
    return `${formatted} ₫`
  }

  const groupedAmenities = React.useMemo(() => {
    const filtered = amenities.filter(a =>
      searchQuery ? a.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
    )
    const groups: Record<string, Amenity[]> = {}
    filtered.forEach(a => {
      if (!groups[a.category]) groups[a.category] = []
      groups[a.category].push(a)
    })
    return groups
  }, [amenities, searchQuery])

  const selectedCount = amenities.filter(a => a.isSelected).length

  if (!propertyId) {
    return (
      <PageContainer>
        <div className="max-w-5xl mx-auto py-16 text-center">
          <p className="text-muted">Không xác định được cơ sở.</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-fg">Tiện ích & Dịch vụ</h1>
          <p className="text-sm text-muted mt-1">
            Quản lý tiện ích và dịch vụ cho cơ sở của bạn
          </p>
        </div>

        {/* Amenities Section */}
        <section className="bg-panel rounded-xl border border-line p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-medium text-fg">Tiện ích</h2>
              <p className="text-sm text-muted mt-0.5">
                {selectedCount > 0 ? `${selectedCount} tiện ích đã chọn` : 'Chọn tiện ích cho cơ sở'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-line rounded-lg focus:outline-none focus:border-muted w-56"
                />
              </div>
              <Button
                onClick={handleSaveAmenities}
                isLoading={isSubmitting}
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />
                Lưu
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-14 bg-fg/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : amenities.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-line rounded-lg">
              <p className="text-sm text-muted">
                Chưa có tiện ích. Chạy{' '}
                <code className="bg-fg/5 px-2 py-0.5 rounded text-xs">
                  npx tsx prisma/seed-amenities.ts
                </code>
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAmenities).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-fg mb-3">
                    {categoryLabels[category] || category}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((amenity) => {
                      const IconComponent = iconMap[amenity.icon ?? ''] || Star
                      return (
                        <button
                          key={amenity.id}
                          onClick={() => toggleAmenity(amenity.id)}
                          className={`
                            flex items-center gap-3 px-4 py-3 rounded-lg border text-left
                            transition-colors
                            ${amenity.isSelected
                              ? 'border-info/30 bg-info-soft'
                              : 'border-line hover:border-line hover:bg-fg/[0.03]'
                            }
                          `}
                        >
                          <IconComponent className={`w-5 h-5 ${amenity.isSelected ? 'text-info' : 'text-muted'}`} />
                          <span className={`text-sm font-medium ${amenity.isSelected ? 'text-info' : 'text-fg'}`}>
                            {amenity.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Services Section */}
        <section className="bg-panel rounded-xl border border-line p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-medium text-fg">Dịch vụ bổ sung</h2>
              <p className="text-sm text-muted mt-0.5">
                {services.length > 0 ? `${services.length} dịch vụ` : 'Chưa có dịch vụ nào'}
              </p>
            </div>
            <Button
              onClick={() => { resetServiceForm(); setShowServiceModal(true) }}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm dịch vụ
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
              <p className="text-sm text-muted font-medium">Chưa có dịch vụ nào</p>
              <p className="text-xs text-muted mt-1 mb-4">Tạo dịch vụ để khách có thể đặt thêm</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { resetServiceForm(); setShowServiceModal(true) }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm dịch vụ đầu tiên
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {services.map((service) => {
                const categoryInfo = serviceCategories.find(c => c.value === service.category)
                return (
                  <div
                    key={service.id}
                    className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="w-10 h-10 bg-fg/5 rounded-lg flex items-center justify-center shrink-0">
                      <ConciergeBell className="w-5 h-5 text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${service.isActive ? 'text-fg' : 'text-muted'}`}>
                          {service.name}
                        </span>
                        {!service.isActive && (
                          <Badge variant="secondary" className="text-xs">Tắt</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted mt-0.5">
                        {categoryInfo?.label || 'Khác'}
                        {service.priceType === 'PER_NIGHT' && ' · Theo đêm'}
                        {service.priceType === 'PER_PERSON' && (service.perPerson ? ' · Theo người' : ' · Theo lần')}
                      </p>
                    </div>
                    <span className="text-base font-semibold text-fg tabular-nums">
                      {formatPrice(service.price, service.priceType, service.perPerson)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditService(service)}
                        className="p-2 text-muted hover:text-muted hover:bg-fg/5 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
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

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-panel rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-line">
              <div>
                <h2 className="text-lg font-semibold text-fg">
                  {editingService ? 'Chỉnh sửa dịch vụ' : 'Dịch vụ mới'}
                </h2>
                <p className="text-sm text-muted mt-0.5">
                  {editingService ? 'Cập nhật thông tin dịch vụ' : 'Tạo dịch vụ mới'}
                </p>
              </div>
              <button
                onClick={() => { setShowServiceModal(false); resetServiceForm() }}
                className="p-2 text-muted hover:text-muted hover:bg-fg/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">
                  Tên dịch vụ
                </label>
                <Input
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="VD: Giặt ủi quần áo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">Danh mục</label>
                <div className="flex flex-wrap gap-2">
                  {serviceCategories.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setServiceForm({ ...serviceForm, category: cat.value })}
                      className={`
                        px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                        ${serviceForm.category === cat.value
                          ? 'bg-info text-on-ink'
                          : 'bg-fg/5 text-muted hover:bg-fg/10'
                        }
                      `}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1.5">Loại giá</label>
                  <select
                    value={serviceForm.priceType}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        priceType: e.target.value as typeof serviceForm.priceType,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:border-muted bg-panel"
                  >
                    <option value="FIXED">Cố định</option>
                    <option value="PER_NIGHT">Theo đêm</option>
                    <option value="PER_PERSON">Theo người</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1.5">Giá (₫)</label>
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

              {serviceForm.priceType === 'PER_PERSON' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={serviceForm.perPerson}
                    onChange={(e) => setServiceForm({ ...serviceForm, perPerson: e.target.checked })}
                    className="w-4 h-4 rounded border-line text-info"
                  />
                  <span className="text-sm text-fg">Tính theo số người</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-line bg-fg/[0.03] rounded-b-xl">
              <Button
                variant="ghost"
                onClick={() => { setShowServiceModal(false); resetServiceForm() }}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button
                onClick={handleSubmitService}
                isLoading={isSubmitting}
              >
                {editingService ? 'Lưu thay đổi' : 'Tạo dịch vụ'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
