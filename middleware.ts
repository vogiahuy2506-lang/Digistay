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

  // Authenticated user -> /workspaces to pick a workspace
  // Unauthenticated user -> /login
  const url = request.nextUrl.clone()
  url.pathname = token ? '/workspaces' : '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/'],
}
