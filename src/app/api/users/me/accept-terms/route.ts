import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 })
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { termsAcceptedAt: new Date() },
      select: { id: true, termsAcceptedAt: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Accept terms error:', error)
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
