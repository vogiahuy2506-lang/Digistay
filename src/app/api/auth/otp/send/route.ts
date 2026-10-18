import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/db/redis'

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Get Redis client (for OTP storage)
async function getOTPStore() {
  try {
    return await redis
  } catch {
    return null
  }
}

// Store OTP in Redis
async function storeOTP(phone: string, otp: string): Promise<boolean> {
  try {
    const store = await getOTPStore()
    if (!store) {
      // Fallback: use in-memory (for dev without Redis)
      console.log(`[OTP:dev] Would store OTP ${otp} for ${phone}`)
      return true
    }
    const key = `otp:${phone}`
    // Store OTP with 5 minute expiry
    await store.set(key, otp, 'EX', 300)
    return true
  } catch (err) {
    console.error('Redis OTP store error:', err)
    return false
  }
}

// Track OTP attempts to prevent brute force
async function checkOTPAttempts(phone: string): Promise<{ allowed: boolean; attempts: number }> {
  try {
    const store = await getOTPStore()
    if (!store) return { allowed: true, attempts: 0 }
    
    const key = `otp_attempts:${phone}`
    const attempts = await store.incr(key)
    
    if (attempts === 1) {
      // Set expiry for attempt counter (15 minutes)
      await store.expire(key, 900)
    }
    
    // Block after 5 attempts
    if (attempts > 5) {
      return { allowed: false, attempts }
    }
    
    return { allowed: true, attempts }
  } catch {
    return { allowed: true, attempts: 0 }
  }
}

// Simple phone validation for Vietnamese numbers
function isValidPhone(phone: string): boolean {
  // Vietnamese phone numbers:
  // 03x, 05x, 07x, 08x, 09x (10 or 11 digits starting with 0)
  // +84 followed by 9 digits (11 or 12 digits with country code)
  const cleaned = phone.replace(/^\+84/, '')
  const phoneRegex = /^(0[3-9]\d{8,9})$/
  return phoneRegex.test(cleaned)
}

/**
 * POST /api/auth/otp/send
 * Send OTP to phone number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Missing phone number' },
        { status: 400 }
      )
    }

    // Validate phone format
    const cleanedPhone = phone.replace(/\D/g, '')
    if (!isValidPhone(cleanedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number' },
        { status: 400 }
      )
    }

    // Check rate limiting
    const { allowed, attempts } = await checkOTPAttempts(cleanedPhone)
    if (!allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many requests. Please try again in 15 minutes.',
          cooldown: true
        },
        { status: 429 }
      )
    }

    // Generate OTP
    const otp = generateOTP()

    // Store OTP
    const stored = await storeOTP(cleanedPhone, otp)
    if (!stored) {
      return NextResponse.json(
        { success: false, error: 'Failed to store OTP' },
        { status: 500 }
      )
    }

    // TODO: Integrate with SMS provider (VNPT, Viettel, etc.)
    // For now, we'll log it and return in response for development
    const smsProvider = process.env.SMS_PROVIDER
    
    if (smsProvider === 'vnptexpress') {
      // VNPT Express integration
      // const response = await fetch('https://api.vnpt.com.vn/sms', {...})
    } else if (smsProvider === 'viettel') {
      // Viettel SMS integration
      // const response = await fetch('https://api.viettelsms.vn/sms', {...})
    }

    // Development mode: return OTP in response
    const isDev = process.env.NODE_ENV === 'development'
    
    // Log OTP for development/testing
    console.log(`[OTP] Sent to ${cleanedPhone}: ${otp}`)

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      // Include OTP in dev mode for testing
      ...(isDev && { otp }),
      remainingAttempts: 6 - attempts,
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
