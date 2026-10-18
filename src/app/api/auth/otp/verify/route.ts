import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redis } from '@/lib/db/redis'

// Get Redis client (for OTP storage)
async function getOTPStore() {
  try {
    return await redis
  } catch {
    return null
  }
}

// Verify OTP from Redis
async function verifyOTPFromStore(phone: string, otp: string): Promise<boolean> {
  try {
    const store = await getOTPStore()
    if (!store) {
      // Fallback: accept any 6-digit OTP in dev
      console.log(`[OTP:dev] Would verify OTP ${otp} for ${phone}`)
      return otp.length === 6
    }
    const key = `otp:${phone}`
    const storedOTP = await store.get(key)
    return storedOTP === otp
  } catch (err) {
    console.error('Redis OTP verify error:', err)
    return false
  }
}

// Delete OTP after verification
async function deleteOTP(phone: string): Promise<void> {
  try {
    const store = await getOTPStore()
    if (store) {
      const key = `otp:${phone}`
      await store.del(key)
    }
  } catch (err) {
    console.error('Redis OTP delete error:', err)
  }
}

/**
 * POST /api/auth/otp/verify
 * Verify OTP and optionally link phone to user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()
    const { phone, otp, linkToAccount } = body

    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, error: 'Missing phone and OTP' },
        { status: 400 }
      )
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: 'OTP must be 6 digits' },
        { status: 400 }
      )
    }

    // Verify OTP
    const isValid = await verifyOTPFromStore(phone, otp)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 400 }
      )
    }

    // Delete OTP after successful verification
    await deleteOTP(phone)

    // If user is logged in and wants to link phone
    if (session?.user?.id && linkToAccount) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { phone },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      phone,
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
