import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/invitations/[token]
 *
 * Look up an invitation by its public token. Used by the public
 * `/invitations/[token]` page so the recipient can see who invited them
 * and which workspace / role they will join.
 *
 * Returns 404 if the token is unknown, 410 if it has expired, and 200
 * with the invitation data otherwise. Sensitive fields like the raw
 * token are never returned (we already have it in the URL).
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params
  try {
    const { token } = params
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token không hợp lệ' },
        { status: 400 }
      )
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            description: true,
            logo: true,
          },
        },
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Lời mời không tồn tại' },
        { status: 404 }
      )
    }

    const isExpired = invitation.expiresAt < new Date()

    // Auto-mark expired invitations so future lookups are cheap
    if (isExpired && invitation.status === 'PENDING') {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })
    }

    // Whether to offer "sign in" or "set a password" (POST ./register), and
    // which properties a limited invitation gives.
    const open = invitation.status === 'PENDING' && !isExpired
    const [account, properties] = open
      ? await Promise.all([
          prisma.user.findFirst({ where: { email: { equals: invitation.email, mode: 'insensitive' } }, select: { id: true } }),
          invitation.allProperties
            ? []
            : prisma.property.findMany({
                where: { workspaceId: invitation.workspaceId, id: { in: invitation.propertyIds } },
                select: { name: true },
                orderBy: { createdAt: 'asc' },
              }),
        ])
      : [null, []]

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        customPermissions: invitation.customPermissions,
        properties: invitation.allProperties ? null : properties.map((p) => p.name),
        hasAccount: !!account,
        status: isExpired && invitation.status === 'PENDING' ? 'EXPIRED' : invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        workspace: invitation.workspace,
        sender: invitation.sender,
      },
    })
  } catch (error) {
    console.error('Get invitation error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tải lời mời' },
      { status: 500 }
    )
  }
}
