-- ============================================================
-- Khởi tạo Workspace Demo hoàn chỉnh cho tài khoản nhphuc
-- Chạy trực tiếp qua docker exec trên VPS:
--   docker exec -i digistay-postgres psql -U digistay -d digistay < scripts/seed-nhphuc.sql
-- ============================================================

DO $$
DECLARE
  v_user_id TEXT;
  v_workspace_id TEXT := 'ws_nhphuc_demo_01';
  v_property_id TEXT := 'prop_nhphuc_demo_01';
  v_pricing_id TEXT := 'price_nhphuc_demo_01';
  v_rt_deluxe TEXT := 'rt_nhphuc_deluxe_01';
  v_rt_suite TEXT := 'rt_nhphuc_suite_01';
  v_rt_superior TEXT := 'rt_nhphuc_superior_01';
  v_room_201 TEXT := 'rm_nhphuc_201';
  v_room_301 TEXT := 'rm_nhphuc_301';
  v_booking1_id TEXT := 'bk_nhphuc_01';
  v_booking2_id TEXT := 'bk_nhphuc_02';
BEGIN
  -- 1. Tìm hoặc tạo User nhphuc
  SELECT id INTO v_user_id FROM users WHERE username = 'nhphuc' OR email = 'nhphuc@digistay.vn' OR email ILIKE 'nhphuc%' LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := 'usr_nhphuc_01';
    INSERT INTO users (id, name, username, email, password, role, phone, "emailVerified", "createdAt", "updatedAt")
    VALUES (v_user_id, 'Nguyễn Hồng Phúc', 'nhphuc', 'nhphuc@digistay.vn', '$2a$12$PmWF6tOIkPML8FvaAhwanugiwlGTI33NLJzx4crzXORwYrWzz9H8y', 'USER', '0905888999', NOW(), NOW(), NOW());
  ELSE
    UPDATE users SET username = 'nhphuc' WHERE id = v_user_id AND (username IS NULL OR username = '');
  END IF;

  -- 2. Workspace
  INSERT INTO workspaces (id, name, slug, description, "ownerId", "createdAt", "updatedAt")
  VALUES (v_workspace_id, 'Digistay Riverside Resort Đà Nẵng', 'nhphuc-resort', 'Khu nghỉ dưỡng 4 sao phong cách Boutique ven sông Hàn, Đà Nẵng', v_user_id, NOW(), NOW())
  ON CONFLICT (slug) DO UPDATE SET "ownerId" = v_user_id;

  SELECT id INTO v_workspace_id FROM workspaces WHERE slug = 'nhphuc-resort';

  -- Gán quyền ADMIN trong workspace
  INSERT INTO workspace_members (id, "workspaceId", "userId", role, "joinedAt")
  VALUES ('wm_nhphuc_01', v_workspace_id, v_user_id, 'ADMIN', NOW())
  ON CONFLICT ("workspaceId", "userId") DO UPDATE SET role = 'ADMIN';

  -- 3. Property
  INSERT INTO properties (id, "workspaceId", name, slug, subdomain, type, address, city, ward, "provinceCode", country, phone, email, description, logo, "coverImage", "isActive", "createdAt", "updatedAt")
  VALUES (
    v_property_id,
    v_workspace_id,
    'Digistay Riverside Boutique Resort',
    'riverside-boutique-danang',
    'nhphuc',
    'RESORT',
    '36 Bạch Đằng, Phường Thạch Thang, Quận Hải Châu',
    'Đà Nẵng',
    'Phường Thạch Thang',
    '48',
    'Vietnam',
    '0905 888 999',
    'nhphuc.resort@digistay.vn',
    'Nằm bên bờ sông Hàn thơ mộng, Digistay Riverside Boutique Resort mang đến trải nghiệm nghỉ dưỡng tiện nghi, hiện đại kết hợp văn hóa địa phương. Hồ bơi vô cực ngắm trọn Cầu Rồng, quầy bar tầng thượng và dịch vụ tiêu chuẩn 4 sao.',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&h=900&fit=crop',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (subdomain) DO UPDATE SET
    "workspaceId" = v_workspace_id,
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    description = EXCLUDED.description,
    "deletedAt" = NULL;

  SELECT id INTO v_property_id FROM properties WHERE subdomain = 'nhphuc';

  -- 4. WebsiteSettings & Policy
  INSERT INTO website_settings (id, "propertyId", "primaryColor", "secondaryColor", "metaTitle", "metaDescription", layout, "isPublished", "publishedAt", "createdAt", "updatedAt")
  VALUES ('ws_set_' || v_property_id, v_property_id, '#0ea5e9', '#10b981', 'Digistay Riverside Boutique Resort Đà Nẵng', 'Khu nghỉ dưỡng 4 sao phong cách Boutique ven sông Hàn, Đà Nẵng', 'modern', true, NOW(), NOW(), NOW())
  ON CONFLICT ("propertyId") DO UPDATE SET "primaryColor" = '#0ea5e9', "isPublished" = true;

  INSERT INTO policies (id, "propertyId", "checkInTime", "checkOutTime", "childrenAllowed", "minChildAge", "petsAllowed", "smokingAllowed", "onlineDepositPercent", "createdAt", "updatedAt")
  VALUES ('pol_' || v_property_id, v_property_id, '14:00', '12:00', true, 0, true, false, 50, NOW(), NOW())
  ON CONFLICT ("propertyId") DO NOTHING;

  -- 5. PricingConfig
  INSERT INTO pricing_configs (id, "propertyId", name, "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "isActive", "createdAt", "updatedAt")
  VALUES (v_pricing_id, v_property_id, 'Bảng giá chuẩn 2026', 1200000, 1500000, 250000, 150000, true, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET "propertyId" = v_property_id;

  -- 6. Room Types & Rooms
  -- Deluxe
  INSERT INTO room_types (id, "propertyId", name, slug, description, area, "bedType", "maxAdults", "maxChildren", "totalRooms", "availableRooms", "baseOccupancy", "maxOccupancy", "createdAt", "updatedAt")
  VALUES (v_rt_deluxe, v_property_id, 'Deluxe King River View', 'deluxe-king-river-view', 'Phòng Deluxe hướng trực diện sông Hàn với ban công riêng biệt, bồn tắm nằm cao cấp.', 36, 'KING', 2, 1, 5, 5, 2, 3, NOW(), NOW())
  ON CONFLICT ("propertyId", slug) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO v_rt_deluxe FROM room_types WHERE "propertyId" = v_property_id AND slug = 'deluxe-king-river-view';

  INSERT INTO room_type_pricing (id, "roomTypeId", "pricingId", "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "createdAt", "updatedAt")
  VALUES ('rtp_deluxe_' || v_property_id, v_rt_deluxe, v_pricing_id, 1250000, 1550000, 250000, 150000, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET "weekdayPrice" = 1250000, "weekendPrice" = 1550000;

  -- Suite
  INSERT INTO room_types (id, "propertyId", name, slug, description, area, "bedType", "maxAdults", "maxChildren", "totalRooms", "availableRooms", "baseOccupancy", "maxOccupancy", "createdAt", "updatedAt")
  VALUES (v_rt_suite, v_property_id, 'Grand Suite Balcony', 'grand-suite-balcony', 'Căn hộ Suite sang trọng với phòng khách riêng, tầm nhìn Panorama 180 độ ôm trọn Cầu Rồng.', 58, 'KING', 3, 2, 3, 3, 2, 5, NOW(), NOW())
  ON CONFLICT ("propertyId", slug) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO v_rt_suite FROM room_types WHERE "propertyId" = v_property_id AND slug = 'grand-suite-balcony';

  INSERT INTO room_type_pricing (id, "roomTypeId", "pricingId", "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "createdAt", "updatedAt")
  VALUES ('rtp_suite_' || v_property_id, v_rt_suite, v_pricing_id, 2300000, 2800000, 300000, 200000, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET "weekdayPrice" = 2300000, "weekendPrice" = 2800000;

  -- Superior
  INSERT INTO room_types (id, "propertyId", name, slug, description, area, "bedType", "maxAdults", "maxChildren", "totalRooms", "availableRooms", "baseOccupancy", "maxOccupancy", "createdAt", "updatedAt")
  VALUES (v_rt_superior, v_property_id, 'Superior Garden View', 'superior-garden-view', 'Phòng tiêu chuẩn nhìn ra khu vườn nhiệt đới yên tĩnh, đầy đủ tiện nghi.', 28, 'QUEEN', 2, 1, 4, 4, 2, 3, NOW(), NOW())
  ON CONFLICT ("propertyId", slug) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO v_rt_superior FROM room_types WHERE "propertyId" = v_property_id AND slug = 'superior-garden-view';

  INSERT INTO room_type_pricing (id, "roomTypeId", "pricingId", "weekdayPrice", "weekendPrice", "extraAdultPrice", "extraChildPrice", "createdAt", "updatedAt")
  VALUES ('rtp_sup_' || v_property_id, v_rt_superior, v_pricing_id, 850000, 1050000, 200000, 100000, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET "weekdayPrice" = 850000, "weekendPrice" = 1050000;

  -- Rooms
  INSERT INTO rooms (id, "propertyId", "roomTypeId", number, floor, "isActive", "createdAt", "updatedAt")
  VALUES
    (v_room_201, v_property_id, v_rt_deluxe, '201', 2, true, NOW(), NOW()),
    ('rm_nhphuc_202', v_property_id, v_rt_deluxe, '202', 2, true, NOW(), NOW()),
    ('rm_nhphuc_203', v_property_id, v_rt_deluxe, '203', 2, true, NOW(), NOW()),
    (v_room_301, v_property_id, v_rt_suite, '301', 3, true, NOW(), NOW()),
    ('rm_nhphuc_302', v_property_id, v_rt_suite, '302', 3, true, NOW(), NOW()),
    ('rm_nhphuc_101', v_property_id, v_rt_superior, '101', 1, true, NOW(), NOW()),
    ('rm_nhphuc_102', v_property_id, v_rt_superior, '102', 1, true, NOW(), NOW())
  ON CONFLICT ("propertyId", number) DO UPDATE SET "roomTypeId" = EXCLUDED."roomTypeId";

  -- 7. Extra Services
  INSERT INTO extra_services (id, "propertyId", name, category, price, "priceType", "perPerson", "isActive", "createdAt", "updatedAt")
  VALUES
    ('srv_nhphuc_01', v_property_id, 'Thuê xe máy Honda AirBlade', 'transport', 150000, 'PER_NIGHT', false, true, NOW(), NOW()),
    ('srv_nhphuc_02', v_property_id, 'Đưa đón sân bay Đà Nẵng 2 chiều', 'transport', 350000, 'FIXED', false, true, NOW(), NOW()),
    ('srv_nhphuc_03', v_property_id, 'Bữa sáng Buffet Á-Âu tại nhà hàng', 'food', 150000, 'PER_PERSON', true, true, NOW(), NOW()),
    ('srv_nhphuc_04', v_property_id, 'Set trà chiều hoàng hôn Rooftop', 'entertainment', 220000, 'FIXED', false, true, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 8. Bank Account (VietQR)
  INSERT INTO bank_accounts (id, "propertyId", "bankName", "bankCode", "accountNumber", "accountHolder", "isActive", "createdAt", "updatedAt")
  VALUES ('bank_nhphuc_01', v_property_id, 'MBBank', 'MB', '0905888999', 'NGUYEN HONG PHUC', true, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 9. Customers
  INSERT INTO customer_profiles (id, "propertyId", name, email, phone, tags, "totalStays", "totalSpent", notes, "createdAt", "updatedAt")
  VALUES
    ('cust_nhphuc_01', v_property_id, 'Nguyễn Văn Hùng', 'hung.nguyen@example.com', '0912345678', ARRAY['VIP', 'Thân thiết'], 3, 12500000, 'Thích phòng tầng cao, view sông Hàn', NOW(), NOW()),
    ('cust_nhphuc_02', v_property_id, 'Trần Thị Mai', 'mai.tran@example.com', '0987654321', ARRAY['Gia đình'], 2, 7800000, 'Cần nôi cho em bé', NOW(), NOW())
  ON CONFLICT ("propertyId", email, phone) DO UPDATE SET "totalStays" = EXCLUDED."totalStays";

  -- 10. Sample Bookings
  -- Booking 1: CHECKED_IN
  INSERT INTO bookings (id, "bookingCode", "propertyId", "guestName", "guestEmail", "guestPhone", "checkInDate", "checkOutDate", "numAdults", "numChildren", status, subtotal, "extraCharges", "totalAmount", "depositAmount", "paymentStatus", "paymentMethod", source, "actualCheckIn", "createdAt", "updatedAt")
  VALUES (v_booking1_id, 'BK-RIV-001', v_property_id, 'Nguyễn Văn Hùng', 'hung.nguyen@example.com', '0912345678', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', 2, 0, 'CHECKED_IN', 2500000, 300000, 2800000, 2800000, 'PAID', 'BANK_TRANSFER', 'DIRECT', NOW() - INTERVAL '1 day', NOW(), NOW())
  ON CONFLICT ("bookingCode") DO UPDATE SET status = 'CHECKED_IN';

  INSERT INTO booking_items (id, "bookingId", "roomTypeId", "roomId", "roomNumber", "checkInDate", "checkOutDate", "basePrice", "totalPrice", "createdAt")
  VALUES ('bki_nhphuc_01', v_booking1_id, v_rt_deluxe, v_room_201, '201', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', 1250000, 2500000, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Booking 2: CONFIRMED
  INSERT INTO bookings (id, "bookingCode", "propertyId", "guestName", "guestEmail", "guestPhone", "checkInDate", "checkOutDate", "numAdults", "numChildren", status, subtotal, "extraCharges", "totalAmount", "depositAmount", "paymentStatus", "paymentMethod", source, "createdAt", "updatedAt")
  VALUES (v_booking2_id, 'BK-RIV-002', v_property_id, 'Trần Thị Mai', 'mai.tran@example.com', '0987654321', NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', 2, 2, 'CONFIRMED', 4600000, 400000, 5000000, 2500000, 'PARTIAL', 'QR_VIETQR', 'DIRECT', NOW(), NOW())
  ON CONFLICT ("bookingCode") DO UPDATE SET status = 'CONFIRMED';

  INSERT INTO booking_items (id, "bookingId", "roomTypeId", "roomId", "roomNumber", "checkInDate", "checkOutDate", "basePrice", "totalPrice", "createdAt")
  VALUES ('bki_nhphuc_02', v_booking2_id, v_rt_suite, v_room_301, '301', NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', 2300000, 4600000, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 11. Review
  INSERT INTO reviews (id, "propertyId", "bookingId", "guestName", "guestEmail", rating, title, comment, "isPublished", "createdAt", "updatedAt")
  VALUES ('rev_nhphuc_01', v_property_id, v_booking1_id, 'Nguyễn Văn Hùng', 'hung.nguyen@example.com', 5, 'Kỳ nghỉ tuyệt vời bên sông Hàn', 'Khách sạn view ngắm Cầu Rồng rất đẹp, phòng Deluxe sạch sẽ, dịch vụ chu đáo. Bữa sáng phong phú, gia đình tôi sẽ quay lại!', true, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Hoàn tất khởi tạo dữ liệu demo cho tài khoản nhphuc!';
END $$;

