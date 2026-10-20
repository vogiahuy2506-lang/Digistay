import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const createInvoiceSchema = z.object({
  bookingId: z.string(),
  companyName: z.string().min(2),
  companyAddress: z.string().min(5),
  taxCode: z.string().min(10),
  companyEmail: z.string().email().optional(),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerAddress: z.string().optional(),
  subtotal: z.number().positive(),
  taxRate: z.number().min(0).max(1).default(0.1),
})

function generateInvoiceNumber(): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `INV${year}${month}${day}${random}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    
    const propertyId = searchParams.get('propertyId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Always the caller's workspaces; propertyId only narrows it (without
    // it, this once listed every hotel's invoices).
    const where: any = {
      property: {
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
      },
    }

    if (propertyId) {
      where.propertyId = propertyId
    }

    if (status) {
      where.status = status
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) }
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate) }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json({ success: true, data: invoices })
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách hóa đơn' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const validation = createInvoiceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const { bookingId, taxRate, ...invoiceData } = validation.data

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
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
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access
    const workspace = booking.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isStaff = workspace.members.length > 0
    const isGuest = booking.guestEmail === session.user.email

    if (!isOwner && !isStaff && !isGuest) {
      return NextResponse.json({ success: false, error: 'Không có quyền tạo hóa đơn' }, { status: 403 })
    }

    const taxAmount = invoiceData.subtotal * taxRate
    const totalAmount = invoiceData.subtotal + taxAmount

    const invoice = await prisma.invoice.create({
      data: {
        bookingId,
        propertyId: booking.propertyId,
        invoiceNumber: generateInvoiceNumber(),
        ...invoiceData,
        taxRate,
        taxAmount,
        totalAmount,
        status: 'PENDING',
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        propertyId: booking.propertyId,
        action: 'CREATE',
        entityType: 'INVOICE',
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      },
    })

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Tạo hóa đơn thành công',
    })
  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo hóa đơn' }, { status: 500 })
  }
}
