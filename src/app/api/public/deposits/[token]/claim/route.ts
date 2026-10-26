import { NextRequest, NextResponse } from 'next/server'
import { sendAfterResponse } from '@/lib/email/outbox'
import { readDepositToken } from '@/lib/payments/deposit-link'
import { ManualDepositError, claimTransfer } from '@/lib/payments/manual-deposit'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

/**
 * POST /api/public/deposits/[token]/claim — "Tôi đã chuyển khoản": the guest
 * says they transferred their manual deposit (src/lib/payments/manual-deposit.ts).
 * Public: the token is the credential and names one booking
 * (deposit-link.ts). Once per booking: the deadline is pushed back once and
 * the front desk is told once; a repeat answers with the first claim. It
 * marks nothing paid: staff confirm when the money is in. Not stopped by a
 * locked workspace (src/lib/billing): the booking exists and the guest may
 * have paid, so the hotel must hear of it.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const byIp = await hit(LIMITS.depositClaimIp, getClientIp(request.headers))
  if (!byIp.allowed) return tooManyRequests('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', byIp.retryAfterSec)

  const bookingId = readDepositToken((await props.params).token)
  if (!bookingId) return NextResponse.json({ success: false, error: 'Link đặt cọc không hợp lệ' }, { status: 404 })

  try {
    const claim = await claimTransfer(bookingId)
    if (claim.emailIds.length > 0) sendAfterResponse(claim.emailIds)
    return NextResponse.json({
      success: true,
      data: { claimedAt: claim.claimedAt, deadline: claim.deadline, already: claim.already },
      message: 'Đã báo khách sạn. Khách sạn sẽ xác nhận khi nhận được tiền.',
    })
  } catch (error) {
    if (error instanceof ManualDepositError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Transfer claim error:', error)
    return NextResponse.json({ success: false, error: 'Chưa gửi được thông báo, vui lòng thử lại hoặc gọi khách sạn' }, { status: 500 })
  }
}
