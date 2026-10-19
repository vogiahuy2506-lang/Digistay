import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/db/redis'
import { sendOtpEmail } from '@/lib/email'
import { issueOtp, normalizeEmail, OtpCooldownError, OTP_PURPOSES, type OtpPurpose } from '@/lib/auth/otp'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

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

    // Per IP: stops one client from mailing codes to many addresses.
    const byIp = await hit(LIMITS.otpSendIp, getClientIp(request.headers))
    if (!byIp.allowed) {
      return tooManyRequests('Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau.', byIp.retryAfterSec)
    }

    // Per email
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

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { name: true },
    })

    // For register: ensure email not already used
    if (purpose === 'register' && existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email đã được sử dụng' },
        { status: 400 }
      )
    }

    // For forgot_password an unknown email gets exactly the same answers as a
    // known one (including the 60 s cooldown below), so this endpoint cannot
    // be used to find out who has an account. It just sends no email.
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

    const isDev = process.env.NODE_ENV === 'development'
    const sentResponse = (devOtp?: string) =>
      NextResponse.json({
        success: true,
        message: 'Mã OTP đã được gửi đến email của bạn',
        ...(isDev && devOtp && { otp: devOtp }),
        remainingAttempts: 6 - attempts,
      })

    if (purpose === 'forgot_password' && !existingUser) {
      return sentResponse()
    }

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

    return sentResponse(otp)
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi gửi OTP' },
      { status: 500 }
    )
  }
}
