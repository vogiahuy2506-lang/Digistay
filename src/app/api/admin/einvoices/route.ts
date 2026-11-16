import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/admin/guard'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const granted = await requirePlatformAdmin()
  if (!granted.ok) return granted.response

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'all'
  const search = (url.searchParams.get('q') || '').trim()
  const dateFrom = url.searchParams.get('dateFrom')
  const dateTo = url.searchParams.get('dateTo')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  const where: Prisma.SubscriptionInvoiceWhereInput = {}

  if (status === 'stuck') {
    // Invoices that are stuck (PENDING or FAILED without next attempt or attempt >= 3)
    where.OR = [
      { status: 'FAILED' },
      { status: 'PENDING', createdAt: { lte: new Date(Date.now() - 30 * 60 * 1000) } },
      { status: 'ISSUING', nextAttemptAt: { lte: new Date() } },
    ]
  } else if (status === 'pending') {
    where.status = { in: ['PENDING', 'ISSUING'] }
  } else if (status === 'issued') {
    where.status = 'ISSUED'
  } else if (status === 'failed') {
    where.status = 'FAILED'
  }

  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) {
      const dTo = new Date(dateTo)
      dTo.setDate(dTo.getDate() + 1)
      where.createdAt.lt = dTo
    }
  }

  if (search) {
    where.OR = [
      { lookupCode: { contains: search, mode: 'insensitive' } },
      { einvoiceNumber: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { taxCode: { contains: search, mode: 'insensitive' } },
      { buyerName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { idNumber: { contains: search, mode: 'insensitive' } },
      { payment: { orderCode: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [invoices, total, stats] = await Promise.all([
    prisma.subscriptionInvoice.findMany({
      where,
      include: {
        payment: {
          select: {
            id: true,
            orderCode: true,
            plan: true,
            billing: true,
            amount: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.subscriptionInvoice.count({ where }),
    prisma.subscriptionInvoice.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ])

  // Get workspace names for display
  const workspaceIds = Array.from(new Set(invoices.map((i) => i.workspaceId)))
  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: workspaceIds } },
    select: { id: true, name: true, slug: true },
  })
  const workspaceMap = new Map(workspaces.map((w) => [w.id, w]))

  const statusCounts: Record<string, number> = {
    all: 0,
    PENDING: 0,
    ISSUED: 0,
    FAILED: 0,
    ISSUING: 0,
  }
  for (const s of stats) {
    statusCounts[s.status] = s._count.id
    statusCounts.all += s._count.id
  }

  const data = invoices.map((inv) => ({
    id: inv.id,
    lookupCode: inv.lookupCode,
    einvoiceNumber: inv.einvoiceNumber,
    invoiceCode: inv.invoiceCode,
    series: inv.series,
    templateCode: inv.templateCode,
    status: inv.status,
    buyerType: inv.buyerType,
    buyerName: inv.buyerName,
    idNumber: inv.idNumber,
    companyName: inv.companyName,
    taxCode: inv.taxCode,
    address: inv.address,
    email: inv.email,
    amount: inv.amount,
    vatCode: inv.vatCode,
    attempts: inv.attempts,
    error: inv.error,
    cqtStatus: inv.cqtStatus,
    cqtNote: inv.cqtNote,
    emailStatus: inv.emailStatus,
    emailAttempts: inv.emailAttempts,
    emailError: inv.emailError,
    emailedAt: inv.emailedAt,
    issuedAt: inv.issuedAt,
    createdAt: inv.createdAt,
    workspace: workspaceMap.get(inv.workspaceId) || { id: inv.workspaceId, name: '—', slug: '' },
    payment: inv.payment,
  }))

  return NextResponse.json({
    success: true,
    data: {
      einvoices: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      counts: statusCounts,
    },
  })
}
