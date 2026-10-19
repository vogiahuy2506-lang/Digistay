import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { consumeOtp, issueResetToken, normalizeEmail } from '@/lib/auth/otp'

/**
 * POST /api/auth/otp/verify
 * Verifies a forgot-password code. body: { email, otp }
 *
 * On success returns a single-use `resetToken` that
 * POST /api/auth/reset-password requires. Signup codes are verified by
 * POST /api/auth/register ({ purpose: 'verify_otp' }) and cannot be used
 * here: codes are bound to their purpose.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { email, otp } = body as { email?: unknown; otp?: unknown }

    if (typeof email !== 'string' || typeof otp !== 'string' || !email || !otp) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập email và mã OTP' },
        { status: 400 }
      )
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: 'Mã OTP phải gồm 6 chữ số' },
        { status: 400 }
      )
    }

    const normalizedEmail = normalizeEmail(email)
    const check = await consumeOtp('forgot_password', normalizedEmail, otp)
    if (check === 'too_many_attempts') {
      return NextResponse.json(
        { success: false, error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.' },
        { status: 429 }
      )
    }

    const user =
      check === 'ok'
        ? await prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
            select: { id: true },
          })
        : null
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Mã OTP không hợp lệ hoặc đã hết hạn' },
        { status: 400 }
      )
    }

    const resetToken = await issueResetToken(user.id)
    return NextResponse.json({
      success: true,
      message: 'Xác thực OTP thành công',
      email: normalizedEmail,
      resetToken,
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xác thực' },
      { status: 500 }
    )
  }
}
