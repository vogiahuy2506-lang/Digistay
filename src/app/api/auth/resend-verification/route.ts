import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/db/redis'
import { sendOtpEmail } from '@/lib/email'

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function storeOTP(key: string, otp: string): Promise<boolean> {
  try {
    const store = await redis
    await store.set(`otp:register:${key}`, otp, 'EX', 600) // 10 minutes for verification
    return true
  } catch {
    console.log(`[OTP:dev] Would store OTP ${otp} for register:${key}`)
    return true
  }
}

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

    const normalizedEmail = email.trim().toLowerCase()
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

    const otp = generateOTP()
    await storeOTP(normalizedEmail, otp)

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
