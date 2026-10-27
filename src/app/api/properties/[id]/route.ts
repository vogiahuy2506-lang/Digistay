import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { updatePropertySchema } from '@/lib/validations'
import { invalidatePublicSite } from '@/lib/public-site/site'
import { mergeTranslations, translationsInput } from '@/lib/i18n/translations-input'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { reconcileOverageSoon } from '@/lib/billing/overage'
import { locationColumns, resolveLocation } from '@/lib/vn-admin/location'
import { guestsBooked, livePropertyForOwner, lockRoomTypes } from '@/lib/deletion/deletion'
import { purgeAt, sameName } from '@/lib/deletion/rules'
import { can, checkPropertyAccess } from '@/lib/auth/access'

/** The editable fields, and the description in English. */
const patchSchema = updatePropertySchema.extend({ translations: translationsInput(['description'], 2000) })

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    // Anyone who reaches the property; to others it does not exist.
    const access = await checkPropertyAccess(session.user.id, id, null, 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        websiteSettings: { select: { isPublished: true } },
        roomTypes: {
          where: { isActive: true },
          include: {
            images: {
              where: { isPrimary: true },
              take: 1,
            },
            amenities: {
              include: {
                amenity: true,
              },
            },
          },
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        images: {
          orderBy: [
            { isPrimary: 'desc' },
            { sortOrder: 'asc' },
          ],
        },
        pricing: {
          where: { isActive: true },
        },
      },
    })

    // Fetch policy separately
    const policy = await prisma.policy.findUnique({
      where: { propertyId: id },
    })

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy cơ sở' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { ...property, policy },
    })
  } catch (error) {
    console.error('Get property error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy thông tin cơ sở' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const access = await checkPropertyAccess(session.user.id, id, null, 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response
    if (!can(access.access, 'property_edit', id)) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa cơ sở này' },
        { status: 403 }
      )
    }
    const locked = await lockedResponseForProperty(id)
    if (locked) return locked

    const body = await request.json()
    
    // Validate input
    const validation = patchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { translations, provinceCode, wardCode, city, ...fields } = validation.data
    // One of the 34 provinces, and the ward one of its own (src/lib/vn-admin).
    const place = resolveLocation({ provinceCode, wardCode, city })
    if (!place.ok) {
      return NextResponse.json({ success: false, error: place.error }, { status: 400 })
    }
    const stored =
      (translations || place.location) &&
      (await prisma.property.findUnique({ where: { id }, select: { translations: true, city: true, provinceCode: true } }))
    const property = await prisma.property.update({
      where: { id },
      data: {
        ...fields,
        ...(place.location && locationColumns(place.location, stored)),
        ...(translations && { translations: mergeTranslations(stored?.translations, translations) }),
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Log activity
    invalidatePublicSite(id)

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        workspaceId: property.workspaceId,
        propertyId: property.id,
        action: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: property.id,
        changes: validation.data,
      },
    })

    return NextResponse.json({
      success: true,
      data: property,
      message: 'Cập nhật cơ sở thành công',
    })
  } catch (error) {
    console.error('Update property error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật cơ sở' },
      { status: 500 }
    )
  }
}

/**
 * DELETE { confirmName } — the workspace's owner deletes the property
 * (src/lib/deletion): hidden at once everywhere, restorable for 30 days
 * (POST ./restore), then purged. Refused while guests are staying or booked.
 * The workspace's lock does not stop it: deleting is one way back under the plan.
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    const { id } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }
    const userId = session.user.id

    const found = await livePropertyForOwner(id, userId)
    if (!found.ok) {
      return found.status === 404
        ? NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 404 })
        : NextResponse.json({ success: false, error: 'Chỉ chủ sở hữu workspace mới có thể xoá cơ sở' }, { status: 403 })
    }
    const property = found.row

    const body = await request.json().catch(() => null)
    if (!sameName(body?.confirmName, property.name)) {
      return NextResponse.json(
        { success: false, error: 'Tên cơ sở không khớp. Gõ đúng tên cơ sở để xác nhận xoá.', code: 'NAME_MISMATCH' },
        { status: 400 }
      )
    }

    const now = new Date()
    const outcome = await prisma.$transaction(async (tx) => {
      await lockRoomTypes(tx, { propertyId: id })
      const booked = await guestsBooked(tx, { propertyId: id }, now)
      if (booked > 0) return { booked }
      const { count } = await tx.property.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: now, deletedById: userId },
      })
      if (count === 0) return { gone: true as const }
      await tx.activityLog.create({
        data: {
          userId,
          workspaceId: property.workspaceId,
          propertyId: id,
          action: 'DELETE',
          entityType: 'PROPERTY',
          entityId: id,
          metadata: { name: property.name, subdomain: property.subdomain, purgeAt: purgeAt(now).toISOString() },
        },
      })
      return { deleted: true as const }
    })
    if ('booked' in outcome) {
      return NextResponse.json(
        {
          success: false,
          error: `Cơ sở còn ${outcome.booked} đơn đặt phòng của khách đang ở hoặc sắp đến. Huỷ hoặc chuyển các đơn này trước khi xoá.`,
          code: 'GUESTS_BOOKED',
          count: outcome.booked,
        },
        { status: 409 }
      )
    }
    if ('gone' in outcome) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cơ sở' }, { status: 404 })
    }
    invalidatePublicSite(id)
    reconcileOverageSoon(property.workspaceId)

    return NextResponse.json({
      success: true,
      data: { purgeAt: purgeAt(now).toISOString() },
      message: 'Đã xoá cơ sở. Bạn có thể khôi phục trong 30 ngày.',
    })
  } catch (error) {
    console.error('Delete property error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi xóa cơ sở' },
      { status: 500 }
    )
  }
}
