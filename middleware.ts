import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only handle root path
  if (pathname !== '/') return NextResponse.next()

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Authenticated user -> redirect to first workspace
  // Unauthenticated user -> /login
  const url = request.nextUrl.clone()
  if (token) {
    // Fetch first workspace and redirect there
    try {
      const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`
      const res = await fetch(`${baseUrl}/api/workspaces`, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
        cache: 'no-store',
      })
      const data = await res.json()
      if (data?.success && data.data?.length > 0) {
        url.pathname = `/workspace/${data.data[0].slug}`
      } else {
        url.pathname = '/workspaces'
      }
    } catch {
      url.pathname = '/workspaces'
    }
  } else {
    url.pathname = '/login'
  }
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/'],
}
