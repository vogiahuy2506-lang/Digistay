'use client'

import * as React from 'react'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select } from '@/components/ui'
import { 
  Star, Plus, Trash2, Edit, Wifi, Car, Utensils, Waves, Dumbbell, 
  Coffee, Sun, Shield, CoffeeIcon, Music, Baby, Dog, Cigarette, 
  Check, X, Save
} from 'lucide-react'

interface Service {
  id: string
  name: string
  category: string
  priceType: 'FIXED' | 'PER_NIGHT' | 'PER_PERSON'
  price: number
  perPerson: boolean
  isActive: boolean
}

interface Amenity {
  id: string
  name: string
  icon: string
  category: string
  isSelected: boolean
}

const defaultAmenities: Omit<Amenity, 'isSelected'>[] = [
  { id: 'wifi', name: 'Wifi miễn phí', icon: 'Wifi', category: 'internet' },
  { id: 'parking', name: 'Bãi đỗ xe', icon: 'Car', category: 'parking' },
  { id: 'restaurant', name: 'Nhà hàng', icon: 'Utensils', category: 'food' },
  { id: 'pool', name: 'Hồ bơi', icon: 'Waves', category: 'entertainment' },
  { id: 'gym', name: 'Phòng gym', icon: 'Dumbbell', category: 'entertainment' },
  { id: 'cafe', name: 'Bar & Cafe', icon: 'Coffee', category: 'food' },
  { id: 'spa', name: 'Spa & Massage', icon: 'Sun', category: 'entertainment' },
  { id: 'security', name: 'An ninh 24/7', icon: 'Shield', category: 'security' },
  { id: 'ac', name: 'Điều hòa', icon: 'Star', category: 'room' },
  { id: 'tv', name: 'TV', icon: 'Star', category: 'room' },
  { id: 'minibar', name: 'Mini bar', icon: 'Coffee', category: 'room' },
  { id: 'laundry', name: 'Giặt ủi', icon: 'Star', category: 'service' },
  { id: 'airport', name: 'Đưa đón sân bay', icon: 'Car', category: 'service' },
  { id: 'pet', name: 'Cho phép thú cưng', icon: 'Dog', category: 'policy' },
]

const serviceCategories = [
  { value: 'laundry', label: 'Giặt ủi' },
  { value: 'transport', label: 'Vận chuyển' },
  { value: 'food', label: 'Ăn uống' },
  { value: 'entertainment', label: 'Giải trí' },
  { value: 'other', label: 'Khác' },
]

const iconMap: Record<string, any> = {
  Wifi, Car, Utensils, Waves, Dumbbell, Coffee, Sun, Shield, Star, Dog,
}

export default function ServicesPage() {
  const [selectedProperty, setSelectedProperty] = React.useState('')
  const [amenities, setAmenities] = React.useState<Amenity[]>([])
  const [services, setServices] = React.useState<Service[]>([])
  const [showServiceModal, setShowServiceModal] = React.useState(false)
  const [editingService, setEditingService] = React.useState<Service | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const [serviceForm, setServiceForm] = React.useState({
    name: '',
    category: 'other',
    priceType: 'FIXED' as 'FIXED' | 'PER_NIGHT' | 'PER_PERSON',
    price: 0,
    perPerson: false,
  })

  React.useEffect(() => {
    if (selectedProperty) {
      fetchData()
    }
  }, [selectedProperty])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Mock data
      setAmenities(defaultAmenities.map(a => ({ ...a, isSelected: true })))
      setServices([
        {
          id: '1',
          name: 'Giặt ủi quần áo',
          category: 'laundry',
          priceType: 'PER_PERSON',
          price: 50000,
          perPerson: true,
          isActive: true,
        },
        {
          id: '2',
          name: 'Đưa đón sân bay',
          category: 'transport',
          priceType: 'FIXED',
          price: 250000,
          perPerson: false,
          isActive: true,
        },
        {
          id: '3',
          name: 'Thuê xe máy',
          category: 'transport',
          priceType: 'PER_NIGHT',
          price: 150000,
          perPerson: false,
          isActive: true,
        },
      ])
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAmenity = (id: string) => {
    setAmenities(amenities.map(a => 
      a.id === id ? { ...a, isSelected: !a.isSelected } : a
    ))
  }

  const handleSaveServices = async () => {
    // Save amenities
    const selectedAmenities = amenities.filter(a => a.isSelected).map(a => a.id)
    console.log('Saving amenities:', selectedAmenities)
    alert('Đã lưu tiện ích!')
  }

  const handleDeleteService = (id: string) => {
    if (confirm('Xóa dịch vụ này?')) {
      setServices(services.filter(s => s.id !== id))
    }
  }

  const handleSubmitService = () => {
    if (!serviceForm.name || serviceForm.price <= 0) {
      alert('Vui lòng điền đầy đủ thông tin')
      return
    }

    if (editingService) {
      setServices(services.map(s => 
        s.id === editingService.id ? { ...s, ...serviceForm } : s
      ))
    } else {
      setServices([...services, { id: Date.now().toString(), ...serviceForm, isActive: true }])
    }
    setShowServiceModal(false)
    resetServiceForm()
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

  const handleEditService = (service: Service) => {
    setEditingService(service)
    setServiceForm({
      name: service.name,
      category: service.category,
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

  if (!selectedProperty) {
    return (
      <PageContainer>
        <Header title="Tiện ích & Dịch vụ" description="Quản lý tiện ích và dịch vụ của cơ sở" />
        <Card>
          <CardContent className="p-12 text-center">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Vui lòng chọn cơ sở để quản lý</p>
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
            <p className="text-sm text-gray-500 mt-1">Chọn các tiện ích hiển thị trên website</p>
          </div>
          <Button onClick={handleSaveServices}>
            <Save className="w-4 h-4 mr-2" />
            Lưu thay đổi
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {amenities.map((amenity) => {
              const IconComponent = iconMap[amenity.icon] || Star
              return (
                <div
                  key={amenity.id}
                  onClick={() => toggleAmenity(amenity.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    amenity.isSelected
                      ? 'border-primary bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        amenity.isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-sm">{amenity.name}</span>
                    </div>
                    {amenity.isSelected && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Services Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Dịch vụ kèm theo</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Các dịch vụ có thể đặt thêm khi đặt phòng</p>
          </div>
          <Button onClick={() => { resetServiceForm(); setShowServiceModal(true) }}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm dịch vụ
          </Button>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p>Chưa có dịch vụ nào</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowServiceModal(true)}>
                Thêm dịch vụ đầu tiên
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary flex items-center justify-center">
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-gray-500">
                        {serviceCategories.find(c => c.value === service.category)?.label} •{' '}
                        {formatPrice(service.price, service.priceType, service.perPerson)}
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
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service.id)}>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Danh mục
                </label>
                <select
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {serviceCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loại giá
                  </label>
                  <select
                    value={serviceForm.priceType}
                    onChange={(e) => setServiceForm({ ...serviceForm, priceType: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="FIXED">Cố định</option>
                    <option value="PER_NIGHT">Theo đêm</option>
                    <option value="PER_PERSON">Theo người</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá (VNĐ)
                  </label>
                  <Input
                    type="number"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowServiceModal(false); resetServiceForm() }}>
                Hủy
              </Button>
              <Button onClick={handleSubmitService}>
                {editingService ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
