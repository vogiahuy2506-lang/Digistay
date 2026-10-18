import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { uploadImage } from '@/lib/cloudinary'

/**
 * PATCH /api/users/me/avatar
 * Upload and update user avatar
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { base64 } = body

    if (!base64) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp hình ảnh' },
        { status: 400 }
      )
    }

    // Validate base64 format
    const base64Regex = /^data:image\/\w+;base64,/
    const base64Data = base64Regex.test(base64) 
      ? base64 
      : `data:image/jpeg;base64,${base64}`

    // Upload to Cloudinary
    const result = await uploadImage(base64Data, { 
      folder: 'digistay/avatars',
      transformation: {
        width: 400,
        height: 400,
        crop: 'fill',
        gravity: 'face',
      }
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Upload failed' },
        { status: 500 }
      )
    }

    // Update user avatar
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: result.url },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Cập nhật avatar thành công',
    })
  } catch (error) {
    console.error('Avatar update error:', error)
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi cập nhật avatar' },
      { status: 500 }
    )
  }
}
