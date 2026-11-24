import { NextResponse, type NextRequest } from 'next/server'
import { auth, authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Clean logout endpoint that explicitly purges all NextAuth cookie variants
 * (both host-only and domain cookies, secure and non-secure).
 * This eliminates the Safari WebKit bfcache & asynchronous cookie jar race condition
 * where location.reload() or soft client-side signout preserves the active session.
 */
export async function GET(request: NextRequest) {
  return handleLogout(request)
}

export async function POST(request: NextRequest) {
  return handleLogout(request)
}

async function handleLogout(request: NextRequest) {
  // Call auth() to register usage with route policy and detect caller if needed
  try {
    await auth()
  } catch {
    // Ignore any revocation errors during signout
  }

  const cookieDomain = process.env.COOKIE_DOMAIN || (process.env.NODE_ENV === 'production' ? '.digistay.vn' : undefined)
  const targetUrl = new URL('/?signedOut=' + Date.now(), request.url)
  const response = NextResponse.redirect(targetUrl, 302)

  const cookieNames = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
  ]

  // Expire cookies host-only
  for (const name of cookieNames) {
    response.cookies.set(name, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    // Also expire with explicit domain if set (e.g. .digistay.vn)
    if (cookieDomain) {
      response.cookies.set(name, '', {
        path: '/',
        domain: cookieDomain,
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }
  }

  // Prevent Safari / intermediate proxies from caching this redirect or the resulting page in bfcache
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}
