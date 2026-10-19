import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT, updateProfileSchema } from '@/lib/validations'
import { sendPasswordChangedEmail } from '@/lib/email'
import { revokeSessions } from '@/lib/auth/session-revocation'
import { LIMITS } from '@/lib/security/limits'
import { clearLimit, isBlocked, recordFailure, tooManyRequests } from '@/lib/security/rate-limit'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        address: true,
        dateOfBirth: true,
        bio: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy người dùng' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy thông tin' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validation = updateProfileSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, phone, address, dateOfBirth, bio } = validation.data

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        phone,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        bio,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        address: true,
        dateOfBirth: true,
        bio: true,
        role: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Cập nhật thông tin thành công',
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật thông tin' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập đầy đủ thông tin' },
        { status: 400 }
      )
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ success: false, error: PASSWORD_TOO_SHORT }, { status: 400 })
    }

    // Wrong current passwords per user: a stolen session must not be able
    // to guess the password.
    const blocked = await isBlocked(LIMITS.passwordCheckUser, session.user.id)
    if (!blocked.allowed) {
      return tooManyRequests('Bạn đã nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau.', blocked.retryAfterSec)
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true, email: true, name: true },
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: 'Người dùng không tồn tại hoặc chưa đặt mật khẩu' },
        { status: 400 }
      )
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      await recordFailure(LIMITS.passwordCheckUser, session.user.id)
      return NextResponse.json(
        { success: false, error: 'Mật khẩu hiện tại không đúng' },
        { status: 400 }
      )
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    })
    await clearLimit(LIMITS.passwordCheckUser, session.user.id)

    // Sign out every device, this one included (decision 2026-10-19): the
    // client should send the user to /login.
    await revokeSessions(session.user.id)

    // Notify user via email (fire and forget)
    if (user.email) {
      sendPasswordChangedEmail({
        recipientEmail: user.email,
        recipientName: user.name || undefined,
      }).catch((err) => console.error('Failed to send password changed email:', err))
    }

    return NextResponse.json({
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
      signedOut: true,
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi đổi mật khẩu' },
      { status: 500 }
    )
  }
}
