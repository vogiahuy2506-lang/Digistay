/**
 * TASK 57: KIỂM THỬ CHỊU TẢI & CHỐNG BÁN TRÙNG PHÒNG (ZERO OVERBOOKING TEST)
 *
 * Kịch bản:
 * - Khởi tạo hạng phòng có đúng 01 phòng duy nhất (totalRooms = 1).
 * - Bắn đồng thời 100 requests (Promise.all) trong cùng 1 giây cố gắng đặt phòng cùng ngày.
 * - Kiểm chứng cơ chế Row Locking (SELECT ... FOR UPDATE) và ACID Transaction:
 *   + Đúng 01 request thành công.
 *   + 99 requests bị từ chối có kiểm soát với mã lỗi 409 (Conflict).
 *   + 0 deadlock, 0 rò rỉ dữ liệu, tổng số booking trong DB đúng bằng 1.
 *
 * Cách chạy:
 *   npx tsx scripts/test-task-57-load-overbooking.ts [--concurrency 100]
 */
import { PrismaClient } from '@prisma/client'
import { createBooking, BookingError } from '../src/lib/bookings/create-booking'
import { roomsTaken } from '../src/lib/bookings/occupancy'
import { createTenant, createRoomType, publishSite } from '../src/test/integration/fixtures'

const prisma = new PrismaClient()

interface RequestResult {
  index: number
  success: boolean
  status: number
  message: string
  durationMs: number
}

function calculatePercentile(sortedNumbers: number[], percentile: number): number {
  if (sortedNumbers.length === 0) return 0
  const index = Math.ceil((percentile / 100) * sortedNumbers.length) - 1
  return sortedNumbers[Math.max(0, Math.min(index, sortedNumbers.length - 1))]
}

