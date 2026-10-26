import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireWorkspaceRole, WorkspaceRoles } from '@/lib/auth/rbac'
import { lockedResponse } from '@/lib/billing/guard'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { parseSiteSnapshot, recordSiteVersion, snapshotSettingsData } from '@/lib/public-site/versions'

const bodySchema = z.object({ propertyId: z.string().min(1) })

/**
 * POST /api/website/versions/[versionId]/restore  { propertyId }
 * Puts a saved version of the website back: its blocks, look and SEO texts
 * (not whether the site is published, nor its domain: see
 * src/lib/public-site/versions.ts). In one transaction it first keeps the
 * site as it is now (BEFORE_RESTORE), so the restore can be undone, then
 * writes the version back and records the result (RESTORE). The public site's
 * cache is dropped, as after a save in the builder.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const { versionId } = await params

    const body = bodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) {
      return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    const property = await prisma.property.findFirst({
      where: {
        id: body.data.propertyId,
        workspace: {
          OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      select: { id: true, workspaceId: true },
    })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa' }, { status: 403 })
    }
    // Whoever may save the site may restore it (owners, ADMIN, MANAGER).
    const access = await requireWorkspaceRole(property.workspaceId, WorkspaceRoles.ADMINS_AND_MANAGERS)
    if (!access.ok) return access.response
    const locked = await lockedResponse(property.workspaceId)
    if (locked) return locked

    // Only this site's versions: another property's id is "not found".
    const version = await prisma.siteVersion.findFirst({ where: { id: versionId, propertyId: property.id } })
    if (!version) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy phiên bản' }, { status: 404 })
    }
    const snapshot = parseSiteSnapshot(version.snapshot)
    const userId = session.user.id
    const propertyId = property.id
    const now = Date.now()

    await prisma.$transaction(async (tx) => {
      // The site as it is, just before (so a restore can itself be undone).
      await recordSiteVersion(tx, { propertyId, userId, kind: 'BEFORE_RESTORE', at: new Date(now - 1) })
      await tx.websiteBlock.deleteMany({ where: { propertyId } })
      await tx.websiteBlock.createMany({
        data: snapshot.blocks.map((block, index) => ({
          propertyId,
          type: block.type,
          name: block.name,
          config: block.config as Prisma.InputJsonObject,
          isEnabled: block.isEnabled,
          sortOrder: index,
        })),
      })
      const settings = snapshotSettingsData(snapshot)
      await tx.websiteSettings.upsert({
        where: { propertyId },
        update: settings,
        create: { propertyId, ...settings },
      })
      await tx.activityLog.create({
        data: {
          userId,
          propertyId,
          action: 'UPDATE',
          entityType: 'WEBSITE',
          entityId: propertyId,
          changes: { restoredVersionId: version.id },
        },
      })
      await recordSiteVersion(tx, { propertyId, userId, kind: 'RESTORE', restoredFromId: version.id, at: new Date(now) })
    })
    invalidatePublicSite(propertyId)

    return NextResponse.json({ success: true, message: 'Đã khôi phục phiên bản' })
  } catch (error) {
    console.error('Restore website version error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi khôi phục phiên bản' }, { status: 500 })
  }
}
