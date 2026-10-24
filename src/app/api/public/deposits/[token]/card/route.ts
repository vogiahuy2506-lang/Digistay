import { NextRequest, NextResponse } from 'next/server'
import { readDepositToken } from '@/lib/payments/deposit-link'
import { DepositError, startCardDeposit } from '@/lib/payments/guest-deposit'
import { SepayError } from '@/lib/payments/sepay'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

/**
 * POST /api/public/deposits/[token]/card — a guest pays their deposit by
 * card (guest-deposit.ts, startCardDeposit): the signed form for SePay's
 * card page. Public: the token is the credential (deposit-link.ts). Only a
 * form; the money is recorded from SePay's IPN and API as always (sepay.ts).
 */
export async function POST(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const byIp = await hit(LIMITS.depositRetryIp, getClientIp(request.headers))
  if (!byIp.allowed) {
    return tooManyRequests('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)
  }

  const bookingId = readDepositToken((await props.params).token)
  if (!bookingId) return NextResponse.json({ success: false, error: 'Link đặt cọc không hợp lệ' }, { status: 404 })

  try {
    return NextResponse.json({ success: true, data: await startCardDeposit(bookingId) })
  } catch (error) {
    if (error instanceof DepositError || error instanceof SepayError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Card deposit error:', error)
    return NextResponse.json({ success: false, error: 'Chưa mở được trang thanh toán thẻ, vui lòng thử lại' }, { status: 500 })
  }
}
