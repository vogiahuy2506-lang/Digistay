import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

/**
 * POST /api/auth/reset-password
 * Reset password using phone number (after OTP verification)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, newPassword } = body

    if (!phone || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Missing phone or password' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Find user by phone
    const user = await prisma.user.findFirst({
      where: { phone },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found with this phone number' },
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

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}
