import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { registerSchema } from '@/lib/validations'
import { getClientIp } from '@/lib/security/client-ip'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'
import { InvitationAnsweredError, joinFromInvitation } from '@/lib/members/invitations'

// The sign-up form's fields but the email: it is the invitation's.
const schema = registerSchema.omit({ email: true })

const USERNAME_TAKEN = 'Tên đăng nhập đã được sử dụng'

/**
 * POST /api/invitations/[token]/register { name, username, phone?, password }
 *
 * An invitee without an account signs up on the sign-up page
 * (/register?invite=<token>, RegisterForm) with the invited email. The link
 * in the email proves they own the address, so there is no code to type:
 * the account is made verified, joins the workspace with the invitation's
 * access, and the page signs them in. No workspace or trial of their own
 * (they can create one later). An email that already has an account signs
 * in and accepts instead.
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

    const { name, username, phone, password } = validation.data
    if (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
      return NextResponse.json({ success: false, error: USERNAME_TAKEN }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: name.trim(), username, email, phone: phone?.trim() || null, password: hashed, emailVerified: new Date() },
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
    // Taken meanwhile: the username, or the email by a sign-up at the same moment.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const fields = String(error.meta?.target ?? '')
      return fields.includes('username')
        ? NextResponse.json({ success: false, error: USERNAME_TAKEN }, { status: 400 })
        : NextResponse.json({ success: false, error: 'Email này đã có tài khoản. Đăng nhập để chấp nhận lời mời.', code: 'HAS_ACCOUNT' }, { status: 409 })
    }
    console.error('Register from invitation error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi chấp nhận lời mời' }, { status: 500 })
  }
}
