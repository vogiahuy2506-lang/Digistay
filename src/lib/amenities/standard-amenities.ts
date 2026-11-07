export interface StandardAmenity {
  name: string
  slug: string
  icon: string
  category: string
}

export const DEFAULT_AMENITIES: StandardAmenity[] = [
  { name: 'Wifi miễn phí', slug: 'wifi', icon: 'Wifi', category: 'internet' },
  { name: 'Bãi đỗ xe', slug: 'parking', icon: 'Car', category: 'parking' },
  { name: 'Nhà hàng', slug: 'restaurant', icon: 'Utensils', category: 'food' },
  { name: 'Hồ bơi', slug: 'pool', icon: 'Waves', category: 'entertainment' },
  { name: 'Phòng gym', slug: 'gym', icon: 'Dumbbell', category: 'entertainment' },
  { name: 'Bar & Cafe', slug: 'cafe', icon: 'Coffee', category: 'food' },
  { name: 'Spa & Massage', slug: 'spa', icon: 'Sun', category: 'entertainment' },
  { name: 'An ninh 24/7', slug: 'security', icon: 'Shield', category: 'security' },
  { name: 'Điều hòa', slug: 'ac', icon: 'Snowflake', category: 'room' },
  { name: 'TV', slug: 'tv', icon: 'Tv', category: 'room' },
  { name: 'Mini bar', slug: 'minibar', icon: 'Coffee', category: 'room' },
  { name: 'Giặt ủi', slug: 'laundry', icon: 'Shirt', category: 'service' },
  { name: 'Đưa đón sân bay', slug: 'airport', icon: 'Plane', category: 'service' },
  { name: 'Cho phép thú cưng', slug: 'pet', icon: 'Dog', category: 'policy' },
  { name: 'Cho phép hút thuốc', slug: 'smoking', icon: 'Cigarette', category: 'policy' },
  { name: 'Lễ tân 24/7', slug: 'frontdesk', icon: 'ConciergeBell', category: 'service' },
  { name: 'Bữa sáng miễn phí', slug: 'breakfast', icon: 'Utensils', category: 'food' },
  { name: 'Thang máy', slug: 'elevator', icon: 'ArrowUpDown', category: 'room' },
  { name: 'Phòng họp', slug: 'meeting', icon: 'Users', category: 'service' },
  { name: 'Sân vườn', slug: 'garden', icon: 'TreePine', category: 'entertainment' },
]
