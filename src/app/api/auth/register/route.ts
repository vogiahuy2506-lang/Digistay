import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { registerSchema } from '@/lib/validations'
import { generateSlug } from '@/lib/utils'
import { redis } from '@/lib/db/redis'
import { sendOtpEmail } from '@/lib/email'

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function storeOTP(key: string, otp: string): Promise<boolean> {
  try {
    const store = await redis
    await store.set(`otp:register:${key}`, otp, 'EX', 300)
    return true
  } catch {
    console.log(`[OTP:dev] Would store OTP ${otp} for register:${key}`)
    return true
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, purpose } = body

    // Handle OTP verification for registration
    if (purpose === 'verify_otp') {
      const { userId, otp } = body

      if (!userId || !otp) {
        return NextResponse.json(
          { success: false, error: 'Thiếu thông tin xác thực' },
          { status: 400 }
        )
      }

      const store = redis
      let storedOTP: string | null = null

      if (store) {
        storedOTP = await store.get(`otp:register:${email}`)
      } else {
        // Dev fallback
        storedOTP = otp
      }

      if (storedOTP !== otp) {
        return NextResponse.json(
          { success: false, error: 'Mã OTP không hợp lệ hoặc đã hết hạn' },
          { status: 400 }
        )
      }

      // Mark email as verified
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: new Date() },
      })

      // Clean up OTP
      if (store) {
        await store.del(`otp:register:${email}`)
      }

      // Send welcome email (non-blocking)
      const { sendWelcomeEmail } = await import('@/lib/email')
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      sendWelcomeEmail({
        recipientEmail: email,
        recipientName: undefined,
        loginUrl: `${baseUrl}/login`,
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
        name: `${name}'s Workspace`,
        slug: workspaceSlug,
        ownerId: user.id,
        description: 'Không gian làm việc mặc định',
      },
    })

    // Send OTP to email
    const otp = generateOTP()
    await storeOTP(userEmail, otp)
    
    const emailResult = await sendOtpEmail({
      recipientEmail: userEmail,
      recipientName: name,
      otp,
      purpose: 'register',
    })

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
