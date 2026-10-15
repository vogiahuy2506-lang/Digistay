import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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
      return NextResponse.json({ success: false, error: 'Không có quyền hủy hóa đơn' }, { status: 403 })
    }

    // Check if invoice can be cancelled
    if (invoice.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Hóa đơn đã được hủy' }, { status: 400 })
    }

    if (invoice.status === 'PUBLISHED') {
      return NextResponse.json({ 
        success: false, 
        error: 'Hóa đơn đã phát hành không thể hủy. Vui lòng liên hệ cơ quan thuế để hủy hóa đơn điện tử.' 
      }, { status: 400 })
    }

    // Update invoice to cancelled status
    const cancelledInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: invoice.propertyId,
        action: 'CANCEL',
        entityType: 'INVOICE',
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      },
    })

    return NextResponse.json({
      success: true,
      data: cancelledInvoice,
      message: 'Hủy hóa đơn thành công',
    })
  } catch (error) {
    console.error('Cancel invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi hủy hóa đơn' }, { status: 500 })
  }
}
