import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { createWorkspaceSchema, validationMessage } from '@/lib/validations'
import { generateSlug } from '@/lib/utils'
import { trialFields } from '@/lib/billing/subscription'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    // Get workspaces where user is owner or member
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            properties: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: workspaces,
    })
  } catch (error) {
    console.error('Get workspaces error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi lấy danh sách workspace' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validation = createWorkspaceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validationMessage(validation.error) },
        { status: 400 }
      )
    }

    const { name, description, domain, slug: customSlug, businessType, currency, timezone, logo } = validation.data

    // Generate slug from name or use custom slug
    const baseSlug = customSlug || generateSlug(name)
    let slug = baseSlug
    let counter = 1
    
    // Check if slug already exists and make it unique
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Prepare settings from additional fields
    const settings: Record<string, unknown> = {}
    if (businessType) settings.businessType = businessType
    if (currency) settings.currency = currency
    if (timezone) settings.timezone = timezone

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        description,
        domain: domain || null,
        logo: logo || null,
        ownerId: session.user.id,
        settings: Object.keys(settings).length > 0 ? (settings as any) : undefined,
        // Every new workspace starts with the trial (src/lib/billing).
        subscription: { create: trialFields() },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: workspace,
      message: 'Tạo workspace thành công',
    })
  } catch (error) {
    console.error('Create workspace error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tạo workspace' },
      { status: 500 }
    )
  }
}
