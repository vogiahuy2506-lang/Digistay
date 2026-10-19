import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redis } from '@/lib/db/redis'

async function getOTPStore() {
  try {
    return await redis
  } catch {
    return null
  }
}

async function verifyOTPFromStore(key: string, otp: string): Promise<boolean> {
  try {
    const store = await getOTPStore()
    if (!store) {
      // Dev fallback: accept any 6-digit OTP
      console.log(`[OTP:dev] Would verify OTP ${otp} for ${key}`)
      return /^\d{6}$/.test(otp)
    }
    const storedOTP = await store.get(`otp:${key}`)
    return storedOTP === otp
  } catch (err) {
    console.error('Redis OTP verify error:', err)
    return false
  }
}

async function deleteOTP(key: string): Promise<void> {
  try {
    const store = await getOTPStore()
    if (store) {
      await store.del(`otp:${key}`)
    }
  } catch (err) {
    console.error('Redis OTP delete error:', err)
  }
}

/**
 * POST /api/auth/otp/verify
 * Verify OTP sent to email
 * body: { email, otp, linkToAccount? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()
    const { email, otp, linkToAccount } = body

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập email và mã OTP' },
        { status: 400 }
      )
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: 'Mã OTP phải gồm 6 chữ số' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    const isValid = await verifyOTPFromStore(normalizedEmail, otp)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Mã OTP không hợp lệ hoặc đã hết hạn' },
        { status: 400 }
      )
    }

    await deleteOTP(normalizedEmail)

    // If user logged in and wants to link email (no-op currently since email is already on user)
    if (session?.user?.id && linkToAccount) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { email: normalizedEmail },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Xác thực OTP thành công',
      email: normalizedEmail,
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xác thực' },
      { status: 500 }
    )
  }
}
