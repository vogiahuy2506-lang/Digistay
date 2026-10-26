import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { registerSchema } from '@/lib/validations'
import { generateSlug } from '@/lib/utils'
import { trialFields } from '@/lib/billing/subscription'
import { defaultWorkspaceName } from '@/lib/auth/default-workspace'
import { sendOtpEmail } from '@/lib/email'
import { consumeOtp, issueOtp, normalizeEmail, OtpCooldownError } from '@/lib/auth/otp'
import { requestLocale } from '@/lib/i18n/request-locale'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, isBlocked, recordFailure, tooManyRequests } from '@/lib/security/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, purpose } = body

    // Handle OTP verification for registration
    if (purpose === 'verify_otp') {
      const { otp } = body

      if (typeof email !== 'string' || typeof otp !== 'string' || !email || !otp) {
        return NextResponse.json(
          { success: false, error: 'Thiếu thông tin xác thực' },
          { status: 400 }
        )
      }

      const ip = getClientIp(request.headers)
      const byIp = await isBlocked(LIMITS.otpVerifyIp, ip)
      if (!byIp.allowed) {
        return tooManyRequests('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau.', byIp.retryAfterSec)
      }

      const normalizedEmail = normalizeEmail(email)
      const check = await consumeOtp('register', normalizedEmail, otp)
      if (check !== 'ok') await recordFailure(LIMITS.otpVerifyIp, ip)
      if (check === 'too_many_attempts') {
        return NextResponse.json(
          { success: false, error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.' },
          { status: 429 }
        )
      }
      if (check !== 'ok') {
        return NextResponse.json(
          { success: false, error: 'Mã OTP không hợp lệ hoặc đã hết hạn' },
          { status: 400 }
        )
      }

      // Verify the account that owns THIS email. The body's userId used to
      // be trusted here, so a code for one's own email could verify any
      // other account; it is ignored now.
      await prisma.user.updateMany({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' }, emailVerified: null },
        data: { emailVerified: new Date() },
      })

      // Send welcome email (non-blocking)
      const { sendWelcomeEmail } = await import('@/lib/email')
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      sendWelcomeEmail({
        recipientEmail: email,
        recipientName: undefined,
        loginUrl: `${baseUrl}/login`,
        locale: requestLocale(request),
      }).catch((err) => console.error('Welcome email failed:', err))

      return NextResponse.json({
        success: true,
        message: 'Xác thực email thành công! Bạn có thể đăng nhập ngay bây giờ.',
      })
    }

    // Validate input
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, username, email: userEmail, phone, password } = validation.data

    // Account creation per IP (each one also sends an email).
    const byIp = await hit(LIMITS.registerIp, getClientIp(request.headers))
    if (!byIp.allowed) {
      return tooManyRequests('Bạn đã tạo quá nhiều tài khoản. Vui lòng thử lại sau.', byIp.retryAfterSec)
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: 'Tên đăng nhập đã được sử dụng' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: userEmail },
    })

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'Email đã được sử dụng' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user (unverified)
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email: userEmail,
        phone,
        password: hashedPassword,
        emailVerified: null, // Not verified yet
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    })

    // Create default workspace for the user
    const workspaceSlug = generateSlug(`${username}-workspace`)
    
    await prisma.workspace.create({
      data: {
        name: defaultWorkspaceName(name),
        slug: workspaceSlug,
        ownerId: user.id,
        description: 'Không gian làm việc mặc định',
        subscription: { create: trialFields() },
      },
    })

    // Send OTP to email. The account already exists at this point, so a
    // cooldown (a code went out moments ago) must not turn into a 500: that
    // code is still valid and the user can request another later.
    let otp: string | null = null
    try {
      otp = await issueOtp('register', userEmail)
    } catch (err) {
      if (!(err instanceof OtpCooldownError)) throw err
    }

    if (otp) {
      await sendOtpEmail({
        recipientEmail: userEmail,
        recipientName: name,
        otp,
        purpose: 'register',
        locale: requestLocale(request),
      })
    }

    const isDev = process.env.NODE_ENV === 'development'

    return NextResponse.json({
      success: true,
      message: 'Đăng ký thành công! Vui lòng xác thực email để đăng nhập.',
      data: {
        userId: user.id,
        email: userEmail,
        requiresVerification: true,
      },
      ...(isDev && { otp }),
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi đăng ký' },
      { status: 500 }
    )
  }
}
