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
      return NextResponse.json({ success: false, error: 'Không có quyền hủy hóa đơn' }, { status: 403 })
    }

    // Check if invoice can be cancelled
    if (invoice.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Hóa đơn đã được hủy' }, { status: 400 })
    }

    if (invoice.status === 'PUBLISHED') {
      return NextResponse.json({
        success: false,
        error:
          'Hóa đơn đã phát hành không huỷ ở đây được: cần lập thông báo sai sót (mẫu 04/SS-HĐĐT) trên cổng Mắt Bão.',
      }, { status: 400 })
    }
    // Being published, or a publish that may have reached Mắt Bão.
    if (invoice.status === 'PUBLISHING' || invoice.lookupCode) {
      return NextResponse.json({
        success: false,
        error: 'Lần phát hành trước chưa rõ kết quả (Mắt Bão có thể đã xuất). Hãy bấm phát hành lại trước.',
      }, { status: 409 })
    }

    // Conditional: a publish started meanwhile wins.
    const { count } = await prisma.invoice.updateMany({
      where: { id, status: { in: ['DRAFT', 'PENDING'] }, lookupCode: null },
      data: { status: 'CANCELLED' },
    })
    if (count === 0) {
      return NextResponse.json({ success: false, error: 'Hoá đơn vừa được phát hành, không huỷ được' }, { status: 409 })
    }
    const cancelledInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id } })

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
