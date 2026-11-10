-- ============================================================
-- Khởi tạo Khách sạn mẫu (Demo Hotel): khach-san-demo.digistay.vn
-- Chạy trực tiếp qua docker exec trên VPS:
--   docker exec -i digistay-postgres psql -U digistay -d digistay < scripts/seed-demo-hotel.sql
-- ============================================================

DO $$
DECLARE
  v_user_id TEXT;
  v_workspace_id TEXT := 'ws_demo_hotel_digistay';
  v_property_id TEXT := 'prop_demo_hotel_digistay';
  v_pricing_id TEXT := 'price_demo_hotel_digistay';
  v_rt_standard TEXT := 'rt_demo_standard';
  v_rt_deluxe TEXT := 'rt_demo_deluxe';
  v_rt_suite TEXT := 'rt_demo_suite';
  v_rt_family TEXT := 'rt_demo_family';
BEGIN
  -- 1. Tìm User sở hữu (admin hoặc user bất kỳ)
  SELECT id INTO v_user_id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM users LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    v_user_id := 'usr_digistay_demo';
    INSERT INTO users (id, name, username, email, password, role, "emailVerified", "createdAt", "updatedAt")
    VALUES (v_user_id, 'Digistay Admin', 'admin', 'admin@digistay.vn', '$2a$12$PmWF6tOIkPML8FvaAhwanugiwlGTI33NLJzx4crzXORwYrWzz9H8y', 'SUPER_ADMIN', NOW(), NOW(), NOW());
  END IF;

  -- 2. Workspace Demo
  INSERT INTO workspaces (id, name, slug, description, "ownerId", "createdAt", "updatedAt")
  VALUES (v_workspace_id, 'Digistay Demo Workspace', 'demo-workspace', 'Workspace mẫu phục vụ trải nghiệm và bán hàng cho khách hàng tiềm năng', v_user_id, NOW(), NOW())
  ON CONFLICT (slug) DO UPDATE SET "ownerId" = v_user_id;

  SELECT id INTO v_workspace_id FROM workspaces WHERE slug = 'demo-workspace';

  -- 3. Cơ sở lưu trú (Property): khach-san-demo
  INSERT INTO properties (
    id, "workspaceId", name, slug, subdomain, type, address, city, ward, "provinceCode", country, phone, email,
    description, logo, "coverImage", "isActive", "createdAt", "updatedAt"
  )
  VALUES (
    v_property_id,
    v_workspace_id,
    'Digistay Demo Resort & Spa',
    'khach-san-demo',
    'khach-san-demo',
    'RESORT',
    '123 Đường Trần Phú, Phường Lộc Thọ',
    'Nha Trang',
    'Phường Lộc Thọ',
    '56',
    'Vietnam',
    '0258 3888 999',
    'demo@digistay.vn',
    'Nằm trải dài bên bờ biển Nha Trang thơ mộng, Digistay Demo Resort & Spa mang đến không gian nghỉ dưỡng 4 sao sang trọng với tầm nhìn panorama ôm trọn vịnh biển. Cơ sở tích hợp đầy đủ hồ bơi vô cực, nhà hàng hải sản cao cấp, dịch vụ spa trị liệu và tour trải nghiệm biển đảo.',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&h=900&fit=crop',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (subdomain) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    ward = EXCLUDED.ward,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    description = EXCLUDED.description,
    logo = EXCLUDED.logo,
    "coverImage" = EXCLUDED."coverImage",
    "isActive" = true,
    "deletedAt" = NULL;

  SELECT id INTO v_property_id FROM properties WHERE subdomain = 'khach-san-demo';

  -- 4. Xuất bản website (WebsiteSettings)
  INSERT INTO website_settings (
    id, "propertyId", "primaryColor", "secondaryColor", "accentColor", "fontFamily", "headingFont",
    "metaTitle", "metaDescription", "isPublished", "publishedAt", "createdAt", "updatedAt"
  )
  VALUES (
    'ws_settings_' || v_property_id,
    v_property_id,
    '#0ea5e9',
    '#10b981',
    '#f59e0b',
    'Inter',
    'Playfair Display',
    'Digistay Demo Resort & Spa Nha Trang',
    'Khu nghỉ dưỡng 4 sao cao cấp ven biển Nha Trang. Trải nghiệm dịch vụ nghỉ dưỡng tiêu chuẩn quốc tế.',
    true,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT ("propertyId") DO UPDATE SET
    "isPublished" = true,
    "publishedAt" = NOW();

  -- 5. Chính sách (Policy)
  INSERT INTO policies (id, "propertyId", "checkInTime", "checkOutTime", "childrenAllowed", "minChildAge", "petsAllowed", "smokingAllowed", "onlineDepositPercent")
  VALUES ('pol_' || v_property_id, v_property_id, '14:00', '12:00', true, 0, false, false, 50)
  ON CONFLICT ("propertyId") DO NOTHING;

  -- 6. Bảng giá chuẩn (PricingConfig)
  INSERT INTO pricing_configs (id, "propertyId", name, "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "isActive", "createdAt", "updatedAt")
  VALUES (v_pricing_id, v_property_id, 'Bảng giá chuẩn 2026', 950000, 1250000, 250000, 150000, true, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 7. Hạng phòng 1: Standard
  INSERT INTO room_types (id, "propertyId", name, slug, description, area, "bedType", "maxAdults", "maxChildren", "totalRooms", "availableRooms", "baseOccupancy", "maxOccupancy", "isActive", "createdAt", "updatedAt")
  VALUES (v_rt_standard, v_property_id, 'Standard Queen Ocean View', 'standard', 'Phòng nghỉ tiện nghi nhìn ra vịnh biển Nha Trang, trang bị giường Queen êm ái, TV màn hình phẳng, bàn làm việc và minibar.', 28, 'QUEEN', 2, 1, 4, 4, 2, 3, true, NOW(), NOW())
  ON CONFLICT ("propertyId", slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, "isActive" = true;
  SELECT id INTO v_rt_standard FROM room_types WHERE "propertyId" = v_property_id AND slug = 'standard';

  INSERT INTO room_type_pricing (id, "roomTypeId", "pricingId", "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "createdAt", "updatedAt")
  VALUES ('rtp_std_' || v_property_id, v_rt_standard, v_pricing_id, 850000, 1100000, 250000, 150000, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO room_type_images (id, "roomTypeId", url, "isPrimary", "sortOrder", "createdAt")
  VALUES ('img_std_' || v_property_id, v_rt_standard, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&h=600&fit=crop', true, 0, NOW())
  ON CONFLICT DO NOTHING;

  -- Hạng phòng 2: Deluxe
  INSERT INTO room_types (id, "propertyId", name, slug, description, area, "bedType", "maxAdults", "maxChildren", "totalRooms", "availableRooms", "baseOccupancy", "maxOccupancy", "isActive", "createdAt", "updatedAt")
  VALUES (v_rt_deluxe, v_property_id, 'Deluxe King Sea Balcony', 'deluxe', 'Phòng Deluxe sang trọng với ban công riêng ngắm biển lộng gió, bồn tắm nằm cao cấp và nội thất gỗ tự nhiên.', 38, 'KING', 2, 1, 4, 4, 2, 3, true, NOW(), NOW())
  ON CONFLICT ("propertyId", slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, "isActive" = true;
  SELECT id INTO v_rt_deluxe FROM room_types WHERE "propertyId" = v_property_id AND slug = 'deluxe';

  INSERT INTO room_type_pricing (id, "roomTypeId", "pricingId", "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "createdAt", "updatedAt")
  VALUES ('rtp_dlx_' || v_property_id, v_rt_deluxe, v_pricing_id, 1450000, 1750000, 250000, 150000, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO room_type_images (id, "roomTypeId", url, "isPrimary", "sortOrder", "createdAt")
  VALUES ('img_dlx_' || v_property_id, v_rt_deluxe, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&h=600&fit=crop', true, 0, NOW())
  ON CONFLICT DO NOTHING;

  -- Hạng phòng 3: Suite
  INSERT INTO room_types (id, "propertyId", name, slug, description, area, "bedType", "maxAdults", "maxChildren", "totalRooms", "availableRooms", "baseOccupancy", "maxOccupancy", "isActive", "createdAt", "updatedAt")
  VALUES (v_rt_suite, v_property_id, 'Grand Suite Panorama Bay', 'suite', 'Căn hộ Suite thượng lưu với phòng khách tách biệt, tầm nhìn 180 độ bao quát toàn cảnh vịnh Nha Trang và dịch vụ quản gia riêng.', 58, 'KING', 3, 2, 3, 3, 2, 5, true, NOW(), NOW())
  ON CONFLICT ("propertyId", slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, "isActive" = true;
  SELECT id INTO v_rt_suite FROM room_types WHERE "propertyId" = v_property_id AND slug = 'suite';

  INSERT INTO room_type_pricing (id, "roomTypeId", "pricingId", "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "createdAt", "updatedAt")
  VALUES ('rtp_sui_' || v_property_id, v_rt_suite, v_pricing_id, 2500000, 3000000, 250000, 150000, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO room_type_images (id, "roomTypeId", url, "isPrimary", "sortOrder", "createdAt")
  VALUES ('img_sui_' || v_property_id, v_rt_suite, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop', true, 0, NOW())
  ON CONFLICT DO NOTHING;

  -- Hạng phòng 4: Family
  INSERT INTO room_types (id, "propertyId", name, slug, description, area, "bedType", "maxAdults", "maxChildren", "totalRooms", "availableRooms", "baseOccupancy", "maxOccupancy", "isActive", "createdAt", "updatedAt")
  VALUES (v_rt_family, v_property_id, 'Family Connecting Ocean Suite', 'family', 'Không gian lý tưởng cho gia đình 4-6 thành viên với 2 phòng ngủ thông nhau, 2 phòng tắm riêng biệt và ban công lớn.', 75, 'DOUBLE', 4, 2, 3, 3, 4, 6, true, NOW(), NOW())
  ON CONFLICT ("propertyId", slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, "isActive" = true;
  SELECT id INTO v_rt_family FROM room_types WHERE "propertyId" = v_property_id AND slug = 'family';

  INSERT INTO room_type_pricing (id, "roomTypeId", "pricingId", "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "createdAt", "updatedAt")
  VALUES ('rtp_fam_' || v_property_id, v_rt_family, v_pricing_id, 3200000, 3800000, 250000, 150000, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO room_type_images (id, "roomTypeId", url, "isPrimary", "sortOrder", "createdAt")
  VALUES ('img_fam_' || v_property_id, v_rt_family, 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&h=600&fit=crop', true, 0, NOW())
  ON CONFLICT DO NOTHING;

  -- 8. Danh sách phòng cụ thể (Rooms)
  INSERT INTO rooms (id, "propertyId", "roomTypeId", number, floor, "isActive", "createdAt", "updatedAt")
  VALUES
    ('rm_101_' || v_property_id, v_property_id, v_rt_standard, '101', 1, true, NOW(), NOW()),
    ('rm_102_' || v_property_id, v_property_id, v_rt_standard, '102', 1, true, NOW(), NOW()),
    ('rm_201_' || v_property_id, v_property_id, v_rt_deluxe, '201', 2, true, NOW(), NOW()),
    ('rm_202_' || v_property_id, v_property_id, v_rt_deluxe, '202', 2, true, NOW(), NOW()),
    ('rm_301_' || v_property_id, v_property_id, v_rt_suite, '301', 3, true, NOW(), NOW()),
    ('rm_401_' || v_property_id, v_property_id, v_rt_family, '401', 4, true, NOW(), NOW())
  ON CONFLICT ("propertyId", number) DO UPDATE SET "roomTypeId" = EXCLUDED."roomTypeId";

  -- 9. Thực đơn nhà hàng (menu_items)
  INSERT INTO menu_items (id, "propertyId", name, price, category, description, "imageUrl", "sortOrder", "isAvailable", "createdAt", "updatedAt")
  VALUES
    ('menu_1_' || v_property_id, v_property_id, 'Hải sản nướng vịnh Nha Trang', 450000, 'Món chính', 'Tôm hùm baby, mực lá, sò điệp và ốc hương nướng mỡ hành hoặc sốt bơ tỏi.', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop', 0, true, NOW(), NOW()),
    ('menu_2_' || v_property_id, v_property_id, 'Bò lúc lắc sốt tiêu đen', 280000, 'Món chính', 'Thịt thăn bò Úc áp chảo thơm lừng, dùng kèm khoai tây chiên giòn và salad tươi.', 'https://images.unsplash.com/photo-1558030006-450675393462?w=600&h=400&fit=crop', 1, true, NOW(), NOW()),
    ('menu_3_' || v_property_id, v_property_id, 'Nộm hoa chuối tai heo giòn', 150000, 'Khai vị', 'Hoa chuối bào mỏng trộn tai heo giòn sần sật, đậu phộng rang và rau thơm.', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop', 2, true, NOW(), NOW()),
    ('menu_4_' || v_property_id, v_property_id, 'Súp vi cá bào ngư thượng hạng', 350000, 'Khai vị', 'Nước dùng hầm xương gà 12 tiếng, kết hợp bào ngư tươi và nấm đông cô.', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop', 3, true, NOW(), NOW()),
    ('menu_5_' || v_property_id, v_property_id, 'Nước ép dưa hấu bạc hà', 65000, 'Đồ uống', 'Dưa hấu tươi ép nguyên chất mát lạnh kết hợp lá bạc hà thanh mát giải nhiệt.', 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&h=400&fit=crop', 4, true, NOW(), NOW()),
    ('menu_6_' || v_property_id, v_property_id, 'Cocktail Sunset Biển Nha Trang', 120000, 'Đồ uống', 'Cocktail nhiệt đới đặc trưng pha chế từ rượu Rum, nước ép dứa, cam và chanh dây.', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&h=400&fit=crop', 5, true, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- 10. Dịch vụ (extra_services)
  INSERT INTO extra_services (id, "propertyId", name, price, "priceType", category, description, "isActive", "showOnBooking", "createdAt", "updatedAt")
  VALUES
    ('srv_1_' || v_property_id, v_property_id, 'Đưa đón sân bay Cam Ranh 2 chiều', 350000, 'FIXED', 'transport', 'Xe đưa đón riêng 4-7 chỗ cao cấp, đón đúng giờ tại sân bay quốc tế Cam Ranh.', true, true, NOW(), NOW()),
    ('srv_2_' || v_property_id, v_property_id, 'Gói Spa & Thư giãn toàn thân', 450000, 'FIXED', 'wellness', '60 phút massage tinh dầu thiên nhiên, xông hơi đá muối Himalaya giảm mệt mỏi.', true, true, NOW(), NOW()),
    ('srv_3_' || v_property_id, v_property_id, 'Giặt ủi cao cấp lấy nhanh trong ngày', 120000, 'FIXED', 'laundry', 'Dịch vụ giặt sấy, ủi phẳng thơm ngát giao tận phòng trong vòng 6 giờ.', true, true, NOW(), NOW()),
    ('srv_4_' || v_property_id, v_property_id, 'Thuê xe máy tham quan thành phố', 150000, 'FIXED', 'transport', 'Xe tay ga đời mới, trang bị sẵn 2 nón bảo hiểm và bản đồ du lịch Nha Trang.', true, true, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- 11. Bài viết tin tức (blog_posts)
  INSERT INTO blog_posts (id, "propertyId", title, slug, summary, content, "coverImage", "authorName", "isPublished", "publishedAt", "createdAt", "updatedAt")
  VALUES
    (
      'post_1_' || v_property_id,
      v_property_id,
      'Top 7 bãi biển đẹp nhất vịnh Nha Trang du khách không thể bỏ lỡ',
      'top-7-bai-bien-dep-nhat-nha-trang',
      'Khám phá những bãi biển cát trắng mịn, làn nước trong xanh như ngọc bích tại Nha Trang mùa hè này.',
      'Vịnh Nha Trang được mệnh danh là một trong những vịnh biển đẹp nhất thế giới với vô vàn cảnh sắc thiên nhiên tuyệt đẹp...',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop',
      'Digistay Travel Guide',
      true,
      NOW(),
      NOW(),
      NOW()
    ),
    (
      'post_2_' || v_property_id,
      v_property_id,
      'Cẩm nang du lịch nghỉ dưỡng trọn gói cùng gia đình mùa hè 2026',
      'cam-nang-du-lich-nghi-duong-gia-dinh-2026',
      'Chia sẻ kinh nghiệm chuẩn bị lịch trình, chọn phòng và trải nghiệm ẩm thực hoàn hảo cho chuyến đi gia đình.',
      'Du lịch cùng gia đình đòi hỏi sự chuẩn bị kỹ lưỡng để mọi thành viên từ trẻ nhỏ đến người lớn tuổi đều có kỳ nghỉ đáng nhớ...',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&h=500&fit=crop',
      'Ban Biên Tập Digistay',
      true,
      NOW(),
      NOW(),
      NOW()
    )
  ON CONFLICT ("propertyId", slug) DO UPDATE SET "isPublished" = true, "publishedAt" = NOW();

  -- 12. Khối giao diện (website_blocks)
  INSERT INTO website_blocks (id, "propertyId", type, name, "sortOrder", "isEnabled", config, "createdAt", "updatedAt")
  VALUES
    ('blk_0_' || v_property_id, v_property_id, 'HERO', 'Banner chính', 0, true, '{"showSearchBar": true}', NOW(), NOW()),
    ('blk_1_' || v_property_id, v_property_id, 'ROOMS', 'Hạng phòng nghỉ dưỡng', 1, true, '{"title": "Các hạng phòng"}', NOW(), NOW()),
    ('blk_2_' || v_property_id, v_property_id, 'AMENITIES', 'Tiện ích nổi bật', 2, true, '{"title": "Tiện nghi đẳng cấp"}', NOW(), NOW()),
    ('blk_3_' || v_property_id, v_property_id, 'ABOUT', 'Giới thiệu khu nghỉ dưỡng', 3, true, '{"title": "Về chúng tôi"}', NOW(), NOW()),
    ('blk_4_' || v_property_id, v_property_id, 'SERVICES', 'Dịch vụ kèm theo', 4, true, '{"title": "Dịch vụ trải nghiệm"}', NOW(), NOW()),
    ('blk_5_' || v_property_id, v_property_id, 'RESTAURANT_MENU', 'Thực đơn ẩm thực', 5, true, '{"title": "Hương vị biển Nha Trang"}', NOW(), NOW()),
    ('blk_6_' || v_property_id, v_property_id, 'GALLERY', 'Hình ảnh không gian', 6, true, '{"title": "Khoảnh khắc đáng nhớ"}', NOW(), NOW()),
    ('blk_7_' || v_property_id, v_property_id, 'REVIEWS', 'Đánh giá khách hàng', 7, true, '{"title": "Cảm nhận từ khách hàng"}', NOW(), NOW()),
    ('blk_8_' || v_property_id, v_property_id, 'MAP', 'Vị trí & Bản đồ', 8, true, '{}', NOW(), NOW()),
    ('blk_9_' || v_property_id, v_property_id, 'CONTACT', 'Liên hệ', 9, true, '{}', NOW(), NOW())
  ON CONFLICT DO NOTHING;

END $$;
