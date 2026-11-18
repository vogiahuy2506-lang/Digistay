import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkPropertyAccess, can } from '@/lib/auth/access'
import { remixWebsiteBlockWithAi } from '@/lib/ai/website-ai'

const schema = z.object({
  propertyId: z.string().min(1, 'Thiếu propertyId'),
  blockType: z.string().min(1),
  currentConfig: z.record(z.any()).default({}),
  prompt: z.string().trim().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ' }, { status: 400 })
    }

    const { propertyId, blockType, currentConfig, prompt } = parsed.data
    const granted = await checkPropertyAccess(session.user.id, propertyId, null)
    if (!granted.ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }
    if (!can(granted.access, 'website_manage', granted.property.id)) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { name: true },
    })

    const variants = await remixWebsiteBlockWithAi({
      blockType,
      currentConfig,
      propertyName: property?.name || 'Khách sạn',
      prompt,
    })

    return NextResponse.json({
      success: true,
      data: variants,
    })
  } catch (error) {
    console.error('[API remix-block] Error:', error)
    return NextResponse.json({ success: false, error: 'Không thể remix khối giao diện lúc này' }, { status: 500 })
  }
}
