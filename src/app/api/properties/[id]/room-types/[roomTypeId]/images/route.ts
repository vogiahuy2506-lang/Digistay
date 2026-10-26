import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getWorkspaceRole, requireSession } from '@/lib/auth/rbac'
import { isStoredImageUrl } from '@/lib/media/image-url'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { lockedResponse } from '@/lib/billing/guard'

/**
 * A room type's own photos (RoomTypeImage): the hotel site's room cards and
 * room page show them, the main one first (src/lib/public-site/site.ts).
 * Who edits room types edits their photos: the owner and admins; not while
 * the workspace is locked (src/lib/billing).
 */

type Props = { params: Promise<{ id: string; roomTypeId: string }> }

const MAX_ROOM_PHOTOS = 20

const ORDER = [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }, { createdAt: 'asc' as const }]

const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status })

async function access(propertyId: string, roomTypeId: string, userId: string) {
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, propertyId },
    select: { id: true, property: { select: { workspaceId: true } } },
  })
  const role = roomType ? await getWorkspaceRole(roomType.property.workspaceId, userId) : null
  if (!roomType || !role) return { ok: false as const, response: fail(404, 'Không tìm thấy loại phòng') }
  if (role !== 'ADMIN') return { ok: false as const, response: fail(403, 'Bạn không có quyền thực hiện hành động này') }
  const locked = await lockedResponse(roomType.property.workspaceId)
  if (locked) return { ok: false as const, response: locked }
  return { ok: true as const }
}

const list = (roomTypeId: string) => prisma.roomTypeImage.findMany({ where: { roomTypeId }, orderBy: ORDER })

const addSchema = z.object({
  url: z
    .string({ required_error: 'Vui lòng nhập URL hình ảnh' })
    .trim()
    .refine(isStoredImageUrl, 'Link ảnh phải bắt đầu bằng https://'),
  alt: z.string().trim().max(200, 'Mô tả ảnh tối đa 200 ký tự').optional(),
})

/** POST { url, alt? } — one more photo, last; the first one is the main photo. */
export async function POST(request: NextRequest, props: Props) {
  const { id, roomTypeId } = await props.params
  const session = await requireSession()
  if (!session.ok) return session.response
  const allowed = await access(id, roomTypeId, session.session.user.id)
  if (!allowed.ok) return allowed.response

  const parsed = addSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, parsed.error.errors[0].message)

  const stats = await prisma.roomTypeImage.aggregate({ where: { roomTypeId }, _count: true, _max: { sortOrder: true } })
  if (stats._count >= MAX_ROOM_PHOTOS) return fail(400, `Mỗi loại phòng có tối đa ${MAX_ROOM_PHOTOS} ảnh`)

  await prisma.roomTypeImage.create({
    data: {
      roomTypeId,
      url: parsed.data.url,
      alt: parsed.data.alt || null,
      isPrimary: stats._count === 0,
      sortOrder: (stats._max.sortOrder ?? -1) + 1,
    },
  })
  invalidatePublicSite(id)
  return NextResponse.json({ success: true, data: await list(roomTypeId) })
}

/** PATCH { imageId } — make that photo the main one. */
export async function PATCH(request: NextRequest, props: Props) {
  const { id, roomTypeId } = await props.params
  const session = await requireSession()
  if (!session.ok) return session.response
  const allowed = await access(id, roomTypeId, session.session.user.id)
  if (!allowed.ok) return allowed.response

  const body = await request.json().catch(() => null)
  const imageId = typeof body?.imageId === 'string' ? body.imageId : ''
  const image = imageId ? await prisma.roomTypeImage.findFirst({ where: { id: imageId, roomTypeId } }) : null
  if (!image) return fail(404, 'Không tìm thấy ảnh')

  await prisma.$transaction([
    prisma.roomTypeImage.updateMany({ where: { roomTypeId, isPrimary: true }, data: { isPrimary: false } }),
    prisma.roomTypeImage.update({ where: { id: image.id }, data: { isPrimary: true } }),
  ])
  invalidatePublicSite(id)
  return NextResponse.json({ success: true, data: await list(roomTypeId) })
}

/** DELETE ?imageId= — remove a photo; if it was the main one, the next becomes main. */
export async function DELETE(request: NextRequest, props: Props) {
  const { id, roomTypeId } = await props.params
  const session = await requireSession()
  if (!session.ok) return session.response
  const allowed = await access(id, roomTypeId, session.session.user.id)
  if (!allowed.ok) return allowed.response

  const imageId = request.nextUrl.searchParams.get('imageId') ?? ''
  const image = imageId ? await prisma.roomTypeImage.findFirst({ where: { id: imageId, roomTypeId } }) : null
  if (!image) return fail(404, 'Không tìm thấy ảnh')

  await prisma.$transaction(async (tx) => {
    await tx.roomTypeImage.delete({ where: { id: image.id } })
    if (image.isPrimary) {
      const next = await tx.roomTypeImage.findFirst({ where: { roomTypeId }, orderBy: ORDER })
      if (next) await tx.roomTypeImage.update({ where: { id: next.id }, data: { isPrimary: true } })
    }
  })
  invalidatePublicSite(id)
  return NextResponse.json({ success: true, data: await list(roomTypeId) })
}
