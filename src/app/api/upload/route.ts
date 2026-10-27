import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/rbac'
import { can, checkAccess, checkPropertyAccess } from '@/lib/auth/access'
import type { Permission } from '@/lib/auth/permissions'
import { uploadImage, UploadError } from '@/lib/cloudinary'
import { parseImageDataUrl } from '@/lib/media/upload-input'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'
import { lockedResponse, lockedResponseForProperty } from '@/lib/billing/guard'

/**
 * POST /api/upload { base64, propertyId? | workspaceId? } — store one photo
 * (src/lib/cloudinary) and answer its URL; the caller then saves that URL
 * where it belongs (a property or room photo, a dish, the logo), through that
 * thing's own API and its own permission check.
 *
 * For a property: who edits something with photos there (PROPERTY_UPLOADERS:
 * the property, room types, the menu, the site). For a workspace: who edits
 * its settings (the logo). With neither: the user's own folder (the logo of
 * a workspace being created). A limited number per
 * hour: each upload uses the shared Cloudinary account's storage. The folder
 * is decided here — digistay/<workspace>/<property>, digistay/users/<user> —
 * never by the browser. Not for a locked workspace (src/lib/billing).
 */
/** Any one of these on the property lets the caller upload its photos. */
const PROPERTY_UPLOADERS: Permission[] = ['property_edit', 'room_types_manage', 'services_manage', 'website_manage']

export async function POST(request: NextRequest) {
  const session = await requireSession()
  if (!session.ok) return session.response
  const userId = session.session.user.id

  const body = await request.json().catch(() => null)
  const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : null
  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : null

  let folder: string
  if (propertyId) {
    const granted = await checkPropertyAccess(userId, propertyId, null, 'Không tìm thấy khách sạn')
    if (!granted.ok) return granted.response
    if (!PROPERTY_UPLOADERS.some((permission) => can(granted.access, permission, propertyId))) return forbidden()
    const locked = await lockedResponseForProperty(propertyId)
    if (locked) return locked
    folder = `digistay/${granted.property.workspaceId}/${propertyId}`
  } else if (workspaceId) {
    const granted = await checkAccess(userId, workspaceId, null, { notFound: 'Không tìm thấy workspace' })
    if (!granted.ok) return granted.response
    if (!can(granted.access, 'workspace_settings')) return forbidden()
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
