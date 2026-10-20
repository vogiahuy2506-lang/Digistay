/**
 * Shared by the /api/users/me/two-factor routes: the logic lives in
 * src/lib/auth/two-factor.ts, these only map its errors to responses.
 */
import { NextResponse } from 'next/server'
import { TwoFactorError } from '@/lib/auth/two-factor'

export function unauthorized() {
  return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
}

export async function readCode(request: Request): Promise<{ code: string; password?: string }> {
  const body = await request.json().catch(() => ({}))
  return {
    code: typeof body?.code === 'string' ? body.code : '',
    password: typeof body?.password === 'string' ? body.password : undefined,
  }
}

export function errorResponse(error: unknown, context: string) {
  if (error instanceof TwoFactorError) {
    const headers: Record<string, string> = error.retryAfterSec ? { 'Retry-After': String(error.retryAfterSec) } : {}
    return NextResponse.json(
      { success: false, error: error.message, code: error.code, retryAfterSec: error.retryAfterSec },
      { status: error.status, headers }
    )
  }
  console.error(`[two-factor] ${context} failed:`, error)
  return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi, vui lòng thử lại' }, { status: 500 })
}
