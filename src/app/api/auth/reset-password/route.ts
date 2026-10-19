import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

/**
 * POST /api/auth/reset-password
 * Reset password using email (after OTP verification)
 * body: { email, newPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, newPassword } = body

    if (!email || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập email và mật khẩu mới' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tài khoản với email này' },
        { status: 404 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    // Notify user (non-blocking)
    const { sendPasswordChangedEmail } = await import('@/lib/email')
    sendPasswordChangedEmail({
      recipientEmail: user.email,
      recipientName: user.name || undefined,
    }).catch((err) => console.error('Password changed email failed:', err))

    return NextResponse.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi đặt lại mật khẩu' },
      { status: 500 }
    )
  }
}
