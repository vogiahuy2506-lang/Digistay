import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/db/redis'
import { sendOtpEmail } from '@/lib/email'

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function getOTPStore() {
  try {
    return await redis
  } catch {
    return null
  }
}

async function storeOTP(key: string, otp: string): Promise<boolean> {
  try {
    const store = await getOTPStore()
    if (!store) {
      console.log(`[OTP:dev] Would store OTP ${otp} for ${key}`)
      return true
    }
    await store.set(`otp:${key}`, otp, 'EX', 300)
    return true
  } catch (err) {
    console.error('Redis OTP store error:', err)
    return false
  }
}

async function checkOTPAttempts(key: string): Promise<{ allowed: boolean; attempts: number }> {
  try {
    const store = await getOTPStore()
    if (!store) return { allowed: true, attempts: 0 }

    const attemptKey = `otp_attempts:${key}`
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
 * body: { email, purpose?: 'register' | 'forgot_password' | 'login' }
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

    const normalizedEmail = email.trim().toLowerCase()

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

    const otp = generateOTP()
    const stored = await storeOTP(normalizedEmail, otp)
    if (!stored) {
      return NextResponse.json(
        { success: false, error: 'Không thể lưu mã OTP' },
        { status: 500 }
      )
    }

    // Get user name if exists (for personalized email)
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    // Send OTP email
    const result = await sendOtpEmail({
      recipientEmail: normalizedEmail,
      recipientName: existingUser?.name || undefined,
      otp,
      purpose: purpose as 'register' | 'forgot_password' | 'login',
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
    console.log(`[OTP] Sent to ${normalizedEmail}: ${otp}`)

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
