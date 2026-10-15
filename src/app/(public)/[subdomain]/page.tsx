'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, CardContent, Input } from '@/components/ui'
import { 
  Search, Calendar, Users, MapPin, Phone, Mail, 
  ChevronLeft, ChevronRight, Wifi, Car, Utensils, 
  Waves, Dumbbell, Coffee, Sun, Star, Shield
} from 'lucide-react'

// Mock property data
const mockProperty = {
  name: 'Khách sạn Digistay Demo',
  type: 'Khách sạn',
  address: '123 Đường Lê Lợi, Quận Hoàn Kiếm, Hà Nội',
  phone: '024 1234 5678',
  email: 'info@digistay.vn',
  rating: 4.5,
  reviews: 128,
  description: 'Khách sạn 4 sao tiêu chuẩn quốc tế tọa lạc tại trung tâm thành phố Hà Nội. Với vị trí thuận tiện, dịch vụ chuyên nghiệp và tiện nghi hiện đại, chúng tôi mang đến cho quý khách trải nghiệm lưu trú tuyệt vời.',
  amenities: [
    { icon: Wifi, name: 'Wifi miễn phí' },
    { icon: Car, name: 'Bãi đỗ xe' },
    { icon: Utensils, name: 'Nhà hàng' },
    { icon: Waves, name: 'Hồ bơi' },
    { icon: Dumbbell, name: 'Phòng gym' },
    { icon: Coffee, name: 'Bar & Cafe' },
    { icon: Sun, name: 'Spa & Massage' },
    { icon: Shield, name: 'An ninh 24/7' },
  ],
  images: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800',
    'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800',
  ],
  roomTypes: [
    {
      id: '1',
      name: 'Phòng Standard',
      description: 'Phòng tiêu chuẩn với đầy đủ tiện nghi cơ bản, view thành phố',
      price: 850000,
      maxGuests: 2,
      size: 22,
      bed: '1 giường đôi',
      image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600',
      amenities: ['Wifi', 'TV', 'Điều hòa', 'Mini bar'],
    },
    {
      id: '2',
      name: 'Phòng Superior',
      description: 'Phòng rộng rãi hơn với cửa sổ lớn, view đẹp',
      price: 1200000,
      maxGuests: 2,
      size: 28,
      bed: '1 giường King',
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600',
      amenities: ['Wifi', 'TV', 'Điều hòa', 'Mini bar', 'Bàn làm việc'],
    },
    {
      id: '3',
      name: 'Phòng Deluxe',
      description: 'Phòng sang trọng với ban công riêng, view thành phố',
      price: 1800000,
      maxGuests: 3,
      size: 35,
      bed: '1 giường King',
      image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600',
      amenities: ['Wifi', 'TV', 'Điều hòa', 'Mini bar', 'Ban công', 'Bồn tắm'],
    },
    {
      id: '4',
      name: 'Suite',
      description: 'Phòng suite cao cấp với phòng khách riêng biệt',
      price: 3500000,
      maxGuests: 4,
      size: 55,
      bed: '1 giường King + Sofa bed',
      image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600',
      amenities: ['Wifi', 'TV', 'Điều hòa', 'Mini bar', 'Ban công', 'Bồn tắm', 'Phòng khách'],
    },
  ],
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function PublicPropertyPage() {
  const searchParams = useSearchParams()
  const subdomain = searchParams.get('subdomain') || 'demo'
  
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(1)
  const [currentImage, setCurrentImage] = useState(0)

  const property = mockProperty

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % property.images.length)
  }

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + property.images.length) % property.images.length)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-xl">D</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">{property.name}</h1>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-medium">{property.rating}</span>
                <span>({property.reviews} đánh giá)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="tel:02412345678" className="hidden md:flex items-center gap-2 text-gray-600 hover:text-primary">
              <Phone className="w-5 h-5" />
              <span>{property.phone}</span>
            </a>
            <Button variant="outline">Đăng nhập</Button>
          </div>
        </div>
      </header>

      {/* Hero Image Gallery */}
      <div className="relative h-[400px] md:h-[500px] bg-gray-100">
        <img
          src={property.images[currentImage]}
          alt={property.name}
          className="w-full h-full object-cover"
        />
        <button
          onClick={prevImage}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={nextImage}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {property.images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImage(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentImage ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Property Info */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{property.name}</h2>
              <div className="flex items-center gap-2 text-gray-600 mb-4">
                <MapPin className="w-5 h-5" />
                <span>{property.address}</span>
              </div>
              <p className="text-gray-600 leading-relaxed">{property.description}</p>
            </div>

            {/* Amenities */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Tiện ích</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {property.amenities.map((amenity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <amenity.icon className="w-5 h-5 text-primary" />
                    <span className="text-sm text-gray-700">{amenity.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Room Types */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Loại phòng</h3>
              <div className="space-y-4">
                {property.roomTypes.map((room) => (
                  <Card key={room.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="flex flex-col md:flex-row">
                      <div className="relative w-full md:w-72 h-48 md:h-auto">
                        <img
                          src={room.image}
                          alt={room.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <CardContent className="flex-1 p-6">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-lg font-bold text-gray-900">{room.name}</h4>
                          <div className="text-right">
                            <p className="text-xl font-bold text-primary">
                              {formatCurrency(room.price)}
                            </p>
                            <p className="text-sm text-gray-500">/đêm</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{room.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                          <span>{room.size}m²</span>
                          <span>•</span>
                          <span>{room.bed}</span>
                          <span>•</span>
                          <span>Tối đa {room.maxGuests} người</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {room.amenities.map((a, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                              {a}
                            </span>
                          ))}
                        </div>
                        <Button className="w-full md:w-auto">
                          Đặt phòng
                        </Button>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Đặt phòng</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nhận phòng
                        </label>
                        <Input
                          type="date"
                          value={checkIn}
                          onChange={(e) => setCheckIn(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Trả phòng
                        </label>
                        <Input
                          type="date"
                          value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Số khách
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setGuests(Math.max(1, guests - 1))}
                          className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="flex-1 text-center font-medium">{guests} người</span>
                        <button
                          onClick={() => setGuests(Math.min(6, guests + 1))}
                          className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <Button className="w-full" size="lg">
                      <Search className="w-5 h-5 mr-2" />
                      Tìm phòng trống
                    </Button>
                    <p className="text-center text-sm text-gray-500">
                      Bạn chưa bị tính phí khi đặt
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Card */}
              <Card className="mt-4">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Liên hệ</h4>
                  <div className="space-y-2 text-sm">
                    <a href={`tel:${property.phone}`} className="flex items-center gap-2 text-gray-600 hover:text-primary">
                      <Phone className="w-4 h-4" />
                      {property.phone}
                    </a>
                    <a href={`mailto:${property.email}`} className="flex items-center gap-2 text-gray-600 hover:text-primary">
                      <Mail className="w-4 h-4" />
                      {property.email}
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2024 {property.name}. Tất cả quyền được bảo lưu.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Powered by Digistay
          </p>
        </div>
      </footer>
    </div>
  )
}
