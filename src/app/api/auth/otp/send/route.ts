import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/db/redis'
import { sendOtpEmail } from '@/lib/email'
import { issueOtp, normalizeEmail, OtpCooldownError, OTP_PURPOSES, type OtpPurpose } from '@/lib/auth/otp'

// Codes sent per email per 15 minutes (verify attempts are limited in @/lib/auth/otp).
async function checkOTPAttempts(key: string): Promise<{ allowed: boolean; attempts: number }> {
  try {
    const store = redis

    const attemptKey = `otp_send_count:${key}`
    const attempts = await store.incr(attemptKey)

    if (attempts === 1) {
      await store.expire(attemptKey, 900)
    }

    if (attempts > 5) {
      return { allowed: false, attempts }
    }

    return { allowed: true, attempts }
  } catch {
    return { allowed: true, attempts: 0 }
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * POST /api/auth/otp/send
 * Send OTP to user's email
 * body: { email, purpose?: 'register' | 'forgot_password' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, purpose = 'register' } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập email' },
        { status: 400 }
      )
    }

    if (!OTP_PURPOSES.includes(purpose)) {
      return NextResponse.json(
        { success: false, error: 'Mục đích gửi mã không hợp lệ' },
        { status: 400 }
      )
    }

    const normalizedEmail = normalizeEmail(email)

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ' },
        { status: 400 }
      )
    }

    // Rate limiting
    const { allowed, attempts } = await checkOTPAttempts(normalizedEmail)
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau 15 phút.',
          cooldown: true,
        },
        { status: 429 }
      )
    }

    // For forgot_password: ensure user exists
    if (purpose === 'forgot_password') {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Email chưa được đăng ký' },
          { status: 404 }
        )
      }
    }

    // For register: ensure email not already used
    if (purpose === 'register') {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      if (user) {
        return NextResponse.json(
          { success: false, error: 'Email đã được sử dụng' },
          { status: 400 }
        )
      }
    }

    let otp: string
    try {
      otp = await issueOtp(purpose as OtpPurpose, normalizedEmail)
    } catch (err) {
      if (err instanceof OtpCooldownError) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng đợi 60 giây trước khi yêu cầu mã mới.', cooldown: true },
          { status: 429 }
        )
      }
      throw err
    }

    // Get user name if exists (for personalized email)
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    // Send OTP email
    const result = await sendOtpEmail({
      recipientEmail: normalizedEmail,
      recipientName: existingUser?.name || undefined,
      otp,
      purpose: purpose as OtpPurpose,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Không thể gửi email. Vui lòng thử lại.',
        },
        { status: 500 }
      )
    }

    const isDev = process.env.NODE_ENV === 'development'

    return NextResponse.json({
      success: true,
      message: 'Mã OTP đã được gửi đến email của bạn',
      ...(isDev && { otp }),
      remainingAttempts: 6 - attempts,
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi gửi OTP' },
      { status: 500 }
    )
  }
}
