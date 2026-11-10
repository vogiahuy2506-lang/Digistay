import {
  PrismaClient,
  BedType,
  WorkspaceRole,
  BookingStatus,
  BookingSource,
  PaymentMethod,
  PaymentStatus,
  PriceType,
  DiscountType,
  BlockType,
} from '@prisma/client'

const prisma = new PrismaClient()

export async function seedDemoHotel() {
  console.log('🚀 Đang khởi tạo Khách sạn mẫu (Demo Hotel): khach-san-demo.digistay.vn...')

  // 1. Tìm hoặc tạo Workspace demo
  let demoWorkspace = await prisma.workspace.findFirst({
    where: {
      OR: [
        { slug: 'demo-workspace' },
        { slug: 'digistay-demo' },
      ],
    },
  })

  if (!demoWorkspace) {
    // Tìm user làm owner (admin hoặc user đầu tiên)
    let owner = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    })
    if (!owner) {
      owner = await prisma.user.findFirst()
    }
    if (!owner) {
      throw new Error('Chưa có người dùng trong hệ thống để tạo workspace demo')
    }

    demoWorkspace = await prisma.workspace.create({
      data: {
        id: 'ws-demo-hotel-digistay',
        name: 'Digistay Demo Workspace',
        slug: 'demo-workspace',
        description: 'Workspace mẫu phục vụ trải nghiệm và bán hàng cho khách hàng tiềm năng',
        ownerId: owner.id,
      },
    })
    console.log(`✅ Đã tạo Workspace: ${demoWorkspace.name}`)
  }

  // 2. Tạo hoặc cập nhật Cơ sở lưu trú mẫu: khach-san-demo
  const propertySubdomain = 'khach-san-demo'
  const propertySlug = 'khach-san-demo'

  const property = await prisma.property.upsert({
    where: { subdomain: propertySubdomain },
    update: {
      name: 'Digistay Demo Resort & Spa',
      slug: propertySlug,
      type: 'RESORT',
      address: '123 Đường Trần Phú, Phường Lộc Thọ',
      city: 'Nha Trang',
      ward: 'Phường Lộc Thọ',
      provinceCode: '56',
      country: 'Vietnam',
      phone: '0258 3888 999',
      email: 'demo@digistay.vn',
      description: 'Nằm trải dài bên bờ biển Nha Trang thơ mộng, Digistay Demo Resort & Spa mang đến không gian nghỉ dưỡng 4 sao sang trọng với tầm nhìn panorama ôm trọn vịnh biển. Cơ sở tích hợp đầy đủ hồ bơi vô cực, nhà hàng hải sản cao cấp, dịch vụ spa trị liệu và tour trải nghiệm biển đảo.',
      logo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&h=900&fit=crop',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: 'prop-demo-hotel-digistay',
      workspaceId: demoWorkspace.id,
      name: 'Digistay Demo Resort & Spa',
      slug: propertySlug,
      subdomain: propertySubdomain,
      type: 'RESORT',
      address: '123 Đường Trần Phú, Phường Lộc Thọ',
      city: 'Nha Trang',
      ward: 'Phường Lộc Thọ',
      provinceCode: '56',
      country: 'Vietnam',
      phone: '0258 3888 999',
      email: 'demo@digistay.vn',
      description: 'Nằm trải dài bên bờ biển Nha Trang thơ mộng, Digistay Demo Resort & Spa mang đến không gian nghỉ dưỡng 4 sao sang trọng với tầm nhìn panorama ôm trọn vịnh biển. Cơ sở tích hợp đầy đủ hồ bơi vô cực, nhà hàng hải sản cao cấp, dịch vụ spa trị liệu và tour trải nghiệm biển đảo.',
      logo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&h=900&fit=crop',
      isActive: true,
    },
  })
  console.log(`✅ Cơ sở lưu trú mẫu: ${property.name} (https://${property.subdomain}.digistay.vn)`)

  // 3. Xuất bản website (WebsiteSettings) & Cấu hình chính sách
  await prisma.websiteSettings.upsert({
    where: { propertyId: property.id },
    update: {
      isPublished: true,
      publishedAt: new Date(),
      primaryColor: '#0ea5e9',
      secondaryColor: '#10b981',
      accentColor: '#f59e0b',
      fontFamily: 'Inter',
      headingFont: 'Playfair Display',
      metaTitle: 'Digistay Demo Resort & Spa Nha Trang',
      metaDescription: 'Khu nghỉ dưỡng 4 sao cao cấp ven biển Nha Trang. Trải nghiệm dịch vụ nghỉ dưỡng tiêu chuẩn quốc tế.',
    },
    create: {
      propertyId: property.id,
      isPublished: true,
      publishedAt: new Date(),
      primaryColor: '#0ea5e9',
      secondaryColor: '#10b981',
      accentColor: '#f59e0b',
      fontFamily: 'Inter',
      headingFont: 'Playfair Display',
      metaTitle: 'Digistay Demo Resort & Spa Nha Trang',
      metaDescription: 'Khu nghỉ dưỡng 4 sao cao cấp ven biển Nha Trang. Trải nghiệm dịch vụ nghỉ dưỡng tiêu chuẩn quốc tế.',
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
      petsAllowed: false,
      smokingAllowed: false,
      onlineDepositPercent: 50,
    },
  })

  // 4. Bảng giá tiêu chuẩn
  const pricingConfig = await prisma.pricingConfig.upsert({
    where: { id: `pricing-${property.id}` },
    update: {},
    create: {
      id: `pricing-${property.id}`,
      propertyId: property.id,
      name: 'Bảng giá chuẩn 2026',
      weekdayPrice: 950000,
      weekendPrice: 1250000,
      extraAdultPrice: 250000,
      extraChildPrice: 150000,
      isActive: true,
    },
  })

  // 5. Tiện ích cơ sở
  const defaultAmenities = [
    { slug: 'wifi', name: 'Wifi tốc độ cao miễn phí', icon: 'wifi', category: 'internet' },
    { slug: 'ac', name: 'Điều hòa nhiệt độ', icon: 'snowflake', category: 'room' },
    { slug: 'parking', name: 'Bãi đỗ xe an toàn có bảo vệ', icon: 'car', category: 'transport' },
    { slug: 'pool', name: 'Hồ bơi vô cực hướng biển', icon: 'waves', category: 'leisure' },
    { slug: 'restaurant', name: 'Nhà hàng ẩm thực Á - Âu', icon: 'utensils', category: 'dining' },
    { slug: 'spa', name: 'Spa thư giãn & Massage thảo dược', icon: 'sparkles', category: 'wellness' },
  ]

  for (const item of defaultAmenities) {
    const amenity = await prisma.amenity.upsert({
      where: { slug: item.slug },
      update: {},
      create: item,
    })
    await prisma.propertyAmenity.upsert({
      where: {
        propertyId_amenityId: {
          propertyId: property.id,
          amenityId: amenity.id,
        },
      },
      update: { isFeatured: true },
      create: {
        propertyId: property.id,
        amenityId: amenity.id,
        isFeatured: true,
      },
    })
  }

  // 6. 4 Hạng phòng mẫu (RoomTypes) + Ảnh phòng (RoomTypeImage) + Danh sách phòng (Rooms)
  const roomTypesData = [
    {
      name: 'Standard Queen Ocean View',
      slug: 'standard',
      description: 'Phòng nghỉ tiện nghi nhìn ra vịnh biển Nha Trang, trang bị giường Queen êm ái, TV màn hình phẳng, bàn làm việc và minibar.',
      area: 28,
      bedType: BedType.QUEEN,
      maxAdults: 2,
      maxChildren: 1,
      totalRooms: 4,
      baseOccupancy: 2,
      maxOccupancy: 3,
      weekdayPrice: 850000,
      weekendPrice: 1100000,
      image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&h=600&fit=crop',
      rooms: ['101', '102', '103', '104'],
    },
    {
      name: 'Deluxe King Sea Balcony',
      slug: 'deluxe',
      description: 'Phòng Deluxe sang trọng với ban công riêng ngắm biển lộng gió, bồn tắm nằm cao cấp và nội thất gỗ tự nhiên.',
      area: 38,
      bedType: BedType.KING,
      maxAdults: 2,
      maxChildren: 1,
      totalRooms: 4,
      baseOccupancy: 2,
      maxOccupancy: 3,
      weekdayPrice: 1450000,
      weekendPrice: 1750000,
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&h=600&fit=crop',
      rooms: ['201', '202', '203', '204'],
    },
    {
      name: 'Grand Suite Panorama Bay',
      slug: 'suite',
      description: 'Căn hộ Suite thượng lưu với phòng khách tách biệt, tầm nhìn 180 độ bao quát toàn cảnh vịnh Nha Trang và dịch vụ quản gia riêng.',
      area: 58,
      bedType: BedType.KING,
      maxAdults: 3,
      maxChildren: 2,
      totalRooms: 3,
      baseOccupancy: 2,
      maxOccupancy: 5,
      weekdayPrice: 2500000,
      weekendPrice: 3000000,
      image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop',
      rooms: ['301', '302', '303'],
    },
    {
      name: 'Family Connecting Ocean Suite',
      slug: 'family',
      description: 'Không gian lý tưởng cho gia đình 4-6 thành viên với 2 phòng ngủ thông nhau, 2 phòng tắm riêng biệt và ban công lớn.',
      area: 75,
      bedType: BedType.DOUBLE,
      maxAdults: 4,
      maxChildren: 2,
      totalRooms: 3,
      baseOccupancy: 4,
      maxOccupancy: 6,
      weekdayPrice: 3200000,
      weekendPrice: 3800000,
      image: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&h=600&fit=crop',
      rooms: ['401', '402', '403'],
    },
  ]

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
        isActive: true,
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
        isActive: true,
      },
    })

    // Giá phòng
    const existingPricing = await prisma.roomTypePricing.findFirst({
      where: { roomTypeId: roomType.id, pricingId: pricingConfig.id },
    })
    if (!existingPricing) {
      await prisma.roomTypePricing.create({
        data: {
          roomTypeId: roomType.id,
          pricingId: pricingConfig.id,
          weekdayPrice: rt.weekdayPrice,
          weekendPrice: rt.weekendPrice,
        },
      })
    } else {
      await prisma.roomTypePricing.update({
        where: { id: existingPricing.id },
        data: {
          weekdayPrice: rt.weekdayPrice,
          weekendPrice: rt.weekendPrice,
        },
      })
    }

    // Ảnh phòng
    const existingImage = await prisma.roomTypeImage.findFirst({
      where: { roomTypeId: roomType.id },
    })
    if (!existingImage) {
      await prisma.roomTypeImage.create({
        data: {
          roomTypeId: roomType.id,
          url: rt.image,
          isPrimary: true,
          sortOrder: 0,
        },
      })
    } else {
      await prisma.roomTypeImage.update({
        where: { id: existingImage.id },
        data: { url: rt.image, isPrimary: true },
      })
    }

    // Tạo danh sách phòng cụ thể
    for (const roomNum of rt.rooms) {
      await prisma.room.upsert({
        where: {
          propertyId_number: {
            propertyId: property.id,
            number: roomNum,
          },
        },
        update: { roomTypeId: roomType.id },
        create: {
          propertyId: property.id,
          roomTypeId: roomType.id,
          number: roomNum,
          floor: parseInt(roomNum[0], 10),
          isActive: true,
        },
      })
    }

    console.log(`  + Hạng phòng: ${roomType.name} (${rt.weekdayPrice.toLocaleString()} đ)`)
  }

  // 7. Thực đơn nhà hàng (MenuItem)
  const menuItemsData = [
    { name: 'Hải sản nướng vịnh Nha Trang', price: 450000, category: 'Món chính', description: 'Tôm hùm baby, mực lá, sò điệp và ốc hương nướng mỡ hành hoặc sốt bơ tỏi.', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop' },
    { name: 'Bò lúc lắc sốt tiêu đen', price: 280000, category: 'Món chính', description: 'Thịt thăn bò Úc áp chảo thơm lừng, dùng kèm khoai tây chiên giòn và salad tươi.', imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=600&h=400&fit=crop' },
    { name: 'Nộm hoa chuối tai heo giòn', price: 150000, category: 'Khai vị', description: 'Hoa chuối bào mỏng trộn tai heo giòn sần sật, đậu phộng rang và rau thơm.', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop' },
    { name: 'Súp vi cá bào ngư thượng hạng', price: 350000, category: 'Khai vị', description: 'Nước dùng hầm xương gà 12 tiếng, kết hợp bào ngư tươi và nấm đông cô.', imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop' },
    { name: 'Nước ép dưa hấu bạc hà', price: 65000, category: 'Đồ uống', description: 'Dưa hấu tươi ép nguyên chất mát lạnh kết hợp lá bạc hà thanh mát giải nhiệt.', imageUrl: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&h=400&fit=crop' },
    { name: 'Cocktail Sunset Biển Nha Trang', price: 120000, category: 'Đồ uống', description: 'Cocktail nhiệt đới đặc trưng pha chế từ rượu Rum, nước ép dứa, cam và chanh dây.', imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&h=400&fit=crop' },
  ]

  for (let i = 0; i < menuItemsData.length; i++) {
    const item = menuItemsData[i]
    const existing = await prisma.menuItem.findFirst({
      where: { propertyId: property.id, name: item.name },
    })
    if (!existing) {
      await prisma.menuItem.create({
        data: {
          propertyId: property.id,
          name: item.name,
          price: item.price,
          category: item.category,
          description: item.description,
          imageUrl: item.imageUrl,
          sortOrder: i,
          isAvailable: true,
        },
      })
    }
  }
  console.log(`✅ Thực đơn nhà hàng: ${menuItemsData.length} món`)

  // 8. Dịch vụ kèm theo (ExtraService)
  const servicesData = [
    { name: 'Đưa đón sân bay Cam Ranh 2 chiều', price: 350000, category: 'transport', description: 'Xe đưa đón riêng 4-7 chỗ cao cấp, đón đúng giờ tại sân bay quốc tế Cam Ranh.' },
    { name: 'Gói Spa & Thư giãn toàn thân', price: 450000, category: 'wellness', description: '60 phút massage tinh dầu thiên nhiên, xông hơi đá muối Himalaya giảm mệt mỏi.' },
    { name: 'Giặt ủi cao cấp lấy nhanh trong ngày', price: 120000, category: 'laundry', description: 'Dịch vụ giặt sấy, ủi phẳng thơm ngát giao tận phòng trong vòng 6 giờ.' },
    { name: 'Thuê xe máy tham quan thành phố', price: 150000, category: 'transport', description: 'Xe tay ga đời mới, trang bị sẵn 2 nón bảo hiểm và bản đồ du lịch Nha Trang.' },
  ]

  for (const s of servicesData) {
    const existing = await prisma.extraService.findFirst({
      where: { propertyId: property.id, name: s.name },
    })
    if (!existing) {
      await prisma.extraService.create({
        data: {
          propertyId: property.id,
          name: s.name,
          price: s.price,
          priceType: PriceType.FIXED,
          category: s.category,
          description: s.description,
          isActive: true,
          showOnBooking: true,
        },
      })
    }
  }
  console.log(`✅ Dịch vụ gia tăng: ${servicesData.length} dịch vụ`)

  // 9. Bài viết tin tức (BlogPost)
  const blogPostsData = [
    {
      title: 'Top 7 bãi biển đẹp nhất vịnh Nha Trang du khách không thể bỏ lỡ',
      slug: 'top-7-bai-bien-dep-nhat-nha-trang',
      summary: 'Khám phá những bãi biển cát trắng mịn, làn nước trong xanh như ngọc bích tại Nha Trang mùa hè này.',
      content: `Vịnh Nha Trang được mệnh danh là một trong những vịnh biển đẹp nhất thế giới. Dưới đây là 7 bãi biển tuyệt đẹp bạn nhất định phải ghé thăm:
1. Bãi Dài: Nổi tiếng với bờ cát thoai thoải và hải sản tươi ngon.
2. Hòn Tằm: Thiên đường nghỉ dưỡng với rừng cây xanh mướt và biển êm ả.
3. Hòn Mun: Khu bảo tồn sinh vật biển đầu tiên tại Việt Nam, lý tưởng để lặn ngắm san hô.
4. Bãi Tranh: Nơi hội tụ các trò chơi thể thao nước mạo hiểm như dù lượn, motor nước.
5. Đảo Điệp Sơn: Con đường đi bộ giữa biển độc nhất vô nhị.
6. Dốc Lết: Nước nông, sóng êm rất an toàn cho gia đình có trẻ nhỏ.
7. Bãi biển Trần Phú: Con đường ven biển sầm uất ngay trung tâm thành phố.`,
      coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop',
      authorName: 'Digistay Travel Guide',
      isPublished: true,
      publishedAt: new Date(),
    },
    {
      title: 'Cẩm nang du lịch nghỉ dưỡng trọn gói cùng gia đình mùa hè 2026',
      slug: 'cam-nang-du-lich-nghi-duong-gia-dinh-2026',
      summary: 'Chia sẻ kinh nghiệm chuẩn bị lịch trình, chọn phòng và trải nghiệm ẩm thực hoàn hảo cho chuyến đi gia đình.',
      content: `Du lịch cùng gia đình đòi hỏi sự chuẩn bị kỹ lưỡng để mọi thành viên từ trẻ nhỏ đến người lớn tuổi đều có kỳ nghỉ đáng nhớ:
- Lựa chọn phòng connecting room hoặc suite để các thành viên vừa có không gian riêng vừa dễ chăm sóc lẫn nhau.
- Ưu tiên các resort có hồ bơi trẻ em, khu vui chơi và gần bãi biển.
- Đặt trước các dịch vụ đưa đón sân bay để tránh phải chờ đợi mệt mỏi.
- Lên lịch trình nhẹ nhàng, dành nhiều thời gian thư giãn tại khách sạn thay vì di chuyển quá nhiều điểm trong một ngày.`,
      coverImage: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&h=500&fit=crop',
      authorName: 'Ban Biên Tập Digistay',
      isPublished: true,
      publishedAt: new Date(),
    },
  ]

  for (const post of blogPostsData) {
    await prisma.blogPost.upsert({
      where: {
        propertyId_slug: {
          propertyId: property.id,
          slug: post.slug,
        },
      },
      update: {
        title: post.title,
        summary: post.summary,
        content: post.content,
        coverImage: post.coverImage,
        isPublished: true,
        publishedAt: post.publishedAt,
      },
      create: {
        propertyId: property.id,
        title: post.title,
        slug: post.slug,
        summary: post.summary,
        content: post.content,
        coverImage: post.coverImage,
        authorName: post.authorName,
        isPublished: true,
        publishedAt: post.publishedAt,
      },
    })
  }
  console.log(`✅ Bài viết tin tức: ${blogPostsData.length} bài đã xuất bản`)

  // 10. Khối giao diện website (WebsiteBlocks)
  const defaultBlocks = [
    { type: BlockType.HERO, name: 'Banner chính', sortOrder: 0, config: { showSearchBar: true } },
    { type: BlockType.ROOMS, name: 'Hạng phòng nghỉ dưỡng', sortOrder: 1, config: { title: 'Các hạng phòng' } },
    { type: BlockType.AMENITIES, name: 'Tiện ích nổi bật', sortOrder: 2, config: { title: 'Tiện nghi đẳng cấp' } },
    { type: BlockType.ABOUT, name: 'Giới thiệu khu nghỉ dưỡng', sortOrder: 3, config: { title: 'Về chúng tôi' } },
    { type: BlockType.SERVICES, name: 'Dịch vụ kèm theo', sortOrder: 4, config: { title: 'Dịch vụ trải nghiệm' } },
    { type: BlockType.RESTAURANT_MENU, name: 'Thực đơn ẩm thực', sortOrder: 5, config: { title: 'Hương vị biển Nha Trang' } },
    { type: BlockType.GALLERY, name: 'Hình ảnh không gian', sortOrder: 6, config: { title: 'Khoảnh khắc đáng nhớ' } },
    { type: BlockType.REVIEWS, name: 'Đánh giá của khách hàng', sortOrder: 7, config: { title: 'Cảm nhận từ khách hàng' } },
    { type: BlockType.MAP, name: 'Vị trí & Bản đồ', sortOrder: 8, config: {} },
    { type: BlockType.CONTACT, name: 'Liên hệ', sortOrder: 9, config: {} },
  ]

  for (const block of defaultBlocks) {
    const existing = await prisma.websiteBlock.findFirst({
      where: { propertyId: property.id, type: block.type },
    })
    if (!existing) {
      await prisma.websiteBlock.create({
        data: {
          propertyId: property.id,
          type: block.type,
          name: block.name,
          sortOrder: block.sortOrder,
          isEnabled: true,
          config: block.config,
        },
      })
    } else {
      await prisma.websiteBlock.update({
        where: { id: existing.id },
        data: { isEnabled: true, sortOrder: block.sortOrder },
      })
    }
  }
  console.log(`✅ Khối giao diện Website: ${defaultBlocks.length} khối hoạt động`)

  // 11. Đánh giá của khách hàng (Reviews)
  const reviewsData = [
    { guestName: 'Hoàng Anh Tuấn', guestEmail: 'tuan.hoang@example.com', rating: 5, title: 'Kỳ nghỉ tuyệt vời ngoài mong đợi', comment: 'Phòng Deluxe view biển rất đẹp, sáng thức dậy ngắm bình minh ngay trên giường. Hồ bơi sạch, nhân viên lễ tân và nhà hàng cực kỳ chu đáo!', isPublished: true },
    { guestName: 'Phạm Minh Châu', guestEmail: 'chau.pham@example.com', rating: 5, title: 'Resort rất phù hợp cho gia đình', comment: 'Gia đình mình ở phòng Family Connecting rộng rãi, các bé rất thích hồ bơi. Món ăn sáng đa dạng, tươi ngon.', isPublished: true },
    { guestName: 'Michael Chen', guestEmail: 'mchen@traveler.com', rating: 5, title: 'Exceptional service and view', comment: 'Breathtaking ocean view, luxurious suite and very helpful staff. Will definitely come back on my next trip to Vietnam!', isPublished: true },
  ]

  for (const r of reviewsData) {
    const existing = await prisma.review.findFirst({
      where: { propertyId: property.id, guestEmail: r.guestEmail },
    })
    if (!existing) {
      await prisma.review.create({
        data: {
          propertyId: property.id,
          guestName: r.guestName,
          guestEmail: r.guestEmail,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          isPublished: true,
        },
      })
    }
  }

  console.log(`\n🎉 HOÀN TẤT KHỞI TẠO KHÁCH SẠN MẪU!`)
  console.log(`- Subdomain: https://${property.subdomain}.digistay.vn`)
  console.log(`- Website đã xuất bản, 4 hạng phòng đủ ảnh & giá, 6 món thực đơn, 4 dịch vụ, 2 bài viết tin tức.`)
}

if (require.main === module) {
  seedDemoHotel()
    .catch((err) => {
      console.error('❌ Lỗi:', err)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
