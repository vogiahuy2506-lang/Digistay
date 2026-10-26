import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { lockedResponseForProperty } from '@/lib/billing/guard'
import { WALLET_PHONE_ERROR, bankAccountFields, walletAccountNumber } from '../fields'

const updateSchema = z.object({
  bankName: bankAccountFields.bankName.optional(),
  bankCode: bankAccountFields.bankCode.optional(),
  accountNumber: bankAccountFields.accountNumber.optional(),
  accountHolder: bankAccountFields.accountHolder.optional(),
  qrEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

async function userCanManageBankAccount(
  bankAccountId: string,
  userId: string
): Promise<
  | { ok: true; bankAccount: { propertyId: string; bankCode: string; accountNumber: string } }
  | { ok: false; status: number; error: string }
> {
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
    include: {
      property: {
        include: {
          workspace: {
            select: {
              ownerId: true,
              // ADMIN only, like creating an account and PayOS: the account
              // number decides where guests' QR transfers go.
              members: {
                where: { userId, role: 'ADMIN' },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  })

  if (!bankAccount) {
    return { ok: false, status: 404, error: 'Không tìm thấy tài khoản' }
  }

  const workspace = bankAccount.property.workspace
  const isOwner = workspace.ownerId === userId
  const isAdmin = workspace.members.length > 0

  if (!isOwner && !isAdmin) {
    return { ok: false, status: 403, error: 'Không có quyền chỉnh sửa tài khoản này' }
  }

  return {
    ok: true,
    bankAccount: { propertyId: bankAccount.propertyId, bankCode: bankAccount.bankCode, accountNumber: bankAccount.accountNumber },
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const authz = await userCanManageBankAccount(params.id, session.user.id)
    if (!authz.ok) {
      return NextResponse.json({ success: false, error: authz.error }, { status: authz.status })
    }
    const locked = await lockedResponseForProperty(authz.bankAccount.propertyId)
    if (locked) return locked

    const body = await request.json()
    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // A MoMo wallet stays named by a phone number, whichever field changed.
    const data = validation.data
    if (data.bankCode !== undefined || data.accountNumber !== undefined) {
      const bankCode = data.bankCode ?? authz.bankAccount.bankCode
      const number = walletAccountNumber(bankCode, data.accountNumber ?? authz.bankAccount.accountNumber)
      if (number === null) {
        return NextResponse.json({ success: false, error: WALLET_PHONE_ERROR }, { status: 400 })
      }
      if (data.accountNumber !== undefined) data.accountNumber = number
    }

    const updated = await prisma.bankAccount.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Đã cập nhật tài khoản',
    })
  } catch (error) {
    console.error('Update bank account error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi cập nhật tài khoản' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const authz = await userCanManageBankAccount(params.id, session.user.id)
    if (!authz.ok) {
      return NextResponse.json({ success: false, error: authz.error }, { status: authz.status })
    }
    const locked = await lockedResponseForProperty(authz.bankAccount.propertyId)
    if (locked) return locked

    await prisma.bankAccount.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true, message: 'Đã xóa tài khoản' })
  } catch (error) {
    console.error('Delete bank account error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi khi xóa tài khoản' },
      { status: 500 }
    )
  }
}
