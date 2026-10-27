import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { EinvoiceError } from '@/lib/einvoice/matbao'
import { assertEditable, invoiceData, invoiceInputSchema } from '@/lib/einvoice/invoices'
import { isVatCode, type VatCode } from '@/lib/einvoice/vat'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { checkAccess, checkPropertyAccess } from '@/lib/auth/access'

// The whole buyer and amount, as when creating; amounts are recomputed on
// the server. Provider, template and series come from the property.
const updateInvoiceSchema = invoiceInputSchema

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params
  try {
    const { id } = params
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Another hotel's invoice answers 404, the same as a missing one. An
    // invoice is part of its booking's record: bookings_view.
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
    const access = await checkPropertyAccess(session.user.id, invoice.propertyId, 'bookings_view', 'Không tìm thấy hóa đơn')
    if (!access.ok) return access.response

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    console.error('Get invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy thông tin hóa đơn' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, props: RouteParams) {
  const params = await props.params
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
        booking: { select: { id: true, totalAmount: true } },
        property: { select: { workspaceId: true } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
    }

    // Check access: invoices_manage, like publishing
    const access = await checkAccess(session.user.id, invoice.property.workspaceId, 'invoices_manage', {
      propertyId: invoice.propertyId,
    })
    if (!access.ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền chỉnh sửa hóa đơn' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(invoice.propertyId)
    if (locked) return locked

    assertEditable(invoice)
    if (invoice.adjustsInvoiceId) {
      throw new EinvoiceError('Hoá đơn điều chỉnh không sửa được: huỷ bản nháp này rồi lập lại', 409)
    }

    const validation = updateInvoiceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const config = await prisma.propertyEinvoice.findUnique({
      where: { propertyId: invoice.propertyId },
      select: { vatCode: true },
    })
    const vatCode = isVatCode(invoice.vatCode) ? invoice.vatCode : config?.vatCode
    if (vatCode == null) {
      return NextResponse.json(
        { success: false, error: 'Khách sạn chưa kết nối hoá đơn điện tử Mắt Bão (trang Hoá đơn → Kết nối)' },
        { status: 400 }
      )
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const data = await invoiceData(tx, invoice.booking, validation.data, vatCode as VatCode, invoice.id)
      // Conditional: a publish started meanwhile wins.
      const updated = await tx.invoice.updateMany({
        where: { id, status: { in: ['DRAFT', 'PENDING'] }, lookupCode: null },
        data,
      })
      if (updated.count === 0) throw new EinvoiceError('Hoá đơn vừa được phát hành, không sửa được nữa', 409)
      return tx.invoice.findUniqueOrThrow({ where: { id } })
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
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Update invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi cập nhật hóa đơn' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, props: RouteParams) {
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
      include: { property: { select: { workspaceId: true } } },
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hóa đơn' }, { status: 404 })
    }

    // Check access: invoices_manage, like publishing
    const access = await checkAccess(session.user.id, invoice.property.workspaceId, 'invoices_manage', {
      propertyId: invoice.propertyId,
    })
    if (!access.ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền xóa hóa đơn' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(invoice.propertyId)
    if (locked) return locked

    assertEditable(invoice)

    const deleted = await prisma.invoice.deleteMany({
      where: { id, status: { in: ['DRAFT', 'PENDING', 'CANCELLED'] }, lookupCode: null },
    })
    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: 'Hoá đơn vừa được phát hành, không xoá được' }, { status: 409 })
    }

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
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('Delete invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa hóa đơn' }, { status: 500 })
  }
}
