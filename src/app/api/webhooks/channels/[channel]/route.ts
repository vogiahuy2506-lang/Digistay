import { NextRequest, NextResponse } from 'next/server'
import { OtaChannel } from '@/lib/ota/types'
import { processOtaInboundWebhook } from '@/lib/ota/sync-engine'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit } from '@/lib/security/rate-limit'

const VALID_CHANNELS = new Set<string>(['AGODA', 'BOOKING_COM', 'AIRBNB', 'TRAVELOKA', 'EXPEDIA'])

/**
 * Public Webhook endpoint for OTAs (Agoda, Booking.com, Airbnb, Traveloka, Expedia).
 * Inbound sync for new bookings, modifications, and cancellations.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ channel: string }> }
) {
  const { channel: rawChannel } = await props.params
  const channel = rawChannel.toUpperCase() as OtaChannel

  if (!VALID_CHANNELS.has(channel)) {
    return NextResponse.json({ error: 'Kênh phân phối không hợp lệ' }, { status: 400 })
  }

  // Rate limiting per IP
  const clientIp = getClientIp(request.headers)
  const limited = await hit(LIMITS.payosWebhookIp, `ota-${channel}-${clientIp}`)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
    )
  }

  const rawBody = await request.text()
  let payload: any

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Dữ liệu webhook không hợp lệ (Invalid JSON)' }, { status: 400 })
  }

  const signatureHeader =
    request.headers.get('x-ota-signature') ||
    request.headers.get('x-webhook-signature') ||
    request.headers.get('x-signature')

  const searchParams = request.nextUrl.searchParams
  const fallbackHotelId = searchParams.get('hotelId') || searchParams.get('propertyId')

  if (!payload.hotelIdentifier && fallbackHotelId) {
    payload.hotelIdentifier = fallbackHotelId
  }

  if (!payload.hotelIdentifier) {
    return NextResponse.json({ error: 'Thiếu mã định danh khách sạn (hotelIdentifier)' }, { status: 400 })
  }

  if (!payload.channelBookingId) {
    return NextResponse.json({ error: 'Thiếu mã đơn hàng sàn (channelBookingId)' }, { status: 400 })
  }

  try {
    const result = await processOtaInboundWebhook(channel, payload, {
      rawBody,
      signatureHeader,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: result.action === 'BOOKING_CANCEL' ? 'Đã hủy đơn thành công' : 'Đã xử lý đơn OTA thành công',
    })
  } catch (err: any) {
    console.error(`[OTA Webhook ${channel}] Processing error:`, err)
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi xử lý webhook từ sàn OTA' },
      { status: 400 }
    )
  }
}
