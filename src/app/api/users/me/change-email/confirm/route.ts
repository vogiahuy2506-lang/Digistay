import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redis } from '@/lib/db/redis'

/**
 * GET /api/users/me/change-email/confirm?token=xxx
 * Confirm email change via token sent to new email.
 * Redirects to profile page with success/error message.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/profile?email_change=invalid', request.url))
  }

  try {
    const store = await redis
    const tokenKey = `email_change:${token}`
    const raw = await store.get(tokenKey)

    if (!raw) {
      return NextResponse.redirect(new URL('/profile?email_change=expired', request.url))
    }

    const { userId, newEmail } = JSON.parse(raw) as { userId: string; newEmail: string }

    // Verify user still exists and is the one requesting
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login?redirect=/profile', request.url))
    }

    if (session.user.id !== userId) {
      return NextResponse.redirect(new URL('/profile?email_change=unauthorized', request.url))
    }

    // Check if new email is still available
    const existing = await prisma.user.findUnique({ where: { email: newEmail } })
    if (existing && existing.id !== userId) {
      await store.del(tokenKey)
      return NextResponse.redirect(new URL('/profile?email_change=taken', request.url))
    }

    // Apply change
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerified: new Date(), // new email is auto-verified via this link
      },
    })

    // Cleanup
    await store.del(tokenKey)

    return NextResponse.redirect(new URL('/profile?email_change=success', request.url))
  } catch (error) {
    console.error('Confirm email change error:', error)
    return NextResponse.redirect(new URL('/profile?email_change=error', request.url))
  }
}
