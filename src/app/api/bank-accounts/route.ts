import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const bankAccountSchema = z.object({
  propertyId: z.string(),
  bankName: z.string().min(2),
  bankCode: z.string().min(2),
  accountNumber: z.string().min(6),
  accountHolder: z.string().min(2),
  qrEnabled: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const where: any = {}
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const bankAccountId = searchParams.get('id')

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    if (!bankAccountId) {
      return NextResponse.json({ success: false, error: 'Thiếu ID tài khoản' }, { status: 400 })
    }

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      include: {
        property: {
          include: {
            workspace: {
              select: {
                ownerId: true,
                members: {
                  where: { userId: session.user.id, role: 'ADMIN' },
                },
              },
            },
          },
        },
      },
    })

    if (!bankAccount) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tài khoản' }, { status: 404 })
    }

    const workspace = bankAccount.property.workspace
    const isOwner = workspace.ownerId === session.user.id
    const isAdmin = workspace.members.length > 0

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Không có quyền xóa' }, { status: 403 })
    }

    await prisma.bankAccount.delete({ where: { id: bankAccountId } })

    return NextResponse.json({ success: true, message: 'Xóa tài khoản thành công' })
  } catch (error) {
    console.error('Delete bank account error:', error)
    return NextResponse.json({ success: false, error: 'Lỗi khi xóa tài khoản' }, { status: 500 })
  }
}
