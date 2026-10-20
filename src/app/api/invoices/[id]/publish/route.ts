import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const { id } = params
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            property: {
              select: {
                workspace: {
                  select: {
                    ownerId: true,
                    members: {
                      where: { userId: session.user.id },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
    }

    // Check access
    const workspace = invoice.booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.length > 0

    if (!isOwner && !isStaff) {
      return NextResponse.json({ success: false, error: 'Không có quyền phát hành hóa đơn' }, { status: 403 })
    }

    // Check if invoice can be published
    if (invoice.status === 'PUBLISHED') {
      return NextResponse.json({ success: false, error: 'Hóa đơn đã được phát hành' }, { status: 400 })
    }

    if (invoice.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Hóa đơn đã bị hủy' }, { status: 400 })
    }

    // Generate invoice code (simulated - in production, this would call the e-invoice provider API)
    const invoiceCode = `CODE${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    
    // Update invoice to published status
    const publishedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        invoiceCode,
        invoicePattern: '01GTKT',
        invoiceSeries: 'NC',
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: invoice.propertyId,
        action: 'PUBLISH',
        entityType: 'INVOICE',
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      },
    })

    return NextResponse.json({
      success: true,
      data: publishedInvoice,
      message: 'Phát hành hóa đơn thành công',
    })
  } catch (error) {
    console.error('Publish invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi phát hành hóa đơn' }, { status: 500 })
  }
}
