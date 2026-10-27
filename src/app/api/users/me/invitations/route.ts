import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * GET /api/users/me/invitations — the invitations to the signed-in user's
 * email still open, for /workspaces to answer (POST /api/invitations/[token]/
 * accept | decline; the token is theirs: it was sent to their address). Their
 * bell points here too (notifyInvitation in src/lib/notifications.ts).
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    // Invitations keep the email lowercased; an account's may have capitals.
    const invitations = await prisma.invitation.findMany({
      where: {
        email: { equals: session.user.email, mode: 'insensitive' },
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        token: true,
        role: true,
        customPermissions: true,
        allProperties: true,
        propertyIds: true,
        status: true,
        expiresAt: true,
        workspace: { select: { id: true, name: true, slug: true } },
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // The properties a limited invitation gives, by name.
    const limited = invitations.filter((i) => !i.allProperties).flatMap((i) => i.propertyIds)
    const names = new Map(
      limited.length
        ? (await prisma.property.findMany({ where: { id: { in: limited } }, select: { id: true, name: true } })).map((p) => [p.id, p.name])
        : []
    )

    const data = invitations.map(({ allProperties, propertyIds, ...invitation }) => ({
      ...invitation,
      properties: allProperties ? null : propertyIds.flatMap((id) => names.get(id) ?? []),
    }))

    return NextResponse.json({ success: true, data, count: data.length })
  } catch (error) {
    console.error('Get pending invitations error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách lời mời' },
      { status: 500 }
    )
  }
}
