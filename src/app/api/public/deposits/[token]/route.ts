import { NextRequest, NextResponse } from 'next/server'
import { readDepositToken } from '@/lib/payments/deposit-link'
import { loadDepositView } from '@/lib/payments/deposit-view'
import { DepositError, payDepositAgain } from '@/lib/payments/guest-deposit'
import { PayosError } from '@/lib/payments/payos'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

/**
 * POST /api/public/deposits/[token] — a guest pays their deposit again
 * (src/lib/payments/guest-deposit.ts, payDepositAgain). Public: the token is
 * the credential (src/lib/payments/deposit-link.ts). A POST, not the page
 * load: mail scanners open links, and must not create PayOS links. It only
 * hands out a PayOS link; the money is recorded by the webhook as always.
 */
/**
 * GET /api/public/deposits/[token] — where the deposit stands, for the
 * deposit page to move on by itself once PayOS reports the money
 * (deposit-view.ts). Only the state: the page already shows the rest.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const byIp = await hit(LIMITS.depositStatusIp, getClientIp(request.headers))
  if (!byIp.allowed) return tooManyRequests('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)
  const view = await loadDepositView(null, (await props.params).token)
  if (!view) return NextResponse.json({ success: false, error: 'Link đặt cọc không hợp lệ' }, { status: 404 })
  return NextResponse.json({ success: true, data: { state: view.state } }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const byIp = await hit(LIMITS.depositRetryIp, getClientIp(request.headers))
  if (!byIp.allowed) {
    return tooManyRequests('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)
  }

  const bookingId = readDepositToken((await props.params).token)
  if (!bookingId) return NextResponse.json({ success: false, error: 'Link đặt cọc không hợp lệ' }, { status: 404 })

  try {
    const result = await payDepositAgain(bookingId)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof DepositError || error instanceof PayosError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Deposit retry error:', error)
    return NextResponse.json({ success: false, error: 'Không tạo được link đặt cọc, vui lòng thử lại' }, { status: 500 })
  }
}
