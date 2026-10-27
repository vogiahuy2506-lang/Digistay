import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { InvoiceStatus, type Prisma } from '@prisma/client'
import { badParam, dayParam, enumParam, pageParams, paginationOf, searchParam } from '@/lib/api/list-params'
import { EinvoiceError } from '@/lib/einvoice/matbao'
import { generateInvoiceNumber, invoiceData, invoiceInputSchema } from '@/lib/einvoice/invoices'
import { invoiceLookupUrl } from '@/lib/einvoice/lookup-link'
import { isLocale } from '@/i18n/locales'
import type { VatCode } from '@/lib/einvoice/vat'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { accessibleProperties, checkAccess } from '@/lib/auth/access'
import { seesMoneyTotals } from '../payments/money-access'

// Amounts are computed on the server from the VAT-inclusive total and the
// property's VAT code (src/lib/einvoice/invoices.ts).
const createInvoiceSchema = z.object({ bookingId: z.string() }).and(invoiceInputSchema)

/**
 * GET /api/invoices — one page of the caller's invoices, newest first:
 * those of the properties where they may issue invoices (invoices_manage).
 * Filters (propertyId, status, q, startDate/endDate as yyyy-mm-dd) and the
 * search run in the database, so they cover every page. `stats` counts the
 * property's invoices whatever the filters (the cards above the list).
 * The amount issued (`stats.issuedAmount`) is null unless the caller may
 * see money totals (revenue_view: payments/money-access.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const propertyId = searchParams.get('propertyId')
    const status = enumParam(searchParams.get('status'), Object.values(InvoiceStatus))
    const from = dayParam(searchParams.get('startDate'), 'from')
    const to = dayParam(searchParams.get('endDate'), 'to')
    if (status === null) return badParam('Trạng thái không hợp lệ')
    if (from === null || to === null) return badParam('Ngày không hợp lệ (yyyy-mm-dd)')
    const q = searchParam(searchParams)
    const { page, limit, skip } = pageParams(searchParams)

    // Always the caller's properties; propertyId only narrows it (without
    // it, this once listed every hotel's invoices).
    const scope: Prisma.InvoiceWhereInput = {
      property: accessibleProperties(session.user.id, 'invoices_manage'),
      ...(propertyId && { propertyId }),
    }
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const })
    const where: Prisma.InvoiceWhereInput = {
      ...scope,
      ...(status && { status }),
      ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
      ...(q && {
        OR: [
          { invoiceNumber: contains(q) },
          { einvoiceNumber: contains(q) },
          { companyName: contains(q) },
          { customerName: contains(q) },
          { taxCode: contains(q) },
          { booking: { bookingCode: contains(q) } },
        ],
      }),
    }

    const [invoices, total, byStatus, issued, withTotals] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          booking: {
            select: {
              id: true,
              bookingCode: true,
              guestName: true,
              checkInDate: true,
              checkOutDate: true,
              locale: true,
              property: {
                select: {
                  id: true,
                  name: true,
                  subdomain: true,
                },
              },
            },
          },
          replacesInvoice: { select: { id: true, invoiceNumber: true, einvoiceNumber: true, invoiceSeries: true } },
          replacements: {
            where: { status: { not: 'CANCELLED' } },
            select: { id: true, invoiceNumber: true, einvoiceNumber: true, status: true },
          },
          adjustsInvoice: { select: { id: true, invoiceNumber: true, einvoiceNumber: true, invoiceSeries: true } },
          adjustments: {
            where: { status: { not: 'CANCELLED' } },
            select: { id: true, invoiceNumber: true, einvoiceNumber: true, status: true, totalAmount: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
      // Issued money: adjustments are signed, so they count as they should.
      prisma.invoice.aggregate({
        where: { property: accessibleProperties(session.user.id, 'revenue_view'), ...(propertyId && { propertyId }), status: 'PUBLISHED' },
        _sum: { totalAmount: true },
      }),
      seesMoneyTotals(session.user.id, propertyId),
    ])

    const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0
    return NextResponse.json({
      success: true,
      data: invoices.map((invoice) => ({
        ...invoice,
        // The buyer's page (task 39), in their language, for staff to copy and send.
        lookupUrl:
          invoice.status === 'PUBLISHED' || invoice.status === 'REPLACED'
            ? invoiceLookupUrl(invoice.booking.property.subdomain, invoice.id, isLocale(invoice.booking.locale) ? invoice.booking.locale : 'vi')
            : null,
      })),
      pagination: paginationOf(page, limit, total),
      stats: {
        total: byStatus.reduce((n, r) => n + r._count._all, 0),
        draft: count('DRAFT'),
        pending: count('PENDING'),
        published: count('PUBLISHED'),
        issuedAmount: withTotals ? (issued._sum.totalAmount ?? 0) : null,
      },
    })
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

    const { bookingId, ...input } = validation.data

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: {
          select: {
            workspaceId: true,
            einvoice: { select: { vatCode: true, verifiedAt: true } },
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn đặt phòng' }, { status: 404 })
    }

    // Check access (invoices_manage, like publishing). Guests are not let
    // in: a draft of theirs also stopped auto-issue for the booking, and no
    // guest-facing page calls this.
    const access = await checkAccess(session.user.id, booking.property.workspaceId, 'invoices_manage', {
      propertyId: booking.propertyId,
    })
    if (!access.ok) {
      return NextResponse.json({ success: false, error: 'Không có quyền tạo hóa đơn' }, { status: 403 })
    }
    const locked = await lockedResponseForProperty(booking.propertyId)
    if (locked) return locked

    const einvoice = booking.property.einvoice
    if (!einvoice?.verifiedAt) {
      return NextResponse.json(
        { success: false, error: 'Khách sạn chưa kết nối hoá đơn điện tử Mắt Bão (trang Hoá đơn → Kết nối)' },
        { status: 400 }
      )
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const data = await invoiceData(tx, booking, input, einvoice.vatCode as VatCode)
      return tx.invoice.create({
        data: {
          bookingId,
          propertyId: booking.propertyId,
          invoiceNumber: generateInvoiceNumber(),
          ...data,
          status: 'PENDING',
        },
      })
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
    if (error instanceof EinvoiceError) {
      return NextResponse.json({ success: false, error: error.message, ...error.extra }, { status: error.status })
    }
    console.error('Create invoice error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi tạo hóa đơn' }, { status: 500 })
  }
}
