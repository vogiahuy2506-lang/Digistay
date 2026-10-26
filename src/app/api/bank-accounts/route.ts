import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { lockedResponse } from '@/lib/billing/guard'
import { WALLET_PHONE_ERROR, bankAccountFields, walletAccountNumber } from './fields'

const bankAccountSchema = z
  .object({
    propertyId: z.string(),
    ...bankAccountFields,
    qrEnabled: z.boolean().default(true),
  })
  // A MoMo wallet is named by its phone number.
  .superRefine((v, ctx) => {
    if (walletAccountNumber(v.bankCode, v.accountNumber) === null) ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: WALLET_PHONE_ERROR })
  })
  .transform((v) => ({ ...v, accountNumber: walletAccountNumber(v.bankCode, v.accountNumber) ?? v.accountNumber }))

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    // Always the caller's workspaces; propertyId only narrows it.
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

    const bankAccounts = await prisma.bankAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: bankAccounts })
  } catch (error) {
    console.error('Get bank accounts error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi lấy danh sách tài khoản' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const validation = bankAccountSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message,
      }, { status: 400 })
    }

    const { propertyId, ...bankData } = validation.data

    // Check property access
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        workspace: {
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id, role: 'ADMIN' } } },
          ],
        },
      },
    })

    if (!property) {
      return NextResponse.json({ success: false, error: 'Không có quyền thêm tài khoản' }, { status: 403 })
    }

    const locked = await lockedResponse(property.workspaceId)
    if (locked) return locked

    const bankAccount = await prisma.bankAccount.create({
      data: {
        propertyId,
        ...bankData,
      },
    })

    return NextResponse.json({
      success: true,
      data: bankAccount,
      message: 'Thêm tài khoản ngân hàng thành công',
    })
  } catch (error) {
    console.error('Create bank account error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi thêm tài khoản' }, { status: 500 })
  }
}
