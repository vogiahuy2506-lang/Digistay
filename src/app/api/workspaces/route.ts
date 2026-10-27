import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaWithDeleted } from '@/lib/db'
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

    // Get workspaces where user is owner or member (locked ones too, see below)
    const userId = session.user.id
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
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
        // Only the caller's own membership: who else works there is for
        // the members page (members_manage).
        members: {
          where: { userId },
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

    // A member locked for being over the plan (src/lib/billing/overage.ts)
    // or by an admin still sees the workspace in their list, flagged, so the
    // page can say why they cannot open it (and offer to leave).
    const data = workspaces.map((workspace) => {
      const own = workspace.members[0]
      const isOwner = workspace.ownerId === userId
      return {
        ...workspace,
        role: isOwner ? 'ADMIN' : own?.role ?? 'USER',
        isOwner,
        planLocked: !isOwner && !!own?.planLockedAt,
        disabled: !isOwner && !!own?.disabledAt,
      }
    })

    return NextResponse.json({
      success: true,
      data,
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
    
    // Check if slug already exists and make it unique (a deleted workspace
    // keeps its slug until it is purged, src/lib/deletion)
    while (await prismaWithDeleted.workspace.findUnique({ where: { slug } })) {
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
