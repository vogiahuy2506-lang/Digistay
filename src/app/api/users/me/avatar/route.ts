import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/rbac'
import { uploadImage, UploadError } from '@/lib/cloudinary'
import { parseImageDataUrl } from '@/lib/media/upload-input'
import { LIMITS } from '@/lib/security/limits'
import { hit, tooManyRequests } from '@/lib/security/rate-limit'

/**
 * PATCH /api/users/me/avatar { base64 } — store the signed-in user's photo
 * (src/lib/cloudinary, folder digistay/users/<id>) and make it their avatar.
 * The profile page shrinks it to 512 px first (src/lib/media/upload-client.ts).
 */
export async function PATCH(request: Request) {
  const session = await requireSession()
  if (!session.ok) return session.response
  const userId = session.session.user.id

  const body = await request.json().catch(() => null)
  const image = parseImageDataUrl(body?.base64)
  if (!image.ok) return NextResponse.json({ success: false, error: image.error }, { status: 400 })

  const limit = await hit(LIMITS.uploadUser, userId)
  if (!limit.allowed) return tooManyRequests('Bạn đã tải lên quá nhiều ảnh. Vui lòng thử lại sau.', limit.retryAfterSec)

  try {
    const stored = await uploadImage(image.dataUrl, `digistay/users/${userId}`)
    const user = await prisma.user.update({
      where: { id: userId },
      data: { image: stored.url },
      select: { id: true, name: true, email: true, image: true, updatedAt: true },
    })
    return NextResponse.json({ success: true, data: user, message: 'Cập nhật avatar thành công' })
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Avatar update error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi cập nhật avatar' }, { status: 500 })
  }
}
