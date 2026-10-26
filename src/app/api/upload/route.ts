import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getWorkspaceRole, requireSession, WorkspaceRoles } from '@/lib/auth/rbac'
import { uploadImage, UploadError } from '@/lib/cloudinary'
import { parseImageDataUrl } from '@/lib/media/upload-input'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'
import { lockedResponse } from '@/lib/billing/guard'

/**
 * POST /api/upload { base64, propertyId? | workspaceId? } — store one photo
 * (src/lib/cloudinary) and answer its URL; the caller then saves that URL
 * where it belongs (a property or room photo, a dish, the logo), through that
 * thing's own API and its own permission check.
 *
 * For a property or a workspace: its owner, admins and managers (they are
 * the ones who edit photos, the menu and the logo). With neither: the user's
 * own folder (the logo of a workspace being created). A limited number per
 * hour: each upload uses the shared Cloudinary account's storage. The folder
 * is decided here — digistay/<workspace>/<property>, digistay/users/<user> —
 * never by the browser. Not for a locked workspace (src/lib/billing).
 */
export async function POST(request: NextRequest) {
  const session = await requireSession()
  if (!session.ok) return session.response
  const userId = session.session.user.id

  const body = await request.json().catch(() => null)
  const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : null
  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : null

  let folder: string
  if (propertyId) {
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { workspaceId: true } })
    const role = property ? await getWorkspaceRole(property.workspaceId, userId) : null
    if (!property || !role) return NextResponse.json({ success: false, error: 'Không tìm thấy khách sạn' }, { status: 404 })
    if (!(WorkspaceRoles.ADMINS_AND_MANAGERS as readonly string[]).includes(role)) return forbidden()
    const locked = await lockedResponse(property.workspaceId)
    if (locked) return locked
    folder = `digistay/${property.workspaceId}/${propertyId}`
  } else if (workspaceId) {
    const role = await getWorkspaceRole(workspaceId, userId)
    if (!role) return NextResponse.json({ success: false, error: 'Không tìm thấy workspace' }, { status: 404 })
    if (!(WorkspaceRoles.ADMINS_AND_MANAGERS as readonly string[]).includes(role)) return forbidden()
    const locked = await lockedResponse(workspaceId)
    if (locked) return locked
    folder = `digistay/${workspaceId}`
  } else {
    folder = `digistay/users/${userId}`
  }

  const image = parseImageDataUrl(body?.base64)
  if (!image.ok) return NextResponse.json({ success: false, error: image.error }, { status: 400 })

  const limit = await hit(LIMITS.uploadUser, userId)
  if (!limit.allowed) return tooManyRequests('Bạn đã tải lên quá nhiều ảnh. Vui lòng thử lại sau.', limit.retryAfterSec)

  try {
    const stored = await uploadImage(image.dataUrl, folder)
    return NextResponse.json({
      success: true,
      data: { url: stored.url, width: stored.width, height: stored.height, format: stored.format },
    })
  } catch (error) {
    if (error instanceof UploadError) {
      if (error.status === 503) console.error('[upload] CLOUDINARY_* is not set: no image storage')
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Upload API error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi tải lên hình ảnh' }, { status: 500 })
  }
}

const forbidden = () =>
  NextResponse.json({ success: false, error: 'Bạn không có quyền tải ảnh lên' }, { status: 403 })
