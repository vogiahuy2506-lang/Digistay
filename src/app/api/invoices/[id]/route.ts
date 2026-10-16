import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const updateInvoiceSchema = z.object({
  companyName: z.string().min(2).optional(),
  companyAddress: z.string().min(5).optional(),
  taxCode: z.string().min(10).optional(),
  companyEmail: z.string().email().optional().nullable(),
  customerName: z.string().min(2).optional(),
  customerEmail: z.string().email().optional(),
  customerAddress: z.string().optional().nullable(),
  subtotal: z.number().positive().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  eInvoiceProvider: z.enum(['MISA', 'VNPT', 'VIETTAX', 'FAST', 'BASE']).optional().nullable(),
  invoicePattern: z.string().optional().nullable(),
  invoiceSeries: z.string().optional().nullable(),
})

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            bookingCode: true,
            guestName: true,
            checkInDate: true,
            checkOutDate: true,
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    console.error('Get invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy thông tin hóa đơn' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const session = await auth()
    const body = await request.json()

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
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa hóa đơn' }, { status: 403 })
    }

    // Check if invoice can be edited
    if (invoice.status === 'PUBLISHED') {
      return NextResponse.json({ success: false, error: 'Hóa đơn đã phát hành không thể chỉnh sửa' }, { status: 400 })
    }

    const validation = updateInvoiceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const updateData = validation.data

    // Recalculate totals if subtotal or taxRate changed
    let finalUpdateData: any = { ...updateData }
    if (updateData.subtotal !== undefined || updateData.taxRate !== undefined) {
      const newSubtotal = updateData.subtotal ?? invoice.subtotal
      const newTaxRate = updateData.taxRate ?? invoice.taxRate
      finalUpdateData.taxAmount = newSubtotal * newTaxRate
      finalUpdateData.totalAmount = newSubtotal + finalUpdateData.taxAmount
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: finalUpdateData,
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: invoice.propertyId,
        action: 'UPDATE',
        entityType: 'INVOICE',
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message: 'Cập nhật hóa đơn thành công',
    })
  } catch (error) {
    console.error('Update invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật hóa đơn' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
      return NextResponse.json({ success: false, error: 'Không có quyền xóa hóa đơn' }, { status: 403 })
    }

    // Check if invoice can be deleted
    if (invoice.status === 'PUBLISHED') {
      return NextResponse.json({ success: false, error: 'Hóa đơn đã phát hành không thể xóa' }, { status: 400 })
    }

    await prisma.invoice.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: invoice.propertyId,
        action: 'DELETE',
        entityType: 'INVOICE',
        entityId: id,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Xóa hóa đơn thành công',
    })
  } catch (error) {
    console.error('Delete invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa hóa đơn' }, { status: 500 })
  }
}
