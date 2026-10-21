import { NextRequest, NextResponse } from 'next/server'
import { contactSchema, queueContactRequest } from '@/lib/marketing/contact'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

/**
 * POST /api/public/contact — the contact form on Digistay's own site
 * (src/lib/marketing/contact.ts). Public; limited per IP, since each request
 * emails the Digistay team.
 */
export async function POST(request: NextRequest) {
  const byIp = await hit(LIMITS.contactIp, getClientIp(request.headers))
  if (!byIp.allowed) {
    return tooManyRequests('Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau.', byIp.retryAfterSec)
  }

  const parsed = contactSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Thông tin liên hệ chưa hợp lệ' }, { status: 400 })
  }

  try {
    if (!(await queueContactRequest(parsed.data))) {
      console.error('Contact request not sent: set CONTACT_EMAILS (or ALERT_EMAILS)')
      return NextResponse.json({ success: false, error: 'Chưa gửi được yêu cầu, vui lòng thử lại sau' }, { status: 503 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact request error:', error)
    return NextResponse.json({ success: false, error: 'Chưa gửi được yêu cầu, vui lòng thử lại sau' }, { status: 500 })
  }
}