async function runTask57Test() {
  const args = process.argv.slice(2)
  const concurrencyArgIndex = args.indexOf('--concurrency')
  const CONCURRENCY = concurrencyArgIndex !== -1 ? parseInt(args[concurrencyArgIndex + 1], 10) || 100 : 100

  console.log(`\n================================================================================`)
  console.log(`   DIGISTAY - KIỂM THỬ CHỊU TẢI & CHỐNG BÁN TRÙNG PHÒNG (TASK 57)`)
  console.log(`================================================================================`)
  console.log(`Khởi tạo môi trường thử nghiệm với ${CONCURRENCY} luồng đồng thời...`)

  const timestamp = Date.now().toString(36)

  // 1. Tạo Tenant và Hạng phòng có đúng 01 phòng duy nhất
  const { property, workspace } = await createTenant()
  await publishSite(property.id)

  const roomType = await createRoomType(property.id, {
    name: 'Phòng Tổng Thống VIP (Độc Bản - Task 57)',
    totalRooms: 1,
    weekdayPrice: 1_500_000,
    weekendPrice: 2_000_000,
    baseOccupancy: 2,
    maxAdults: 2,
    maxChildren: 1,
  })

  // Chọn ngày lưu trú: 2 đêm
  const now = new Date()
  const checkIn = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 14, 0, 0)
  const checkOut = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 12, 0, 0)

  console.log(`\n[Thông tin thử nghiệm]`)
  console.log(`- Cơ sở lưu trú : ${property.name} (${property.id})`)
  console.log(`- Hạng phòng    : ${roomType.name} (TỔNG SỐ PHÒNG: 1)`)
  console.log(`- Kỳ lưu trú    : ${checkIn.toISOString().slice(0, 10)} -> ${checkOut.toISOString().slice(0, 10)} (2 đêm)`)
  console.log(`- Tải giả lập   : ${CONCURRENCY} luồng cùng bấm đặt phòng trong 1 giây...`)
  console.log(`\n⏳ Đang kích hoạt đồng thời ${CONCURRENCY} requests...`)

  const testStartTime = Date.now()

  // 2. Chạy CONCURRENCY requests đồng thời bằng Promise.all
  const promises = Array.from({ length: CONCURRENCY }, async (_, i) => {
    const reqStart = Date.now()
    const guestNumber = i + 1
    try {
      const res = await createBooking({
        propertyId: property.id,
        roomTypeId: roomType.id,
        guestName: `Khách hàng giả lập #${guestNumber}`,
        guestEmail: `guest_${guestNumber}_${timestamp}@test.vn`,
        guestPhone: `090${String(guestNumber).padStart(7, '0')}`,
        checkIn,
        checkOut,
        numAdults: 2,
        numChildren: 0,
        locale: 'vi',
      })
      const reqDuration = Date.now() - reqStart
      return {
        index: guestNumber,
        success: true,
        status: 200,
        message: `Thành công: Mã đặt phòng ${res.booking.bookingCode}`,
        durationMs: reqDuration,
      } as RequestResult
    } catch (err) {
      const reqDuration = Date.now() - reqStart
      if (err instanceof BookingError) {
        return {
          index: guestNumber,
          success: false,
          status: err.status,
          message: err.message,
          durationMs: reqDuration,
        } as RequestResult
      }
      return {
        index: guestNumber,
        success: false,
        status: 500,
        message: (err as Error).message,
        durationMs: reqDuration,
      } as RequestResult
    }
  })

  const results = await Promise.all(promises)
  const totalDurationMs = Date.now() - testStartTime

  // 3. Phân tích kết quả
  const successes = results.filter((r) => r.success)
  const conflicts409 = results.filter((r) => !r.success && r.status === 409)
  const deadlocksOrErrors500 = results.filter((r) => r.status >= 500 || r.status === 0)

  // 4. Kiểm tra trong cơ sở dữ liệu thực tế
  const actualDbBookings = await prisma.booking.findMany({
    where: { propertyId: property.id },
  })

  const takenRoomsInDb = await roomsTaken(prisma, roomType.id, {
    propertyId: property.id,
    checkIn,
    checkOut,
  })

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b)
  const minLatency = durations[0] || 0
  const maxLatency = durations[durations.length - 1] || 0
  const avgLatency = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
  const p50 = calculatePercentile(durations, 50)
  const p90 = calculatePercentile(durations, 90)
  const p95 = calculatePercentile(durations, 95)
  const p99 = calculatePercentile(durations, 99)

  console.log(`\n================================================================================`)
  console.log(`                          BÁO CÁO KẾT QUẢ TASK 57`)
  console.log(`================================================================================`)
  console.log(`Tổng số request gửi đi            : ${CONCURRENCY}`)
  console.log(`Tổng thời gian thực thi           : ${totalDurationMs} ms (${(CONCURRENCY / (totalDurationMs / 1000)).toFixed(1)} req/sec)`)
  console.log(`--------------------------------------------------------------------------------`)
  console.log(`Số đơn ĐẶT THÀNH CÔNG (200 OK)    : ${successes.length} / ${CONCURRENCY}  (Kỳ vọng: Đúng 1)`)
  console.log(`Số đơn BỊ TỪ CHỐI (409 Conflict)  : ${conflicts409.length} / ${CONCURRENCY}  (Kỳ vọng: Đúng ${CONCURRENCY - 1})`)
  console.log(`Số lỗi hệ thống / Deadlock (500)  : ${deadlocksOrErrors500.length}       (Kỳ vọng: 0)`)
  console.log(`--------------------------------------------------------------------------------`)
  console.log(`Số đơn lưu thực tế trong Database : ${actualDbBookings.length}       (Kỳ vọng: Đúng 1)`)
  console.log(`Số phòng bị chiếm dụng trong DB   : ${takenRoomsInDb} / 1   (Kỳ vọng: 1)`)
  console.log(`--------------------------------------------------------------------------------`)
  console.log(`HIỆU NĂNG ĐỘ TRỄ (LATENCY):`)
  console.log(`- Nhanh nhất (Min)                : ${minLatency} ms`)
  console.log(`- Trung bình (Avg)                : ${avgLatency} ms`)
  console.log(`- Trung vị (P50)                  : ${p50} ms`)
  console.log(`- P90                             : ${p90} ms`)
  console.log(`- P95                             : ${p95} ms`)
  console.log(`- Chậm nhất (Max)                 : ${maxLatency} ms`)
  console.log(`--------------------------------------------------------------------------------`)

  if (successes.length > 0) {
    console.log(`Đơn thành công duy nhất: ${successes[0].message} (xử lý trong ${successes[0].durationMs} ms)`)
  }
  if (conflicts409.length > 0) {
    console.log(`Thông báo từ chối 409  : "${conflicts409[0].message}"`)
  }

  // Tiêu chí kiểm định Task 57
  const isZeroOverbookingPassed =
    successes.length === 1 &&
    conflicts409.length === CONCURRENCY - 1 &&
    deadlocksOrErrors500.length === 0 &&
    actualDbBookings.length === 1 &&
    takenRoomsInDb === 1

  console.log(`================================================================================`)
  if (isZeroOverbookingPassed) {
    console.log(`🎯 KẾT LUẬN: ĐẠT TIÊU CHUẨN XUẤT XƯỞNG TUYỆT ĐỐI (ZERO OVERBOOKING VERIFIED)!`)
    console.log(`   Cơ chế Khóa bi quan Row Locking (SELECT ... FOR UPDATE) hoạt động chuẩn xác 100%.`)
  } else {
    console.error(`❌ KẾT LUẬN: THỬ NGHIỆM KHÔNG ĐẠT TIÊU CHUẨN!`)
  }
  console.log(`================================================================================\n`)

  // 5. Dọn dẹp dữ liệu thử nghiệm
  console.log(`Đang dọn dẹp dữ liệu thử nghiệm...`)
  await prisma.bookingItem.deleteMany({ where: { roomTypeId: roomType.id } })
  await prisma.booking.deleteMany({ where: { propertyId: property.id } })
  await prisma.roomTypePricing.deleteMany({ where: { roomTypeId: roomType.id } })
  await prisma.roomType.deleteMany({ where: { id: roomType.id } })
  await prisma.pricingConfig.deleteMany({ where: { propertyId: property.id } })
  await prisma.websiteSettings.deleteMany({ where: { propertyId: property.id } })
  await prisma.property.deleteMany({ where: { id: property.id } })
  await prisma.workspace.deleteMany({ where: { id: workspace.id } })
  console.log(`✓ Đã dọn dẹp xong dữ liệu thử nghiệm Task 57.`)

  if (!isZeroOverbookingPassed) {
    process.exit(1)
  }
}

runTask57Test()
  .catch((e) => {
    console.error('Lỗi khi chạy kịch bản thử nghiệm Task 57:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
