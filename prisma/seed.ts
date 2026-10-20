import { PrismaClient, BedType, WorkspaceRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Create amenities
  const amenities = [
    { name: 'Wifi miễn phí', slug: 'wifi', icon: 'wifi', category: 'internet' },
    { name: 'Bãi đỗ xe', slug: 'parking', icon: 'car', category: 'parking' },
    { name: 'Ăn sáng miễn phí', slug: 'breakfast', icon: 'utensils', category: 'food' },
    { name: 'Điều hòa không khí', slug: 'ac', icon: 'snowflake', category: 'comfort' },
    { name: 'Hồ bơi', slug: 'pool', icon: 'waves', category: 'leisure' },
    { name: 'Phòng gym', slug: 'gym', icon: 'dumbbell', category: 'leisure' },
    { name: 'Spa & Massage', slug: 'spa', icon: 'sparkles', category: 'leisure' },
    { name: 'Nhà hàng', slug: 'restaurant', icon: 'utensils', category: 'food' },
    { name: 'Quầy bar', slug: 'bar', icon: 'wine', category: 'food' },
    { name: 'Dịch vụ phòng', slug: 'room-service', icon: 'concierge', category: 'service' },
    { name: 'Giặt ủi', slug: 'laundry', icon: 'shirt', category: 'service' },
    { name: 'Đưa đón sân bay', slug: 'airport', icon: 'plane', category: 'transport' },
    { name: 'Bếp chung', slug: 'kitchen', icon: 'chef', category: 'food' },
    { name: 'Khu vực bếp', slug: 'kitchenette', icon: 'chef', category: 'food' },
    { name: 'Máy giặt', slug: 'washing-machine', icon: 'shirt', category: 'service' },
    { name: 'Tivi', slug: 'tv', icon: 'tv', category: 'entertainment' },
    { name: 'Minibar', slug: 'minibar', icon: 'wine', category: 'food' },
    { name: ' сейф', slug: 'safe', icon: 'lock', category: 'security' },
    { name: 'Ban công', slug: 'balcony', icon: 'sun', category: 'comfort' },
    { name: 'View biển', slug: 'sea-view', icon: 'waves', category: 'view' },
    { name: 'View núi', slug: 'mountain-view', icon: 'mountain', category: 'view' },
    { name: 'Thang máy', slug: 'elevator', icon: 'arrow-up', category: 'facility' },
    { name: 'Lễ tân 24/7', slug: 'reception', icon: 'user', category: 'service' },
    { name: 'Bảo vệ', slug: 'security', icon: 'shield', category: 'security' },
    { name: 'Camera an ninh', slug: 'cctv', icon: 'camera', category: 'security' },
  ]

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { slug: amenity.slug },
      update: amenity,
      create: amenity,
    })
  }

  console.log(`Created ${amenities.length} amenities`)

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 12)
  
  // Tài khoản Admin (Chủ sở hữu workspace - toàn quyền)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@digistay.vn' },
    update: {},
    create: {
      name: 'Trần Minh Đức',
      email: 'admin@digistay.vn',
      password: hashedPassword,
      role: 'USER',
    },
  })

  console.log(`Created admin user: ${adminUser.email}`)

  // Tài khoản Quản lý (thấp hơn Admin)
  const managerUser = await prisma.user.upsert({
    where: { email: 'quanly@digistay.vn' },
    update: {},
    create: {
      name: 'Trần Thị Quản Lý',
      email: 'quanly@digistay.vn',
      password: hashedPassword,
      role: 'USER',
    },
  })

  console.log(`Created manager user: ${managerUser.email}`)

  // Tài khoản Lễ tân
  const receptionistUser = await prisma.user.upsert({
    where: { email: 'leitan@digistay.vn' },
    update: {},
    create: {
      name: 'Lê Văn Lễ Tân',
      email: 'leitan@digistay.vn',
      password: hashedPassword,
      role: 'USER',
    },
  })

  console.log(`Created receptionist user: ${receptionistUser.email}`)

  // Tài khoản Người dùng thường
  const normalUser = await prisma.user.upsert({
    where: { email: 'user@digistay.vn' },
    update: {},
    create: {
      name: 'Phạm Văn User',
      email: 'user@digistay.vn',
      password: hashedPassword,
      role: 'USER',
    },
  })

  console.log(`Created normal user: ${normalUser.email}`)

  // Create demo workspace
  const demoWorkspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Khách sạn Demo',
      slug: 'demo-workspace',
      description: 'Workspace demo để test hệ thống',
      ownerId: adminUser.id,
    },
  })

  console.log(`Created demo workspace: ${demoWorkspace.name}`)

  // Add admin as workspace ADMIN (chủ sở hữu - toàn quyền)
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: demoWorkspace.id,
        userId: adminUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: demoWorkspace.id,
      userId: adminUser.id,
      role: WorkspaceRole.ADMIN,
    },
  })

  // Add manager as workspace MANAGER (quản lý - thấp hơn admin)
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: demoWorkspace.id,
        userId: managerUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: demoWorkspace.id,
      userId: managerUser.id,
      role: WorkspaceRole.MANAGER,
    },
  })

  // Add receptionist as workspace RECEPTIONIST (lễ tân)
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: demoWorkspace.id,
        userId: receptionistUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: demoWorkspace.id,
      userId: receptionistUser.id,
      role: WorkspaceRole.RECEPTIONIST,
    },
  })

  // Add normal user as workspace USER (người dùng thường)
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: demoWorkspace.id,
        userId: normalUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: demoWorkspace.id,
      userId: normalUser.id,
      role: WorkspaceRole.USER,
    },
  })

  console.log(`Added all members to workspace`)

  // Create demo property
  const demoProperty = await prisma.property.upsert({
    where: { subdomain: 'khach-san-demo' },
    update: {},
    create: {
      name: 'Khách sạn Demo Hà Nội',
      slug: 'demo-hotel-hanoi',
      subdomain: 'khach-san-demo',
      type: 'HOTEL',
      address: '123 Đường Lê Lợi',
      city: 'Hà Nội',
      district: 'Quận Hoàn Kiếm',
      country: 'Vietnam',
      phone: '024 1234 5678',
      email: 'info@demo-hotel.vn',
      description: 'Khách sạn 4 sao tiêu chuẩn quốc tế tọa lạc tại trung tâm thành phố Hà Nội.',
      workspaceId: demoWorkspace.id,
      isActive: true,
    },
  })

  console.log(`Created demo property: ${demoProperty.name}`)

  // Create default policy
  await prisma.policy.upsert({
    where: { propertyId: demoProperty.id },
    update: {},
    create: {
      propertyId: demoProperty.id,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      childrenAllowed: true,
      minChildAge: 0,
      petsAllowed: false,
      smokingAllowed: false,
    },
  })

  // Create room types
  const roomTypes: {
    name: string
    slug: string
    description: string
    area: number
    bedType: BedType
    maxAdults: number
    maxChildren: number
    totalRooms: number
    baseOccupancy: number
    maxOccupancy: number
  }[] = [
    {
      name: 'Standard',
      slug: 'standard',
      description: 'Phòng tiêu chuẩn với đầy đủ tiện nghi cơ bản',
      area: 22,
      bedType: BedType.DOUBLE,
      maxAdults: 2,
      maxChildren: 1,
      totalRooms: 20,
      baseOccupancy: 2,
      maxOccupancy: 3,
    },
    {
      name: 'Superior',
      slug: 'superior',
      description: 'Phòng superior rộng rãi hơn với view thành phố',
      area: 28,
      bedType: BedType.DOUBLE,
      maxAdults: 2,
      maxChildren: 1,
      totalRooms: 15,
      baseOccupancy: 2,
      maxOccupancy: 3,
    },
    {
      name: 'Deluxe',
      slug: 'deluxe',
      description: 'Phòng deluxe sang trọng với ban công',
      area: 35,
      bedType: BedType.KING,
      maxAdults: 2,
      maxChildren: 2,
      totalRooms: 10,
      baseOccupancy: 2,
      maxOccupancy: 4,
    },
    {
      name: 'Suite',
      slug: 'suite',
      description: 'Phòng suite cao cấp với phòng khách riêng biệt',
      area: 50,
      bedType: BedType.KING,
      maxAdults: 3,
      maxChildren: 2,
      totalRooms: 5,
      baseOccupancy: 2,
      maxOccupancy: 5,
    },
  ]

  // Create pricing
  const pricing = await prisma.pricingConfig.upsert({
    where: { id: 'demo-pricing' },
    update: {},
    create: {
      id: 'demo-pricing',
      propertyId: demoProperty.id,
      name: 'Giá tiêu chuẩn',
      weekdayPrice: 850000,
      weekendPrice: 1100000,
      extraAdultPrice: 250000,
      extraChildPrice: 150000,
      isActive: true,
    },
  })

  console.log(`Created pricing: ${pricing.name}`)

  // Each room type's own price: what the site quotes and bookings charge
  // (src/lib/pricing/quote.ts). The price list above holds the surcharges.
  const ROOM_PRICES: Record<string, [number, number]> = {
    standard: [850000, 1100000],
    superior: [1050000, 1300000],
    deluxe: [1450000, 1750000],
    suite: [2500000, 3000000],
  }

  for (const roomType of roomTypes) {
    const created = await prisma.roomType.upsert({
      where: {
        propertyId_slug: {
          propertyId: demoProperty.id,
          slug: roomType.slug,
        },
      },
      update: roomType,
      create: {
        ...roomType,
        propertyId: demoProperty.id,
        availableRooms: roomType.totalRooms,
      },
    })
    const [weekdayPrice, weekendPrice] = ROOM_PRICES[roomType.slug]
    if ((await prisma.roomTypePricing.count({ where: { roomTypeId: created.id } })) === 0) {
      await prisma.roomTypePricing.create({
        data: { roomTypeId: created.id, pricingId: pricing.id, weekdayPrice, weekendPrice },
      })
    }
    console.log(`Created room type: ${created.name}`)
  }


  // Add some amenities to property
  const wifiAmenity = await prisma.amenity.findUnique({ where: { slug: 'wifi' } })
  const parkingAmenity = await prisma.amenity.findUnique({ where: { slug: 'parking' } })
  const acAmenity = await prisma.amenity.findUnique({ where: { slug: 'ac' } })
  const breakfastAmenity = await prisma.amenity.findUnique({ where: { slug: 'breakfast' } })
  const restaurantAmenity = await prisma.amenity.findUnique({ where: { slug: 'restaurant' } })

  if (wifiAmenity) {
    await prisma.propertyAmenity.upsert({
      where: {
        propertyId_amenityId: {
          propertyId: demoProperty.id,
          amenityId: wifiAmenity.id,
        },
      },
      update: {},
      create: {
        propertyId: demoProperty.id,
        amenityId: wifiAmenity.id,
      },
    })
  }

  if (parkingAmenity) {
    await prisma.propertyAmenity.upsert({
      where: {
        propertyId_amenityId: {
          propertyId: demoProperty.id,
          amenityId: parkingAmenity.id,
        },
      },
      update: {},
      create: {
        propertyId: demoProperty.id,
        amenityId: parkingAmenity.id,
      },
    })
  }

  if (acAmenity) {
    await prisma.propertyAmenity.upsert({
      where: {
        propertyId_amenityId: {
          propertyId: demoProperty.id,
          amenityId: acAmenity.id,
        },
      },
      update: {},
      create: {
        propertyId: demoProperty.id,
        amenityId: acAmenity.id,
      },
    })
  }

  if (breakfastAmenity) {
    await prisma.propertyAmenity.upsert({
      where: {
        propertyId_amenityId: {
          propertyId: demoProperty.id,
          amenityId: breakfastAmenity.id,
        },
      },
      update: {},
      create: {
        propertyId: demoProperty.id,
        amenityId: breakfastAmenity.id,
      },
    })
  }

  if (restaurantAmenity) {
    await prisma.propertyAmenity.upsert({
      where: {
        propertyId_amenityId: {
          propertyId: demoProperty.id,
          amenityId: restaurantAmenity.id,
        },
      },
      update: {},
      create: {
        propertyId: demoProperty.id,
        amenityId: restaurantAmenity.id,
      },
    })
  }

  console.log('Added amenities to property')

  console.log('Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
