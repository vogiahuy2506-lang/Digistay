import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { consumeResetToken } from '@/lib/auth/otp'
import { unlockAccount } from '@/lib/auth/credentials'
import { revokeSessions } from '@/lib/auth/session-revocation'
import { requestLocale } from '@/lib/i18n/request-locale'
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from '@/lib/validations'

/**
 * POST /api/auth/reset-password
 * body: { resetToken, newPassword }
 *
 * resetToken comes from POST /api/auth/otp/verify after a correct
 * forgot-password code; it is single-use and names the user. The previous
 * version took { email, newPassword } with no proof at all, so anyone who
 * knew an email could take over that account.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { resetToken, newPassword } = body as { resetToken?: unknown; newPassword?: unknown }

    if (typeof resetToken !== 'string' || !resetToken || typeof newPassword !== 'string' || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng xác thực mã OTP rồi nhập mật khẩu mới' },
        { status: 400 }
      )
    }

    // Validate before consuming the token, so a rejected password can be retried.
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ success: false, error: PASSWORD_TOO_SHORT }, { status: 400 })
    }

    const userId = await consumeResetToken(resetToken)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng làm lại.' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    const user = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: { email: true, name: true },
    })

    // Sign out every device (a stolen session must not survive the reset)
    // and lift a brute-force lock: the user just proved they own the email.
    await revokeSessions(userId)
    await unlockAccount(userId)

    // Notify user (non-blocking)
    const { sendPasswordChangedEmail } = await import('@/lib/email')
    sendPasswordChangedEmail({
      recipientEmail: user.email,
      recipientName: user.name || undefined,
      locale: requestLocale(request),
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
