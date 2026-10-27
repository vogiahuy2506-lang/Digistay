import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from '@/lib/validations'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'
import { InvitationAnsweredError, joinFromInvitation } from '@/lib/members/invitations'

const schema = z.object({
  name: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
  password: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT).max(200),
})

/** A free username from the email's name part: they sign in with the email anyway. */
async function freeUsername(email: string): Promise<string> {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user'
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}_${randomBytes(3).toString('hex')}`
    if (!(await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate
  }
  return `user_${randomBytes(8).toString('hex')}`
}

/**
 * POST /api/invitations/[token]/register { name, password }
 *
 * An invitee without an account, like UKNOW's: the link in the email proves
 * they own the address, so their account is made verified, joins the
 * workspace with the invitation's access, and the page signs them in with
 * the password they just chose. No workspace or trial of their own (they
 * can create one later). An email that already has an account signs in and
 * accepts instead.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  try {
    const byIp = await hit(LIMITS.registerIp, getClientIp(request.headers))
    if (!byIp.allowed) {
      return tooManyRequests('Bạn đã tạo quá nhiều tài khoản. Vui lòng thử lại sau.', byIp.retryAfterSec)
    }

    const validation = schema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { workspace: { select: { slug: true, name: true } } },
    })
    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Lời mời không tồn tại' }, { status: 404 })
    }
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Lời mời đã được xử lý', code: 'ANSWERED' }, { status: 400 })
    }
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ success: false, error: 'Lời mời đã hết hạn' }, { status: 410 })
    }

    const email = invitation.email.toLowerCase()
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Email này đã có tài khoản. Đăng nhập để chấp nhận lời mời.', code: 'HAS_ACCOUNT' },
        { status: 409 }
      )
    }

    const password = await bcrypt.hash(validation.data.password, 12)
    const username = await freeUsername(email)
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: validation.data.name, username, email, password, emailVerified: new Date() },
        select: { id: true, email: true, name: true },
      })
      await joinFromInvitation(tx, invitation, user)
    })

    return NextResponse.json({
      success: true,
      data: { email, workspaceSlug: invitation.workspace.slug, workspaceName: invitation.workspace.name },
      message: 'Chấp nhận lời mời thành công',
    })
  } catch (error) {
    if (error instanceof InvitationAnsweredError) {
      return NextResponse.json({ success: false, error: 'Lời mời đã được xử lý', code: 'ANSWERED' }, { status: 400 })
    }
    console.error('Register from invitation error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi chấp nhận lời mời' }, { status: 500 })
  }
}
