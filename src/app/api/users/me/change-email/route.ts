import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redis } from '@/lib/db/redis'
import { sendEmailChangeEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { LIMITS } from '@/lib/security/limits'
import { hit, isBlocked, recordFailure, tooManyRequests } from '@/lib/security/rate-limit'

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * POST /api/users/me/change-email
 * Request email change. Sends verification link to NEW email.
 * body: { newEmail, password }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { newEmail, password } = body

    if (!newEmail || !password) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập email mới và mật khẩu' },
        { status: 400 }
      )
    }

    const normalizedEmail = newEmail.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Email mới không hợp lệ' },
        { status: 400 }
      )
    }

    // Shares the wrong-password budget with password changes (per user).
    const blocked = await isBlocked(LIMITS.passwordCheckUser, session.user.id)
    if (!blocked.allowed) {
      return tooManyRequests('Bạn đã nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau.', blocked.retryAfterSec)
    }

    // Verify current password (re-auth for sensitive action)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, password: true, name: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy người dùng' },
        { status: 404 }
      )
    }

    const bcrypt = await import('bcryptjs')
    const isValid = await bcrypt.compare(password, user.password || '')
    if (!isValid) {
      await recordFailure(LIMITS.passwordCheckUser, session.user.id)
      return NextResponse.json(
        { success: false, error: 'Mật khẩu không đúng' },
        { status: 400 }
      )
    }

    // Check new email is not in use
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing && existing.id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Email này đã được sử dụng bởi tài khoản khác' },
        { status: 400 }
      )
    }

    if (user.email === normalizedEmail) {
      return NextResponse.json(
        { success: false, error: 'Email mới phải khác email hiện tại' },
        { status: 400 }
      )
    }

    // Each request mails the new address from Digistay's server.
    const sent = await hit(LIMITS.emailChangeSendUser, user.id)
    if (!sent.allowed) {
      return tooManyRequests('Bạn đã yêu cầu đổi email quá nhiều lần. Vui lòng thử lại sau.', sent.retryAfterSec)
    }

    // Generate token, store in Redis (24h expiry)
    const token = generateToken()
    const tokenKey = `email_change:${token}`
    const tokenData = JSON.stringify({
      userId: user.id,
      newEmail: normalizedEmail,
      currentEmail: user.email,
    })

    try {
      const store = await redis
      await store.set(tokenKey, tokenData, 'EX', 24 * 60 * 60)
    } catch (err) {
      console.error('Redis error:', err)
      return NextResponse.json(
        { success: false, error: 'Không thể lưu token, vui lòng thử lại' },
        { status: 500 }
      )
    }

    // Send verification email to NEW email
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const changeUrl = `${baseUrl}/api/users/me/change-email/confirm?token=${token}`

    await sendEmailChangeEmail({
      recipientEmail: normalizedEmail,
      recipientName: user.name || undefined,
      newEmail: normalizedEmail,
      changeUrl,
      expiresInHours: 24,
    })

    return NextResponse.json({
      success: true,
      message: `Email xác nhận đã được gửi đến ${normalizedEmail}. Vui lòng kiểm tra hộp thư.`,
    })
  } catch (error) {
    console.error('Change email request error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi' },
      { status: 500 }
    )
  }
}
