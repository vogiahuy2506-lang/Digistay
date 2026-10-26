import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { SITE_VERSION_LIMIT } from '@/lib/public-site/versions'

/**
 * GET /api/website/versions?propertyId=xxx
 * The website's saved versions, newest first (src/lib/public-site/versions.ts),
 * for the builder's "Lịch sử phiên bản". Who may edit the site may see them.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const propertyId = new URL(request.url).searchParams.get('propertyId')
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Thiếu propertyId' }, { status: 400 })
    }

    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      select: { id: true, workspaceId: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }
    // The same people as the builder's save: owners, ADMIN and MANAGER.
    const access = await requireWorkspaceRole(property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
    if (!access.ok) return access.response

    const versions = await prisma.siteVersion.findMany({
      where: { propertyId: property.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SITE_VERSION_LIMIT,
      select: { id: true, kind: true, createdById: true, restoredFromId: true, updatedAt: true },
    })
    const authorIds = [...new Set(versions.flatMap((v) => (v.createdById ? [v.createdById] : [])))]
    const authors = new Map(
      (await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } })).map(
        (u) => [u.id, u.name || u.email]
      )
    )

    return NextResponse.json({
      success: true,
      data: {
        versions: versions.map((v) => ({
          id: v.id,
          kind: v.kind,
          // The last save it holds (saves merged into it included).
          savedAt: v.updatedAt,
          by: v.createdById ? (authors.get(v.createdById) ?? null) : null,
          restoredFromId: v.restoredFromId,
        })),
        limit: SITE_VERSION_LIMIT,
      },
    })
  } catch (error) {
    console.error('List website versions error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy lịch sử phiên bản' }, { status: 500 })
  }
}
