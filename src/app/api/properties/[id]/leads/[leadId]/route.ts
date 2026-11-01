import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { checkPropertyAccess } from '@/lib/auth/access'

const patchLeadSchema = z.object({
  name: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

/** PATCH — update lead notes or contact details. property_edit. */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string; leadId: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const access = await checkPropertyAccess(session.user.id, params.id, 'property_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const parsed = patchLeadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
    }
    const data = parsed.data

    const existing = await prisma.lead.findFirst({
      where: { id: params.leadId, propertyId: params.id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy khách hàng tiềm năng' }, { status: 404 })
    }

    const updated = await prisma.lead.update({
      where: { id: params.leadId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update lead error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật khách hàng tiềm năng' }, { status: 500 })
  }
}

/** DELETE — delete a lead. property_edit. */
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string; leadId: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }
    const access = await checkPropertyAccess(session.user.id, params.id, 'property_edit', 'Không tìm thấy cơ sở')
    if (!access.ok) return access.response

    const existing = await prisma.lead.findFirst({
      where: { id: params.leadId, propertyId: params.id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy khách hàng tiềm năng' }, { status: 404 })
    }

    await prisma.lead.delete({
      where: { id: params.leadId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete lead error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xoá khách hàng tiềm năng' }, { status: 500 })
  }
}

