import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendOtpEmail } from '@/lib/email'
import { issueOtp, normalizeEmail, OtpCooldownError } from '@/lib/auth/otp'

/**
 * POST /api/auth/resend-verification
 * Resend verification OTP to user's email
 * body: { email }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập email' },
        { status: 400 }
      )
    }

    const normalizedEmail = normalizeEmail(email)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      // Don't reveal whether email exists
      return NextResponse.json({
        success: true,
        message: 'Nếu email tồn tại, mã xác thực đã được gửi.',
      })
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { success: false, error: 'Email đã được xác thực. Bạn có thể đăng nhập.' },
        { status: 400 }
      )
    }

    let otp: string
    try {
      otp = await issueOtp('register', normalizedEmail)
    } catch (err) {
      if (err instanceof OtpCooldownError) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng đợi 60 giây trước khi yêu cầu mã mới.', cooldown: true },
          { status: 429 }
        )
      }
      throw err
    }

    const emailResult = await sendOtpEmail({
      recipientEmail: normalizedEmail,
      recipientName: user.name || undefined,
      otp,
      purpose: 'register',
    })

    const isDev = process.env.NODE_ENV === 'development'

    return NextResponse.json({
      success: true,
      message: 'Mã xác thực đã được gửi lại đến email của bạn.',
      data: { userId: user.id, email: normalizedEmail },
      ...(isDev && { otp }),
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi' },
      { status: 500 }
    )
  }
}
