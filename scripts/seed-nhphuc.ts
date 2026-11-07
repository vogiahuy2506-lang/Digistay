import { PrismaClient, BedType, WorkspaceRole, BookingStatus, BookingSource, PaymentMethod, PaymentStatus, PriceType, DiscountType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Khởi tạo dữ liệu Demo cho tài khoản: nhphuc...')

  // 1. Tìm hoặc tạo user nhphuc
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'nhphuc' },
        { email: { equals: 'nhphuc@digistay.vn', mode: 'insensitive' } },
        { email: { startsWith: 'nhphuc', mode: 'insensitive' } },
      ],
    },
  })

  if (!user) {
    const hashedPassword = await bcrypt.hash('123456aa', 12)
    user = await prisma.user.create({
      data: {
        username: 'nhphuc',
        email: 'nhphuc@digistay.vn',
        name: 'Nguyễn Hồng Phúc',
        password: hashedPassword,
        role: 'USER',
        emailVerified: new Date(),
        phone: '0905888999',
      },
    })
    console.log(`✅ Đã tạo người dùng mới: ${user.username} (${user.email})`)
  } else {
    if (!user.username) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { username: 'nhphuc' },
      })
    }
    console.log(`✅ Tìm thấy người dùng: ${user.name || user.username} (${user.email})`)
  }

  // 2. Tạo hoặc cập nhật Workspace Demo
  const workspaceSlug = 'nhphuc-resort'
  const workspace = await prisma.workspace.upsert({
    where: { slug: workspaceSlug },
    update: {
      ownerId: user.id,
      name: 'Digistay Riverside Resort Đà Nẵng',
      description: 'Khu nghỉ dưỡng 4 sao phong cách Boutique ven sông Hàn, Đà Nẵng',
    },
    create: {
      name: 'Digistay Riverside Resort Đà Nẵng',
      slug: workspaceSlug,
      description: 'Khu nghỉ dưỡng 4 sao phong cách Boutique ven sông Hàn, Đà Nẵng',
      ownerId: user.id,
    },
  })
  console.log(`✅ Workspace: ${workspace.name} (${workspace.slug})`)

  // Gán quyền ADMIN cho user trong workspace
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: { role: WorkspaceRole.ADMIN },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.ADMIN,
    },
  })

  // 3. Tạo cơ sở lưu trú (Property)
  const propertySubdomain = 'nhphuc'
  const propertySlug = 'riverside-boutique-danang'
  const property = await prisma.property.upsert({
    where: { subdomain: propertySubdomain },
    update: {
      workspaceId: workspace.id,
      name: 'Digistay Riverside Boutique Resort',
      slug: propertySlug,
      type: 'RESORT',
      address: '36 Bạch Đằng, Phường Thạch Thang, Quận Hải Châu',
      city: 'Đà Nẵng',
      ward: 'Phường Thạch Thang',
      provinceCode: '48',
      country: 'Vietnam',
      phone: '0905 888 999',
      email: 'nhphuc.resort@digistay.vn',
      description: 'Nằm bên bờ sông Hàn thơ mộng, Digistay Riverside Boutique Resort mang đến trải nghiệm nghỉ dưỡng tiện nghi, hiện đại kết hợp văn hóa địa phương. Hồ bơi vô cực ngắm trọn Cầu Rồng, quầy bar tầng thượng và dịch vụ tiêu chuẩn 4 sao.',
      logo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&h=900&fit=crop',
      isActive: true,
      deletedAt: null,
    },
    create: {
      workspaceId: workspace.id,
      name: 'Digistay Riverside Boutique Resort',
      slug: propertySlug,
      subdomain: propertySubdomain,
      type: 'RESORT',
      address: '36 Bạch Đằng, Phường Thạch Thang, Quận Hải Châu',
      city: 'Đà Nẵng',
      ward: 'Phường Thạch Thang',
      provinceCode: '48',
      country: 'Vietnam',
      phone: '0905 888 999',
      email: 'nhphuc.resort@digistay.vn',
      description: 'Nằm bên bờ sông Hàn thơ mộng, Digistay Riverside Boutique Resort mang đến trải nghiệm nghỉ dưỡng tiện nghi, hiện đại kết hợp văn hóa địa phương. Hồ bơi vô cực ngắm trọn Cầu Rồng, quầy bar tầng thượng và dịch vụ tiêu chuẩn 4 sao.',
      logo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&h=900&fit=crop',
      isActive: true,
    },
  })
  console.log(`✅ Property: ${property.name} (Subdomain: ${property.subdomain}.digistay.vn)`)

  // 4. Website Settings & Policies
  await prisma.websiteSettings.upsert({
    where: { propertyId: property.id },
    update: { isPublished: true, publishedAt: new Date() },
    create: {
      propertyId: property.id,
      isPublished: true,
      publishedAt: new Date(),
      primaryColor: '#0ea5e9',
      secondaryColor: '#10b981',
      metaTitle: 'Digistay Riverside Boutique Resort Đà Nẵng',
      metaDescription: 'Khu nghỉ dưỡng 4 sao phong cách Boutique ven sông Hàn, Đà Nẵng',
    },
  })

  await prisma.policy.upsert({
    where: { propertyId: property.id },
    update: {},
    create: {
      propertyId: property.id,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      childrenAllowed: true,
      minChildAge: 0,
      petsAllowed: true,
      smokingAllowed: false,
      onlineDepositPercent: 50,
    },
  })

  // 5. Cấu hình bảng giá (PricingConfig)
  const pricingConfig = await prisma.pricingConfig.upsert({
    where: { id: `pricing-${property.id}` },
    update: {},
    create: {
      id: `pricing-${property.id}`,
      propertyId: property.id,
      name: 'Bảng giá chuẩn 2026',
      weekdayPrice: 1200000,
      weekendPrice: 1500000,
      extraAdultPrice: 250000,
      extraChildPrice: 150000,
      isActive: true,
    },
  })

  // 6. Tiện ích (Amenities)
  const commonAmenities = await prisma.amenity.findMany({ take: 10 })
  for (const amenity of commonAmenities) {
    await prisma.propertyAmenity.upsert({
      where: {
        propertyId_amenityId: {
          propertyId: property.id,
          amenityId: amenity.id,
        },
      },
      update: {},
      create: {
        propertyId: property.id,
        amenityId: amenity.id,
        isFeatured: true,
      },
    })
  }

  // 7. Hạng phòng (RoomTypes) & Phòng chi tiết (Rooms)
  const roomTypesData = [
    {
      name: 'Deluxe King River View',
      slug: 'deluxe-king-river-view',
      description: 'Phòng Deluxe hướng trực diện sông Hàn với ban công riêng biệt, bồn tắm nằm cao cấp.',
      area: 36,
      bedType: BedType.KING,
      maxAdults: 2,
      maxChildren: 1,
      totalRooms: 5,
      baseOccupancy: 2,
      maxOccupancy: 3,
      weekdayPrice: 1250000,
      weekendPrice: 1550000,
      rooms: ['201', '202', '203', '204', '205'],
    },
    {
      name: 'Grand Suite Balcony',
      slug: 'grand-suite-balcony',
      description: 'Căn hộ Suite sang trọng với phòng khách riêng, tầm nhìn Panorama 180 độ ôm trọn Cầu Rồng.',
      area: 58,
      bedType: BedType.KING,
      maxAdults: 3,
      maxChildren: 2,
      totalRooms: 3,
      baseOccupancy: 2,
      maxOccupancy: 5,
      weekdayPrice: 2300000,
      weekendPrice: 2800000,
      rooms: ['301', '302', '303'],
    },
    {
      name: 'Family Connecting Suite',
      slug: 'family-connecting-suite',
      description: 'Không gian lý tưởng cho gia đình 4-6 người với 2 phòng ngủ thông nhau, khu bếp tiện nghi.',
      area: 75,
      bedType: BedType.DOUBLE,
      maxAdults: 4,
      maxChildren: 2,
      totalRooms: 2,
      baseOccupancy: 4,
      maxOccupancy: 6,
      weekdayPrice: 3200000,
      weekendPrice: 3900000,
      rooms: ['401', '402'],
    },
    {
      name: 'Superior Garden View',
      slug: 'superior-garden-view',
      description: 'Phòng tiêu chuẩn nhìn ra khu vườn nhiệt đới yên tĩnh, đầy đủ tiện nghi làm việc và nghỉ ngơi.',
      area: 28,
      bedType: BedType.QUEEN,
      maxAdults: 2,
      maxChildren: 1,
      totalRooms: 4,
      baseOccupancy: 2,
      maxOccupancy: 3,
      weekdayPrice: 850000,
      weekendPrice: 1050000,
      rooms: ['101', '102', '103', '104'],
    },
  ]

  const createdRoomTypes = []
  for (const rt of roomTypesData) {
    const roomType = await prisma.roomType.upsert({
      where: {
        propertyId_slug: {
          propertyId: property.id,
          slug: rt.slug,
        },
      },
      update: {
        name: rt.name,
        description: rt.description,
        area: rt.area,
        bedType: rt.bedType,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        totalRooms: rt.totalRooms,
        availableRooms: rt.totalRooms,
        baseOccupancy: rt.baseOccupancy,
        maxOccupancy: rt.maxOccupancy,
      },
      create: {
        propertyId: property.id,
        name: rt.name,
        slug: rt.slug,
        description: rt.description,
        area: rt.area,
        bedType: rt.bedType,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        totalRooms: rt.totalRooms,
        availableRooms: rt.totalRooms,
        baseOccupancy: rt.baseOccupancy,
        maxOccupancy: rt.maxOccupancy,
      },
    })
    createdRoomTypes.push(roomType)

    // Pricing
    const existingPricing = await prisma.roomTypePricing.findFirst({
      where: { roomTypeId: roomType.id, pricingId: pricingConfig.id },
    })
    if (existingPricing) {
      await prisma.roomTypePricing.update({
        where: { id: existingPricing.id },
        data: { weekdayPrice: rt.weekdayPrice, weekendPrice: rt.weekendPrice },
      })
    } else {
      await prisma.roomTypePricing.create({
        data: {
          roomTypeId: roomType.id,
          pricingId: pricingConfig.id,
          weekdayPrice: rt.weekdayPrice,
          weekendPrice: rt.weekendPrice,
        },
      })
    }

    // Rooms
    for (const roomNumber of rt.rooms) {
      await prisma.room.upsert({
        where: {
          propertyId_number: {
            propertyId: property.id,
            number: roomNumber,
          },
        },
        update: { roomTypeId: roomType.id, isActive: true },
        create: {
          propertyId: property.id,
          roomTypeId: roomType.id,
          number: roomNumber,
          floor: parseInt(roomNumber[0], 10),
          isActive: true,
        },
      })
    }
  }
  console.log(`✅ Khởi tạo ${createdRoomTypes.length} hạng phòng & 14 phòng chi tiết`)

  // 8. Dịch vụ gia tăng (Extra Services)
  const extraServicesData = [
    { name: 'Thuê xe máy Honda AirBlade', category: 'transport', price: 150000, priceType: PriceType.PER_NIGHT, perPerson: false },
    { name: 'Đưa đón sân bay Đà Nẵng 2 chiều', category: 'transport', price: 350000, priceType: PriceType.FIXED, perPerson: false },
    { name: 'Bữa sáng Buffet Á-Âu tại nhà hàng', category: 'food', price: 150000, priceType: PriceType.PER_PERSON, perPerson: true },
    { name: 'Set trà chiều hoàng hôn Rooftop', category: 'entertainment', price: 220000, priceType: PriceType.FIXED, perPerson: false },
    { name: 'Giặt sấy lấy ngay trong ngày', category: 'laundry', price: 45000, priceType: PriceType.FIXED, perPerson: false },
  ]

  for (const s of extraServicesData) {
    const existing = await prisma.extraService.findFirst({
      where: { propertyId: property.id, name: s.name },
    })
    if (!existing) {
      await prisma.extraService.create({
        data: { propertyId: property.id, ...s, isActive: true },
      })
    }
  }

  // 9. Tài khoản ngân hàng (VietQR)
  const existingBank = await prisma.bankAccount.findFirst({
    where: { propertyId: property.id, accountNumber: '0905888999' },
  })
  if (!existingBank) {
    await prisma.bankAccount.create({
      data: {
        propertyId: property.id,
        bankName: 'MBBank',
        bankCode: 'MB',
        accountNumber: '0905888999',
        accountHolder: 'NGUYEN HONG PHUC',
        isActive: true,
      },
    })
  }

  // 10. Mã giảm giá (Coupons)
  const coupons = [
    { code: 'WELCOME10', name: 'Chào mừng khách hàng mới', discountType: DiscountType.PERCENT, discountValue: 10, minOrderAmount: 1000000, maxDiscount: 500000 },
    { code: 'SUMMER2026', name: 'Ưu đãi mùa du lịch hè', discountType: DiscountType.FIXED_AMOUNT, discountValue: 200000, minOrderAmount: 2000000, maxDiscount: 200000 },
  ]
  for (const c of coupons) {
    const existing = await prisma.coupon.findFirst({ where: { propertyId: property.id, code: c.code } })
    if (!existing) {
      await prisma.coupon.create({
        data: {
          propertyId: property.id,
          code: c.code,
          name: c.name,
          discountType: c.discountType,
          discountValue: c.discountValue,
          minOrderAmount: c.minOrderAmount,
          maxDiscount: c.maxDiscount,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 86400000),
          isActive: true,
        },
      })
    }
  }

  // 11. Hồ sơ khách hàng (Customer Profiles)
  const customersData = [
    { name: 'Nguyễn Văn Hùng', email: 'hung.nguyen@example.com', phone: '0912345678', tags: ['VIP', 'Thân thiết'], totalStays: 3, totalSpent: 12500000, notes: 'Thích phòng tầng cao, view sông Hàn' },
    { name: 'Trần Thị Mai', email: 'mai.tran@example.com', phone: '0987654321', tags: ['Gia đình'], totalStays: 2, totalSpent: 7800000, notes: 'Cần nôi cho em bé' },
    { name: 'David Miller', email: 'david.m@gmail.com', phone: '+84934567890', tags: ['Quốc tế', 'Công tác'], totalStays: 1, totalSpent: 3750000, notes: 'Nói tiếng Anh' },
  ]

  for (const c of customersData) {
    await prisma.customerProfile.upsert({
      where: {
        propertyId_email_phone: {
          propertyId: property.id,
          email: c.email,
          phone: c.phone,
        },
      },
      update: c,
      create: { propertyId: property.id, ...c },
    })
  }

  // 12. Đơn đặt phòng mẫu (Sample Bookings)
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000)
  const tomorrow = new Date(now.getTime() + 86400000)

  const deluxeRoom = await prisma.room.findFirst({
    where: { propertyId: property.id, number: '201' },
    include: { roomType: true },
  })
  const suiteRoom = await prisma.room.findFirst({
    where: { propertyId: property.id, number: '301' },
    include: { roomType: true },
  })

  // Booking 1: Khách đang ở (CHECKED_IN)
  if (deluxeRoom) {
    const booking1 = await prisma.booking.upsert({
      where: { bookingCode: `BK-RIV-${property.id.slice(-4)}-01` },
      update: {},
      create: {
        bookingCode: `BK-RIV-${property.id.slice(-4)}-01`,
        propertyId: property.id,
        guestName: 'Nguyễn Văn Hùng',
        guestEmail: 'hung.nguyen@example.com',
        guestPhone: '0912345678',
        checkInDate: yesterday,
        checkOutDate: tomorrow,
        numAdults: 2,
        numChildren: 0,
        status: BookingStatus.CHECKED_IN,
        subtotal: 2500000,
        extraCharges: 300000,
        totalAmount: 2800000,
        depositAmount: 2800000,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        source: BookingSource.DIRECT,
        actualCheckIn: yesterday,
      },
    })

    // BookingItem
    await prisma.bookingItem.upsert({
      where: { id: `item-${booking1.id}` },
      update: {},
      create: {
        id: `item-${booking1.id}`,
        bookingId: booking1.id,
        roomTypeId: deluxeRoom.roomTypeId,
        roomId: deluxeRoom.id,
        roomNumber: '201',
        checkInDate: yesterday,
        checkOutDate: tomorrow,
        basePrice: 1250000,
        totalPrice: 2500000,
      },
    })
  }

  // Booking 2: Sắp đến (CONFIRMED)
  if (suiteRoom) {
    const booking2 = await prisma.booking.upsert({
      where: { bookingCode: `BK-RIV-${property.id.slice(-4)}-02` },
      update: {},
      create: {
        bookingCode: `BK-RIV-${property.id.slice(-4)}-02`,
        propertyId: property.id,
        guestName: 'Trần Thị Mai',
        guestEmail: 'mai.tran@example.com',
        guestPhone: '0987654321',
        checkInDate: tomorrow,
        checkOutDate: new Date(tomorrow.getTime() + 2 * 86400000),
        numAdults: 2,
        numChildren: 2,
        status: BookingStatus.CONFIRMED,
        subtotal: 4600000,
        extraCharges: 400000,
        totalAmount: 5000000,
        depositAmount: 2500000,
        paymentStatus: PaymentStatus.PARTIAL,
        paymentMethod: PaymentMethod.QR_VIETQR,
        source: BookingSource.DIRECT,
      },
    })

    await prisma.bookingItem.upsert({
      where: { id: `item-${booking2.id}` },
      update: {},
      create: {
        id: `item-${booking2.id}`,
        bookingId: booking2.id,
        roomTypeId: suiteRoom.roomTypeId,
        roomId: suiteRoom.id,
        roomNumber: '301',
        checkInDate: tomorrow,
        checkOutDate: new Date(tomorrow.getTime() + 2 * 86400000),
        basePrice: 2300000,
        totalPrice: 4600000,
      },
    })
  }

  // 13. Đánh giá của khách (Reviews)
  const existingReview = await prisma.review.findFirst({
    where: { propertyId: property.id, guestEmail: 'hung.nguyen@example.com' },
  })
  if (!existingReview) {
    await prisma.review.create({
      data: {
        propertyId: property.id,
        guestName: 'Nguyễn Văn Hùng',
        guestEmail: 'hung.nguyen@example.com',
        rating: 5,
        title: 'Kỳ nghỉ tuyệt vời bên sông Hàn',
        comment: 'Khách sạn view ngắm Cầu Rồng rất đẹp, phòng Deluxe sạch sẽ, dịch vụ chu đáo. Bữa sáng phong phú, gia đình tôi sẽ quay lại!',
        isPublished: true,
      },
    })
  }

  console.log(`\n🎉 ĐÃ TẠO THÀNH CÔNG WORKSPACE DEMO HOÀN CHỈNH CHO: ${user.username}`)
  console.log(`-----------------------------------------------------------------`)
  console.log(`- Tài khoản: ${user.username} (${user.email})`)
  console.log(`- Workspace: ${workspace.name} (/workspace/${workspace.slug})`)
  console.log(`- Cơ sở: ${property.name}`)
  console.log(`- Subdomain: https://${property.subdomain}.digistay.vn`)
  console.log(`- Số lượng phòng: 14 phòng (4 hạng phòng)`)
  console.log(`- Đơn đặt phòng mẫu, Dịch vụ gia tăng, Tài khoản ngân hàng, Khách hàng thân thiết`)
  console.log(`-----------------------------------------------------------------`)
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
